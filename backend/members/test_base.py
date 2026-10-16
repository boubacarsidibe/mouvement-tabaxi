"""Bases des membres et des coordonnateurs : filtres territoire et date, recherche, périmètre."""

from datetime import date

from django.contrib.admin.sites import site
from django.core.cache import cache
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import RequestFactory, TestCase, TransactionTestCase
from django.utils import timezone

from accounts.admin import TabaxiUserAdmin
from accounts.models import User
from territories.models import Territory

from .models import Member

PASSWORD = 'un-mot-de-passe-long'
URL = '/api/members/'


def territory(name, kind):
    return Territory.objects.get(name=name, kind=kind)


class BaseTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.dakar_region = territory('Dakar', Territory.Kind.REGION)
        cls.thies_region = territory('Thiès', Territory.Kind.REGION)
        cls.pikine = territory('Pikine', Territory.Kind.COMMUNE)
        cls.rufisque = territory('Rufisque', Territory.Kind.COMMUNE)
        cls.mbour = territory('Mbour', Territory.Kind.COMMUNE)

        def person(email, first, last, role, place, joined):
            user = User.objects.create_user(
                email, PASSWORD, first_name=first, last_name=last, role=role, territory=place
            )
            return user, Member.objects.create(user=user, joined_on=joined)

        cls.founder, _ = person('fondateur@example.org', 'Ibrahima', 'Sow', 'fondateur', None, date(2025, 12, 1))
        cls.coord_dakar, _ = person('dakar@example.org', 'Mamadou', 'Diop', 'coordonnateur', cls.dakar_region, date(2026, 1, 6))
        cls.coord_pikine, _ = person('pikine@example.org', 'Rokhaya', 'Gueye', 'coordonnateur', cls.pikine, date(2026, 2, 2))
        cls.coord_thies, _ = person('thies@example.org', 'Khady', 'Ba', 'coordonnateur', cls.thies_region, date(2026, 3, 9))
        # Membres simples : région de Dakar (Pikine, Rufisque) et région de Thiès (Mbour).
        cls.awa, _ = person('awa@example.org', 'Awa', 'Ndiaye', 'membre', cls.pikine, date(2026, 1, 15))
        cls.bineta, _ = person('bineta@example.org', 'Bineta', 'Fall', 'membre', cls.rufisque, date(2026, 2, 20))
        cls.cheikh, _ = person('cheikh@example.org', 'Cheikh', 'Sarr', 'membre', cls.pikine, date(2026, 3, 31))
        cls.dame, _ = person('dame@example.org', 'Dame', 'Thiam', 'membre', cls.mbour, date(2026, 2, 25))
        cls.eli, _ = person('eli@example.org', 'Élimane', 'Kane', 'membre', cls.mbour, date(2026, 4, 2))

    def setUp(self):
        cache.clear()

    def names(self, response):
        self.assertEqual(response.status_code, 200, response.content)
        return sorted(row['first_name'] for row in response.json()['results'])

    def get(self, user, **params):
        self.client.force_login(user)
        return self.client.get(URL, params)


class TerritoryFilterTests(BaseTestCase):
    def test_une_region_comprend_ses_communes(self):
        names = self.names(self.get(self.founder, territory=self.dakar_region.pk))
        self.assertEqual(names, ['Awa', 'Bineta', 'Cheikh'])

    def test_une_commune_seule(self):
        self.assertEqual(self.names(self.get(self.founder, territory=self.pikine.pk)), ['Awa', 'Cheikh'])
        self.assertEqual(self.names(self.get(self.founder, territory=self.rufisque.pk)), ['Bineta'])

    def test_le_pays_comprend_tout(self):
        senegal = territory('Sénégal', Territory.Kind.PAYS)
        self.assertEqual(len(self.names(self.get(self.founder, territory=senegal.pk))), 5)

    def test_territoire_inconnu_ou_mal_forme(self):
        for value in ('999999', 'dakar', '1.5'):
            response = self.get(self.founder, territory=value)
            self.assertEqual(response.status_code, 400, value)
            self.assertEqual(response.json()['territory'], ['Localité inconnue.'])

    def test_un_coordonnateur_ne_sort_pas_de_son_perimetre(self):
        # Sans filtre : seulement la région de Dakar.
        self.assertEqual(self.names(self.get(self.coord_dakar)), ['Awa', 'Bineta', 'Cheikh'])
        # Avec le filtre d'une autre région : rien, jamais les membres de Thiès.
        self.assertEqual(self.names(self.get(self.coord_dakar, territory=self.thies_region.pk)), [])
        self.assertEqual(self.names(self.get(self.coord_dakar, territory=self.mbour.pk)), [])
        # Un sous-territoire reste permis.
        self.assertEqual(self.names(self.get(self.coord_dakar, territory=self.rufisque.pk)), ['Bineta'])

    def test_un_coordonnateur_de_commune_voit_sa_commune(self):
        self.assertEqual(self.names(self.get(self.coord_pikine)), ['Awa', 'Cheikh'])


