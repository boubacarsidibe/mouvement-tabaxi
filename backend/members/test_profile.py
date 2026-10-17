import shutil
import tempfile
from io import BytesIO
from pathlib import Path

from django.test import TestCase, override_settings
from django.test.client import BOUNDARY, MULTIPART_CONTENT, encode_multipart
from PIL import Image

from accounts.models import User
from territories.models import Territory

from core.models import StoredFile

from .models import Member
from .test_registration import image_file

MEDIA_ROOT = tempfile.mkdtemp(prefix='tabaxi-profil-')
URL = '/api/members/me/'
URL_PHOTO = '/api/members/me/photo/'


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

    def test_courriel_et_territoire_non_modifiables_par_le_membre(self):
        thies = Territory.objects.get(name='Thiès', kind=Territory.Kind.COMMUNE)
        for field, value in (('territory', thies.pk), ('email', 'x@example.org')):
            response = self.patch({field: value})
            self.assertEqual(response.status_code, 400, field)
            self.assertEqual(response.json()[field], ['Seul le bureau peut modifier cette information.'])
        self.user.refresh_from_db()
        self.assertEqual((self.user.email, self.user.territory), ('aminata@example.org', self.dakar))

    def test_le_membre_modifie_son_nom(self):
        response = self.patch({'first_name': ' Awa ', 'last_name': 'Fall'})
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual((response.json()['first_name'], response.json()['last_name']), ('Awa', 'Fall'))
        response = self.patch({'last_name': 'Fall Diop'})  # et le modifie encore plus tard
        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual((self.user.first_name, self.user.last_name), ('Awa', 'Fall Diop'))
        self.assertEqual(self.client.get('/api/auth/me/').json()['last_name'], 'Fall Diop')

    def test_numero_et_date_d_adhesion_non_modifiables(self):
        self.assertEqual(self.patch({'number': 'TBX-2020-00001'}).status_code, 400)

    def test_changement_de_photo(self):
        response = self.patch({'photo': image_file()}, multipart=True)
        self.assertEqual(response.status_code, 200, response.content)
        first_url = response.json()['photo_url']
        self.assertTrue(first_url.startswith('/api/members/me/photo/?v='))
        first = Member.objects.get(pk=self.member.pk).photo.name
        response = self.patch({'photo': image_file('autre.png', 'PNG')}, multipart=True)
        self.assertEqual(response.status_code, 200, response.content)
        second = Member.objects.get(pk=self.member.pk).photo.name
        self.assertNotEqual(first, second)
        self.assertFalse((Path(MEDIA_ROOT) / first).exists())  # l'ancienne photo est effacée
        # Nouvelle adresse à chaque photo : le navigateur ne ressert pas l'ancienne depuis son cache.
        self.assertNotEqual(response.json()['photo_url'], first_url)
        self.assertEqual(self.client.get(response.json()['photo_url']).status_code, 200)

    def test_photo_changee_plusieurs_fois_de_suite(self):
        urls, names = set(), []
        for index in range(4):
            response = self.patch({'photo': image_file(f'photo-{index}.jpg', size=(500 + 10 * index, 400))}, multipart=True)
            self.assertEqual(response.status_code, 200, response.content)
            urls.add(response.json()['photo_url'])
            names.append(Member.objects.get(pk=self.member.pk).photo.name)
        self.assertEqual(len(urls), 4)
        # Seule la dernière reste : les précédentes sont effacées une à une.
        self.assertEqual([(Path(MEDIA_ROOT) / name).exists() for name in names], [False, False, False, True])
        with Image.open(BytesIO(b''.join(self.client.get(URL_PHOTO).streaming_content))) as image:
            self.assertEqual(image.size, (530, 400))  # c'est bien la dernière envoyée qui est servie

    def test_retrait_de_la_photo(self):
        self.patch({'photo': image_file()}, multipart=True)
        name = Member.objects.get(pk=self.member.pk).photo.name
        response = self.client.delete(URL_PHOTO)
        self.assertEqual(response.status_code, 204)
        self.assertFalse((Path(MEDIA_ROOT) / name).exists())
        self.assertIsNone(self.client.get(URL).json()['photo_url'])
        self.assertEqual(self.client.get(URL_PHOTO).status_code, 404)
        self.assertEqual(self.client.delete(URL_PHOTO).status_code, 204)  # déjà retirée : rien à faire
        # Une nouvelle photo peut ensuite être ajoutée.
        self.assertEqual(self.patch({'photo': image_file()}, multipart=True).status_code, 200)
        self.assertEqual(self.client.get(URL_PHOTO).status_code, 200)

    def test_retrait_reserve_a_la_personne_connectee(self):
        self.client.logout()
        self.assertEqual(self.client.delete(URL_PHOTO).status_code, 401)

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


