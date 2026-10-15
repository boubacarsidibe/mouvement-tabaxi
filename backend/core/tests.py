import os
import tempfile
from pathlib import Path
from unittest import mock

from django.db import OperationalError
from django.test import SimpleTestCase, TestCase

from config.env import load_env_file


class HealthTests(TestCase):
    url = '/api/health/'

    def test_repond_pret(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'status': 'ready'})

    def test_accessible_sans_connexion_et_en_json(self):
        response = self.client.get(self.url)
        self.assertEqual(response['Content-Type'], 'application/json')

    def test_base_injoignable(self):
        with mock.patch('core.views.connection.ensure_connection', side_effect=OperationalError):
            response = self.client.get(self.url)
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json(), {'status': 'unavailable'})

    def test_lecture_seule(self):
        self.assertEqual(self.client.post(self.url).status_code, 405)


class EnvFileTests(SimpleTestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.path = Path(self.tmp.name) / '.env'
        # Les variables lues par le test sont retirées de l'environnement après coup.
        names = ['TABAXI_TEST_A', 'TABAXI_TEST_B', 'TABAXI_TEST_C', 'TABAXI_TEST_D']
        patcher = mock.patch.dict(os.environ, {})
        patcher.start()
        self.addCleanup(patcher.stop)
        for name in names:
            os.environ.pop(name, None)

    def test_lit_les_variables(self):
        self.path.write_text(
            '# commentaire\n'
            '\n'
            'TABAXI_TEST_A=valeur\n'
            'TABAXI_TEST_B = "entre guillemets"\n'
            "export TABAXI_TEST_C='exportee'\n"
            'TABAXI_TEST_D=a=b\n',
            encoding='utf-8',
        )
        load_env_file(self.path)
        self.assertEqual(os.environ['TABAXI_TEST_A'], 'valeur')
        self.assertEqual(os.environ['TABAXI_TEST_B'], 'entre guillemets')
        self.assertEqual(os.environ['TABAXI_TEST_C'], 'exportee')
        self.assertEqual(os.environ['TABAXI_TEST_D'], 'a=b')

    def test_n_ecrase_pas_l_environnement(self):
        os.environ['TABAXI_TEST_A'] = 'deja-defini'
        self.path.write_text('TABAXI_TEST_A=du-fichier\n', encoding='utf-8')
        load_env_file(self.path)
        self.assertEqual(os.environ['TABAXI_TEST_A'], 'deja-defini')

    def test_fichier_absent(self):
        load_env_file(self.path)  # aucune erreur
