"""Chiffre en base la motivation, le motif du refus et la note interne des demandes."""

import core.fields
from django.db import migrations
from django.db.models import TextField, Value

FIELDS = ('motivation', 'rejection_reason', 'internal_note')


def chiffrer(apps, schema_editor):
    # Lecture : les textes déjà en base sont lus tels quels. Écriture : chiffrée par le champ.
    Application = apps.get_model('applications', 'Application')
    for row in Application.objects.values('pk', *FIELDS).iterator():
        pk = row.pop('pk')
        Application.objects.filter(pk=pk).update(**row)


def dechiffrer(apps, schema_editor):
    # Retour arrière : réécrit les textes en clair, sans passer par le chiffrement du champ.
    Application = apps.get_model('applications', 'Application')
    for row in Application.objects.values('pk', *FIELDS).iterator():
        pk = row.pop('pk')
        Application.objects.filter(pk=pk).update(
            **{name: Value(value, output_field=TextField()) for name, value in row.items()}
        )


class Migration(migrations.Migration):

    dependencies = [
        ('applications', '0003_lien_personnel'),
    ]

    operations = [
        migrations.AlterField(
            model_name='application',
            name='internal_note',
            field=core.fields.EncryptedTextField(blank=True, help_text='Visible par les fondateurs seulement.', verbose_name='note interne'),
        ),
        migrations.AlterField(
            model_name='application',
            name='motivation',
            field=core.fields.EncryptedTextField(max_length=2000, verbose_name='motivation'),
        ),
        migrations.AlterField(
            model_name='application',
            name='rejection_reason',
            field=core.fields.EncryptedTextField(blank=True, verbose_name='motif du refus'),
        ),
        migrations.RunPython(chiffrer, dechiffrer),
    ]
