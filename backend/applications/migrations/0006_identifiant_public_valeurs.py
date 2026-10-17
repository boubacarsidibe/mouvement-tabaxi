"""Identifiant public des demandes, étape 2 : un identifiant aléatoire pour chaque fiche existante.

Étapes séparées (une migration chacune) : sur PostgreSQL, modifier des lignes puis la structure de
la même table dans une seule transaction peut échouer.
"""

import uuid

from django.db import migrations


def fill(apps, schema_editor):
    for name in ('Application',):
        model = apps.get_model('applications', name)
        for pk in model.objects.filter(public_id__isnull=True).values_list('pk', flat=True):
            model.objects.filter(pk=pk).update(public_id=uuid.uuid4())


class Migration(migrations.Migration):
    dependencies = [('applications', '0005_identifiant_public_colonne')]

    operations = [migrations.RunPython(fill, migrations.RunPython.noop)]
