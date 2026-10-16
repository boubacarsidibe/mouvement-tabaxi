from io import StringIO

from cryptography.fernet import Fernet
from django.core.management import call_command
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TestCase, TransactionTestCase, override_settings
from django.utils import timezone

from accounts.models import User
from applications.models import Application
from applications.tests.helpers import make_application
from territories.models import Territory

from .crypto import DecryptionError

KEY_1 = Fernet.generate_key().decode()
KEY_2 = Fernet.generate_key().decode()
MOTIVATION = "Je veux agir pour l'éducation civique des jeunes de Podor."


def raw(application, field):
    """Valeur réellement stockée en base, sans passer par le modèle."""
    with connection.cursor() as cursor:
        cursor.execute(f'SELECT {field} FROM applications_application WHERE id = %s', [application.pk])
        return cursor.fetchone()[0]


def write_raw(application, field, value):
    with connection.cursor() as cursor:
        cursor.execute(f'UPDATE applications_application SET {field} = %s WHERE id = %s', [value, application.pk])


class EncryptedFieldTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.podor = Territory.objects.get(name='Podor')

    def test_motivation_jamais_en_clair_en_base(self):
        application = make_application(self.podor, motivation=MOTIVATION)
        stored = raw(application, 'motivation')
        self.assertNotIn('éducation', stored)
        self.assertTrue(stored.startswith('gAAAAA'))
        self.assertEqual(Application.objects.get(pk=application.pk).motivation, MOTIVATION)

    def test_motif_et_note_chiffres(self):
        application = make_application(self.podor, rejection_reason='Hors territoire', internal_note='Rappeler en 2027')
        self.assertTrue(raw(application, 'rejection_reason').startswith('gAAAAA'))
        self.assertTrue(raw(application, 'internal_note').startswith('gAAAAA'))
        application.refresh_from_db()
        self.assertEqual((application.rejection_reason, application.internal_note), ('Hors territoire', 'Rappeler en 2027'))

    def test_valeur_vide_reste_vide(self):
        application = make_application(self.podor)
        self.assertEqual(raw(application, 'rejection_reason'), '')

    def test_deux_chiffrements_differents(self):
        first = make_application(self.podor, email='a@example.org', motivation=MOTIVATION)
        second = make_application(self.podor, email='b@example.org', motivation=MOTIVATION)
        self.assertNotEqual(raw(first, 'motivation'), raw(second, 'motivation'))

    def test_api_renvoie_le_texte_en_clair_aux_fondateurs(self):
        application = make_application(self.podor, motivation=MOTIVATION)
        self.client.force_login(User.objects.create_user('f@example.org', 'un-mot-de-passe-long', role='fondateur'))
        data = self.client.get(f'/api/applications/{application.pk}/').json()
        self.assertEqual(data['motivation'], MOTIVATION)

    def test_depot_public_chiffre_la_motivation(self):
        response = self.client.post('/api/applications/', {
            'first_name': 'Awa', 'last_name': 'Ndiaye', 'email': 'awa@example.org', 'territory': self.podor.pk,
            'profession': 'Enseignante', 'motivation': MOTIVATION, 'consent': True,
        }, content_type='application/json')
        self.assertEqual(response.status_code, 201)
        self.assertTrue(raw(Application.objects.get(), 'motivation').startswith('gAAAAA'))

    def test_mauvaise_cle_signalee_plutot_que_du_charabia(self):
        with override_settings(FIELD_ENCRYPTION_KEYS=[KEY_1]):
            application = make_application(self.podor, motivation=MOTIVATION)
        with override_settings(FIELD_ENCRYPTION_KEYS=[KEY_2]):
            with self.assertRaises(DecryptionError):
                Application.objects.get(pk=application.pk)


class KeyRotationTests(TestCase):
    def test_changement_de_cle_sans_perte(self):
        podor = Territory.objects.get(name='Podor')
        with override_settings(FIELD_ENCRYPTION_KEYS=[KEY_1]):
            application = make_application(podor, motivation=MOTIVATION)
        # Nouvelle clé en tête, ancienne derrière : tout reste lisible.
        with override_settings(FIELD_ENCRYPTION_KEYS=[KEY_2, KEY_1]):
            self.assertEqual(Application.objects.get(pk=application.pk).motivation, MOTIVATION)
            out = StringIO()
            call_command('rechiffrer', stdout=out)
            self.assertIn('applications.Application : 1 ligne(s)', out.getvalue())
        # Après rechiffrement, l'ancienne clé peut être retirée.
        with override_settings(FIELD_ENCRYPTION_KEYS=[KEY_2]):
            self.assertEqual(Application.objects.get(pk=application.pk).motivation, MOTIVATION)

    def test_texte_ancien_en_clair_lu_puis_chiffre(self):
        application = make_application(Territory.objects.get(name='Podor'))
        write_raw(application, 'motivation', 'Texte saisi avant le chiffrement')
        self.assertEqual(Application.objects.get(pk=application.pk).motivation, 'Texte saisi avant le chiffrement')
        call_command('rechiffrer', stdout=StringIO())
        self.assertTrue(raw(application, 'motivation').startswith('gAAAAA'))
        self.assertEqual(Application.objects.get(pk=application.pk).motivation, 'Texte saisi avant le chiffrement')


class EncryptionMigrationTests(TransactionTestCase):
    """La migration chiffre les demandes déjà en base, et le retour arrière les remet en clair."""

    serialized_rollback = True  # remet les territoires de départ pour les tests suivants
    before = [('applications', '0003_lien_personnel')]
    after = [('applications', '0004_chiffrement_donnees_sensibles')]

    def migrate(self, targets):
        executor = MigrationExecutor(connection)
        executor.loader.build_graph()
        executor.migrate(targets)
        return executor.loader.project_state(targets).apps

    def tearDown(self):
        self.migrate(executor_leaf_nodes())

    def test_aller_et_retour(self):
        old_apps = self.migrate(self.before)
        Territory = old_apps.get_model('territories', 'Territory')
        OldApplication = old_apps.get_model('applications', 'Application')
        old = OldApplication.objects.create(
            first_name='Awa', last_name='Ndiaye', email='awa@example.org', profession='Enseignante',
            territory=Territory.objects.get(name='Podor'), motivation=MOTIVATION, consent_at=timezone.now(),
        )
        self.assertEqual(raw(old, 'motivation'), MOTIVATION)

        self.migrate(self.after)
        self.assertTrue(raw(old, 'motivation').startswith('gAAAAA'))
        self.assertEqual(Application.objects.get(pk=old.pk).motivation, MOTIVATION)

        self.migrate(self.before)
        self.assertEqual(raw(old, 'motivation'), MOTIVATION)


def executor_leaf_nodes():
    executor = MigrationExecutor(connection)
    return executor.loader.graph.leaf_nodes()