class NameAndLocalityTests(TestCase):
    """Compte créé sans nom (premier fondateur) : la personne renseigne son nom ; la carte montre le pays."""

    @classmethod
    def setUpTestData(cls):
        cls.founder = User.objects.create_user(
            'fondateur@example.org', 'un-mot-de-passe-long', role=User.Role.FONDATEUR
        )
        cls.member = Member.objects.create(user=cls.founder)

    def setUp(self):
        self.client.force_login(self.founder)

    def patch(self, data):
        return self.client.patch(URL, data, content_type='application/json')

    def test_nom_vide_renseigne_par_la_personne(self):
        response = self.patch({'first_name': ' Boubacar ', 'last_name': 'Sidibe'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual((response.json()['first_name'], response.json()['last_name']), ('Boubacar', 'Sidibe'))
        self.founder.refresh_from_db()
        self.assertEqual((self.founder.first_name, self.founder.last_name), ('Boubacar', 'Sidibe'))

    def test_nom_renseigne_puis_modifie(self):
        self.patch({'first_name': 'Boubacar', 'last_name': 'Sidibe'})
        response = self.patch({'first_name': 'Bouba'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['first_name'], 'Bouba')

    def test_nom_vide_refuse(self):
        response = self.patch({'first_name': '   '})
        self.assertEqual(response.status_code, 400)
        self.assertIn('first_name', response.json())

    def test_localite_du_pays_sans_territoire(self):
        self.assertEqual(self.client.get(URL).json()['locality'], 'Sénégal')

    def test_localite_du_territoire(self):
        dakar = Territory.objects.get(name='Dakar', kind=Territory.Kind.COMMUNE)
        self.founder.territory = dakar
        self.founder.save()
        self.assertEqual(self.client.get(URL).json()['locality'], 'Dakar')


@override_settings(STORAGES={
    'default': {'BACKEND': 'core.storage.DatabaseStorage'},
    'staticfiles': {'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage'},
})
class PhotoInDatabaseTests(TestCase):
    """Même parcours avec les photos gardées en base, comme en ligne (DJANGO_FILE_STORAGE=database)."""

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user('moussa@example.org', 'un-mot-de-passe-long', first_name='Moussa', last_name='Ba')
        cls.member = Member.objects.create(user=cls.user, address='Thiès')

    def setUp(self):
        self.client.force_login(self.user)

    def send(self, photo):
        return self.client.patch(URL, encode_multipart(BOUNDARY, {'photo': photo}), content_type=MULTIPART_CONTENT)

    def test_changer_puis_retirer_la_photo(self):
        first = self.send(image_file())
        self.assertEqual(first.status_code, 200, first.content)
        second = self.send(image_file('autre.png', 'PNG', size=(400, 300)))
        self.assertEqual(second.status_code, 200, second.content)
        self.assertNotEqual(first.json()['photo_url'], second.json()['photo_url'])
        self.assertEqual(StoredFile.objects.count(), 1)  # l'ancienne photo est effacée de la base
        with Image.open(BytesIO(b''.join(self.client.get(second.json()['photo_url']).streaming_content))) as image:
            self.assertEqual(image.size, (400, 300))  # c'est bien la nouvelle qui est servie
        self.assertEqual(self.client.delete(URL_PHOTO).status_code, 204)
        self.assertEqual(StoredFile.objects.count(), 0)
        self.assertIsNone(self.client.get(URL).json()['photo_url'])
