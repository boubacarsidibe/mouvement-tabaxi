import shutil
import tempfile
from datetime import timedelta
from io import BytesIO
from pathlib import Path
from unittest import mock

from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import connection
from django.test import TestCase, override_settings
from django.utils import timezone
from PIL import Image

from accounts.models import User
from applications.models import Application, RegistrationLink
from applications.tests.helpers import make_application
from territories.models import Territory

from .models import Member

PASSWORD = 'Baobab-solide-2026'
MEDIA_ROOT = tempfile.mkdtemp(prefix='tabaxi-photos-')
PHOTOS_DIR = Path(MEDIA_ROOT) / 'photos'


def image_file(name='photo.jpg', image_format='JPEG', size=(1600, 1200), exif=None):
    buffer = BytesIO()
    image = Image.new('RGB', size, (14, 90, 60))
    options = {'exif': exif} if exif is not None else {}
    image.save(buffer, format=image_format, **options)
    content_type = 'image/png' if image_format == 'PNG' else 'image/jpeg'
    return SimpleUploadedFile(name, buffer.getvalue(), content_type=content_type)


def gps_exif():
    exif = Image.Exif()
    exif[0x8825] = {1: 'N', 2: (14.0, 41.0, 0.0), 3: 'W', 4: (17.0, 26.0, 0.0)}  # position GPS
    exif[0x010F] = 'Appareil de test'
    return exif


@override_settings(MEDIA_ROOT=MEDIA_ROOT)
class RegistrationTestCase(TestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(MEDIA_ROOT, ignore_errors=True)

    @classmethod
    def setUpTestData(cls):
        cls.podor = Territory.objects.get(name='Podor')

    def setUp(self):
        cache.clear()  # remet à zéro la limite d'envois
        self.application = make_application(self.podor, status=Application.Status.ACCEPTEE)
        self.link, self.token = RegistrationLink.issue(self.application)

    def check(self, token=None):
        return self.client.post('/api/registration/check/', {'token': token or self.token}, content_type='application/json')

    def register(self, **changes):
        data = {
            'token': self.token,
            'address': '12, rue Blaise-Diagne, Podor',
            'phone': '+221 77 123 45 67',
            'photo': image_file(),
            'password': PASSWORD,
            'password_confirm': PASSWORD,
            'accept_rules': 'true',
        }
        data.update(changes)
        data = {key: value for key, value in data.items() if value is not None}
        return self.client.post('/api/registration/', data)  # formulaire multipart, comme l'écran


class CheckLinkTests(RegistrationTestCase):
    def test_lien_valable(self):
        response = self.check()
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual((data['first_name'], data['last_name'], data['email']), ('Awa', 'Ndiaye', 'awa.ndiaye@example.org'))
        self.assertEqual(data['territory']['path'], 'Sénégal › Saint-Louis › Podor')
        self.assertIn('expires_at', data)

    def test_lien_inconnu(self):
        response = self.check('jeton-invente')
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()['code'], 'invalid_link')

    def test_lien_expire_explique_quoi_faire(self):
        with mock.patch('django.utils.timezone.now', return_value=timezone.now() + timedelta(days=7, seconds=1)):
            response = self.check()
        self.assertEqual(response.status_code, 410)
        self.assertEqual(response.json()['code'], 'link_expired')
        self.assertIn('Écrivez au mouvement pour en recevoir un nouveau', response.json()['detail'])

    def test_lien_deja_utilise_explique_quoi_faire(self):
        self.link.mark_used()
        response = self.check()
        self.assertEqual(response.status_code, 410)
        self.assertEqual(response.json()['code'], 'link_used')
        self.assertIn('Connectez-vous', response.json()['detail'])

    def test_jeton_absent(self):
        response = self.client.post('/api/registration/check/', {}, content_type='application/json')
        self.assertEqual(response.status_code, 404)


