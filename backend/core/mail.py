"""Envoi des courriels de la plateforme, avec détection des échecs."""

import logging

from django.core.mail import EmailMessage

logger = logging.getLogger(__name__)


class EmailNotSent(Exception):
    """Le courriel n'est pas parti : serveur injoignable, refus du serveur, configuration incorrecte."""

    message = "Le courriel n'a pas pu être envoyé. Réessayez dans quelques minutes."

    def __init__(self, message=None):
        super().__init__(message or self.message)


def send_email(*, to, subject, body):
    """Envoie un courriel texte à une seule adresse.

    Lève ``EmailNotSent`` si l'envoi échoue, pour que l'appelant ne considère
    jamais comme fait ce qui dépend du courriel (une acceptation, par exemple).
    """
    message = EmailMessage(subject=subject, body=body, to=[to])
    try:
        sent = message.send(using='default')
    except Exception as error:
        # Toute erreur d'envoi (réseau, authentification, refus) a la même conséquence.
        # L'adresse du destinataire n'est pas écrite dans le journal.
        logger.exception('Échec de l’envoi du courriel « %s »', subject)
        raise EmailNotSent() from error
    if sent != 1:
        logger.error('Courriel « %s » non envoyé par le serveur', subject)
        raise EmailNotSent()
