"""Changement de statut d'un membre : actif, suspendu ou radié.

Un seul point d'entrée, ``change_status``, pour que le statut, l'accès au compte et
l'historique ne se contredisent jamais :

- suspendu ou radié : le compte est désactivé (plus de connexion) et ses sessions sont fermées ;
- actif : le compte est réactivé ;
- chaque changement ajoute une ligne à l'historique, qui n'est jamais modifié ni effacé ;
- rien n'est supprimé : le dossier, le numéro et les données restent.
"""

from django.db import transaction

from accounts.sessions import close_sessions

from .models import Member, MemberStatusChange


class StatusChangeRefused(Exception):
    """Le changement est refusé ; le message dit pourquoi, en français."""

    def __init__(self, code, detail):
        self.code = code
        self.detail = detail
        super().__init__(detail)


def change_status(member, new_status, *, by, reason=''):
    """Passe le membre au statut demandé. Lève ``StatusChangeRefused`` si c'est impossible."""
    with transaction.atomic():
        member = Member.objects.select_for_update().select_related('user').get(pk=member.pk)
        if member.user_id == by.pk:
            raise StatusChangeRefused('own_status', 'Vous ne pouvez pas changer votre propre statut.')
        if member.status == new_status:
            raise StatusChangeRefused(
                'same_status', f'Ce membre est déjà « {member.get_status_display()} » : rien à changer.'
            )
        previous = member.status
        MemberStatusChange.objects.create(
            member=member, from_status=previous, to_status=new_status, reason=reason.strip(), changed_by=by
        )
        member.status = new_status
        member.save(update_fields=['status', 'updated_at'])
        user = member.user
        user.is_active = new_status == Member.Status.ACTIF
        user.save(update_fields=['is_active'])
        if not user.is_active:
            close_sessions(user)
    return member
