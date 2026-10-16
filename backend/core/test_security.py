import json
import os
import secrets
import subprocess
import sys
from pathlib import Path

from cryptography.fernet import Fernet
from django.conf import settings
from django.contrib.auth.hashers import make_password
from django.test import SimpleTestCase, TestCase, override_settings

from accounts.models import User

BACKEND_DIR = Path(settings.BASE_DIR)
PASSWORD = 'un-mot-de-passe-long'


class PasswordHashingTests(TestCase):
    @override_settings(PASSWORD_HASHERS=settings.SECURE_PASSWORD_HASHERS)
    def test_nouveau_mot_de_passe_en_argon2id(self):
        user = User.objects.create_user('membre@example.org', PASSWORD)
        self.assertTrue(user.password.startswith('argon2$argon2id$'), user.password[:20])
        self.assertNotIn(PASSWORD, user.password)

    @override_settings(PASSWORD_HASHERS=settings.SECURE_PASSWORD_HASHERS)
    def test_ancienne_empreinte_convertie_a_la_connexion(self):
        user = User.objects.create_user('membre@example.org')
        User.objects.filter(pk=user.pk).update(password=make_password(PASSWORD, hasher='pbkdf2_sha256'))
        response = self.client.post(
            '/api/auth/login/', {'email': 'membre@example.org', 'password': PASSWORD}, content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        user.refresh_from_db()
        self.assertTrue(user.password.startswith('argon2$'))


class SecurityHeadersTests(TestCase):
    def test_en_tetes_de_securite_sur_l_api(self):
        response = self.client.get('/api/health/')
        self.assertEqual(response['X-Content-Type-Options'], 'nosniff')
        self.assertEqual(response['X-Frame-Options'], 'DENY')
        self.assertEqual(response['Referrer-Policy'], 'same-origin')
        self.assertEqual(response['Cross-Origin-Opener-Policy'], 'same-origin')
        csp = response['Content-Security-Policy']
        for directive in ("default-src 'self'", "script-src 'self'", "object-src 'none'", "frame-ancestors 'none'"):
            self.assertIn(directive, csp)

    def test_cookie_de_session_illisible_par_le_javascript(self):
        User.objects.create_user('membre@example.org', PASSWORD)
        response = self.client.post(
            '/api/auth/login/', {'email': 'membre@example.org', 'password': PASSWORD}, content_type='application/json'
        )
        session = response.cookies[settings.SESSION_COOKIE_NAME]
        self.assertTrue(session['httponly'])
        self.assertEqual(session['samesite'], 'Lax')
        # Le jeton anti-CSRF, lui, doit rester lisible par Angular.
        self.assertFalse(response.cookies['XSRF-TOKEN']['httponly'])


def run_production(*args, **env):
    """Lance manage.py dans un processus séparé, configuré comme en production."""
    environ = {
        **os.environ,
        'DJANGO_DEBUG': '0',
        'DJANGO_SECRET_KEY': secrets.token_urlsafe(64),
        'DJANGO_ALLOWED_HOSTS': 'tabaxi.example.org',
        'EMAIL_HOST': 'smtp.example.org',
        'FIELD_ENCRYPTION_KEYS': Fernet.generate_key().decode(),
        # Adresse fictive : ces contrôles ne se connectent pas à la base.
        'DATABASE_URL': 'postgres://tabaxi@127.0.0.1:5432/tabaxi',
        'PYTHONIOENCODING': 'utf-8',
        **env,
    }
    return subprocess.run(
        [sys.executable, 'manage.py', *args], cwd=BACKEND_DIR, env=environ,
        capture_output=True, text=True, encoding='utf-8', timeout=120,
    )


SHOW_SETTINGS = (
    'import json; from django.conf import settings as s; print(json.dumps({'
    '"debug": s.DEBUG, "ssl_redirect": s.SECURE_SSL_REDIRECT, "hsts": s.SECURE_HSTS_SECONDS, '
    '"session_secure": s.SESSION_COOKIE_SECURE, "csrf_secure": s.CSRF_COOKIE_SECURE, '
    '"hasher": s.PASSWORD_HASHERS[0]}))'
)

# Le point de contrôle /api/health/ échappe à la redirection (contrôle de santé de Railway).
REDIRECT = (
    'from django.test import Client; '
    'r = Client().get("/api/auth/me/", HTTP_HOST="tabaxi.example.org"); '
    'print(r.status_code, r["Location"])'
)


class ProductionConfigurationTests(SimpleTestCase):
    def test_controle_de_deploiement_sans_alerte(self):
        result = run_production('check', '--deploy', FRONTEND_URL='https://tabaxi.example.org')
        output = result.stdout + result.stderr
        self.assertEqual(result.returncode, 0, output)
        # Seule reste la liste « preload » des navigateurs, décision volontairement laissée aux fondateurs.
        warnings = [line for line in output.splitlines() if any(f'({app}.' in line for app in ('security', 'mail', 'deploiement'))]
        self.assertEqual([w for w in warnings if 'security.W021' not in w], [], output)

    def test_https_obligatoire_et_cookies_securises(self):
        result = run_production('shell', '-c', SHOW_SETTINGS)
        self.assertEqual(result.returncode, 0, result.stderr)
        values = json.loads(result.stdout.strip().splitlines()[-1])
        self.assertEqual(values, {
            'debug': False, 'ssl_redirect': True, 'hsts': 31536000,
            'session_secure': True, 'csrf_secure': True,
            'hasher': 'django.contrib.auth.hashers.Argon2PasswordHasher',
        })

    def test_requete_http_redirigee_vers_https(self):
        result = run_production('shell', '-c', REDIRECT)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.strip().splitlines()[-1], '301 https://tabaxi.example.org/api/auth/me/')

    def test_refus_de_demarrer_avec_la_cle_de_developpement(self):
        for key in ('cle-de-developpement-a-ne-jamais-utiliser-en-production', 'remplacer-par-une-longue-valeur-aleatoire', 'courte'):
            result = run_production('check', DJANGO_SECRET_KEY=key)
            self.assertNotEqual(result.returncode, 0, key)
            self.assertIn('DJANGO_SECRET_KEY', result.stderr)

    def test_refus_de_demarrer_sans_cle_de_chiffrement(self):
        result = run_production('check', FIELD_ENCRYPTION_KEYS='')
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('FIELD_ENCRYPTION_KEYS est obligatoire en production', result.stderr)

    def test_refus_de_demarrer_sans_base_de_donnees(self):
        # Sans DATABASE_URL, le serveur tournerait sur un fichier SQLite figé au déploiement.
        result = run_production('check', DATABASE_URL='')
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('DATABASE_URL est obligatoire en production', result.stderr)

    def test_production_par_defaut_sans_variable(self):
        if (BACKEND_DIR / '.env').exists():
            self.skipTest('Un fichier backend/.env local fixe DJANGO_DEBUG.')
        environ = {k: v for k, v in os.environ.items() if k != 'DJANGO_DEBUG'}
        result = subprocess.run(
            [sys.executable, 'manage.py', 'check'], cwd=BACKEND_DIR,
            env={**environ, 'DJANGO_SECRET_KEY': 'courte', 'PYTHONIOENCODING': 'utf-8'},
            capture_output=True, text=True, encoding='utf-8', timeout=120,
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('DJANGO_SECRET_KEY', result.stderr)
