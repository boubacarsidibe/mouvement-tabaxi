import json
import os
import subprocess
import sys

from django.core.files.base import ContentFile
from django.db import connection
from django.test import SimpleTestCase, TestCase

from .models import StoredFile
from .storage import DatabaseStorage
from .test_security import BACKEND_DIR, run_production

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


SHOW = (
    'import json; from django.conf import settings as s; print(json.dumps({'
    '"engine": s.DATABASES["default"]["ENGINE"], "host": s.DATABASES["default"].get("HOST"), '
    '"ssl": s.DATABASES["default"].get("OPTIONS", {}).get("sslmode"), '
    '"prepare": s.DATABASES["default"].get("OPTIONS", {}).get("prepare_threshold", "absent"), '
    '"cursors": s.DATABASES["default"].get("DISABLE_SERVER_SIDE_CURSORS"), '
    '"storage": s.STORAGES["default"]["BACKEND"], "frontend": s.FRONTEND_URL, '
    '"hosts": s.ALLOWED_HOSTS, "csrf": s.CSRF_TRUSTED_ORIGINS}))'
)


class VercelConfigurationTests(SimpleTestCase):
    def test_reglages_sur_vercel(self):
        result = run_production(
            'shell', '-c', SHOW,
            DATABASE_URL='postgres://tabaxi:secret@db.example.org:5432/tabaxi',
            DJANGO_FILE_STORAGE='database',
            VERCEL_URL='tabaxi-abc123.vercel.app',
            FRONTEND_URL='',
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        values = json.loads(result.stdout.strip().splitlines()[-1])
        self.assertEqual(values['engine'], 'django.db.backends.postgresql')
        self.assertEqual(values['host'], 'db.example.org')
        self.assertEqual(values['ssl'], 'require')
        # Répartiteur de connexions de Neon : pas de requêtes préparées ni de curseurs côté serveur.
        self.assertIsNone(values['prepare'])
        self.assertTrue(values['cursors'])
        self.assertEqual(values['storage'], 'core.storage.DatabaseStorage')
        self.assertEqual(values['frontend'], 'https://tabaxi-abc123.vercel.app')
        self.assertIn('tabaxi-abc123.vercel.app', values['hosts'])
        self.assertIn('https://tabaxi-abc123.vercel.app', values['csrf'])

    def test_courriels_obligatoires_en_production(self):
        result = run_production('check', EMAIL_HOST='')
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('EMAIL_HOST est obligatoire en production', result.stderr)

    def test_apercu_de_test_avec_courriels_dans_les_journaux(self):
        result = run_production('check', EMAIL_HOST='', EMAIL_CONSOLE_IN_PRODUCTION='1')
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_point_d_entree_vercel(self):
        environ = {
            **os.environ, 'DJANGO_DEBUG': '1', 'PYTHONIOENCODING': 'utf-8',
        }
        code = 'import sys; sys.path.insert(0, "api"); import index; print(callable(index.app))'
        result = subprocess.run(
            [sys.executable, '-c', code], cwd=BACKEND_DIR.parent, env=environ,
            capture_output=True, text=True, encoding='utf-8', timeout=120,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.strip().splitlines()[-1], 'True')
