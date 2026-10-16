from datetime import date

from django.contrib.admin.sites import site
from django.contrib.sessions.models import Session
from django.core.cache import cache
from django.test import RequestFactory, TestCase

from accounts.admin import TabaxiUserAdmin
from accounts.models import User
from core.append_only import ImmutableRecordError
from territories.models import Territory

from .models import Member, MemberStatusChange

PASSWORD = 'un-mot-de-passe-long'
JSON = 'application/json'


def commune(name):
    return Territory.objects.get(name=name, kind=Territory.Kind.COMMUNE)


class StatusTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.dakar_region = Territory.objects.get(name='Dakar', kind=Territory.Kind.REGION)
        cls.pikine = commune('Pikine')
        cls.mbour = commune('Mbour')

        def person(email, first, last, role, territory, joined=date(2026, 3, 12)):
            user = User.objects.create_user(
                email, PASSWORD, first_name=first, last_name=last, role=role, territory=territory
            )
            return user, Member.objects.create(user=user, joined_on=joined, address='1, rue du Marché')

        cls.founder, cls.founder_member = person('fondateur@example.org', 'Ibrahima', 'Sow', User.Role.FONDATEUR, None)
        cls.coordinator, cls.coordinator_member = person('coord@example.org', 'Mamadou', 'Diop', User.Role.COORDONNATEUR, cls.dakar_region)
        cls.other_coordinator, _ = person('thies@example.org', 'Khady', 'Ba', User.Role.COORDONNATEUR, cls.mbour)
        cls.aminata, cls.aminata_member = person(
            'aminata@example.org', 'Aminata', 'Ndiaye', User.Role.MEMBRE, cls.pikine, date(2026, 1, 20)
        )
        cls.moussa, cls.moussa_member = person(
            'moussa@example.org', 'Moussa', 'Fall', User.Role.MEMBRE, cls.mbour, date(2026, 2, 10)
        )

    def setUp(self):
        cache.clear()

    def status_url(self, member):
        return f'/api/members/{member.pk}/status/'

    def set_status(self, member, status, reason=''):
        return self.client.post(self.status_url(member), {'status': status, 'reason': reason}, content_type=JSON)

    def login(self, email, password=PASSWORD):
        return self.client.post('/api/auth/login/', {'email': email, 'password': password}, content_type=JSON)


class ChangeStatusTests(StatusTestCase):
    def setUp(self):
        super().setUp()
        self.client.force_login(self.founder)

    def test_un_nouveau_membre_est_actif(self):
        self.assertEqual(self.aminata_member.status, Member.Status.ACTIF)
        self.assertTrue(self.aminata.is_active)

    def test_suspension(self):
        response = self.set_status(self.aminata_member, 'suspendu', 'Propos contraires au règlement.')
        self.assertEqual(response.status_code, 200, response.content)
        data = response.json()
        self.assertEqual((data['status'], data['status_label']), ('suspendu', 'Suspendu'))
        self.aminata.refresh_from_db()
        self.assertFalse(self.aminata.is_active)
        change = MemberStatusChange.objects.get()
        self.assertEqual(
            (change.member, change.from_status, change.to_status, change.reason, change.changed_by),
            (self.aminata_member, 'actif', 'suspendu', 'Propos contraires au règlement.', self.founder),
        )

    def test_radiation_puis_reactivation(self):
        self.set_status(self.aminata_member, 'radie', 'Fraude constatée.')
        self.aminata.refresh_from_db()
        self.assertFalse(self.aminata.is_active)
        response = self.set_status(self.aminata_member, 'actif')
        self.assertEqual(response.status_code, 200)
        self.aminata.refresh_from_db()
        self.assertTrue(self.aminata.is_active)
        self.assertEqual(Member.objects.get(pk=self.aminata_member.pk).status, 'actif')

    def test_motif_obligatoire_pour_suspendre_ou_radier(self):
        for status, message in (('suspendu', 'Indiquez le motif de la suspension.'), ('radie', 'Indiquez le motif de la radiation.')):
            for reason in ('', '   '):
                response = self.set_status(self.aminata_member, status, reason)
                self.assertEqual(response.status_code, 400)
                self.assertEqual(response.json()['reason'], [message])
        self.aminata.refresh_from_db()
        self.assertTrue(self.aminata.is_active)
        self.assertFalse(MemberStatusChange.objects.exists())

    def test_motif_facultatif_pour_rendre_actif(self):
        self.set_status(self.aminata_member, 'suspendu', 'Test')
        self.assertEqual(self.set_status(self.aminata_member, 'actif').status_code, 200)

    def test_statut_inconnu_ou_absent(self):
        self.assertEqual(self.set_status(self.aminata_member, 'banni', 'x').status_code, 400)
        response = self.client.post(self.status_url(self.aminata_member), {}, content_type=JSON)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()['status'], ['Choisissez le nouveau statut.'])

    def test_deja_dans_ce_statut(self):
        response = self.set_status(self.aminata_member, 'actif')
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()['code'], 'same_status')
        self.assertIn('déjà « Actif »', response.json()['detail'])
        self.assertFalse(MemberStatusChange.objects.exists())

    def test_un_fondateur_ne_change_pas_son_propre_statut(self):
        response = self.set_status(self.founder_member, 'suspendu', 'Essai')
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()['code'], 'own_status')
        self.founder.refresh_from_db()
        self.assertTrue(self.founder.is_active)

    def test_un_coordonnateur_peut_etre_suspendu(self):
        self.assertEqual(self.set_status(self.coordinator_member, 'suspendu', 'Absence prolongée.').status_code, 200)
        self.coordinator.refresh_from_db()
        self.assertFalse(self.coordinator.is_active)

    def test_membre_inconnu(self):
        self.assertEqual(self.client.post('/api/members/9999/status/', {'status': 'actif'}, content_type=JSON).status_code, 404)


