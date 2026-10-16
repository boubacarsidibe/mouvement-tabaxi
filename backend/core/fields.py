import json

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


class EncryptedJSONField(EncryptedTextField):
    """Données structurées (dictionnaire ou liste) chiffrées en base, lues telles quelles par l'application.

    Même protection que ``EncryptedTextField`` : le contenu n'est jamais en clair dans la base, et
    on ne peut ni chercher ni trier dedans. Une valeur vide se lit ``{}``.
    """

    description = 'Données JSON chiffrées'

    def from_db_value(self, value, expression, connection):
        text = super().from_db_value(value, expression, connection)
        return json.loads(text) if text else {}

    def get_prep_value(self, value):
        if value is None:
            return None
        return super().get_prep_value(json.dumps(value, ensure_ascii=False))

    def value_to_string(self, obj):
        return json.dumps(self.value_from_object(obj), ensure_ascii=False)
