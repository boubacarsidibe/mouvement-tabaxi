"""Enregistrements qui s'ajoutent et ne changent plus : historiques et journaux.

Un enregistrement ne peut être ni modifié ni supprimé, ni un par un (``save``, ``delete``)
ni en lot (``update``, ``delete``, ``bulk_update`` sur une liste). Les écrans et
l'administration n'offrent d'ailleurs aucune modification.
"""

from django.db import models

IMMUTABLE = "Cet enregistrement fait partie d'un historique : il ne peut être ni modifié ni supprimé."


class ImmutableRecordError(RuntimeError):
    """Tentative de modifier ou de supprimer un enregistrement d'historique."""

    def __init__(self, message=IMMUTABLE):
        super().__init__(message)


class AppendOnlyQuerySet(models.QuerySet):
    def update(self, **kwargs):
        raise ImmutableRecordError()

    def bulk_update(self, objs, fields, batch_size=None):
        raise ImmutableRecordError()

    def delete(self):
        raise ImmutableRecordError()

    def reencrypt(self, **values):
        """Réécrit les mêmes valeurs avec la clé de chiffrement actuelle (``manage.py rechiffrer``).

        Seul usage permis d'une écriture sur un historique : le contenu lu est identique avant et après.
        """
        return super().update(**values)


class AppendOnlyModel(models.Model):
    objects = AppendOnlyQuerySet.as_manager()

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        if not self._state.adding:
            raise ImmutableRecordError()
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ImmutableRecordError()
