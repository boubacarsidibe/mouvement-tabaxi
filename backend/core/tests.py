import os
import smtplib
import tempfile
from pathlib import Path
from unittest import mock

from django.conf import settings
from django.core import mail
from django.core.mail.backends.base import BaseEmailBackend
from django.db import OperationalError
from django.test import SimpleTestCase, TestCase, override_settings

from config.env import load_env_file, mailer_from_env

from .mail import EmailNotSent, send_email


class FailingBackend(BaseEmailBackend):
    """Service d'envoi qui refuse tout, comme un serveur SMTP en panne."""

    def send_messages(self, messages):
        raise smtplib.SMTPServerDisconnected('Connexion perdue')


class SilentBackend(BaseEmailBackend):
    """Service d'envoi qui ne lève pas d'erreur mais n'envoie rien."""

    def send_messages(self, messages):
        return 0


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


class SendEmailTests(SimpleTestCase):
    def test_courriel_envoye(self):
        send_email(to='awa.ndiaye@example.org', subject='Votre demande', body='Bonjour Awa,')
        self.assertEqual(len(mail.outbox), 1)
        message = mail.outbox[0]
        self.assertEqual(message.to, ['awa.ndiaye@example.org'])
        self.assertEqual(message.subject, 'Votre demande')
        self.assertEqual(message.body, 'Bonjour Awa,')
        self.assertEqual(message.from_email, settings.DEFAULT_FROM_EMAIL)

    @override_settings(MAILERS={'default': {'BACKEND': 'core.tests.FailingBackend'}})
    def test_echec_detecte_et_remonte(self):
        with self.assertLogs('core.mail', level='ERROR'):
            with self.assertRaises(EmailNotSent) as raised:
                send_email(to='awa.ndiaye@example.org', subject='Votre demande', body='Bonjour')
        self.assertIsInstance(raised.exception.__cause__, smtplib.SMTPException)
        self.assertIn("n'a pas pu être envoyé", str(raised.exception))

    @override_settings(MAILERS={'default': {'BACKEND': 'core.tests.SilentBackend'}})
    def test_envoi_non_confirme_considere_comme_un_echec(self):
        with self.assertLogs('core.mail', level='ERROR'):
            with self.assertRaises(EmailNotSent):
                send_email(to='awa.ndiaye@example.org', subject='Votre demande', body='Bonjour')

    def test_serveur_smtp_injoignable(self):
        # Port 1 de la machine locale : aucun serveur n'y écoute, la connexion est refusée.
        mailer = mailer_from_env({'EMAIL_HOST': '127.0.0.1', 'EMAIL_PORT': '1', 'EMAIL_USE_TLS': '0', 'EMAIL_TIMEOUT': '2'})
        with override_settings(MAILERS={'default': mailer}):
            with self.assertLogs('core.mail', level='ERROR'):
                with self.assertRaises(EmailNotSent):
                    send_email(to='awa.ndiaye@example.org', subject='Votre demande', body='Bonjour')

    def test_journal_sans_adresse_du_destinataire(self):
        with override_settings(MAILERS={'default': {'BACKEND': 'core.tests.FailingBackend'}}):
            with self.assertLogs('core.mail', level='ERROR') as logs:
                with self.assertRaises(EmailNotSent):
                    send_email(to='awa.ndiaye@example.org', subject='Votre demande', body='Bonjour')
        self.assertNotIn('awa.ndiaye@example.org', '\n'.join(logs.output))


class MailerConfigurationTests(SimpleTestCase):
    def test_console_sans_serveur_configure(self):
        self.assertEqual(mailer_from_env({}), {'BACKEND': 'django.core.mail.backends.console.EmailBackend'})

    def test_smtp_par_variables_d_environnement(self):
        mailer = mailer_from_env({
            'EMAIL_HOST': 'smtp.example.org',
            'EMAIL_PORT': '587',
            'EMAIL_HOST_USER': 'adhesion@example.org',
            'EMAIL_HOST_PASSWORD': 'secret-de-test',
        })
        self.assertEqual(mailer['BACKEND'], 'django.core.mail.backends.smtp.EmailBackend')
        self.assertEqual(mailer['OPTIONS'], {
            'host': 'smtp.example.org', 'port': 587, 'use_tls': True, 'use_ssl': False, 'timeout': 10,
            'username': 'adhesion@example.org', 'password': 'secret-de-test',
        })

    def test_ssl_au_lieu_de_tls(self):
        options = mailer_from_env({'EMAIL_HOST': 'smtp.example.org', 'EMAIL_USE_TLS': '0', 'EMAIL_USE_SSL': '1'})['OPTIONS']
        self.assertEqual((options['use_tls'], options['use_ssl']), (False, True))


class NoCredentialsInRepositoryTests(SimpleTestCase):
    """Aucun identifiant n'est versionné : il n'existe que dans l'environnement ou le fichier .env ignoré."""

    root = Path(settings.BASE_DIR).parent

    def test_fichier_env_ignore_par_git(self):
        ignored = (self.root / '.gitignore').read_text(encoding='utf-8').splitlines()
        self.assertIn('.env', [line.strip() for line in ignored])

    def test_exemple_sans_mot_de_passe(self):
        example = (Path(settings.BASE_DIR) / '.env.example').read_text(encoding='utf-8')
        values = dict(line.split('=', 1) for line in example.splitlines() if '=' in line and not line.startswith('#'))
        self.assertEqual(values.get('EMAIL_HOST_PASSWORD', '').strip(), '')
        self.assertEqual(values.get('EMAIL_HOST', '').strip(), '')
