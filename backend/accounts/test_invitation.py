import re
from datetime import timedelta
from unittest import mock
from urllib.parse import parse_qs, urlparse

from django.core import mail
from django.core.cache import cache
from django.test import TestCase, override_settings
from django.utils import timezone

from applications.tests.helpers import make_application
from members.models import Member
from territories.models import Territory

from .models import PasswordResetLink, User

PASSWORD = 'un-mot-de-passe-long'
CHOSEN = 'Bureau-executif-2026'
FAILING_MAILER = {'default': {'BACKEND': 'core.tests.FailingBackend'}}


def token_from(message):
    url = re.search(r'https?://\S+', message.body).group(0)
    return url, parse_qs(urlparse(url).query)['jeton'][0]


class InvitationTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.region_dakar = Territory.objects.get(name='Dakar', kind=Territory.Kind.REGION)
        cls.fondateur = User.objects.create_user(
            'fondateur@example.org', PASSWORD, role=User.Role.FONDATEUR, first_name='Moussa', last_name='Diop'
        )
        cls.coordonnateur = User.objects.create_user(
            'coord@example.org', PASSWORD, role=User.Role.COORDONNATEUR, territory=cls.region_dakar
        )
        cls.membre = User.objects.create_user('membre@example.org', PASSWORD)

    def setUp(self):
        cache.clear()
        self.client.force_login(self.fondateur)

    def invite(self, **changes):
        data = {
            'email': 'mamadou.diop@example.org', 'first_name': 'Mamadou', 'last_name': 'Diop',
            'role': 'coordonnateur', 'territory': self.region_dakar.pk,
        }
        data.update(changes)
        data = {k: v for k, v in data.items() if v is not None}
        return self.client.post('/api/auth/invitations/', data, content_type='application/json')

    def invited_token(self, **changes):
        self.assertEqual(self.invite(**changes).status_code, 201)
        self.client.logout()
        return token_from(mail.outbox[-1])[1]

    def accept(self, token, password=CHOSEN):
        return self.client.post(
            '/api/auth/invitation/accept/', {'token': token, 'password': password, 'password_confirm': password},
            content_type='application/json',
        )


class InviteTests(InvitationTestCase):
    def test_invitation_d_un_coordonnateur(self):
        response = self.invite()
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()['role'], 'coordonnateur')
        user = User.objects.get(email='mamadou.diop@example.org')
        self.assertEqual((user.role, user.territory), (User.Role.COORDONNATEUR, self.region_dakar))
        self.assertFalse(user.has_usable_password())
        message = mail.outbox[0]
        self.assertEqual(message.to, ['mamadou.diop@example.org'])
        self.assertIn('Moussa Diop vous invite', message.body)
        self.assertIn('coordonnateur (Dakar)', message.body)
        self.assertTrue(token_from(message)[0].startswith('http://localhost:4200/invitation?jeton='))

    def test_seul_un_fondateur_peut_inviter(self):
        for user in (self.coordonnateur, self.membre):
            self.client.force_login(user)
            self.assertEqual(self.invite().status_code, 403)
        self.client.logout()
        self.assertEqual(self.invite().status_code, 401)
        self.assertFalse(User.objects.filter(email='mamadou.diop@example.org').exists())

    def test_coordonnateur_sans_territoire_refuse(self):
        response = self.invite(territory=None)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()['territory'], ['Un coordonnateur doit être rattaché à un territoire.'])

    def test_fondateur_sans_territoire(self):
        response = self.invite(role='fondateur', territory=None)
        self.assertEqual(response.status_code, 201)
        user = User.objects.get(email='mamadou.diop@example.org')
        self.assertEqual(user.role, User.Role.FONDATEUR)
        self.assertIsNone(user.territory)

    def test_fonction_limitee_au_bureau(self):
        self.assertEqual(self.invite(role='membre').status_code, 400)

    def test_courriel_deja_utilise(self):
        response = self.invite(email='Coord@example.org')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()['email'], ['Un compte existe déjà avec ce courriel.'])

    def test_demande_d_adhesion_en_cours(self):
        make_application(self.region_dakar, email='mamadou.diop@example.org')
        response = self.invite()
        self.assertEqual(response.status_code, 400)
        self.assertIn("demande d'adhésion est en cours", response.json()['email'][0])

    @override_settings(MAILERS=FAILING_MAILER)
    def test_echec_d_envoi_aucun_compte_cree(self):
        with self.assertLogs('core.mail', level='ERROR'):
            response = self.invite()
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()['code'], 'email_not_sent')
        self.assertFalse(User.objects.filter(email='mamadou.diop@example.org').exists())


class AcceptInvitationTests(InvitationTestCase):
    def test_verification_du_lien(self):
        token = self.invited_token()
        response = self.client.post('/api/auth/invitation/check/', {'token': token}, content_type='application/json')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual((data['email'], data['role_label'], data['territory_name']), ('mamadou.diop@example.org', 'Coordonnateur', 'Dakar'))

    def test_la_personne_invitee_arrive_sur_l_interface_du_bureau(self):
        token = self.invited_token()
        response = self.accept(token)
        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.json()['is_bureau'])
        self.assertEqual(self.client.get('/api/auth/me/').json()['role'], 'coordonnateur')
        self.client.logout()
        login = self.client.post(
            '/api/auth/login/', {'email': 'mamadou.diop@example.org', 'password': CHOSEN}, content_type='application/json'
        )
        self.assertEqual(login.status_code, 200)
        self.assertEqual(login.json()['role'], 'coordonnateur')

    def test_la_personne_invitee_recoit_son_dossier_de_membre(self):
        token = self.invited_token()
        self.accept(token)
        member = Member.objects.get(user__email='mamadou.diop@example.org')
        self.assertRegex(member.number, r'^TBX-\d{4}-\d{5}$')
        self.assertEqual(member.status, Member.Status.ACTIF)

    def test_le_lien_ne_sert_qu_une_fois(self):
        token = self.invited_token()
        self.assertEqual(self.accept(token).status_code, 201)
        self.client.logout()
        response = self.accept(token, 'Encore-un-autre-2026')
        self.assertEqual(response.status_code, 410)
        self.assertEqual(response.json()['code'], 'link_used')

    def test_le_lien_expire_apres_7_jours(self):
        token = self.invited_token()
        with mock.patch('django.utils.timezone.now', return_value=timezone.now() + timedelta(days=7, seconds=1)):
            response = self.accept(token)
        self.assertEqual(response.status_code, 410)
        self.assertIn('Demandez à un fondateur', response.json()['detail'])

    def test_regles_du_mot_de_passe(self):
        token = self.invited_token()
        response = self.accept(token, 'mamadou.diop')
        self.assertEqual(response.status_code, 400)
        self.assertTrue(response.json()['password'])

    def test_un_lien_de_reinitialisation_ne_sert_pas_d_invitation(self):
        _, token = PasswordResetLink.issue(self.membre)
        self.assertEqual(self.accept(token).status_code, 404)

    def test_invitation_perdue_remplacee_par_mot_de_passe_oublie(self):
        # Courriel d'invitation perdu : « mot de passe oublié » fonctionne aussi, puisqu'il passe
        # par la même boîte aux lettres.
        self.invited_token()
        self.client.post('/api/auth/password/forgot/', {'email': 'mamadou.diop@example.org'}, content_type='application/json')
        self.assertIn('nouveau-mot-de-passe', mail.outbox[-1].body)