class AccessControlTests(StatusTestCase):
    def test_seuls_les_fondateurs_changent_un_statut(self):
        self.client.force_login(self.coordinator)
        self.assertEqual(self.set_status(self.aminata_member, 'suspendu', 'x').status_code, 403)
        self.client.force_login(self.aminata)
        self.assertEqual(self.set_status(self.moussa_member, 'suspendu', 'x').status_code, 403)
        self.client.logout()
        self.assertEqual(self.set_status(self.moussa_member, 'suspendu', 'x').status_code, 401)
        self.assertFalse(MemberStatusChange.objects.exists())

    def test_un_membre_simple_n_a_pas_acces_a_la_base(self):
        self.client.force_login(self.aminata)
        self.assertEqual(self.client.get('/api/members/').status_code, 403)
        self.assertEqual(self.client.get(f'/api/members/{self.moussa_member.pk}/').status_code, 403)
        self.assertEqual(self.client.get(f'/api/members/{self.moussa_member.pk}/photo/').status_code, 403)


class LoginAfterStatusChangeTests(StatusTestCase):
    def test_un_membre_suspendu_ne_peut_plus_se_connecter(self):
        self.assertEqual(self.login('aminata@example.org').status_code, 200)
        self.client.logout()
        self.client.force_login(self.founder)
        self.set_status(self.aminata_member, 'suspendu', 'Motif.')
        self.client.logout()

        response = self.login('aminata@example.org')
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()['code'], 'inactive_account')
        self.assertIn('suspendu', response.json()['detail'])
        self.assertEqual(self.client.get('/api/auth/me/').status_code, 401)

    def test_un_membre_radie_ne_peut_plus_se_connecter(self):
        self.client.force_login(self.founder)
        self.set_status(self.aminata_member, 'radie', 'Motif.')
        self.client.logout()
        response = self.login('aminata@example.org')
        self.assertEqual(response.status_code, 403)
        self.assertIn('radié', response.json()['detail'])

    def test_un_mauvais_mot_de_passe_ne_revele_pas_le_statut(self):
        self.client.force_login(self.founder)
        self.set_status(self.aminata_member, 'suspendu', 'Motif.')
        self.client.logout()
        response = self.login('aminata@example.org', 'mauvais-mot-de-passe')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()['code'], 'invalid_credentials')

    def test_la_session_ouverte_est_fermee_aussitot(self):
        member_client = self.client_class()
        member_client.force_login(self.aminata)
        self.assertEqual(member_client.get('/api/auth/me/').status_code, 200)

        self.client.force_login(self.founder)
        self.set_status(self.aminata_member, 'suspendu', 'Motif.')
        self.assertEqual(member_client.get('/api/auth/me/').status_code, 401)

        # Réactivé, le membre doit se reconnecter : l'ancienne session ne revient pas.
        self.set_status(self.aminata_member, 'actif')
        self.assertEqual(member_client.get('/api/auth/me/').status_code, 401)
        self.assertEqual(self.login('aminata@example.org').status_code, 200)

    def test_les_sessions_des_autres_comptes_restent_ouvertes(self):
        other = self.client_class()
        other.force_login(self.moussa)
        before = Session.objects.count()
        self.client.force_login(self.founder)
        self.set_status(self.aminata_member, 'suspendu', 'Motif.')
        self.assertEqual(other.get('/api/auth/me/').status_code, 200)
        self.assertGreaterEqual(Session.objects.count(), before)

    def test_reactive_le_membre_se_reconnecte(self):
        self.client.force_login(self.founder)
        self.set_status(self.aminata_member, 'radie', 'Motif.')
        self.set_status(self.aminata_member, 'actif')
        self.client.logout()
        self.assertEqual(self.login('aminata@example.org').status_code, 200)

    def test_pas_de_lien_de_mot_de_passe_pour_un_compte_suspendu(self):
        from django.core import mail

        self.client.force_login(self.founder)
        self.set_status(self.aminata_member, 'suspendu', 'Motif.')
        self.client.logout()
        self.client.post('/api/auth/password/forgot/', {'email': 'aminata@example.org'}, content_type=JSON)
        self.assertEqual(len(mail.outbox), 0)


