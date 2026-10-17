"""Identifiant public des fiches de membre, étape 3 : obligatoire et unique."""

import uuid

from django.db import migrations, models

import core.fields


class Migration(migrations.Migration):
    dependencies = [('members', '0007_identifiant_public_valeurs')]

    operations = [
        migrations.AlterField(
            'member',
            'public_id',
            models.UUIDField(
                default=uuid.uuid4,
                editable=False,
                help_text=core.fields.PUBLIC_ID_HELP,
                unique=True,
                verbose_name='identifiant public',
            ),
        ),
    ]
