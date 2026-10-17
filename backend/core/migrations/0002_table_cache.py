"""Crée la table du cache partagé, pour qu'aucune étape manuelle ne soit nécessaire au déploiement."""

from django.conf import settings
from django.core.management import call_command
from django.db import migrations


def creer_table(apps, schema_editor):
    call_command('createcachetable', database=schema_editor.connection.alias, verbosity=0)


def supprimer_table(apps, schema_editor):
    table = schema_editor.connection.ops.quote_name(settings.CACHE_TABLE)
    schema_editor.execute(f'DROP TABLE IF EXISTS {table}')


class Migration(migrations.Migration):
    dependencies = [('core', '0001_fichiers_stockes')]

    operations = [migrations.RunPython(creer_table, supprimer_table)]
