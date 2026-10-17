"""Préparation de l'hébergement du serveur sur Railway (#52), sans casser Vercel."""

import json
import re
import runpy
from pathlib import Path
from unittest import mock

from django.conf import settings
from django.test import SimpleTestCase
from django.urls import resolve

from config.env import env_list, origin_of, origins_from_env
from core.test_security import run_production
from core.views import health

BACKEND_DIR = Path(settings.BASE_DIR)
SITE = 'https://mouvement-tabaxi-app.vercel.app'
RAILWAY = {
    'RAILWAY_ENVIRONMENT_NAME': 'production',
    'RAILWAY_PUBLIC_DOMAIN': 'mouvement-tabaxi-api.up.railway.app',
    # Base en mémoire : le point de contrôle se connecte vraiment à la base.
    'DATABASE_URL': 'sqlite://:memory:',
}
NOT_RAILWAY = {'RAILWAY_ENVIRONMENT_NAME': '', 'RAILWAY_PUBLIC_DOMAIN': ''}

SHOW_ORIGINS = (
    'import json; from django.conf import settings as s; print(json.dumps({'
    '"hosts": s.ALLOWED_HOSTS, "cors": s.CORS_ALLOWED_ORIGINS, '
    '"csrf": s.CSRF_TRUSTED_ORIGINS, "frontend": s.FRONTEND_URL}))'
)

# Requêtes envoyées en http, comme le contrôle de santé de Railway sur le port du serveur.
HTTP_REQUESTS = (
    'from django.test import Client; c = Client(); '
    'r = c.get("/api/health/", HTTP_HOST="healthcheck.railway.app"); print("sante", r.status_code); '
    'r = c.get("/api/health/", HTTP_HOST="intrus.example.org"); print("intrus", r.status_code); '
    'r = c.get("/api/auth/me/", HTTP_HOST="mouvement-tabaxi-api.up.railway.app"); '
    'print("autre", r.status_code, r["Location"])'
)


def last_json(result):
    return json.loads(result.stdout.strip().splitlines()[-1])


class RailwayFilesTests(SimpleTestCase):
    def test_railway_json(self):
        config = json.loads((BACKEND_DIR / 'railway.json').read_text(encoding='utf-8'))
        deploy = config['deploy']
        # gunicorn sert l'application WSGI du projet, avec ses réglages (port compris).
        self.assertEqual(deploy['startCommand'], 'gunicorn config.wsgi --config gunicorn.conf.py')
        self.assertEqual(settings.WSGI_APPLICATION, 'config.wsgi.application')
        # Migrations avant chaque mise en service : un échec garde l'ancienne version en ligne.
        self.assertEqual(deploy['preDeployCommand'], ['python manage.py migrate --noinput'])
        self.assertEqual(deploy['healthcheckPath'], '/api/health/')
        self.assertIs(resolve(deploy['healthcheckPath']).func, health)
        self.assertEqual(config['build']['builder'], 'RAILPACK')

    def test_gunicorn_ecoute_sur_le_port_donne_par_railway(self):
        path = str(BACKEND_DIR / 'gunicorn.conf.py')
        with mock.patch.dict('os.environ', {'PORT': '4321'}):
            config = runpy.run_path(path)
        self.assertEqual(config['bind'], '0.0.0.0:4321')
        self.assertEqual(config['workers'], 2)
        self.assertEqual(config['timeout'], 60)
        with mock.patch.dict('os.environ', {'WEB_CONCURRENCY': '3'}):
            self.assertEqual(runpy.run_path(path)['workers'], 3)

    def test_gunicorn_fige_dans_les_dependances(self):
        lines = (BACKEND_DIR / 'requirements.txt').read_text(encoding='utf-8').splitlines()
        self.assertEqual([line for line in lines if re.fullmatch(r'gunicorn==\d+\.\d+\.\d+', line)], ['gunicorn==26.2.0'])

    def test_python_3_12(self):
        self.assertEqual((BACKEND_DIR / '.python-version').read_text(encoding='utf-8').strip(), '3.12')

    def test_vercel_garde_ses_migrations(self):
        # L'API tourne encore sur Vercel : sa configuration reste en place.
        config = json.loads((BACKEND_DIR / 'vercel.json').read_text(encoding='utf-8'))
        self.assertEqual(config['buildCommand'], 'python manage.py migrate --noinput')


