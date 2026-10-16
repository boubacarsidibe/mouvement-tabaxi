"""Mot de passe oublié : lien par courriel, valable une heure, utilisable une fois."""

import logging
from datetime import timedelta
from urllib.parse import urlencode

from django.conf import settings
from django.db import transaction
from django.template.loader import render_to_string
from django.utils import timezone
from rest_framework.response import Response

from core.mail import EmailNotSent, send_email

from .models import PasswordResetLink, User

logger = logging.getLogger(__name__)

# Réponse identique qu'un compte existe ou non : on ne révèle pas qui est inscrit.
REQUEST_ACKNOWLEDGED = 'Si un compte correspond à cette adresse, un courriel vient de lui être envoyé.'
MAX_REQUESTS_PER_HOUR = 3
NEW_LINK_HINT = 'Demandez-en un nouveau depuis « Mot de passe oublié ».'


class LinkProblem(Exception):
    """Le lien ne permet pas (ou plus) l'action demandée."""

    def __init__(self, code, detail, status):
        super().__init__(detail)
        self.code, self.detail, self.status = code, detail, status

    def response(self):
        return Response({'detail': self.detail, 'code': self.code}, status=self.status)


def reset_url(token):
    return f'{settings.FRONTEND_URL.rstrip("/")}/nouveau-mot-de-passe?{urlencode({"jeton": token})}'


def request_reset(email):
    """Envoie un lien si un compte actif correspond. Ne dit jamais si c'est le cas."""
    user = User.objects.filter(email__iexact=email, is_active=True).first()
    if user is None:
        return
    recent = user.reset_links.filter(created_at__gt=timezone.now() - timedelta(hours=1)).count()
    if recent >= MAX_REQUESTS_PER_HOUR:
        return
    try:
        with transaction.atomic():
            link, token = PasswordResetLink.issue(user)
            body = render_to_string('accounts/emails/password_reset.txt', {'user': user, 'url': reset_url(token)})
            send_email(to=user.email, subject='Choisir un nouveau mot de passe – Mouvement TABAXI', body=body)
    except EmailNotSent:
        # Déjà journalisé par core.mail ; la réponse reste la même pour ne rien révéler.
        logger.warning('Lien de réinitialisation non envoyé (compte %s)', user.pk)


def check_reset_link(token):
    link = PasswordResetLink.find(token)
    if link is None or not link.user.is_active:
        raise LinkProblem('invalid_link', "Ce lien n'est pas valide. Vérifiez qu'il est complet.", 404)
    if link.is_used:
        raise LinkProblem('link_used', f'Ce lien a déjà servi. {NEW_LINK_HINT}', 410)
    if link.is_expired:
        raise LinkProblem('link_expired', f'Ce lien a expiré : il était valable une heure. {NEW_LINK_HINT}', 410)
    return link


def reset_password(token, password):
    """Enregistre le nouveau mot de passe et consomme le lien."""
    with transaction.atomic():
        link = check_reset_link(token)
        if not link.mark_used():
            raise LinkProblem('link_used', f'Ce lien a déjà servi. {NEW_LINK_HINT}', 410)
        user = link.user
        user.set_password(password)
        user.save(update_fields=['password'])
    return user
