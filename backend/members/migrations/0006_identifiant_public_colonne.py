"""Identifiant public des fiches de membre, étape 1 : la colonne, encore vide."""

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('members', '0005_motif_chiffre')]

    operations = [
        migrations.AddField('member', 'public_id', models.UUIDField(null=True, editable=False, verbose_name='identifiant public')),
    ]
