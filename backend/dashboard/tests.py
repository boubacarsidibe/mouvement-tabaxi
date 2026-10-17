from datetime import date, timedelta

from django.core.cache import cache
from django.test import TestCase
from django.utils import timezone

from accounts.models import User
from applications.models import Application
from applications.tests.helpers import make_application
from audit.models import AuditEntry
from audit.services import record
from members.models import Member
from programs.models import Program
from territories.models import Territory

from .services import month_starts

PASSWORD = 'un-mot-de-passe-long'
URL = '/api/dashboard/'


def territory(name, kind=Territory.Kind.COMMUNE):
    return Territory.objects.get(name=name, kind=kind)


def months_ago(count, day=15):
    """Un jour du mois qui précède de ``count`` mois le mois en cours."""
    today = timezone.localdate()
    index = today.year * 12 + today.month - 1 - count
    return date(index // 12, index % 12 + 1, day)


class DashboardTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.dakar = territory('Dakar', Territory.Kind.REGION)
        cls.thies = territory('Thiès', Territory.Kind.REGION)
        cls.pikine, cls.rufisque, cls.mbour = territory('Pikine'), territory('Rufisque'), territory('Mbour')
        cls.podor = territory('Podor')

        def person(email, first, last, role, place, joined, status=Member.Status.ACTIF):
            user = User.objects.create_user(email, PASSWORD, first_name=first, last_name=last, role=role, territory=place)
            Member.objects.create(user=user, joined_on=joined, status=status)
            if status != Member.Status.ACTIF:
                user.is_active = False
                user.save()
            return user

        cls.founder = person('fondateur@example.org', 'Ibrahima', 'Sow', 'fondateur', None, months_ago(14))
        cls.coord_dakar = person('dakar@example.org', 'Mamadou', 'Diop', 'coordonnateur', cls.dakar, months_ago(5))
        cls.coord_thies = person('thies@example.org', 'Khady', 'Ba', 'coordonnateur', cls.thies, months_ago(3))
        cls.coord_suspendu = person(
            'ancien@example.org', 'Ancien', 'Coord', 'coordonnateur', cls.dakar, months_ago(8), Member.Status.SUSPENDU
        )
        today = timezone.localdate()
        person('a@example.org', 'Awa', 'Ndiaye', 'membre', cls.pikine, date(today.year, today.month, 1))  # ce mois-ci
        person('b@example.org', 'Bineta', 'Fall', 'membre', cls.pikine, months_ago(1))
        person('c@example.org', 'Cheikh', 'Sarr', 'membre', cls.pikine, months_ago(13))  # trop ancien pour le graphique
        person('d@example.org', 'Dame', 'Thiam', 'membre', cls.rufisque, months_ago(2))
        person('e@example.org', 'Élimane', 'Kane', 'membre', cls.mbour, date(today.year, today.month, 1))
        person('f@example.org', 'Fatou', 'Diallo', 'membre', cls.mbour, months_ago(1), Member.Status.SUSPENDU)
        person('g@example.org', 'Gora', 'Mbaye', 'membre', cls.mbour, months_ago(11))

        cls.a1 = make_application(cls.podor, email='p1@example.org', first_name='Omar', last_name='Niang')
        cls.a2 = make_application(cls.pikine, email='p2@example.org', first_name='Rama', last_name='Sy')
        cls.a3 = make_application(cls.mbour, email='p3@example.org', first_name='Sidy', last_name='Ly')
        make_application(cls.pikine, email='p4@example.org', status=Application.Status.ACCEPTEE)
        make_application(cls.pikine, email='p5@example.org', status=Application.Status.REJETEE)

    def setUp(self):
        cache.clear()

    def get(self, user):
        self.client.force_login(user)
        response = self.client.get(URL)
        self.assertEqual(response.status_code, 200, response.content)
        return response.json()

    def count(self, url, **params):
        return self.client.get(url, params).json()['count']


class FigureTests(DashboardTestCase):
    def test_fondateur_voit_les_chiffres_de_tout_le_mouvement(self):
        data = self.get(self.founder)
        self.assertEqual(data['scope'], {'all': True, 'territory': None})
        self.assertEqual(data['active_members'], 6)  # Awa, Bineta, Cheikh, Dame, Élimane, Gora (Fatou est suspendue)
        self.assertEqual(data['coordinators'], 3)  # le fondateur et les deux coordonnateurs actifs
        self.assertEqual(data['pending_applications'], 3)
        self.assertEqual(data['joined_this_month'], 2)  # Awa et Élimane

    def test_un_coordonnateur_ne_voit_que_son_territoire(self):
        data = self.get(self.coord_dakar)  # région de Dakar : Pikine et Rufisque
        self.assertEqual(data['scope']['territory']['name'], 'Dakar')
        self.assertEqual(data['scope']['all'], False)
        self.assertEqual(data['active_members'], 4)  # Awa, Bineta, Cheikh, Dame
        self.assertEqual(data['coordinators'], 1)  # lui-même : le coordonnateur suspendu n'est pas compté
        self.assertEqual(data['pending_applications'], 1)  # la demande de Pikine seulement
        self.assertEqual(data['joined_this_month'], 1)
        other = self.get(self.coord_thies)  # région de Thiès : Mbour
        self.assertEqual((other['active_members'], other['coordinators'], other['pending_applications']), (2, 1, 1))

    def test_les_chiffres_correspondent_aux_listes(self):
        for user in (self.founder, self.coord_dakar, self.coord_thies):
            with self.subTest(user=user.email):
                data = self.get(user)
                self.assertEqual(data['active_members'], self.count('/api/members/', status='actif'))
                self.assertEqual(
                    data['coordinators'], self.count('/api/members/', status='actif', role='coordonnateur,fondateur')
                )
                self.assertEqual(
                    data['joined_this_month'],
                    self.count('/api/members/', joined_from=timezone.localdate().replace(day=1).isoformat()),
                )
        self.client.force_login(self.founder)
        self.assertEqual(self.get(self.founder)['pending_applications'], self.count('/api/applications/', status='a_examiner'))

    def test_un_membre_suspendu_ou_une_demande_decidee_ne_comptent_pas(self):
        before = self.get(self.founder)
        Member.objects.filter(user__email='b@example.org').update(status=Member.Status.SUSPENDU)
        Application.objects.filter(pk=self.a1.pk).update(status=Application.Status.REJETEE)
        after = self.get(self.founder)
        self.assertEqual(after['active_members'], before['active_members'] - 1)
        self.assertEqual(after['pending_applications'], before['pending_applications'] - 1)


class TerritoryBreakdownTests(DashboardTestCase):
    def test_repartition_par_territoire_pour_un_fondateur(self):
        rows = self.get(self.founder)['territories']
        summary = [(r['territory']['name'], r['members'], r['coordinators']) for r in rows]
        # Les territoires qui ont des actifs, les plus nombreux d'abord, puis par nom.
        self.assertEqual(
            summary,
            [('Pikine', 3, 0), ('Mbour', 2, 0), ('Rufisque', 1, 0), ('Dakar', 0, 1), ('Thiès', 0, 1)],
        )
        self.assertEqual(rows[0]['territory']['path'], 'Sénégal › Dakar › Pikine')
        self.assertEqual(rows[0]['territory']['kind_label'], 'Commune')

    def test_repartition_limitee_au_territoire(self):
        rows = self.get(self.coord_dakar)['territories']
        self.assertEqual([(r['territory']['name'], r['members'], r['coordinators']) for r in rows], [('Pikine', 3, 0), ('Rufisque', 1, 0), ('Dakar', 0, 1)])
        self.assertNotIn('Mbour', [r['territory']['name'] for r in rows])

    def test_la_somme_de_la_repartition_est_le_total(self):
        for user in (self.founder, self.coord_dakar, self.coord_thies):
            data = self.get(user)
            self.assertEqual(sum(r['members'] for r in data['territories']), data['active_members'])


class MonthlyTests(DashboardTestCase):
    def test_douze_mois_du_plus_ancien_au_mois_en_cours(self):
        data = self.get(self.founder)['monthly_joined']
        self.assertEqual(len(data), 12)
        self.assertEqual(data[-1]['month'], timezone.localdate().strftime('%Y-%m'))
        self.assertEqual([row['month'] for row in data], sorted(row['month'] for row in data))

    def test_nouveaux_membres_par_mois(self):
        by_month = {row['month']: row['count'] for row in self.get(self.founder)['monthly_joined']}
        this_month = timezone.localdate().strftime('%Y-%m')
        self.assertEqual(by_month[this_month], 2)  # Awa et Élimane
        self.assertEqual(by_month[months_ago(1).strftime('%Y-%m')], 2)  # Bineta et Fatou (suspendue : elle a bien adhéré)
        self.assertEqual(by_month[months_ago(2).strftime('%Y-%m')], 1)  # Dame
        self.assertEqual(by_month[months_ago(11).strftime('%Y-%m')], 1)  # Gora : le plus ancien des douze mois
        self.assertNotIn(months_ago(13).strftime('%Y-%m'), by_month)  # Cheikh : hors du graphique
        self.assertEqual(sum(by_month.values()), 6)

    def test_un_coordonnateur_ne_compte_que_son_territoire(self):
        by_month = {row['month']: row['count'] for row in self.get(self.coord_thies)['monthly_joined']}
        self.assertEqual(sum(by_month.values()), 3)  # Élimane, Fatou, Gora
        self.assertEqual(by_month[months_ago(2).strftime('%Y-%m')], 0)  # Dame est à Rufisque

    def test_les_mois_sans_adhesion_valent_zero(self):
        values = [row['count'] for row in self.get(self.founder)['monthly_joined']]
        self.assertIn(0, values)

    def test_premiers_jours_des_mois(self):
        starts = month_starts(date(2026, 2, 10))
        self.assertEqual(starts[0], date(2025, 3, 1))
        self.assertEqual(starts[-1], date(2026, 2, 1))
        self.assertEqual(len(starts), 12)
        self.assertEqual(month_starts(date(2026, 12, 31))[0], date(2026, 1, 1))


class PanelsAndAccessTests(DashboardTestCase):
    def test_demandes_recentes_et_actions_pour_les_fondateurs(self):
        record(AuditEntry.Action.LIST_EXPORTED, actor=self.founder, subject='Base des membres', rows=3)
        data = self.get(self.founder)
        self.assertEqual(
            [item['last_name'] for item in data['recent_applications']], ['Ly', 'Sy', 'Niang']
        )  # les plus récentes d'abord
        self.assertEqual(set(data['recent_applications'][0]), {'id', 'reference', 'first_name', 'last_name', 'territory', 'created_at'})
        self.assertEqual([a['action'] for a in data['recent_actions']], ['liste_exportee'])
        self.assertEqual(data['recent_actions'][0]['actor']['name'], 'Ibrahima Sow')

    def test_pas_de_demandes_ni_de_journal_pour_un_coordonnateur(self):
        record(AuditEntry.Action.LIST_EXPORTED, actor=self.founder, subject='Base des membres', rows=3)
        data = self.get(self.coord_dakar)
        self.assertIsNone(data['recent_applications'])
        self.assertIsNone(data['recent_actions'])

    def test_reserve_au_bureau(self):
        self.client.force_login(User.objects.get(email='a@example.org'))
        self.assertEqual(self.client.get(URL).status_code, 403)
        self.client.logout()
        self.assertEqual(self.client.get(URL).status_code, 401)

    def test_lecture_seule(self):
        self.client.force_login(self.founder)
        self.assertEqual(self.client.post(URL, {}, content_type='application/json').status_code, 405)


class ProgramsFiguresTests(DashboardTestCase):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        today = timezone.localdate()

        def program(name, place, status, start, end):
            return Program.objects.create(
                name=name, objective='Objectif.', territory=place, status=status,
                start_date=today + timedelta(days=start), end_date=today + timedelta(days=end),
            )

        cls.p1 = program('Brigades', cls.pikine, Program.Status.ONGOING, -30, 30)
        cls.p2 = program('Santé', cls.dakar, Program.Status.PLANNED, 10, 60)
        cls.p3 = program('Éducation', cls.mbour, Program.Status.ONGOING, -5, 90)
        cls.p4 = program('Ancien', cls.pikine, Program.Status.DONE, -90, -30)
        cls.p5 = program('Abandonné', cls.rufisque, Program.Status.CANCELLED, 5, 20)
        cls.p6 = program('Sans suite', cls.rufisque, Program.Status.PLANNED, -60, -10)  # prévu mais déjà fini

    def test_programmes_en_cours_dans_le_perimetre(self):
        self.assertEqual(self.get(self.founder)['programs_in_progress'], 2)
        self.assertEqual(self.get(self.coord_dakar)['programs_in_progress'], 1)  # Brigades (Pikine)
        self.assertEqual(self.get(self.coord_thies)['programs_in_progress'], 1)  # Éducation (Mbour)

    def test_les_chiffres_correspondent_a_la_liste(self):
        for user in (self.founder, self.coord_dakar, self.coord_thies):
            data = self.get(user)
            self.assertEqual(data['programs_in_progress'], self.count('/api/programs/', status='en_cours'))

    def test_prochains_programmes(self):
        rows = self.get(self.founder)['upcoming_programs']
        self.assertEqual([row['name'] for row in rows], ['Brigades', 'Éducation', 'Santé'])  # par début, sans terminé, annulé ni fini
        self.assertEqual(rows[0]['territory'], 'Pikine')
        self.assertEqual((rows[2]['status'], rows[2]['status_label']), ('prevu', 'Prévu'))
        self.assertEqual([row['name'] for row in self.get(self.coord_dakar)['upcoming_programs']], ['Brigades', 'Santé'])
        self.assertEqual([row['name'] for row in self.get(self.coord_thies)['upcoming_programs']], ['Éducation'])

    def test_quatre_programmes_au_plus(self):
        today = timezone.localdate()
        for index in range(6):
            Program.objects.create(
                name=f'Extra {index}', objective='x', territory=self.pikine, start_date=today + timedelta(days=100 + index),
                end_date=today + timedelta(days=130 + index),
            )
        self.assertEqual(len(self.get(self.founder)['upcoming_programs']), 4)
