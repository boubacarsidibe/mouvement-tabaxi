"""Réglages de gunicorn, le serveur de production sur Railway (voir docs/DEPLOIEMENT.md).

Lus au démarrage par « gunicorn config.wsgi --config gunicorn.conf.py ». Le port vient de
la variable PORT, fixée par Railway : il n'est pas écrit dans la commande de démarrage.
"""

import os

bind = f'0.0.0.0:{os.environ.get("PORT", "8000")}'
workers = int(os.environ.get('WEB_CONCURRENCY', '2'))
# Un fondateur attend la réponse pendant l'envoi d'un courriel (délai SMTP de 10 s).
timeout = int(os.environ.get('GUNICORN_TIMEOUT', '60'))
# Une ligne par requête sur la sortie standard, lue par le journal de Railway.
accesslog = '-'
