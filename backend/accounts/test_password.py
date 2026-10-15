import re
from datetime import timedelta
from unittest import mock
from urllib.parse import parse_qs, urlparse

from django.core import mail
from django.core.cache import cache
from django.test import Client, TestCase, override_settings
from django.utils import timezone

from .models import AccountLink, User

OLD_PASSWORD = 'Ancien-mot-de-passe-1'
NEW_PASSWORD = 'Nouveau-baobab-2026'
FAILING_MAILER = {'default': {'BACKEND': 'core.tests.FailingBackend'}}


def token_from(message):
    url = re.search(r'https?://\S+', message.body).group(0)
    return url, parse_qs(urlparse(url).query)['jeton'][0]


class PasswordTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user('aminata@example.org', OLD_PASSWORD, first_name='Aminata')

    def setUp(self):
        cache.clear()  # remet à zéro la limite d'envois

    def forgot(self, email='aminata@example.org'):
        return self.client.post('/api/auth/password/forgot/', {'email': email}, content_type='application/json')

    def reset(self, token, password=NEW_PASSWORD, confirm=None, client=None):
        return (client or self.client).post(
            '/api/auth/password/reset/',
            {'token': token, 'password': password, 'password_confirm': confirm or password},
            content_type='application/json',
        )

    def login(self, password, client=None):
        return (client or self.client).post(
            '/api/auth/login/', {'email': 'aminata@example.org', 'password': password}, content_type='application/json'
        )

    def request_token(self):
        self.forgot()
        return token_from(mail.outbox[-1])[1]


class ForgotPasswordTests(PasswordTestCase):
    def test_courriel_avec_un_lien_personnel(self):
        response = self.forgot()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['detail'], 'Si un compte correspond à cette adresse, un courriel vient de lui être envoyé.')
        self.assertEqual(len(mail.outbox), 1)
        message = mail.outbox[0]
        self.assertEqual(message.to, ['aminata@example.org'])
        self.assertIn('valable une heure', message.body)
        url, token = token_from(message)
        self.assertTrue(url.startswith('http://localhost:4200/nouveau-mot-de-passe?jeton='))
        self.assertGreaterEqual(len(token), 43)

    def test_meme_reponse_pour_un_courriel_inconnu(self):
        known = self.forgot().json()
        unknown = self.forgot('inconnu@example.org')
        self.assertEqual(unknown.status_code, 200)
        self.assertEqual(unknown.json(), known)
        self.assertEqual(len(mail.outbox), 1)

    def test_rien_pour_un_compte_desactive(self):
        User.objects.filter(pk=self.user.pk).update(is_active=False)
        self.assertEqual(self.forgot().status_code, 200)
        self.assertEqual(mail.outbox, [])

    def test_courriel_sans_tenir_compte_des_majuscules(self):
        self.forgot('Aminata@Example.org')
        self.assertEqual(len(mail.outbox), 1)

    def test_trois_demandes_par_heure_au_plus(self):
        for _ in range(4):
            self.forgot()
        self.assertEqual(len(mail.outbox), 3)

    def test_un_nouveau_lien_annule_le_precedent(self):
        first = self.request_token()
        second = self.request_token()
        self.assertEqual(self.reset(first).status_code, 410)
        self.assertEqual(self.reset(second).status_code, 200)

    @override_settings(MAILERS=FAILING_MAILER)
    def test_echec_d_envoi_sans_rien_reveler(self):
        with self.assertLogs('core.mail', level='ERROR'):
            response = self.forgot()
        self.assertEqual(response.status_code, 200)
        self.assertFalse(AccountLink.objects.exists())

    def test_courriel_invalide(self):
        response = self.forgot('pas-un-courriel')
        self.assertEqual(response.status_code, 400)


