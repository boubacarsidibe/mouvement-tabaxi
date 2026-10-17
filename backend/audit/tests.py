from datetime import timedelta

from django.contrib.admin.sites import site
from django.core import mail
from django.core.cache import cache
from django.db import connection
from django.db.models import ProtectedError
from django.test import RequestFactory, TestCase, override_settings
from django.utils import timezone

from accounts.models import User
from applications.tests.helpers import make_application
from core.append_only import ImmutableRecordError
from members.models import Member
from territories.models import Territory

from .models import AuditEntry
from .services import record

PASSWORD = 'un-mot-de-passe-long'
JSON = 'application/json'
FAILING_MAILER = {'default': {'BACKEND': 'core.tests.FailingBackend'}}


class AuditTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.dakar = Territory.objects.get(name='Dakar', kind=Territory.Kind.REGION)
        cls.pikine = Territory.objects.get(name='Pikine')
        cls.podor = Territory.objects.get(name='Podor')
        cls.founder = User.objects.create_user(
            'fondateur@example.org', PASSWORD, first_name='Ibrahima', last_name='Sow', role=User.Role.FONDATEUR
        )
        cls.other_founder = User.objects.create_user(
            'autre@example.org', PASSWORD, first_name='Aïssatou', last_name='Ba', role=User.Role.FONDATEUR
        )
        cls.coordinator = User.objects.create_user(
            'coord@example.org', PASSWORD, first_name='Mamadou', last_name='Diop',
            role=User.Role.COORDONNATEUR, territory=cls.dakar,
        )
        cls.member_user = User.objects.create_user(
            'aminata@example.org', PASSWORD, first_name='Aminata', last_name='Ndiaye', territory=cls.pikine
        )
        cls.member = Member.objects.create(user=cls.member_user)

    def setUp(self):
        cache.clear()


class RecordedActionsTests(AuditTestCase):
    def post(self, url, payload=None):
        return self.client.post(url, payload or {}, content_type=JSON)

    def test_acceptation_d_une_demande(self):
        application = make_application(self.podor)
        self.client.force_login(self.founder)
        self.assertEqual(self.post(f'/api/applications/{application.public_id}/accept/').status_code, 200)
        entry = AuditEntry.objects.get()
        self.assertEqual(entry.action, 'demande_acceptee')
        self.assertEqual((entry.actor, entry.actor_name), (self.founder, 'Ibrahima Sow'))
        self.assertEqual(entry.subject, 'Awa Ndiaye')
        self.assertEqual(entry.details, {'reference': application.reference, 'territory': 'Podor'})

    def test_refus_d_une_demande_avec_son_motif(self):
        application = make_application(self.podor)
        self.client.force_login(self.founder)
        response = self.post(f'/api/applications/{application.public_id}/reject/', {'reason': 'Dossier incomplet.'})
        self.assertEqual(response.status_code, 200)
        entry = AuditEntry.objects.get()
        self.assertEqual(entry.action, 'demande_refusee')
        self.assertEqual(entry.details['reason'], 'Dossier incomplet.')
        self.assertEqual(entry.details['reference'], application.reference)

    @override_settings(MAILERS=FAILING_MAILER)
    def test_une_decision_annulee_n_est_pas_journalisee(self):
        application = make_application(self.podor)
        self.client.force_login(self.founder)
        with self.assertLogs('core.mail', level='ERROR'):
            self.assertEqual(self.post(f'/api/applications/{application.public_id}/accept/').status_code, 503)
            self.assertEqual(self.post(f'/api/applications/{application.public_id}/reject/', {'reason': 'Motif.'}).status_code, 503)
        self.assertFalse(AuditEntry.objects.exists())

    def test_une_decision_refusee_n_est_pas_journalisee(self):
        application = make_application(self.podor)
        self.client.force_login(self.founder)
        self.post(f'/api/applications/{application.public_id}/accept/')
        self.assertEqual(self.post(f'/api/applications/{application.public_id}/accept/').status_code, 409)
        self.assertEqual(AuditEntry.objects.count(), 1)

    def test_changement_de_statut(self):
        self.client.force_login(self.founder)
        response = self.post(f'/api/members/{self.member.public_id}/status/', {'status': 'suspendu', 'reason': 'Propos contraires.'})
        self.assertEqual(response.status_code, 200)
        entry = AuditEntry.objects.get()
        self.assertEqual(entry.action, 'statut_modifie')
        self.assertEqual(entry.subject, 'Aminata Ndiaye')
        self.assertEqual(
            entry.details,
            {
                'number': self.member.number, 'from_status': 'actif', 'to_status': 'suspendu',
                'from_label': 'Actif', 'to_label': 'Suspendu', 'reason': 'Propos contraires.',
            },
        )

    def test_un_changement_refuse_n_est_pas_journalise(self):
        self.client.force_login(self.founder)
        self.assertEqual(self.post(f'/api/members/{self.member.public_id}/status/', {'status': 'actif'}).status_code, 409)
        self.assertEqual(self.post(f'/api/members/{self.member.public_id}/status/', {'status': 'radie'}).status_code, 400)
        self.assertFalse(AuditEntry.objects.exists())

    def invite(self, **changes):
        payload = {
            'email': 'khady@example.org', 'first_name': 'Khady', 'last_name': 'Ba',
            'role': 'coordonnateur', 'territory': self.dakar.pk, **changes,
        }
        return self.post('/api/auth/invitations/', payload)

    def test_invitation(self):
        self.client.force_login(self.founder)
        self.assertEqual(self.invite().status_code, 201)
        entry = AuditEntry.objects.get()
        self.assertEqual(entry.action, 'invitation_envoyee')
        self.assertEqual((entry.subject, entry.actor), ('Khady Ba', self.founder))
        self.assertEqual(
            entry.details,
            {'email': 'khady@example.org', 'role': 'coordonnateur', 'role_label': 'Coordonnateur', 'territory': 'Dakar'},
        )

    def test_invitation_d_un_fondateur_sans_territoire(self):
        self.client.force_login(self.founder)
        self.assertEqual(self.invite(role='fondateur', territory=None).status_code, 201)
        self.assertEqual(AuditEntry.objects.get().details['territory'], '')

    @override_settings(MAILERS=FAILING_MAILER)
    def test_une_invitation_non_envoyee_n_est_pas_journalisee(self):
        self.client.force_login(self.founder)
        with self.assertLogs('core.mail', level='ERROR'):
            self.assertEqual(self.invite().status_code, 503)
        self.assertFalse(AuditEntry.objects.exists())
        self.assertEqual(len(mail.outbox), 0)


