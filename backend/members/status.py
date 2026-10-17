"""Changement de statut d'un membre : actif, suspendu ou radié.

Un seul point d'entrée, ``change_status``, pour que le statut, l'accès au compte et
l'historique ne se contredisent jamais :

- suspendu ou radié : le compte est désactivé (plus de connexion) et ses sessions sont fermées ;
- actif : le compte est réactivé ;
- chaque changement ajoute une ligne à l'historique, qui n'est jamais modifié ni effacé ;
- rien n'est supprimé : le dossier, le numéro et les données restent.
"""

from django.db import transaction

from accounts.models import User
from accounts.sessions import close_sessions
from audit.models import AuditEntry
from audit.services import person_name, record

from .models import Member, MemberStatusChange


class StatusChangeRefused(Exception):
    """Le changement est refusé ; le message dit pourquoi, en français."""

    def __init__(self, code, detail):
        self.code = code
        self.detail = detail
        super().__init__(detail)


FOUNDER_PROTECTED = (
    "Le compte d'un membre fondateur ne peut être ni suspendu ni radié depuis la plateforme. "
    "Si c'est vraiment nécessaire, le bureau le demande au développeur."
)
COORDINATOR_LIMIT = 'Un coordonnateur ne change que le statut des membres simples de sa zone.'


def can_change_status(actor, member):
    """Qui peut changer le statut de ce membre, déjà pris dans le périmètre de ``actor``.

    Un fondateur gère les membres simples et les coordonnateurs ; un coordonnateur, les membres
    simples de sa zone. Le compte d'un fondateur ne se suspend ni ne se radie depuis la
    plateforme, même par un autre fondateur : seul le développeur le fait, avec
    ``manage.py statut_compte``. Personne ne change son propre statut.
    """
    if member.user_id == actor.pk:
        return False
    role = member.user.role
    if role == User.Role.FONDATEUR:
        return False
    if actor.is_founder:
        return True
    return actor.is_bureau and role == User.Role.MEMBRE


def refusal_detail(member):
    """Message du refus (403) quand ``can_change_status`` répond non pour le compte d'un autre."""
    return FOUNDER_PROTECTED if member.user.role == User.Role.FONDATEUR else COORDINATOR_LIMIT


def change_status(member, new_status, *, by, reason=''):
    """Passe le membre au statut demandé. Lève ``StatusChangeRefused`` si c'est impossible.

    ``by`` est la personne qui agit ; ``None`` pour le développeur (``manage.py statut_compte``),
    noté « Système » au journal.
    """
    with transaction.atomic():
        member = Member.objects.select_for_update().select_related('user').get(pk=member.pk)
        if by is not None and member.user_id == by.pk:
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
        record(
            AuditEntry.Action.STATUS_CHANGED,
            actor=by,
            subject=person_name(member.user),
            number=member.number,
            from_status=previous,
            to_status=new_status,
            from_label=Member.Status(previous).label,
            to_label=Member.Status(new_status).label,
            reason=reason.strip(),
        )
        user = member.user
        user.is_active = new_status == Member.Status.ACTIF
        user.save(update_fields=['is_active'])
        if not user.is_active:
            close_sessions(user)
    return member
