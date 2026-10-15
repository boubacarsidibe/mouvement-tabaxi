from django.db import IntegrityError
from django.test import Client, TestCase

from .models import User

PASSWORD = 'un-mot-de-passe-long'


class UserTests(TestCase):
    def test_creation_par_courriel(self):
        user = User.objects.create_user('membre@example.org', PASSWORD)
        self.assertEqual(user.role, User.Role.MEMBRE)
        self.assertFalse(user.is_bureau)
        self.assertTrue(user.check_password(PASSWORD))

    def test_bureau_executif(self):
        coord = User.objects.create_user('coord@example.org', PASSWORD, role=User.Role.COORDONNATEUR)
        self.assertTrue(coord.is_bureau)

    def test_superuser_est_fondateur(self):
        admin = User.objects.create_superuser('fondateur@example.org', PASSWORD)
        self.assertEqual(admin.role, User.Role.FONDATEUR)

    def test_courriel_unique(self):
        User.objects.create_user('a@example.org', PASSWORD)
        with self.assertRaises(IntegrityError):
            User.objects.create_user('a@example.org', PASSWORD)

    def test_courriel_unique_quelle_que_soit_la_casse(self):
        User.objects.create_user('awa.ndiaye@example.org', PASSWORD)
        with self.assertRaises(IntegrityError):
            User.objects.create_user('Awa.Ndiaye@example.org', PASSWORD)


class LoginTests(TestCase):
    url = '/api/auth/login/'

    @classmethod
    def setUpTestData(cls):
        cls.membre = User.objects.create_user('membre@example.org', PASSWORD, first_name='Aminata', last_name='Ndiaye')
        cls.fondateur = User.objects.create_user('fondateur@example.org', PASSWORD, role=User.Role.FONDATEUR)

    def login(self, email, password=PASSWORD, **extra):
        return self.client.post(self.url, {'email': email, 'password': password, **extra}, content_type='application/json')

    def test_connexion_valide_renvoie_le_role(self):
        response = self.login('fondateur@example.org')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['role'], 'fondateur')
        self.assertEqual(data['role_label'], 'Membre fondateur')
        self.assertTrue(data['is_bureau'])
        self.assertNotIn('password', data)

    def test_connexion_membre_simple(self):
        data = self.login('membre@example.org').json()
        self.assertEqual(data['role'], 'membre')
        self.assertFalse(data['is_bureau'])
        self.assertEqual((data['first_name'], data['last_name']), ('Aminata', 'Ndiaye'))

    def test_connexion_ouvre_une_session(self):
        self.login('membre@example.org')
        response = self.client.get('/api/auth/me/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['email'], 'membre@example.org')

    def test_courriel_sans_tenir_compte_de_la_casse(self):
        self.assertEqual(self.login('Membre@Example.org').status_code, 200)

    def test_mauvais_mot_de_passe(self):
        response = self.login('membre@example.org', 'mauvais-mot-de-passe')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()['detail'], 'Courriel ou mot de passe incorrect.')
        self.assertEqual(self.client.get('/api/auth/me/').status_code, 401)

    def test_courriel_inconnu_meme_message(self):
        response = self.login('inconnu@example.org')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()['detail'], 'Courriel ou mot de passe incorrect.')

    def test_compte_inactif_ne_peut_pas_se_connecter(self):
        User.objects.filter(pk=self.membre.pk).update(is_active=False)
        response = self.login('membre@example.org')
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()['code'], 'inactive_account')
        self.assertIn('suspendu ou radié', response.json()['detail'])
        self.assertEqual(self.client.get('/api/auth/me/').status_code, 401)

    def test_compte_inactif_et_mauvais_mot_de_passe_ne_revele_rien(self):
        User.objects.filter(pk=self.membre.pk).update(is_active=False)
        response = self.login('membre@example.org', 'mauvais-mot-de-passe')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()['code'], 'invalid_credentials')

    def test_champs_obligatoires(self):
        response = self.client.post(self.url, {}, content_type='application/json')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()['email'], ['Ce champ est obligatoire.'])
        self.assertEqual(response.json()['password'], ['Ce champ est obligatoire.'])

    def test_session_fermee_avec_le_navigateur_par_defaut(self):
        self.login('membre@example.org')
        self.assertTrue(self.client.session.get_expire_at_browser_close())

    def test_rester_connecte(self):
        self.login('membre@example.org', remember=True)
        self.assertFalse(self.client.session.get_expire_at_browser_close())


class MeAndLogoutTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.membre = User.objects.create_user('membre@example.org', PASSWORD)

    def test_personne_non_connectee(self):
        response = self.client.get('/api/auth/me/')
        self.assertEqual(response.status_code, 401)

    def test_cookie_anti_csrf_depose(self):
        response = self.client.get('/api/auth/me/')
        self.assertIn('XSRF-TOKEN', response.cookies)

    def test_deconnexion(self):
        self.client.force_login(self.membre)
        self.assertEqual(self.client.post('/api/auth/logout/').status_code, 204)
        self.assertEqual(self.client.get('/api/auth/me/').status_code, 401)

    def test_deconnexion_sans_session(self):
        self.assertEqual(self.client.post('/api/auth/logout/').status_code, 204)

    def test_compte_desactive_pendant_la_session(self):
        self.client.force_login(self.membre)
        User.objects.filter(pk=self.membre.pk).update(is_active=False)
        self.assertEqual(self.client.get('/api/auth/me/').status_code, 401)


class CsrfTests(TestCase):
    """Le client Angular renvoie le jeton du cookie XSRF-TOKEN dans l'en-tête X-XSRF-TOKEN."""

    @classmethod
    def setUpTestData(cls):
        User.objects.create_user('membre@example.org', PASSWORD)

    def setUp(self):
        self.client = Client(enforce_csrf_checks=True)
        response = self.client.post(
            '/api/auth/login/', {'email': 'membre@example.org', 'password': PASSWORD}, content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)

    def test_requete_sans_jeton_refusee(self):
        response = self.client.post('/api/auth/logout/')
        self.assertEqual(response.status_code, 403)

    def test_requete_avec_jeton_acceptee(self):
        token = self.client.cookies['XSRF-TOKEN'].value
        response = self.client.post('/api/auth/logout/', headers={'X-XSRF-TOKEN': token})
        self.assertEqual(response.status_code, 204)
