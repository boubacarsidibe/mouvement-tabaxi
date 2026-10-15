"""Jetons des liens personnels (inscription, puis réinitialisation et invitation).

Le jeton envoyé par courriel n'est jamais conservé : la base ne garde que son
empreinte SHA-256. Un jeton de 256 bits tiré au hasard ne peut pas être deviné ;
une empreinte rapide suffit donc, sans hachage lent comme pour un mot de passe.
"""

import hashlib
import secrets


def new_token():
    """Renvoie un jeton aléatoire et son empreinte : (jeton à envoyer, empreinte à stocker)."""
    token = secrets.token_urlsafe(32)
    return token, token_digest(token)


def token_digest(token):
    return hashlib.sha256(token.encode('utf-8')).hexdigest()
