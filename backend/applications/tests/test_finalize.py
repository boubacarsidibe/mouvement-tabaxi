import tempfile
from datetime import timedelta

from django.conf import settings
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone

from accounts.models import User
from applications.models import Application, RegistrationLink
from members.models import Member
from territories.models import Territory

from .helpers import make_application


class FinalizeRegistrationTests(TestCase):
    def setUp(self):
        self.media = tempfile.TemporaryDirectory(dir=settings.BASE_DIR)
        self.override = override_settings(MEDIA_ROOT=self.media.name)
        self.override.enable()
        self.application = make_application(Territory.objects.get(name='Podor'))
        self.application.status = Application.Status.ACCEPTEE
        self.application.save(update_fields=('status', 'updated_at'))
        self.link, self.token = RegistrationLink.issue(self.application)

    def tearDown(self):
        self.override.disable()
        self.media.cleanup()

    def photo(self):
        return SimpleUploadedFile('portrait.jpg', b'fake-jpeg-content', content_type='image/jpeg')

    def payload(self, **extra):
        return {
            'token': self.token,
            'address': '12 rue des Jardins, Podor',
            'photo': self.photo(),
            'password': 'Mot-de-passe-solide-2026',
            'password_confirm': 'Mot-de-passe-solide-2026',
            **extra,
        }

    def test_apercu_du_lien(self):
        response = self.client.get('/api/applications/finalize/', {'token': self.token})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['first_name'], 'Awa')
        self.assertEqual(response.json()['territory']['name'], 'Podor')

    def test_finalisation_cree_un_membre_actif(self):
        response = self.client.post('/api/applications/finalize/', self.payload())
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()['status'], 'inscrite')
        self.assertRegex(response.json()['membership_number'], r'^TBX-\d{4}-\d{5}$')

        user = User.objects.get(email='awa.ndiaye@example.org')
        self.assertTrue(user.check_password('Mot-de-passe-solide-2026'))
        self.assertEqual(user.role, User.Role.MEMBRE)
        member = Member.objects.get(user=user)
        self.assertEqual(member.status, Member.Status.ACTIF)
        self.assertEqual(member.territory, self.application.territory)
        self.assertEqual(member.address, '12 rue des Jardins, Podor')

        self.application.refresh_from_db()
        self.link.refresh_from_db()
        self.assertEqual(self.application.status, Application.Status.INSCRITE)
        self.assertIsNotNone(self.link.used_at)

    def test_lien_ne_fonctionne_qu_une_fois(self):
        self.assertEqual(self.client.post('/api/applications/finalize/', self.payload()).status_code, 201)
        response = self.client.post('/api/applications/finalize/', self.payload())
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()['code'], 'used_link')
        self.assertEqual(Member.objects.count(), 1)

    def test_lien_expire_explique_la_suite(self):
        RegistrationLink.objects.filter(pk=self.link.pk).update(expires_at=timezone.now() - timedelta(seconds=1))
        response = self.client.get('/api/applications/finalize/', {'token': self.token})
        self.assertEqual(response.status_code, 410)
        self.assertEqual(response.json()['code'], 'expired_link')
        self.assertIn('Contactez le bureau', response.json()['detail'])

    def test_lien_inconnu(self):
        response = self.client.get('/api/applications/finalize/', {'token': 'jeton-inconnu'})
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()['code'], 'invalid_link')

    def test_erreur_de_formulaire_ne_consomme_pas_le_lien(self):
        response = self.client.post(
            '/api/applications/finalize/',
            self.payload(password_confirm='pas-le-meme-mot-de-passe'),
        )
        self.assertEqual(response.status_code, 400)
        self.link.refresh_from_db()
        self.assertIsNone(self.link.used_at)
        self.assertFalse(Member.objects.exists())