class HistoryTests(StatusTestCase):
    def setUp(self):
        super().setUp()
        self.client.force_login(self.founder)

    def test_l_historique_garde_tous_les_changements(self):
        self.set_status(self.aminata_member, 'suspendu', 'Premier motif.')
        self.set_status(self.aminata_member, 'actif', 'Levée de la suspension.')
        self.set_status(self.aminata_member, 'radie', 'Second motif.')
        history = self.client.get(f'/api/members/{self.aminata_member.pk}/').json()['status_history']
        self.assertEqual(
            [(h['from_status'], h['to_status'], h['reason']) for h in history],
            [
                ('actif', 'radie', 'Second motif.'),
                ('suspendu', 'actif', 'Levée de la suspension.'),
                ('actif', 'suspendu', 'Premier motif.'),
            ],
        )
        self.assertEqual(history[0]['changed_by'], {'id': self.founder.pk, 'first_name': 'Ibrahima', 'last_name': 'Sow'})
        self.assertIn('changed_at', history[0])

    def test_rien_n_est_efface(self):
        number = self.aminata_member.number
        self.set_status(self.aminata_member, 'radie', 'Motif.')
        member = Member.objects.get(pk=self.aminata_member.pk)
        self.assertEqual((member.number, member.address, member.user.email), (number, '1, rue du Marché', 'aminata@example.org'))

    def test_un_fondateur_seul_voit_l_historique(self):
        self.set_status(self.aminata_member, 'suspendu', 'Motif confidentiel.')
        self.client.force_login(self.coordinator)
        data = self.client.get(f'/api/members/{self.aminata_member.pk}/').json()
        self.assertEqual(data['status'], 'suspendu')
        self.assertIsNone(data['status_history'])
        self.assertNotIn('Motif confidentiel.', str(data))

    def test_l_historique_ne_se_modifie_pas(self):
        self.set_status(self.aminata_member, 'suspendu', 'Motif.')
        change = MemberStatusChange.objects.get()
        change.reason = 'Réécrit'
        with self.assertRaises(ImmutableRecordError):
            change.save()
        with self.assertRaises(ImmutableRecordError):
            change.delete()
        with self.assertRaises(ImmutableRecordError):
            MemberStatusChange.objects.update(reason='Réécrit')
        with self.assertRaises(ImmutableRecordError):
            MemberStatusChange.objects.all().delete()
        self.assertEqual(MemberStatusChange.objects.get().reason, 'Motif.')

    def test_un_membre_avec_historique_ne_se_supprime_pas(self):
        from django.db.models import ProtectedError

        self.set_status(self.aminata_member, 'suspendu', 'Motif.')
        with self.assertRaises(ProtectedError):
            Member.objects.get(pk=self.aminata_member.pk).delete()

    def test_l_administration_ne_permet_ni_suppression_ni_changement_de_statut(self):
        request = RequestFactory().get('/')
        request.user = self.founder
        admin = site._registry[Member]
        self.assertFalse(admin.has_delete_permission(request, self.aminata_member))
        self.assertIn('status', admin.readonly_fields)
        user_admin = TabaxiUserAdmin(User, site)
        self.assertIn('is_active', user_admin.get_readonly_fields(request, self.aminata))
        orphan = User.objects.create_user('sans-dossier@example.org', PASSWORD)
        self.assertNotIn('is_active', user_admin.get_readonly_fields(request, orphan))


