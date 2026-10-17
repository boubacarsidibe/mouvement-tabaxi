"""Changer le statut d'un compte hors de la plateforme : réservé au développeur.

Sert au cas rare où le compte d'un membre fondateur doit être suspendu, radié ou rendu actif :
la plateforme ne le permet à personne, pas même à un autre fondateur. Le changement suit les
mêmes règles que dans la plateforme (motif obligatoire pour suspendre ou radier, historique,
journal des actions, sessions fermées), avec « Système » comme auteur.

À lancer avec les variables de la production, dont la vraie clé FIELD_ENCRYPTION_KEYS : le motif
et le journal sont chiffrés, et une autre clé les rendrait illisibles.
"""

import os

from django.core.management.base import BaseCommand, CommandError

from members.models import Member
from members.status import StatusChangeRefused, change_status


class Command(BaseCommand):
    help = (
        "Rend actif, suspend ou radie un compte (par exemple celui d'un membre fondateur, "
        'que la plateforme ne permet pas de révoquer). Réservé au développeur.'
    )

    def add_arguments(self, parser):
        parser.add_argument('email', help='Courriel du compte.')
        parser.add_argument('statut', choices=Member.Status.values, help='actif, suspendu ou radie.')
        parser.add_argument('--motif', default='', help='Obligatoire pour suspendre ou radier.')

    def handle(self, *args, email, statut, motif, **options):
        if os.environ.get('DATABASE_URL') and not os.environ.get('FIELD_ENCRYPTION_KEYS'):
            raise CommandError(
                'FIELD_ENCRYPTION_KEYS manque : sans la vraie clé de la production, le motif et le journal '
                'seraient chiffrés avec une autre clé et deviendraient illisibles.'
            )
        member = Member.objects.select_related('user').filter(user__email__iexact=email.strip()).first()
        if member is None:
            raise CommandError(f'Aucun dossier de membre pour {email}.')
        if statut != Member.Status.ACTIF and not motif.strip():
            raise CommandError('Indiquez le motif avec --motif "…" : il est obligatoire pour suspendre ou radier.')
        try:
            member = change_status(member, statut, by=None, reason=motif)
        except StatusChangeRefused as refusal:
            raise CommandError(refusal.detail) from refusal
        self.stdout.write(
            self.style.SUCCESS(f'{member.user.email} ({member.user.get_role_display()}) : {member.get_status_display()}.')
        )
