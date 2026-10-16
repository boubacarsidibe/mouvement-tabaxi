import shutil
import tempfile
from datetime import timedelta

from django.core import mail
from django.core.cache import cache
from django.test import override_settings
from django.utils import timezone

from applications.models import Application, RegistrationLink
from audit.models import AuditEntry
from members.test_registration import image_file
from territories.models import Territory

from .helpers import make_application
from .test_accept import FAILING_MAILER, AcceptTestCase, token_from_email


class ResendLinkTestCase(AcceptTestCase):
    """Demande acceptée dont la personne n'a pas encore finalisé son inscription."""

    def setUp(self):
        super().setUp()
        cache.clear()  # remet à zéro la limite d'envois de la page d'inscription
        self.accept()
        _, self.old_token = token_from_email(mail.outbox[0])
        mail.outbox.clear()

    def resend(self, application=None):
        application = application or self.awa
        return self.client.post(f'/api/applications/{application.pk}/resend-link/', content_type='application/json')

    def check(self, token):
        return self.client.post('/api/registration/check/', {'token': token}, content_type='application/json')

    def expire_links(self):
        RegistrationLink.objects.update(expires_at=timezone.now() - timedelta(minutes=1))


class ResendLinkTests(ResendLinkTestCase):
    def test_lien_expire_un_nouveau_lien_permet_de_finaliser(self):
        self.expire_links()
        self.assertEqual(self.check(self.old_token).json()['code'], 'link_expired')

        response = self.resend()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['status'], 'acceptee')
        self.assertEqual(len(mail.outbox), 1)
        message = mail.outbox[0]
        self.assertEqual(message.to, ['awa.ndiaye@example.org'])
        self.assertIn('nouveau lien', message.body)
        self.assertIn('valable 7 jours', message.body)
        _, new_token = token_from_email(message)
        self.assertNotEqual(new_token, self.old_token)
        self.assertEqual(self.check(new_token).status_code, 200)

    def test_l_ancien_lien_encore_valable_cesse_de_fonctionner(self):
        self.assertEqual(self.check(self.old_token).status_code, 200)
        self.resend()
        _, new_token = token_from_email(mail.outbox[0])
        self.assertNotEqual(self.check(self.old_token).status_code, 200)
        self.assertEqual(self.check(new_token).status_code, 200)

    def test_la_personne_peut_ensuite_devenir_membre(self):
        self.expire_links()
        self.resend()
        _, new_token = token_from_email(mail.outbox[0])
        media_root = tempfile.mkdtemp(prefix='tabaxi-photos-')
        self.addCleanup(shutil.rmtree, media_root, ignore_errors=True)
        self.client.logout()
        with override_settings(MEDIA_ROOT=media_root):
            response = self.client.post(
                '/api/registration/',
                {
                    'token': new_token,
                    'address': '12, rue Blaise-Diagne, Podor',
                    'photo': image_file(),
                    'password': 'Baobab-solide-2026',
                    'password_confirm': 'Baobab-solide-2026',
                    'accept_rules': 'true',
                },
            )
        self.assertEqual(response.status_code, 201, response.content)
        self.awa.refresh_from_db()
        self.assertEqual(self.awa.status, Application.Status.INSCRITE)

    def test_renvoi_note_dans_le_journal(self):
        self.resend()
        entry = AuditEntry.objects.get(action=AuditEntry.Action.LINK_RESENT)
        self.assertEqual(entry.actor, self.fondateur)
        self.assertEqual(entry.subject, 'Awa Ndiaye')
        self.assertEqual(entry.details['reference'], self.awa.reference)

    def test_fin_de_validite_du_dernier_lien_dans_la_fiche(self):
        self.expire_links()
        before = self.client.get(f'/api/applications/{self.awa.pk}/').json()['link_expires_at']
        self.resend()
        after = self.client.get(f'/api/applications/{self.awa.pk}/').json()['link_expires_at']
        self.assertGreater(after, before)
        latest = RegistrationLink.objects.order_by('-created_at', '-pk').first()
        self.assertGreater(latest.expires_at, timezone.now() + timedelta(days=6))


class ResendLinkRefusedTests(ResendLinkTestCase):
    def test_coordonnateur_refuse(self):
        self.client.force_login(self.coordonnateur)
        self.assertEqual(self.resend().status_code, 403)
        self.assertEqual(len(mail.outbox), 0)

    def test_visiteur_refuse(self):
        self.client.logout()
        self.assertIn(self.resend().status_code, (401, 403))

    def test_demande_a_examiner_refusee(self):
        pending = make_application(Territory.objects.get(name='Podor'), email='moussa@example.org')
        response = self.resend(pending)
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()['code'], 'not_accepted')
        self.assertEqual(len(mail.outbox), 0)

    def test_demande_rejetee_ou_inscrite_refusee(self):
        for status in (Application.Status.REJETEE, Application.Status.INSCRITE):
            Application.objects.filter(pk=self.awa.pk).update(status=status)
            response = self.resend()
            self.assertEqual(response.status_code, 409)
            self.assertEqual(response.json()['code'], 'not_accepted')
        self.assertEqual(len(mail.outbox), 0)

    @override_settings(MAILERS=FAILING_MAILER)
    def test_echec_de_l_envoi_rien_ne_change(self):
        links_before = RegistrationLink.objects.count()
        with self.assertLogs('core.mail', level='ERROR'):
            response = self.resend()
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()['code'], 'email_not_sent')
        self.assertIn("aucun nouveau lien", response.json()['detail'])
        self.assertEqual(RegistrationLink.objects.count(), links_before)
        self.assertFalse(AuditEntry.objects.filter(action=AuditEntry.Action.LINK_RESENT).exists())
        self.assertEqual(self.check(self.old_token).status_code, 200)


class DecisionMessageTests(AcceptTestCase):
    @override_settings(MAILERS=FAILING_MAILER)
    def test_message_d_echec_de_l_acceptation_inchange(self):
        with self.assertLogs('core.mail', level='ERROR'):
            response = self.accept()
        self.assertIn('reste « À examiner »', response.json()['detail'])