class DateFilterTests(BaseTestCase):
    def test_periode_bornes_comprises(self):
        names = self.names(self.get(self.founder, joined_from='2026-01-15', joined_to='2026-02-25'))
        self.assertEqual(names, ['Awa', 'Bineta', 'Dame'])

    def test_une_seule_borne(self):
        self.assertEqual(self.names(self.get(self.founder, joined_from='2026-03-31')), ['Cheikh', 'Élimane'])
        self.assertEqual(self.names(self.get(self.founder, joined_to='2026-01-15')), ['Awa'])

    def test_region_et_janvier_a_mars(self):
        """Le cas du cahier des charges : « région X, janvier à mars »."""
        names = self.names(
            self.get(self.founder, territory=self.dakar_region.pk, joined_from='2026-01-01', joined_to='2026-03-31')
        )
        self.assertEqual(names, ['Awa', 'Bineta', 'Cheikh'])
        names = self.names(
            self.get(self.founder, territory=self.thies_region.pk, joined_from='2026-01-01', joined_to='2026-03-31')
        )
        self.assertEqual(names, ['Dame'])  # Élimane a rejoint le 2 avril

    def test_dates_invalides(self):
        for value in ('15/01/2026', '2026-02-30', 'hier'):
            response = self.get(self.founder, joined_from=value)
            self.assertEqual(response.status_code, 400, value)
            self.assertEqual(response.json()['joined_from'], ['Saisissez une date valide au format AAAA-MM-JJ.'])
        response = self.get(self.founder, joined_to='2026-13-01')
        self.assertEqual(response.json()['joined_to'], ['Saisissez une date valide au format AAAA-MM-JJ.'])

    def test_periode_a_l_envers(self):
        response = self.get(self.founder, joined_from='2026-03-01', joined_to='2026-01-01')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()['joined_to'], ['La date de fin doit être égale ou postérieure à la date de début.'])


class SearchAndCombinationTests(BaseTestCase):
    def test_recherche_par_nom_dans_un_territoire_et_une_periode(self):
        names = self.names(
            self.get(self.founder, search='sar', territory=self.dakar_region.pk, joined_from='2026-03-01')
        )
        self.assertEqual(names, ['Cheikh'])

    def test_recherche_sans_tenir_compte_de_la_casse_ni_de_l_ordre(self):
        self.assertEqual(self.names(self.get(self.founder, search='NDIAYE awa')), ['Awa'])
        self.assertEqual(self.names(self.get(self.founder, search='LIMANE')), ['Élimane'])

    def test_statut_et_territoire(self):
        self.client.force_login(self.founder)
        self.client.post(
            f'/api/members/{self.cheikh.pk}/status/', {'status': 'suspendu', 'reason': 'Motif.'}, content_type='application/json'
        )
        self.assertEqual(self.names(self.get(self.founder, territory=self.pikine.pk, status='suspendu')), ['Cheikh'])
        self.assertEqual(self.names(self.get(self.founder, territory=self.pikine.pk, status='actif')), ['Awa'])

    def test_le_total_suit_les_filtres_et_les_pages(self):
        data = self.get(self.founder, territory=self.dakar_region.pk, page_size=2).json()
        self.assertEqual((data['count'], len(data['results'])), (3, 2))
        self.assertIsNotNone(data['next'])


class CoordinatorsBaseTests(BaseTestCase):
    bureau = 'coordonnateur,fondateur'

    def test_un_fondateur_voit_tout_le_bureau(self):
        names = self.names(self.get(self.founder, role=self.bureau))
        self.assertEqual(names, ['Ibrahima', 'Khady', 'Mamadou', 'Rokhaya'])

    def test_seuls_les_coordonnateurs(self):
        names = self.names(self.get(self.founder, role='coordonnateur'))
        self.assertEqual(names, ['Khady', 'Mamadou', 'Rokhaya'])

    def test_un_coordonnateur_voit_les_coordonnateurs_de_son_territoire(self):
        self.assertEqual(self.names(self.get(self.coord_dakar, role=self.bureau)), ['Mamadou', 'Rokhaya'])
        self.assertEqual(self.names(self.get(self.coord_pikine, role=self.bureau)), ['Rokhaya'])
        self.assertEqual(self.names(self.get(self.coord_thies, role=self.bureau)), ['Khady'])

    def test_memes_filtres_que_la_base_des_membres(self):
        names = self.names(self.get(self.founder, role=self.bureau, territory=self.dakar_region.pk))
        self.assertEqual(names, ['Mamadou', 'Rokhaya'])
        names = self.names(self.get(self.founder, role=self.bureau, joined_from='2026-02-01', joined_to='2026-02-28'))
        self.assertEqual(names, ['Rokhaya'])
        self.assertEqual(self.names(self.get(self.founder, role=self.bureau, search='diop')), ['Mamadou'])

    def test_la_fonction_est_dans_la_ligne(self):
        rows = self.get(self.founder, role=self.bureau).json()['results']
        self.assertEqual({row['role_label'] for row in rows}, {'Coordonnateur', 'Membre fondateur'})

    def test_roles_inconnus(self):
        for value in ('roi', 'membre,roi', ','):
            self.assertEqual(self.get(self.founder, role=value).status_code, 400, value)


