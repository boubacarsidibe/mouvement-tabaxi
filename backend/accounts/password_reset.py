"""Mot de passe oublié (besoin B2) : lien par courriel, valable une heure, utilisable une fois."""

import logging
from datetime import timedelta
from urllib.parse import urlencode

from django.conf import settings
from django.db import transaction
from django.template.loader import render_to_string
from django.utils import timezone

from core.links import expired_link, invalid_link, used_link
from core.mail import EmailNotSent, send_email

from . import lockout
from .models import AccountLink, User

logger = logging.getLogger(__name__)

# Réponse identique qu'un compte existe ou non : on ne révèle pas qui est inscrit.
REQUEST_ACKNOWLEDGED = 'Si un compte correspond à cette adresse, un courriel vient de lui être envoyé.'
MAX_REQUESTS_PER_HOUR = 3


def reset_url(token):
    return f'{settings.FRONTEND_URL.rstrip("/")}/nouveau-mot-de-passe?{urlencode({"jeton": token})}'


def request_reset(email):
    """Envoie un lien de réinitialisation si un compte actif correspond. Ne dit jamais si c'est le cas."""
    user = User.objects.filter(email__iexact=email, is_active=True).first()
    if user is None:
        return
    recent = user.account_links.filter(
        purpose=AccountLink.Purpose.RESET, created_at__gt=timezone.now() - timedelta(hours=1)
    ).count()
    if recent >= MAX_REQUESTS_PER_HOUR:
        return
    try:
        with transaction.atomic():
            link, token = AccountLink.issue(user, AccountLink.Purpose.RESET)
            body = render_to_string(
                'accounts/emails/password_reset.txt', {'user': user, 'link': link, 'url': reset_url(token)}
            )
            send_email(to=user.email, subject='Choisir un nouveau mot de passe – Mouvement TABAXI', body=body)
    except EmailNotSent:
        # Déjà journalisé par core.mail ; la réponse reste la même pour ne rien révéler.
        logger.warning('Lien de réinitialisation non envoyé (compte %s)', user.pk)


def check_reset_link(token):
    link = AccountLink.find(token, AccountLink.Purpose.RESET)
    if link is None or not link.user.is_active:
        raise invalid_link()
    if link.is_used:
        raise used_link('Ce lien a déjà servi. Si besoin, demandez-en un nouveau depuis « Mot de passe oublié ».')
    if link.is_expired:
        raise expired_link(
            'Ce lien a expiré : il était valable une heure. Demandez-en un nouveau depuis « Mot de passe oublié ».'
        )
    return link


def reset_password(token, password):
    """Enregistre le nouveau mot de passe et consomme le lien. Les autres sessions sont fermées."""
    with transaction.atomic():
        link = check_reset_link(token)
        link = AccountLink.objects.select_for_update().select_related('user').get(pk=link.pk)
        if not link.mark_used():
            raise used_link('Ce lien a déjà servi. Si besoin, demandez-en un nouveau depuis « Mot de passe oublié ».')
        user = link.user
        user.set_password(password)
        user.save(update_fields=['password'])
    # La personne a prouvé qu'elle reçoit les courriels du compte : le blocage est levé.
    lockout.clear_failures(user.email)
    return user
