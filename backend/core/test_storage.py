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


SHOW_STORAGE = 'from django.conf import settings as s; print(s.STORAGES["default"]["BACKEND"])'


class StorageSettingTests(SimpleTestCase):
    """En production, les photos ne sont jamais gardées sur un disque temporaire par défaut."""

    def storage(self, **env):
        result = run_production('shell', '-c', SHOW_STORAGE, **env)
        self.assertEqual(result.returncode, 0, result.stderr)
        return result.stdout.strip().splitlines()[-1]

    def test_base_par_defaut_en_production(self):
        self.assertEqual(self.storage(DJANGO_FILE_STORAGE=''), 'core.storage.DatabaseStorage')

    def test_base_choisie_par_variable(self):
        self.assertEqual(self.storage(DJANGO_FILE_STORAGE='database'), 'core.storage.DatabaseStorage')

    def test_disque_seulement_si_demande(self):
        self.assertEqual(
            self.storage(DJANGO_FILE_STORAGE='filesystem'), 'django.core.files.storage.FileSystemStorage'
        )

    def test_valeur_inconnue_refusee(self):
        result = run_production('check', DJANGO_FILE_STORAGE='tmp')
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('DJANGO_FILE_STORAGE', result.stderr)
