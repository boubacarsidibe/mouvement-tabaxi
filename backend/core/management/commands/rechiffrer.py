from django.apps import apps
from django.core.management.base import BaseCommand
from django.db import transaction

from core.append_only import AppendOnlyQuerySet
from core.fields import EncryptedTextField


class Command(BaseCommand):
    help = (
        'Chiffre avec la première clé de FIELD_ENCRYPTION_KEYS toutes les données sensibles : '
        'textes écrits avant le chiffrement, ou chiffrés avec une ancienne clé.'
    )

    def handle(self, *args, **options):
        total = 0
        for model in apps.get_models():
            fields = [f.name for f in model._meta.get_fields() if isinstance(f, EncryptedTextField)]
            if not fields:
                continue
            count = 0
            with transaction.atomic():
                # Lecture : déchiffrée avec n'importe quelle clé connue. Écriture : première clé.
                for row in model._default_manager.values('pk', *fields).iterator():
                    pk = row.pop('pk')
                    rows = model._default_manager.filter(pk=pk)
                    # Un historique ne se modifie pas, mais sa clé de chiffrement peut changer.
                    (rows.reencrypt if isinstance(rows, AppendOnlyQuerySet) else rows.update)(**row)
                    count += 1
            total += count
            self.stdout.write(f'{model._meta.label} : {count} ligne(s) rechiffrée(s).')
        self.stdout.write(self.style.SUCCESS(f'Terminé : {total} ligne(s).'))
