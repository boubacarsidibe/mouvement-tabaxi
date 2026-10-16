"""Chiffrement des données personnelles sensibles stockées en base.

Algorithme : Fernet (AES-128 en mode CBC, authentifié par HMAC-SHA256), de la
bibliothèque « cryptography ». Une valeur chiffrée ne peut être ni lue ni modifiée
sans la clé.

Les clés viennent de ``FIELD_ENCRYPTION_KEYS`` (variable d'environnement, jamais
versionnée). La première chiffre ; toutes déchiffrent. Pour changer de clé : placer la
nouvelle en tête, garder l'ancienne derrière, lancer ``python manage.py rechiffrer``,
puis retirer l'ancienne.
"""

import base64
import hashlib
from functools import lru_cache

from cryptography.fernet import Fernet, InvalidToken, MultiFernet
from django.conf import settings

# Tout jeton Fernet commence ainsi (octet de version 0x80 encodé en base64).
TOKEN_PREFIX = 'gAAAAA'


class DecryptionError(Exception):
    """Une valeur chiffrée ne peut pas être lue avec les clés configurées."""


def dev_key_from_secret(secret_key):
    """Clé dérivée de la clé secrète Django : développement et tests uniquement."""
    digest = hashlib.sha256(f'tabaxi-chiffrement:{secret_key}'.encode()).digest()
    return base64.urlsafe_b64encode(digest).decode()


@lru_cache(maxsize=4)
def _fernet(keys):
    return MultiFernet([Fernet(key) for key in keys])


def fernet():
    return _fernet(tuple(settings.FIELD_ENCRYPTION_KEYS))


def encrypt(text):
    return fernet().encrypt(text.encode('utf-8')).decode('ascii')


def decrypt(token):
    try:
        return fernet().decrypt(token.encode('ascii')).decode('utf-8')
    except InvalidToken as error:
        raise DecryptionError(
            'Donnée chiffrée illisible : la clé FIELD_ENCRYPTION_KEYS ne correspond pas.'
        ) from error


def is_encrypted(value):
    return isinstance(value, str) and value.startswith(TOKEN_PREFIX)
