"""Identifiant public des programmes et des activités, étape 1 : la colonne, encore vide."""

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('programs', '0001_initial')]

    operations = [
        migrations.AddField('program', 'public_id', models.UUIDField(null=True, editable=False, verbose_name='identifiant public')),
        migrations.AddField('activity', 'public_id', models.UUIDField(null=True, editable=False, verbose_name='identifiant public')),
    ]
