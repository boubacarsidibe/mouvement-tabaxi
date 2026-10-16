import re
from datetime import timedelta
from urllib.parse import parse_qs, urlparse

from django.core import mail
from django.core.cache import cache
from django.test import TestCase, override_settings
from django.utils import timezone

from .models import PasswordResetLink, User

PASSWORD = 'un-mot-de-passe-long'
NEW_PASSWORD = 'un-autre-mot-de-passe-solide'
FAILING_MAILER = {'default': {'BACKEND': 'core.tests.FailingBackend'}}


def token_from_email(message):
    url = re.search(r'https?://\S+', message.body).group(0)
    return parse_qs(urlparse(url).query)['jeton'][0]


class PasswordResetTests(TestCase):
    forgot = '/api/auth/password/forgot/'
    check = '/api/auth/password/reset/check/'
    reset = '/api/auth/password/reset/'

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user('awa@example.org', PASSWORD, first_name='Awa')

    def setUp(self):
        cache.clear()  # le plafond de demandes est gardé en mémoire

    def ask(self, email='awa@example.org'):
        return self.client.post(self.forgot, {'email': email}, content_type='application/json')

    def token(self):
        self.ask()
        return token_from_email(mail.outbox[-1])

    def post_reset(self, token, password=NEW_PASSWORD, confirm=None):
        return self.client.post(
            self.reset,
            {'token': token, 'password': password, 'password_confirm': confirm or password},
            content_type='application/json',
        )

    def test_envoie_un_lien_valable_une_heure(self):
        response = self.ask()
        self.assertEqual(response.status_code, 202)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ['awa@example.org'])
        link = PasswordResetLink.objects.get()
        self.assertAlmostEqual(link.expires_at, timezone.now() + timedelta(hours=1), delta=timedelta(seconds=30))

    def test_meme_reponse_si_le_compte_n_existe_pas(self):
        known, unknown = self.ask(), self.ask('inconnu@example.org')
        self.assertEqual(known.json(), unknown.json())
        self.assertEqual(len(mail.outbox), 1)

    def test_pas_de_lien_pour_un_compte_suspendu(self):
        User.objects.filter(pk=self.user.pk).update(is_active=False)
        self.ask()
        self.assertEqual(len(mail.outbox), 0)

    def test_trois_demandes_par_heure_au_plus(self):
        for _ in range(5):
            self.ask()
        self.assertEqual(len(mail.outbox), 3)

    def test_le_jeton_n_est_pas_conserve(self):
        token = self.token()
        self.assertNotIn(token, PasswordResetLink.objects.get().token_digest)

    def test_echec_d_envoi_ne_revele_rien(self):
        with override_settings(MAILERS=FAILING_MAILER), self.assertLogs('core.mail', level='ERROR'):
            response = self.ask()
        self.assertEqual(response.status_code, 202)

    def test_une_nouvelle_demande_invalide_la_precedente(self):
        first = self.token()
        second = self.token()
        self.assertEqual(self.client.post(self.check, {'token': first}, content_type='application/json').status_code, 410)
        self.assertEqual(self.client.post(self.check, {'token': second}, content_type='application/json').status_code, 200)

    def test_changement_du_mot_de_passe(self):
        token = self.token()
        response = self.post_reset(token)
        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(NEW_PASSWORD))

    def test_lien_a_usage_unique(self):
        token = self.token()
        self.post_reset(token)
        response = self.post_reset(token, 'encore-un-autre-mot-de-passe')
        self.assertEqual(response.status_code, 410)
        self.assertEqual(response.json()['code'], 'link_used')

    def test_lien_expire(self):
        token = self.token()
        PasswordResetLink.objects.update(expires_at=timezone.now() - timedelta(minutes=1))
        response = self.post_reset(token)
        self.assertEqual(response.status_code, 410)
        self.assertEqual(response.json()['code'], 'link_expired')
        self.assertIn('expiré', response.json()['detail'])

    def test_lien_inconnu(self):
        response = self.client.post(self.check, {'token': 'nimporte-quoi'}, content_type='application/json')
        self.assertEqual(response.status_code, 404)

    def test_confirmation_differente(self):
        response = self.post_reset(self.token(), confirm='autre-chose-de-long')
        self.assertEqual(response.status_code, 400)
        self.assertIn('ne correspondent pas', response.json()['password_confirm'][0])

    def test_mot_de_passe_trop_court(self):
        response = self.post_reset(self.token(), 'court')
        self.assertEqual(response.status_code, 400)
        self.assertIn('password', response.json())

    def test_connexion_avec_le_nouveau_mot_de_passe(self):
        self.post_reset(self.token())
        login = lambda pw: self.client.post(
            '/api/auth/login/', {'email': 'awa@example.org', 'password': pw}, content_type='application/json'
        )
        self.assertEqual(login(PASSWORD).status_code, 400)
        self.assertEqual(login(NEW_PASSWORD).status_code, 200)