class OriginsTests(SimpleTestCase):
    def test_liste(self):
        self.assertEqual(env_list(' a.example.org, ,b.example.org,'), ['a.example.org', 'b.example.org'])
        self.assertEqual(env_list(''), [])

    def test_origine_sans_chemin_ni_barre_finale(self):
        self.assertEqual(origin_of(f'{SITE}/'), SITE)
        self.assertEqual(origin_of(f'{SITE}/finaliser?jeton=x'), SITE)
        self.assertEqual(origin_of('http://localhost:4200'), 'http://localhost:4200')

    def test_origines_sans_doublon(self):
        self.assertEqual(origins_from_env(f'{SITE}/, {SITE},http://localhost:4200'), [SITE, 'http://localhost:4200'])


class RailwayProductionTests(SimpleTestCase):
    def test_hotes_de_railway_ajoutes(self):
        result = run_production('shell', '-c', SHOW_ORIGINS, **RAILWAY)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(
            last_json(result)['hosts'],
            ['tabaxi.example.org', 'mouvement-tabaxi-api.up.railway.app', 'healthcheck.railway.app'],
        )

    def test_hotes_inchanges_hors_de_railway(self):
        result = run_production('shell', '-c', SHOW_ORIGINS, **NOT_RAILWAY)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(last_json(result)['hosts'], ['tabaxi.example.org'])

    def test_controle_de_sante_en_http_sans_redirection(self):
        result = run_production('shell', '-c', HTTP_REQUESTS, **RAILWAY)
        self.assertEqual(result.returncode, 0, result.stderr)
        lines = result.stdout.strip().splitlines()[-3:]
        self.assertEqual(lines[0], 'sante 200')
        # Les autres hôtes restent refusés, les autres adresses passent toujours en https.
        self.assertEqual(lines[1], 'intrus 400')
        self.assertEqual(lines[2], 'autre 301 https://mouvement-tabaxi-api.up.railway.app/api/auth/me/')

    def test_origines_lues_dans_l_environnement(self):
        result = run_production(
            'shell', '-c', SHOW_ORIGINS, CORS_ALLOWED_ORIGINS=f'{SITE}/', FRONTEND_URL=f'{SITE}/', CSRF_TRUSTED_ORIGINS=''
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        values = last_json(result)
        # Une barre finale dans l'adresse ne doit pas empêcher le démarrage.
        self.assertEqual(values['cors'], [SITE])
        self.assertEqual(values['csrf'], [SITE])
        self.assertEqual(values['frontend'], f'{SITE}/')

    def test_origines_csrf_propres_et_site_toujours_accepte(self):
        result = run_production(
            'shell', '-c', SHOW_ORIGINS,
            CORS_ALLOWED_ORIGINS='', CSRF_TRUSTED_ORIGINS='https://bureau.example.org', FRONTEND_URL=SITE,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        values = last_json(result)
        self.assertEqual(values['cors'], [])
        self.assertEqual(values['csrf'], ['https://bureau.example.org', SITE])

    def test_alerte_si_les_liens_des_courriels_menent_en_local(self):
        result = run_production('check', '--deploy', FRONTEND_URL='http://localhost:4200')
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn('deploiement.W001', result.stdout + result.stderr)

    def test_controle_de_deploiement_railway_sans_alerte(self):
        result = run_production('check', '--deploy', FRONTEND_URL=SITE, CORS_ALLOWED_ORIGINS=f'{SITE}/', **RAILWAY)
        output = result.stdout + result.stderr
        self.assertEqual(result.returncode, 0, output)
        warnings = [line for line in output.splitlines() if re.search(r'\((security|mail|deploiement|corsheaders)\.', line)]
        self.assertEqual([w for w in warnings if 'security.W021' not in w], [], output)