class ConsultationTests(AuditTestCase):
    url = '/api/audit/'

    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        record(AuditEntry.Action.APPLICATION_ACCEPTED, actor=cls.founder, subject='Awa Ndiaye', reference='TAB-2026-00001', territory='Podor')
        record(AuditEntry.Action.APPLICATION_REJECTED, actor=cls.other_founder, subject='Moussa Fall', reference='TAB-2026-00002', territory='Dakar', reason='Dossier incomplet.')
        record(AuditEntry.Action.STATUS_CHANGED, actor=cls.founder, subject='Aminata Ndiaye', number='TBX-2026-00003', from_label='Actif', to_label='Suspendu', reason='Motif.')
        record(AuditEntry.Action.INVITATION_SENT, actor=cls.other_founder, subject='Khady Ba', email='khady@example.org', role_label='Coordonnateur', territory='Dakar')
        record(AuditEntry.Action.LIST_EXPORTED, actor=cls.founder, subject='Base des membres', rows=12, filters={'Localité': 'Dakar', 'Statut': 'Actif'})
        cls.entries = list(AuditEntry.objects.order_by('id'))

    def get(self, **params):
        return self.client.get(self.url, params)

    def test_reserve_aux_fondateurs(self):
        self.client.force_login(self.coordinator)
        self.assertEqual(self.get().status_code, 403)
        self.assertEqual(self.client.get('/api/audit/actors/').status_code, 403)
        self.client.force_login(self.member_user)
        self.assertEqual(self.get().status_code, 403)
        self.client.logout()
        self.assertEqual(self.get().status_code, 401)

    def test_du_plus_recent_au_plus_ancien_avec_le_detail(self):
        self.client.force_login(self.founder)
        data = self.get().json()
        self.assertEqual(data['count'], 5)
        self.assertEqual([row['action'] for row in data['results']], [e.action for e in reversed(self.entries)])
        first = data['results'][0]
        self.assertEqual(
            (first['action_label'], first['category'], first['category_label'], first['subject']),
            ('Liste exportée', 'export', 'Export', 'Base des membres'),
        )
        self.assertEqual(first['detail'], '12 lignes · Localité : Dakar, Statut : Actif')
        self.assertEqual(first['actor'], {'id': self.founder.pk, 'name': 'Ibrahima Sow'})

    def test_phrases_du_detail(self):
        self.client.force_login(self.founder)
        by_action = {row['action']: row['detail'] for row in self.get().json()['results']}
        self.assertEqual(by_action['demande_acceptee'], 'TAB-2026-00001 · Podor')
        self.assertEqual(by_action['demande_refusee'], 'TAB-2026-00002 · Dakar · Motif : Dossier incomplet.')
        self.assertEqual(by_action['statut_modifie'], 'TBX-2026-00003 · Actif → Suspendu · Motif : Motif.')
        self.assertEqual(by_action['invitation_envoyee'], 'Coordonnateur · Dakar · khady@example.org')

    def test_filtre_par_action(self):
        self.client.force_login(self.founder)
        rows = self.get(action='demande_refusee').json()['results']
        self.assertEqual([row['subject'] for row in rows], ['Moussa Fall'])
        self.assertEqual(self.get(action='inconnue').status_code, 400)

    def test_filtre_par_auteur(self):
        self.client.force_login(self.founder)
        rows = self.get(actor=self.other_founder.pk).json()['results']
        self.assertEqual(sorted(row['subject'] for row in rows), ['Khady Ba', 'Moussa Fall'])
        self.assertEqual(self.get(actor='abc').status_code, 400)

    def test_recherche(self):
        self.client.force_login(self.founder)
        self.assertEqual([r['subject'] for r in self.get(search='khady').json()['results']], ['Khady Ba'])
        self.assertEqual(len(self.get(search='sow').json()['results']), 3)  # auteur
        self.assertEqual(self.get(search='sow khady').json()['count'], 0)

    def test_filtre_par_periode(self):
        old = self.entries[0]
        # La date d'une ligne ne se change pas par le code : on la recule par le SQL pour le test.
        with connection.cursor() as cursor:
            cursor.execute(
                'UPDATE audit_auditentry SET created_at = %s WHERE id = %s',
                [timezone.now() - timedelta(days=40), old.pk],
            )
        self.client.force_login(self.founder)
        today = timezone.localdate().isoformat()
        self.assertEqual(self.get(date_from=today).json()['count'], 4)
        self.assertEqual(self.get(date_to=(timezone.localdate() - timedelta(days=30)).isoformat()).json()['count'], 1)
        self.assertEqual(self.get(date_from='2020-01-01', date_to=today).json()['count'], 5)
        self.assertEqual(self.get(date_from='hier').status_code, 400)
        self.assertEqual(self.get(date_from='2026-03-01', date_to='2026-01-01').status_code, 400)

    def test_pages(self):
        self.client.force_login(self.founder)
        data = self.get(page_size=2).json()
        self.assertEqual((data['count'], len(data['results'])), (5, 2))
        self.assertIsNotNone(data['next'])

    def test_auteurs_proposes_au_filtre(self):
        self.client.force_login(self.founder)
        names = [row['name'] for row in self.client.get('/api/audit/actors/').json()]
        self.assertEqual(names, ['Aïssatou Ba', 'Ibrahima Sow'])


