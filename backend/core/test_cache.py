import importlib
from types import SimpleNamespace
from unittest import mock

from django.conf import settings
from django.core.cache import cache, caches
from django.core.cache.backends.db import DatabaseCache
from django.db import connection
from django.test import TestCase
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.test import APIClient


def lignes_du_cache(motif):
    table = connection.ops.quote_name(settings.CACHE_TABLE)
    with connection.cursor() as cursor:
        cursor.execute(f'SELECT cache_key FROM {table} WHERE cache_key LIKE %s', [f'%{motif}%'])
        return [ligne[0] for ligne in cursor.fetchall()]


class CachePartageTests(TestCase):
    """Les limites d'envoi sont comptées dans une table partagée par toutes les instances."""

    def setUp(self):
        cache.clear()
        self.client = APIClient()

    def test_le_cache_par_defaut_est_en_base(self):
        self.assertIsInstance(caches['default'], DatabaseCache)
        self.assertEqual(settings.CACHES['default']['LOCATION'], settings.CACHE_TABLE)

    def test_la_table_du_cache_existe_apres_les_migrations(self):
        self.assertIn(settings.CACHE_TABLE, connection.introspection.table_names())

    def test_chaque_limite_est_comptee_dans_la_table(self):
        formulaires = {
            'adhesion': '/api/applications/',
            'registration': '/api/registration/check/',
            'password_reset': '/api/auth/password/forgot/',
        }
        for scope, url in formulaires.items():
            with self.subTest(scope=scope):
                self.client.post(url, {}, format='json')
                self.assertEqual(len(lignes_du_cache(f'throttle_{scope}_')), 1)

    def test_une_autre_instance_voit_le_meme_compteur(self):
        """Un cache neuf sur la même table (une autre instance) refuse l'envoi de trop."""
        with mock.patch.object(ScopedRateThrottle, 'THROTTLE_RATES', {'adhesion': '2/hour'}):
            self.client.post('/api/applications/', {}, format='json')
            self.client.post('/api/applications/', {}, format='json')
            autre_instance = DatabaseCache(settings.CACHE_TABLE, {})
            with mock.patch.object(ScopedRateThrottle, 'cache', autre_instance):
                reponse = self.client.post('/api/applications/', {}, format='json')
        self.assertEqual(reponse.status_code, 429)


class MigrationTableCacheTests(TestCase):
    """La migration crée la table du cache : aucune étape manuelle au déploiement."""

    def test_la_migration_supprime_puis_recree_la_table(self):
        migration = importlib.import_module('core.migrations.0002_table_cache')
        editeur = SimpleNamespace(connection=connection, execute=lambda sql: connection.cursor().execute(sql))
        migration.supprimer_table(None, editeur)
        self.assertNotIn(settings.CACHE_TABLE, connection.introspection.table_names())
        migration.creer_table(None, editeur)
        self.assertIn(settings.CACHE_TABLE, connection.introspection.table_names())
