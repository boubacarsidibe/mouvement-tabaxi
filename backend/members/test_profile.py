import shutil
import tempfile
from pathlib import Path

from django.test import TestCase, override_settings
from django.test.client import BOUNDARY, MULTIPART_CONTENT, encode_multipart

from accounts.models import User
from territories.models import Territory

from .models import Member
from .test_registration import image_file

MEDIA_ROOT = tempfile.mkdtemp(prefix='tabaxi-profil-')
URL = '/api/members/me/'


@override_settings(MEDIA_ROOT=MEDIA_ROOT)
class MemberProfileTests(TestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(MEDIA_ROOT, ignore_errors=True)

    @classmethod
    def setUpTestData(cls):
        cls.dakar = Territory.objects.get(name='Dakar', kind=Territory.Kind.COMMUNE)
        cls.user = User.objects.create_user(
            'aminata@example.org', 'un-mot-de-passe-long', first_name='Aminata', last_name='Ndiaye', territory=cls.dakar
        )
        cls.member = Member.objects.create(user=cls.user, address='18, rue de la Corniche, Dakar')

    def setUp(self):
        self.client.force_login(self.user)

    def patch(self, data, multipart=False):
        if multipart:
            return self.client.patch(URL, encode_multipart(BOUNDARY, data), content_type=MULTIPART_CONTENT)
        return self.client.patch(URL, data, content_type='application/json')

    def test_profil_et_donnees_de_la_carte(self):
        response = self.client.get(URL)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['number'], self.member.number)
        self.assertEqual((data['first_name'], data['last_name']), ('Aminata', 'Ndiaye'))
        self.assertEqual(data['territory']['name'], 'Dakar')
        self.assertEqual(data['address'], '18, rue de la Corniche, Dakar')
        self.assertIn('joined_on', data)
        self.assertIsNone(data['photo_url'])

    def test_modifications_retrouvees_a_la_connexion_suivante(self):
        response = self.patch({'address': '5, avenue Lamine-Guèye, Dakar', 'phone': '+221 76 000 11 22'})
        self.assertEqual(response.status_code, 200)
        self.client.logout()
        self.client.post(
            '/api/auth/login/', {'email': 'aminata@example.org', 'password': 'un-mot-de-passe-long'},
            content_type='application/json',
        )
        data = self.client.get(URL).json()
        self.assertEqual((data['address'], data['phone']), ('5, avenue Lamine-Guèye, Dakar', '+221 76 000 11 22'))

    def test_nom_et_territoire_non_modifiables_par_le_membre(self):
        thies = Territory.objects.get(name='Thiès', kind=Territory.Kind.COMMUNE)
        for field, value in (('first_name', 'Awa'), ('last_name', 'Fall'), ('territory', thies.pk), ('email', 'x@example.org')):
            response = self.patch({field: value})
            self.assertEqual(response.status_code, 400, field)
            self.assertEqual(response.json()[field], ['Seul le bureau peut modifier cette information.'])
        self.user.refresh_from_db()
        self.assertEqual((self.user.first_name, self.user.last_name, self.user.territory), ('Aminata', 'Ndiaye', self.dakar))

    def test_numero_et_date_d_adhesion_non_modifiables(self):
        self.assertEqual(self.patch({'number': 'TBX-2020-00001'}).status_code, 400)

    def test_changement_de_photo(self):
        response = self.patch({'photo': image_file()}, multipart=True)
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()['photo_url'], '/api/members/me/photo/')
        first = Member.objects.get(pk=self.member.pk).photo.name
        self.patch({'photo': image_file('autre.png', 'PNG')}, multipart=True)
        second = Member.objects.get(pk=self.member.pk).photo.name
        self.assertNotEqual(first, second)
        self.assertFalse((Path(MEDIA_ROOT) / first).exists())  # l'ancienne photo est effacée
        self.assertEqual(self.client.get('/api/members/me/photo/').status_code, 200)

    def test_photo_invalide(self):
        response = self.patch({'photo': image_file('photo.gif', 'GIF')}, multipart=True)
        self.assertEqual(response.status_code, 400)

    def test_compte_sans_dossier(self):
        self.client.force_login(User.objects.create_user('f@example.org', 'un-mot-de-passe-long', role='fondateur'))
        self.assertEqual(self.client.get(URL).status_code, 404)

    def test_personne_non_connectee(self):
        self.client.logout()
        self.assertEqual(self.client.get(URL).status_code, 401)

    def test_pas_de_remplacement_complet(self):
        self.assertEqual(self.client.put(URL, {}, content_type='application/json').status_code, 405)

    def test_coordonnateur_le_plus_proche(self):
        self.assertIsNone(self.client.get(URL).json()['coordinator'])
        region = Territory.objects.get(name='Dakar', kind=Territory.Kind.REGION)
        far = User.objects.create_user('region@example.org', 'un-mot-de-passe-long', first_name='Mamadou', last_name='Diop',
                                       role=User.Role.COORDONNATEUR, territory=region)
        coordinator = self.client.get(URL).json()['coordinator']
        self.assertEqual(coordinator, {'first_name': 'Mamadou', 'last_name': 'Diop', 'email': 'region@example.org', 'territory': 'Dakar'})
        near = User.objects.create_user('commune@example.org', 'un-mot-de-passe-long', first_name='Rokhaya', last_name='Gueye',
                                        role=User.Role.COORDONNATEUR, territory=self.dakar)
        self.assertEqual(self.client.get(URL).json()['coordinator']['last_name'], 'Gueye')  # celui de sa commune d'abord
        near.is_active = False
        near.save()
        self.assertEqual(self.client.get(URL).json()['coordinator']['last_name'], 'Diop')  # un compte désactivé ne compte pas
        far.is_active = False
        far.save()
        self.assertIsNone(self.client.get(URL).json()['coordinator'])