class ImmutabilityTests(AuditTestCase):
    def setUp(self):
        super().setUp()
        self.entry = record(AuditEntry.Action.LIST_EXPORTED, actor=self.founder, subject='Base des membres', rows=3)

    def test_une_ligne_ne_se_modifie_pas(self):
        self.entry.subject = 'Autre chose'
        with self.assertRaises(ImmutableRecordError):
            self.entry.save()
        self.assertEqual(AuditEntry.objects.get().subject, 'Base des membres')

    def test_une_ligne_ne_s_efface_pas(self):
        with self.assertRaises(ImmutableRecordError):
            self.entry.delete()
        with self.assertRaises(ImmutableRecordError):
            AuditEntry.objects.all().delete()
        with self.assertRaises(ImmutableRecordError):
            AuditEntry.objects.filter(pk=self.entry.pk).update(subject='x')
        with self.assertRaises(ImmutableRecordError):
            AuditEntry.objects.bulk_update([self.entry], ['subject'])
        self.assertEqual(AuditEntry.objects.count(), 1)

    def test_aucune_route_n_ecrit_dans_le_journal(self):
        self.client.force_login(self.founder)
        for method in ('post', 'put', 'patch', 'delete'):
            response = getattr(self.client, method)('/api/audit/', {}, content_type=JSON)
            self.assertEqual(response.status_code, 405, method)
            response = getattr(self.client, method)(f'/api/audit/{self.entry.pk}/', {}, content_type=JSON)
            self.assertEqual(response.status_code, 404, method)

    def test_l_administration_est_en_lecture_seule(self):
        request = RequestFactory().get('/')
        request.user = User.objects.create_superuser('root@example.org', PASSWORD)
        admin = site._registry[AuditEntry]
        self.assertFalse(admin.has_add_permission(request))
        self.assertFalse(admin.has_change_permission(request, self.entry))
        self.assertFalse(admin.has_delete_permission(request, self.entry))
        self.assertEqual(set(admin.readonly_fields), set(admin.fields))

    def test_le_nom_de_l_auteur_reste_celui_du_moment(self):
        self.founder.first_name = 'Ibra'
        self.founder.save()
        self.assertEqual(AuditEntry.objects.get().actor_name, 'Ibrahima Sow')

    def test_un_auteur_ne_se_supprime_pas(self):
        with self.assertRaises(ProtectedError):
            self.founder.delete()


