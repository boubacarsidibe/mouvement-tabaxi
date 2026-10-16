from django.core.files.base import ContentFile
from django.db import connection
from django.test import SimpleTestCase, TestCase

from .models import StoredFile
from .storage import DatabaseStorage
from .test_security import run_production

PHOTO = b'\xff\xd8\xff\xe0' + b'photo de test' * 50


class DatabaseStorageTests(TestCase):
    """Photos gardées en base, chiffrées : pas besoin de disque durable chez l'hébergeur."""

    def setUp(self):
        self.storage = DatabaseStorage()

    def test_enregistrer_et_relire(self):
        name = self.storage.save('photos/awa.jpg', ContentFile(PHOTO))
        self.assertEqual(name, 'photos/awa.jpg')
        self.assertTrue(self.storage.exists(name))
        self.assertEqual(self.storage.size(name), len(PHOTO))
        with self.storage.open(name) as stored:
            self.assertEqual(stored.read(), PHOTO)

    def test_contenu_chiffre_en_base(self):
        self.storage.save('photos/awa.jpg', ContentFile(PHOTO))
        with connection.cursor() as cursor:
            cursor.execute('SELECT content FROM core_storedfile')
            raw = bytes(cursor.fetchone()[0])
        self.assertNotIn(b'photo de test', raw)
        self.assertTrue(raw.startswith(b'gAAAAA'))

    def test_nom_deja_pris(self):
        first = self.storage.save('photos/awa.jpg', ContentFile(PHOTO))
        second = self.storage.save('photos/awa.jpg', ContentFile(b'autre'))
        self.assertNotEqual(first, second)
        self.assertEqual(StoredFile.objects.count(), 2)

    def test_suppression(self):
        name = self.storage.save('photos/awa.jpg', ContentFile(PHOTO))
        self.storage.delete(name)
        self.assertFalse(self.storage.exists(name))
        with self.assertRaises(FileNotFoundError):
            self.storage.open(name)

    def test_aucune_adresse_publique(self):
        with self.assertRaises(NotImplementedError):
            self.storage.url('photos/awa.jpg')


class StorageSettingTests(SimpleTestCase):
    def test_stockage_en_base_choisi_par_variable(self):
        code = 'from django.conf import settings as s; print(s.STORAGES["default"]["BACKEND"])'
        result = run_production('shell', '-c', code, DJANGO_FILE_STORAGE='database')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.strip().splitlines()[-1], 'core.storage.DatabaseStorage')
