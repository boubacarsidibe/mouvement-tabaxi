import secrets

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from accounts.models import User
from members.models import Member
from territories.models import Territory

ACCOUNTS = (
    ('fondateur.demo@example.org', 'Fondateur', 'Démo', User.Role.FONDATEUR, None),
    ('coordonnateur.demo@example.org', 'Coordonnateur', 'Démo', User.Role.COORDONNATEUR, ('Dakar', Territory.Kind.REGION)),
    ('membre.demo@example.org', 'Membre', 'Démo', User.Role.MEMBRE, ('Pikine', Territory.Kind.COMMUNE)),
)


class Command(BaseCommand):
    help = 'Crée un compte de démonstration par rôle (développement seulement, DJANGO_DEBUG=1).'

    def add_arguments(self, parser):
        parser.add_argument(
            '--mot-de-passe', help='Mot de passe commun aux trois comptes (sinon un mot de passe aléatoire par compte).'
        )

    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError('Les comptes de démonstration ne se créent qu’en développement (DJANGO_DEBUG=1).')
        for email, first, last, role, place in ACCOUNTS:
            territory = Territory.objects.get(name=place[0], kind=place[1]) if place else None
            password = options['mot_de_passe'] or secrets.token_urlsafe(12)
            user = User.objects.filter(email__iexact=email).first() or User(email=email)
            user.first_name, user.last_name, user.role, user.territory = first, last, role, territory
            user.is_active = True
            user.set_password(password)
            user.save()
            Member.objects.get_or_create(user=user)
            self.stdout.write(f'{user.get_role_display():<16} {email}  {password}')