class RegistrationTests(RegistrationTestCase):
    def test_finalisation_cree_un_membre_simple_actif(self):
        response = self.register()
        self.assertEqual(response.status_code, 201, response.content)
        user = User.objects.get(email='awa.ndiaye@example.org')
        self.assertEqual(user.role, User.Role.MEMBRE)
        self.assertTrue(user.is_active)
        self.assertEqual(user.territory, self.podor)
        self.assertEqual((user.first_name, user.last_name), ('Awa', 'Ndiaye'))
        self.assertTrue(user.check_password(PASSWORD))
        member = user.member
        self.assertRegex(member.number, r'^TBX-\d{4}-\d{5}$')
        self.assertEqual(member.joined_on, timezone.localdate())
        self.assertEqual(member.application, self.application)
        self.assertIsNotNone(member.rules_accepted_at)
        data = response.json()
        self.assertEqual(data['member_number'], member.number)
        self.assertEqual(data['user']['role'], 'membre')

    def test_demande_marquee_inscrite_et_lien_consomme(self):
        self.register()
        self.application.refresh_from_db()
        self.assertEqual(self.application.status, Application.Status.INSCRITE)
        self.link.refresh_from_db()
        self.assertTrue(self.link.is_used)

    def test_session_ouverte_apres_la_finalisation(self):
        self.register()
        self.assertEqual(self.client.get('/api/auth/me/').json()['email'], 'awa.ndiaye@example.org')

    def test_le_membre_peut_ensuite_se_connecter(self):
        self.register()
        self.client.logout()
        response = self.client.post(
            '/api/auth/login/', {'email': 'awa.ndiaye@example.org', 'password': PASSWORD}, content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['role'], 'membre')

    def test_le_lien_ne_marche_qu_une_fois(self):
        self.assertEqual(self.register().status_code, 201)
        self.client.logout()
        response = self.register()
        self.assertEqual(response.status_code, 410)
        self.assertEqual(response.json()['code'], 'link_used')
        self.assertEqual(User.objects.filter(email__iexact='awa.ndiaye@example.org').count(), 1)

    def test_le_lien_ne_marche_que_7_jours(self):
        with mock.patch('django.utils.timezone.now', return_value=timezone.now() + timedelta(days=7, seconds=1)):
            response = self.register()
        self.assertEqual(response.status_code, 410)
        self.assertEqual(response.json()['code'], 'link_expired')
        self.assertFalse(User.objects.filter(email__iexact='awa.ndiaye@example.org').exists())

    def test_adresse_et_telephone_chiffres_en_base(self):
        self.register()
        member = Member.objects.get()
        with connection.cursor() as cursor:
            cursor.execute('SELECT address, phone FROM members_member WHERE id = %s', [member.pk])
            address, phone = cursor.fetchone()
        self.assertTrue(address.startswith('gAAAAA') and phone.startswith('gAAAAA'))
        self.assertEqual((member.address, member.phone), ('12, rue Blaise-Diagne, Podor', '+221 77 123 45 67'))

    def test_telephone_facultatif(self):
        self.assertEqual(self.register(phone=None).status_code, 201)
        self.assertEqual(Member.objects.get().phone, '')

    def test_telephone_invalide(self):
        response = self.register(phone='appelez-moi')
        self.assertEqual(response.status_code, 400)
        self.assertIn('numéro de téléphone valide', response.json()['phone'][0])

    def test_compte_deja_existant(self):
        User.objects.create_user('Awa.Ndiaye@example.org', 'un-autre-mot-de-passe')
        response = self.register()
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()['code'], 'account_exists')
        self.link.refresh_from_db()
        self.assertFalse(self.link.is_used)

    def test_tout_est_annule_en_cas_d_erreur(self):
        photos_before = set(PHOTOS_DIR.glob('*.jpg'))
        with mock.patch.object(Application, 'save', side_effect=RuntimeError('panne')):
            with self.assertRaises(RuntimeError):
                self.register()
        self.assertFalse(User.objects.filter(email__iexact='awa.ndiaye@example.org').exists())
        self.assertFalse(Member.objects.exists())
        self.link.refresh_from_db()
        self.assertFalse(self.link.is_used)
        self.assertEqual(set(PHOTOS_DIR.glob('*.jpg')), photos_before)


