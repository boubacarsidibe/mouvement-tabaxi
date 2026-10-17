"""Identifiant public des programmes et des activités, étape 3 : obligatoire et unique."""

import uuid

from django.db import migrations, models

import core.fields


class Migration(migrations.Migration):
    dependencies = [('programs', '0003_identifiant_public_valeurs')]

    operations = [
        migrations.AlterField(
            'program',
            'public_id',
            models.UUIDField(
                default=uuid.uuid4,
                editable=False,
                help_text=core.fields.PUBLIC_ID_HELP,
                unique=True,
                verbose_name='identifiant public',
            ),
        ),
        migrations.AlterField(
            'activity',
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
