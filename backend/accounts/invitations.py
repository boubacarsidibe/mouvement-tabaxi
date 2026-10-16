"""Invitation au bureau exécutif : un fondateur invite un coordonnateur ou un fondateur.

Le compte est créé aussitôt, sans mot de passe utilisable ; la personne reçoit un lien
personnel (7 jours, une fois) pour choisir son mot de passe, puis arrive sur l'interface
du bureau. Si le courriel ne part pas, aucun compte n'est créé.
"""

from urllib.parse import urlencode

from django.conf import settings
from django.db import transaction
from django.template.loader import render_to_string

from audit.models import AuditEntry
from audit.services import person_name, record
from core.mail import send_email
from members.models import Member

from .models import InvitationLink, User
from .password_reset import LinkProblem

INVITATION_SUBJECT = 'Invitation au bureau exécutif du Mouvement TABAXI'
USED = 'Cette invitation a déjà servi. Connectez-vous avec votre courriel et votre mot de passe.'


def invitation_url(token):
    return f'{settings.FRONTEND_URL.rstrip("/")}/invitation?{urlencode({"jeton": token})}'


def invite(*, email, first_name, last_name, role, territory, invited_by):
    """Crée le compte et envoie l'invitation (EmailNotSent si le courriel ne part pas : rien n'est créé)."""
    with transaction.atomic():
        user = User.objects.create_user(
            email,
            None,  # mot de passe inutilisable tant que l'invitation n'est pas acceptée
            first_name=first_name,
            last_name=last_name,
            role=role,
            territory=territory,
        )
        link, token = InvitationLink.issue(user, invited_by)
        record(
            AuditEntry.Action.INVITATION_SENT,
            actor=invited_by,
            subject=person_name(user),
            email=user.email,
            role=user.role,
            role_label=user.get_role_display(),
            territory=territory.name if territory else '',
        )
        body = render_to_string(
            'accounts/emails/invitation.txt',
            {'user': user, 'link': link, 'url': invitation_url(token), 'invited_by': invited_by},
        )
        send_email(to=user.email, subject=INVITATION_SUBJECT, body=body)
    return user


def check_invitation(token):
    link = InvitationLink.find(token)
    if link is None or not link.user.is_active:
        raise LinkProblem('invalid_link', "Cette invitation n'est pas valide. Vérifiez que le lien est complet.", 404)
    if link.is_used or link.user.has_usable_password():
        raise LinkProblem('link_used', USED, 410)
    if link.is_expired:
        raise LinkProblem(
            'link_expired',
            'Cette invitation a expiré : elle était valable 7 jours. Demandez à un fondateur de vous inviter à nouveau.',
            410,
        )
    return link


def accept_invitation(token, password):
    """Enregistre le mot de passe choisi, consomme le lien et ouvre le dossier de membre (numéro, statut)."""
    with transaction.atomic():
        link = check_invitation(token)
        if not link.mark_used():
            raise LinkProblem('link_used', USED, 410)
        user = link.user
        user.set_password(password)
        user.save(update_fields=['password'])
        Member.objects.get_or_create(user=user)
    return user