def raw(table, column, pk):
    """Valeur réellement stockée en base, sans passer par le modèle."""
    with connection.cursor() as cursor:
        cursor.execute(f'SELECT {column} FROM {table} WHERE id = %s', [pk])
        return cursor.fetchone()[0]


class EncryptionTests(AuditTestCase):
    """Les motifs de refus et de suspension sont des données sensibles : jamais en clair en base."""

    SECRET = 'Motif confidentiel : accusation grave'

    def test_les_details_du_journal_sont_chiffres(self):
        entry = record(AuditEntry.Action.APPLICATION_REJECTED, actor=self.founder, subject='Awa Ndiaye', reason=self.SECRET)
        stored = raw('audit_auditentry', 'details', entry.pk)
        self.assertTrue(stored.startswith('gAAAAA'))
        self.assertNotIn('confidentiel', stored)
        self.assertEqual(AuditEntry.objects.get(pk=entry.pk).details, {'reason': self.SECRET})

    def test_le_motif_d_un_changement_de_statut_est_chiffre(self):
        self.client.force_login(self.founder)
        self.client.post(f'/api/members/{self.member.public_id}/status/', {'status': 'suspendu', 'reason': self.SECRET}, content_type=JSON)
        change = self.member.status_changes.get()
        self.assertTrue(raw('members_memberstatuschange', 'reason', change.pk).startswith('gAAAAA'))
        self.assertEqual(change.reason, self.SECRET)
        entry = AuditEntry.objects.get()
        self.assertNotIn('confidentiel', raw('audit_auditentry', 'details', entry.pk))

    def test_le_journal_lu_par_l_api_est_en_clair(self):
        record(AuditEntry.Action.APPLICATION_REJECTED, actor=self.founder, subject='Awa Ndiaye', reference='TAB-1', territory='Podor', reason=self.SECRET)
        self.client.force_login(self.founder)
        detail = self.client.get('/api/audit/').json()['results'][0]['detail']
        self.assertIn(self.SECRET, detail)

    def test_changement_de_cle_sans_perte_ni_modification_du_contenu(self):
        from io import StringIO

        from cryptography.fernet import Fernet
        from django.core.management import call_command

        key_1, key_2 = Fernet.generate_key().decode(), Fernet.generate_key().decode()
        with override_settings(FIELD_ENCRYPTION_KEYS=[key_1]):
            entry = record(AuditEntry.Action.STATUS_CHANGED, actor=self.founder, subject='Aminata Ndiaye', reason=self.SECRET)
            self.client.force_login(self.founder)
            self.client.post(f'/api/members/{self.member.public_id}/status/', {'status': 'radie', 'reason': self.SECRET}, content_type=JSON)
        with override_settings(FIELD_ENCRYPTION_KEYS=[key_2, key_1]):
            out = StringIO()
            call_command('rechiffrer', stdout=out)
            self.assertIn('audit.AuditEntry : 2 ligne(s) rechiffrée(s).', out.getvalue())
            self.assertIn('members.MemberStatusChange : 1 ligne(s) rechiffrée(s).', out.getvalue())
        # L'ancienne clé peut être retirée : tout reste lisible, et le journal n'a pas changé.
        with override_settings(FIELD_ENCRYPTION_KEYS=[key_2]):
            self.assertEqual(AuditEntry.objects.get(pk=entry.pk).details, {'reason': self.SECRET})
            self.assertEqual(self.member.status_changes.get().reason, self.SECRET)
            self.assertEqual(AuditEntry.objects.get(pk=entry.pk).subject, 'Aminata Ndiaye')