class ResetTests(PasswordTestCase):
    def test_verification_du_lien(self):
        token = self.request_token()
        response = self.client.post('/api/auth/password/reset/check/', {'token': token}, content_type='application/json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['email'], 'aminata@example.org')
        response = self.client.post('/api/auth/password/reset/check/', {'token': 'invente'}, content_type='application/json')
        self.assertEqual(response.status_code, 404)

    def test_nouveau_mot_de_passe(self):
        token = self.request_token()
        response = self.reset(token)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.login(NEW_PASSWORD).status_code, 200)
        self.client.logout()
        self.assertEqual(self.login(OLD_PASSWORD).status_code, 400)

    def test_le_lien_ne_sert_qu_une_fois(self):
        token = self.request_token()
        self.assertEqual(self.reset(token).status_code, 200)
        response = self.reset(token, 'Encore-un-autre-2026')
        self.assertEqual(response.status_code, 410)
        self.assertEqual(response.json()['code'], 'link_used')

    def test_le_lien_expire_apres_une_heure(self):
        token = self.request_token()
        with mock.patch('django.utils.timezone.now', return_value=timezone.now() + timedelta(minutes=59)):
            response = self.client.post('/api/auth/password/reset/check/', {'token': token}, content_type='application/json')
            self.assertEqual(response.status_code, 200)
        with mock.patch('django.utils.timezone.now', return_value=timezone.now() + timedelta(hours=1, seconds=1)):
            response = self.reset(token)
        self.assertEqual(response.status_code, 410)
        self.assertEqual(response.json()['code'], 'link_expired')
        self.assertIn('valable une heure', response.json()['detail'])
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(OLD_PASSWORD))

    def test_regles_de_securite(self):
        token = self.request_token()
        response = self.reset(token, 'court')
        self.assertEqual(response.status_code, 400)
        self.assertIn('au minimum 10 caractères', ' '.join(response.json()['password']))
        response = self.reset(token, NEW_PASSWORD, 'Autre-chose-2026')
        self.assertEqual(response.json()['password_confirm'], ['Les deux mots de passe ne correspondent pas.'])
        # Les refus ne consomment pas le lien.
        self.assertEqual(self.reset(token).status_code, 200)

    def test_autres_sessions_fermees(self):
        other_device = Client()
        self.login(OLD_PASSWORD, client=other_device)
        self.assertEqual(other_device.get('/api/auth/me/').status_code, 200)
        self.reset(self.request_token())
        self.assertEqual(other_device.get('/api/auth/me/').status_code, 401)

    def test_blocage_leve_apres_reinitialisation(self):
        for _ in range(5):
            self.login('mauvais-mot-de-passe')
        self.assertEqual(self.login(OLD_PASSWORD).status_code, 429)
        self.reset(self.request_token())
        self.assertEqual(self.login(NEW_PASSWORD).status_code, 200)

    def test_un_lien_d_invitation_ne_sert_pas_a_reinitialiser(self):
        _, token = AccountLink.issue(self.user, AccountLink.Purpose.INVITATION)
        self.assertEqual(self.reset(token).status_code, 404)


class PasswordChangeTests(PasswordTestCase):
    url = '/api/auth/password/change/'

    def change(self, current=OLD_PASSWORD, new=NEW_PASSWORD, confirm=None):
        return self.client.post(self.url, {
            'current_password': current, 'new_password': new, 'new_password_confirm': confirm or new,
        }, content_type='application/json')

    def test_changement_et_session_gardee(self):
        other_device = Client()
        self.login(OLD_PASSWORD, client=other_device)
        self.client.force_login(self.user)
        response = self.change()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.client.get('/api/auth/me/').status_code, 200)
        self.assertEqual(other_device.get('/api/auth/me/').status_code, 401)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(NEW_PASSWORD))

    def test_mot_de_passe_actuel_exige(self):
        self.client.force_login(self.user)
        response = self.change(current='mauvais-mot-de-passe')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()['current_password'], ['Le mot de passe actuel est incorrect.'])

    def test_regles_de_securite(self):
        self.client.force_login(self.user)
        response = self.change(new='1234567890')
        self.assertEqual(response.status_code, 400)
        self.assertIn('entièrement numérique', ' '.join(response.json()['new_password']))

    def test_personne_non_connectee(self):
        self.assertEqual(self.change().status_code, 401)
