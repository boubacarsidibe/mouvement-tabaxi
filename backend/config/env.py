"""Lecture de la configuration locale (fichier .env)."""

import os
from pathlib import Path


def load_env_file(path):
    """Charge les variables d'un fichier .env sans écraser celles déjà définies.

    Format : une variable par ligne, ``NOM=valeur``. Les lignes vides et celles
    qui commencent par ``#`` sont ignorées ; les guillemets autour de la valeur
    sont retirés. Un fichier absent n'est pas une erreur : en production, les
    variables viennent directement de l'environnement.
    """
    try:
        lines = Path(path).read_text(encoding='utf-8').splitlines()
    except FileNotFoundError:
        return
    for line in lines:
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        name, value = line.split('=', 1)
        name = name.removeprefix('export ').strip()
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in '"\'':
            value = value[1:-1]
        os.environ.setdefault(name, value)


def env_flag(value):
    """Interprète « 1 », « true », « oui »… comme vrai."""
    return str(value).strip().lower() in {'1', 'true', 'yes', 'oui', 'on'}


def mailer_from_env(environ):
    """Service d'envoi des courriels, décrit par les variables d'environnement.

    Sans ``EMAIL_HOST``, les courriels sont affichés dans la console (développement).
    Avec ``EMAIL_HOST``, ils partent par SMTP ; l'identifiant et le mot de passe
    ne viennent que de l'environnement, jamais du code.
    """
    host = environ.get('EMAIL_HOST', '').strip()
    if not host:
        return {'BACKEND': 'django.core.mail.backends.console.EmailBackend'}
    options = {
        'host': host,
        'use_tls': env_flag(environ.get('EMAIL_USE_TLS', '1')),
        'use_ssl': env_flag(environ.get('EMAIL_USE_SSL', '0')),
        # Délai court : un fondateur attend la réponse pendant l'envoi.
        'timeout': int(environ.get('EMAIL_TIMEOUT', '10')),
    }
    if environ.get('EMAIL_PORT'):
        options['port'] = int(environ['EMAIL_PORT'])
    if environ.get('EMAIL_HOST_USER'):
        options['username'] = environ['EMAIL_HOST_USER']
    if environ.get('EMAIL_HOST_PASSWORD'):
        options['password'] = environ['EMAIL_HOST_PASSWORD']
    return {'BACKEND': 'django.core.mail.backends.smtp.EmailBackend', 'OPTIONS': options}
