from django.db import models

from . import crypto


class EncryptedTextField(models.TextField):
    """Texte chiffré en base, lu en clair par l'application.

    Une valeur vide reste vide (rien à protéger). Un texte écrit avant le chiffrement
    est encore lu tel quel ; ``manage.py rechiffrer`` le chiffre. On ne peut ni
    chercher ni trier sur un tel champ : chaque chiffrement donne un résultat différent.
    """

    description = 'Texte chiffré'

    def from_db_value(self, value, expression, connection):
        if not value or not crypto.is_encrypted(value):
            return value
        return crypto.decrypt(value)

    def get_prep_value(self, value):
        value = super().get_prep_value(value)
        if not value:
            return value
        return crypto.encrypt(value)
