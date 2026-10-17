"""Identifiant public des demandes, étape 1 : la colonne, encore vide."""

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('applications', '0004_chiffrement_donnees_sensibles')]

    operations = [
        migrations.AddField('application', 'public_id', models.UUIDField(null=True, editable=False, verbose_name='identifiant public')),
    ]