class PasswordRulesTests(RegistrationTestCase):
    def assert_password_refused(self, password, message):
        response = self.register(password=password, password_confirm=password)
        self.assertEqual(response.status_code, 400)
        self.assertIn(message, ' '.join(response.json()['password']))
        self.assertFalse(User.objects.filter(email__iexact='awa.ndiaye@example.org').exists())

    def test_au_moins_10_caracteres(self):
        self.assert_password_refused('Court-1', 'au minimum 10 caractères')

    def test_pas_seulement_des_chiffres(self):
        self.assert_password_refused('2026202620262026', 'entièrement numérique')

    def test_pas_un_mot_de_passe_courant(self):
        self.assert_password_refused('password123', 'trop courant')

    def test_pas_semblable_au_courriel(self):
        self.assert_password_refused('awa.ndiaye@example', 'trop semblable')

    def test_confirmation_differente(self):
        response = self.register(password_confirm='Autre-mot-de-passe-2026')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()['password_confirm'], ['Les deux mots de passe ne correspondent pas.'])


class PhotoTests(RegistrationTestCase):
    def test_photo_obligatoire(self):
        response = self.register(photo=None)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()['photo'], ['Ajoutez une photo de profil.'])

    def test_fichier_qui_n_est_pas_une_image(self):
        fake = SimpleUploadedFile('photo.jpg', b'<?php echo "pas une image"; ?>', content_type='image/jpeg')
        response = self.register(photo=fake)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()['photo'], ['Choisissez une photo au format JPG ou PNG.'])

    def test_format_refuse(self):
        response = self.register(photo=image_file('photo.gif', 'GIF'))
        self.assertEqual(response.status_code, 400)

    def test_photo_trop_lourde(self):
        heavy = SimpleUploadedFile('photo.jpg', b'0' * (5 * 1024 * 1024 + 1), content_type='image/jpeg')
        response = self.register(photo=heavy)
        self.assertEqual(response.status_code, 400)
        self.assertIn('5 Mo', response.json()['photo'][0])

    def test_png_accepte(self):
        self.assertEqual(self.register(photo=image_file('photo.png', 'PNG')).status_code, 201)

    def test_photo_reduite_et_sans_metadonnees(self):
        self.register(photo=image_file(exif=gps_exif()))
        with Member.objects.get().photo.open('rb') as stored, Image.open(stored) as image:
            self.assertEqual(image.format, 'JPEG')
            self.assertLessEqual(max(image.size), 800)
            self.assertEqual(dict(image.getexif()), {})

    def test_photo_servie_seulement_a_son_proprietaire(self):
        self.register()
        response = self.client.get('/api/members/me/photo/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Content-Type'], 'image/jpeg')
        self.assertTrue(response['Cache-Control'].startswith('private'))
        self.client.logout()
        self.assertEqual(self.client.get('/api/members/me/photo/').status_code, 401)

    def test_compte_sans_photo(self):
        self.client.force_login(User.objects.create_user('f@example.org', 'un-mot-de-passe-long', role='fondateur'))
        self.assertEqual(self.client.get('/api/members/me/photo/').status_code, 404)


class RulesTests(RegistrationTestCase):
    def test_statuts_et_reglement_a_accepter(self):
        response = self.register(accept_rules='false')
        self.assertEqual(response.status_code, 400)
        self.assertIn('statuts et le règlement intérieur', response.json()['accept_rules'][0])

    def test_adresse_obligatoire(self):
        response = self.register(address='')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()['address'], ['Ce champ ne peut être vide.'])