class MemberBaseTests(StatusTestCase):
    url = '/api/members/'

    def names(self, response):
        return [f"{row['first_name']} {row['last_name']}" for row in response.json()['results']]

    def test_un_fondateur_voit_tous_les_membres(self):
        self.client.force_login(self.founder)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['count'], 2)
        row = response.json()['results'][0]
        self.assertEqual(
            set(row),
            {'id', 'number', 'first_name', 'last_name', 'email', 'role', 'role_label', 'territory', 'joined_on', 'status', 'status_label'},
        )

    def test_les_plus_recents_d_abord(self):
        self.client.force_login(self.founder)
        self.assertEqual(self.names(self.client.get(self.url)), ['Moussa Fall', 'Aminata Ndiaye'])
        self.assertEqual(self.names(self.client.get(self.url, {'ordering': 'date'})), ['Aminata Ndiaye', 'Moussa Fall'])

    def test_tri_par_nom_et_par_territoire(self):
        self.client.force_login(self.founder)
        self.assertEqual(self.names(self.client.get(self.url, {'ordering': 'name'})), ['Moussa Fall', 'Aminata Ndiaye'])
        self.assertEqual(self.names(self.client.get(self.url, {'ordering': '-name'})), ['Aminata Ndiaye', 'Moussa Fall'])
        self.assertEqual(self.names(self.client.get(self.url, {'ordering': 'place'})), ['Moussa Fall', 'Aminata Ndiaye'])
        self.assertEqual(self.client.get(self.url, {'ordering': 'age'}).status_code, 400)

    def test_un_coordonnateur_ne_voit_que_son_territoire(self):
        self.client.force_login(self.coordinator)  # région de Dakar : Pikine, pas Mbour
        self.assertEqual(self.names(self.client.get(self.url)), ['Aminata Ndiaye'])
        self.assertEqual(self.client.get(f'/api/members/{self.aminata_member.pk}/').status_code, 200)
        self.assertEqual(self.client.get(f'/api/members/{self.moussa_member.pk}/').status_code, 404)
        self.assertEqual(self.client.get(f'/api/members/{self.moussa_member.pk}/photo/').status_code, 404)

    def test_filtre_par_statut(self):
        self.client.force_login(self.founder)
        self.set_status(self.moussa_member, 'suspendu', 'Motif.')
        self.assertEqual(self.names(self.client.get(self.url, {'status': 'suspendu'})), ['Moussa Fall'])
        self.assertEqual(self.names(self.client.get(self.url, {'status': 'actif'})), ['Aminata Ndiaye'])
        self.assertEqual(self.client.get(self.url, {'status': 'banni'}).status_code, 400)

    def test_recherche_par_nom_courriel_ou_numero(self):
        self.client.force_login(self.founder)
        self.assertEqual(self.names(self.client.get(self.url, {'search': 'aminata'})), ['Aminata Ndiaye'])
        self.assertEqual(self.names(self.client.get(self.url, {'search': 'NDIAYE aminata'})), ['Aminata Ndiaye'])
        self.assertEqual(self.names(self.client.get(self.url, {'search': 'moussa@example'})), ['Moussa Fall'])
        self.assertEqual(self.names(self.client.get(self.url, {'search': self.moussa_member.number})), ['Moussa Fall'])
        self.assertEqual(self.names(self.client.get(self.url, {'search': 'inconnu'})), [])

    def test_filtre_par_role(self):
        self.client.force_login(self.founder)
        self.assertEqual(self.names(self.client.get(self.url, {'role': 'coordonnateur'})), ['Khady Ba', 'Mamadou Diop'])
        self.assertEqual(self.client.get(self.url, {'role': 'roi'}).status_code, 400)

    def test_pagination(self):
        self.client.force_login(self.founder)
        data = self.client.get(self.url, {'page_size': 1}).json()
        self.assertEqual((data['count'], len(data['results'])), (2, 1))
        self.assertIsNotNone(data['next'])

    def test_personne_non_connectee(self):
        self.assertEqual(self.client.get(self.url).status_code, 401)

    def test_fiche_complete(self):
        self.client.force_login(self.founder)
        data = self.client.get(f'/api/members/{self.aminata_member.pk}/').json()
        self.assertEqual(data['address'], '1, rue du Marché')
        self.assertEqual(data['territory']['name'], 'Pikine')
        self.assertEqual(data['status_history'], [])
        self.assertIsNone(data['photo_url'])