class BureauFilesTests(TestCase):
    def test_createsuperuser_ouvre_le_dossier_du_fondateur(self):
        founder = User.objects.create_superuser('fondateur@example.org', PASSWORD, first_name='Ibrahima', last_name='Sow')
        member = founder.member
        self.assertRegex(member.number, r'^TBX-\d{4}-\d{5}$')
        self.assertEqual(member.status, Member.Status.ACTIF)
        self.assertEqual(self.client.login(username='fondateur@example.org', password=PASSWORD), True)
        self.assertEqual(self.client.get('/api/members/me/').status_code, 200)

    def test_le_fondateur_figure_dans_la_base_du_bureau(self):
        founder = User.objects.create_superuser('fondateur@example.org', PASSWORD, first_name='Ibrahima', last_name='Sow')
        self.client.force_login(founder)
        response = self.client.get(URL, {'role': 'coordonnateur,fondateur'})
        self.assertEqual([row['first_name'] for row in response.json()['results']], ['Ibrahima'])

    def test_administration_un_compte_du_bureau_avec_mot_de_passe_recoit_un_dossier(self):
        admin = TabaxiUserAdmin(User, site)
        request = RequestFactory().post('/')
        coordinator = User(email='coord@example.org', role=User.Role.COORDONNATEUR, territory=territory('Pikine', 'commune'))
        coordinator.set_password(PASSWORD)
        admin.save_model(request, coordinator, None, False)
        self.assertTrue(Member.objects.filter(user=coordinator).exists())

        invited = User(email='invite@example.org', role=User.Role.COORDONNATEUR, territory=territory('Pikine', 'commune'))
        invited.set_unusable_password()
        admin.save_model(request, invited, None, False)
        self.assertFalse(Member.objects.filter(user=invited).exists())  # dossier ouvert à l'acceptation

        simple = User(email='membre@example.org', role=User.Role.MEMBRE)
        simple.set_password(PASSWORD)
        admin.save_model(request, simple, None, False)
        self.assertFalse(Member.objects.filter(user=simple).exists())


class BureauFilesMigrationTests(TransactionTestCase):
    """La migration ouvre un dossier aux comptes du bureau créés avant le dossier de membre."""

    serialized_rollback = True  # remet les territoires de départ pour les tests suivants
    before = [('members', '0003_statut_du_membre')]
    after = [('members', '0004_dossiers_du_bureau')]

    def migrate(self, targets):
        executor = MigrationExecutor(connection)
        executor.loader.build_graph()
        executor.migrate(targets)
        return executor.loader.project_state(targets).apps

    def tearDown(self):
        executor = MigrationExecutor(connection)
        self.migrate(executor.loader.graph.leaf_nodes())

    def test_dossiers_ouverts_pour_les_comptes_du_bureau(self):
        old_apps = self.migrate(self.before)
        OldUser = old_apps.get_model('accounts', 'User')

        def old_user(email, role, password):
            return OldUser.objects.create(email=email, role=role, password=password, date_joined=timezone.make_aware(
                timezone.datetime(2026, 1, 5, 10, 0)
            ))

        founder = old_user('fondateur@example.org', 'fondateur', 'pbkdf2_sha256$1$sel$hash')
        coordinator = old_user('coord@example.org', 'coordonnateur', 'pbkdf2_sha256$1$sel$hash')
        invited = old_user('invite@example.org', 'coordonnateur', '!inutilisable')
        simple = old_user('membre@example.org', 'membre', 'pbkdf2_sha256$1$sel$hash')

        self.migrate(self.after)
        founder_file = Member.objects.get(user_id=founder.pk)
        self.assertEqual(founder_file.joined_on, date(2026, 1, 5))
        self.assertRegex(founder_file.number, r'^TBX-2026-\d{5}$')
        self.assertEqual(founder_file.status, 'actif')
        self.assertTrue(Member.objects.filter(user_id=coordinator.pk).exists())
        self.assertFalse(Member.objects.filter(user_id=invited.pk).exists())  # invitation en attente
        self.assertFalse(Member.objects.filter(user_id=simple.pk).exists())  # un membre simple a déjà son dossier à l'inscription
