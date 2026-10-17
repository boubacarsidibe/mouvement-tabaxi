import re
from datetime import timedelta
from unittest import mock
from urllib.parse import parse_qs, urlparse

from django.core import mail
from django.test import TestCase, override_settings
from django.utils import timezone

from accounts.models import User
from applications.models import Application, RegistrationLink
from core.tokens import token_digest
from territories.models import Territory

from .helpers import make_application

PASSWORD = 'un-mot-de-passe-long'
FAILING_MAILER = {'default': {'BACKEND': 'core.tests.FailingBackend'}}


def token_from_email(message):
    url = re.search(r'https?://\S+', message.body).group(0)
    return url, parse_qs(urlparse(url).query)['jeton'][0]


class AcceptTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.fondateur = User.objects.create_user('fondateur@example.org', PASSWORD, role=User.Role.FONDATEUR)
        cls.coordonnateur = User.objects.create_user('coord@example.org', PASSWORD, role=User.Role.COORDONNATEUR)
        cls.awa = make_application(Territory.objects.get(name='Podor'))

    def setUp(self):
        self.client.force_login(self.fondateur)

    def accept(self, application=None, **payload):
        application = application or self.awa
        return self.client.post(f'/api/applications/{application.public_id}/accept/', payload, content_type='application/json')


class AcceptTests(AcceptTestCase):
    def test_acceptation(self):
        response = self.accept(internal_note='Profil enseignant, utile pour les ateliers.')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['status'], 'acceptee')
        self.assertEqual(data['status_label'], 'Acceptée')
        self.assertEqual(data['decided_by']['email'], 'fondateur@example.org')
        self.assertIsNotNone(data['decided_at'])
        self.assertEqual(data['internal_note'], 'Profil enseignant, utile pour les ateliers.')

    def test_courriel_d_acceptation_avec_le_lien_personnel(self):
        self.accept()
        self.assertEqual(len(mail.outbox), 1)
        message = mail.outbox[0]
        self.assertEqual(message.to, ['awa.ndiaye@example.org'])
        self.assertIn('a été acceptée', message.body)
        self.assertIn(self.awa.reference, message.body)
        self.assertIn('valable 7 jours', message.body)
        self.assertIn('une seule fois', message.body)
        url, token = token_from_email(message)
        self.assertTrue(url.startswith('http://localhost:4200/finaliser?jeton='))

    @override_settings(FRONTEND_URL='https://tabaxi.example.org/')
    def test_lien_vers_l_adresse_publique_du_frontend(self):
        self.accept()
        url, _ = token_from_email(mail.outbox[0])
        self.assertTrue(url.startswith('https://tabaxi.example.org/finaliser?jeton='))

    def test_date_d_expiration_en_francais(self):
        self.accept()
        link = RegistrationLink.objects.get()
        expected = timezone.localtime(link.expires_at)
        months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre',
                  'octobre', 'novembre', 'décembre']
        self.assertIn(f'{expected.day} {months[expected.month - 1]} {expected.year}', mail.outbox[0].body)

    def test_coordonnateur_refuse(self):
        self.client.force_login(self.coordonnateur)
        self.assertEqual(self.accept().status_code, 403)
        self.assertEqual(Application.objects.get(pk=self.awa.pk).status, Application.Status.A_EXAMINER)
        self.assertFalse(RegistrationLink.objects.exists())

    def test_personne_non_connectee(self):
        self.client.logout()
        self.assertEqual(self.accept().status_code, 401)

    def test_demande_deja_traitee(self):
        self.accept()
        response = self.accept()
        self.assertEqual(response.status_code, 409)
        self.assertEqual(RegistrationLink.objects.count(), 1)
        self.assertEqual(len(mail.outbox), 1)


class EmailFailureTests(AcceptTestCase):
    @override_settings(MAILERS=FAILING_MAILER)
    def test_echec_de_l_envoi_la_demande_reste_a_examiner_et_l_erreur_est_visible(self):
        with self.assertLogs('core.mail', level='ERROR'):
            response = self.accept()
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()['code'], 'email_not_sent')
        self.assertIn('reste « À examiner »', response.json()['detail'])
        self.awa.refresh_from_db()
        self.assertEqual(self.awa.status, Application.Status.A_EXAMINER)
        self.assertIsNone(self.awa.decided_by)
        self.assertIsNone(self.awa.decided_at)
        self.assertFalse(RegistrationLink.objects.exists())

    def test_nouvel_essai_apres_un_echec(self):
        with override_settings(MAILERS=FAILING_MAILER), self.assertLogs('core.mail', level='ERROR'):
            self.assertEqual(self.accept().status_code, 503)
        self.assertEqual(self.accept().status_code, 200)
        self.assertEqual(RegistrationLink.objects.count(), 1)


class TokenTests(AcceptTestCase):
    def setUp(self):
        super().setUp()
        self.accept()
        _, self.token = token_from_email(mail.outbox[0])
        self.link = RegistrationLink.objects.get()

    def test_seule_l_empreinte_est_conservee(self):
        self.assertEqual(self.link.token_digest, token_digest(self.token))
        self.assertNotEqual(self.link.token_digest, self.token)
        stored = RegistrationLink.objects.values_list('token_digest', flat=True)
        self.assertNotIn(self.token, list(stored))

    def test_jeton_aleatoire_et_long(self):
        self.assertGreaterEqual(len(self.token), 43)  # 256 bits en base64
        other, _ = RegistrationLink.issue(make_application(Territory.objects.get(name='Matam', kind='commune'), email='b@example.org'))
        self.assertNotEqual(other.token_digest, self.link.token_digest)

    def test_lien_retrouve_par_son_jeton(self):
        self.assertEqual(RegistrationLink.find(self.token), self.link)
        self.assertIsNone(RegistrationLink.find('jeton-invente'))

    def test_jeton_valable_7_jours(self):
        tolerance = timedelta(seconds=5)
        self.assertLess(abs(self.link.expires_at - self.link.created_at - timedelta(days=7)), tolerance)
        self.assertLess(abs(self.link.expires_at - self.awa_decided_at() - timedelta(days=7)), tolerance)

    def test_jeton_expire_apres_7_jours(self):
        start = self.link.created_at
        with mock.patch('django.utils.timezone.now', return_value=start + timedelta(days=6, hours=23)):
            self.assertTrue(RegistrationLink.find(self.token).is_valid)
        with mock.patch('django.utils.timezone.now', return_value=start + timedelta(days=7, seconds=1)):
            link = RegistrationLink.find(self.token)
            self.assertTrue(link.is_expired)
            self.assertFalse(link.is_valid)
            self.assertFalse(link.mark_used())

    def test_usage_unique(self):
        self.assertTrue(self.link.mark_used())
        self.assertFalse(RegistrationLink.objects.get(pk=self.link.pk).mark_used())
        link = RegistrationLink.find(self.token)
        self.assertTrue(link.is_used)
        self.assertFalse(link.is_valid)

    def awa_decided_at(self):
        return Application.objects.get(pk=self.awa.pk).decided_at
