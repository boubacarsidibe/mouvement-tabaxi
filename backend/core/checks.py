"""Contrôles propres au projet, lancés par « python manage.py check --deploy »."""

from urllib.parse import urlsplit

from django.conf import settings
from django.core.checks import Tags, Warning, register


@register(Tags.security, deploy=True)
def check_frontend_url(app_configs, **kwargs):
    """Les liens personnels envoyés par courriel doivent mener au vrai site, en https."""
    url = urlsplit(settings.FRONTEND_URL)
    if url.scheme == 'https' and url.hostname not in {'localhost', '127.0.0.1'}:
        return []
    return [
        Warning(
            f'FRONTEND_URL vaut « {settings.FRONTEND_URL} » : les liens envoyés par courriel '
            '(inscription, invitation, mot de passe) ne mèneront pas au site public.',
            hint='Mettre l\'adresse https du site, par exemple https://mouvement-tabaxi-app.vercel.app.',
            id='deploiement.W001',
        )
    ]
