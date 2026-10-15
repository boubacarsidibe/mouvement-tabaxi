"""Invitation au bureau exécutif (besoin B3).

Un fondateur invite une personne comme coordonnateur ou fondateur. Le compte est créé
aussitôt, sans mot de passe utilisable ; la personne reçoit un lien personnel (7 jours,
une fois) pour choisir son mot de passe, puis arrive sur l'interface du bureau.
"""

from urllib.parse import urlencode

from django.conf import settings
from django.db import transaction
from django.template.loader import render_to_string

from core.links import expired_link, invalid_link, used_link
from core.mail import send_email
from members.models import Member

from .models import AccountLink, User

INVITATION_SUBJECT = 'Invitation au bureau exécutif du Mouvement TABAXI'


def invitation_url(token):
    return f'{settings.FRONTEND_URL.rstrip("/")}/invitation?{urlencode({"jeton": token})}'


def invite(*, email, first_name, last_name, role, territory, invited_by):
    """Crée le compte et envoie l'invitation. Si le courriel ne part pas, rien n'est créé (EmailNotSent)."""
    with transaction.atomic():
        user = User.objects.create_user(
            email,
            None,  # mot de passe inutilisable tant que l'invitation n'est pas acceptée
            first_name=first_name,
            last_name=last_name,
            role=role,
            territory=territory,
            # Les fondateurs gèrent aussi les territoires et les comptes dans l'administration.
            is_staff=role == User.Role.FONDATEUR,
            is_superuser=role == User.Role.FONDATEUR,
        )
        link, token = AccountLink.issue(user, AccountLink.Purpose.INVITATION)
        body = render_to_string(
            'accounts/emails/invitation.txt',
            {'user': user, 'link': link, 'url': invitation_url(token), 'invited_by': invited_by},
        )
        send_email(to=user.email, subject=INVITATION_SUBJECT, body=body)
    return user


def check_invitation(token):
    link = AccountLink.find(token, AccountLink.Purpose.INVITATION)
    if link is None or not link.user.is_active:
        raise invalid_link()
    if link.is_used or link.user.has_usable_password():
        raise used_link('Cette invitation a déjà servi. Connectez-vous avec votre courriel et votre mot de passe.')
    if link.is_expired:
        raise expired_link(
            'Cette invitation a expiré : elle était valable 7 jours. Demandez à un fondateur de vous inviter à nouveau.'
        )
    return link


def accept_invitation(token, password):
    """Enregistre le mot de passe choisi, consomme le lien et crée le dossier de membre (carte)."""
    with transaction.atomic():
        link = check_invitation(token)
        link = AccountLink.objects.select_for_update().select_related('user').get(pk=link.pk)
        if not link.mark_used():
            raise used_link('Cette invitation a déjà servi. Connectez-vous avec votre courriel et votre mot de passe.')
        user = link.user
        user.set_password(password)
        user.save(update_fields=['password'])
        Member.objects.get_or_create(user=user)
    return user
