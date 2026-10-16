from .test_status import StatusTestCase


class MemberFilterTests(StatusTestCase):
    url = '/api/members/'

    def names(self, **params):
        response = self.client.get(self.url, params)
        self.assertEqual(response.status_code, 200, response.content)
        return [f"{row['first_name']} {row['last_name']}" for row in response.json()['results']]

    def setUp(self):
        super().setUp()
        self.client.force_login(self.founder)

    def test_filtre_par_commune(self):
        self.assertEqual(self.names(territory=self.pikine.pk), ['Aminata Ndiaye'])
        self.assertEqual(self.names(territory=self.mbour.pk), ['Moussa Fall'])

    def test_filtre_par_region_inclut_les_communes(self):
        self.assertEqual(self.names(territory=self.dakar_region.pk), ['Aminata Ndiaye'])

    def test_filtre_par_territoire_pour_les_coordonnateurs(self):
        self.assertEqual(self.names(role='coordonnateur', territory=self.dakar_region.pk), ['Mamadou Diop'])

    def test_territoire_inconnu(self):
        for value in ('999999', 'abc'):
            response = self.client.get(self.url, {'territory': value})
            self.assertEqual(response.status_code, 400)
            self.assertEqual(response.json()['territory'], ['Localité inconnue.'])

    def test_un_coordonnateur_ne_sort_pas_de_son_territoire(self):
        self.client.force_login(self.coordinator)  # région de Dakar
        self.assertEqual(self.names(territory=self.mbour.pk), [])
        self.assertEqual(self.names(territory=self.pikine.pk), ['Aminata Ndiaye'])

    def test_filtre_par_date_d_adhesion(self):
        self.assertEqual(self.names(joined_from='2026-02-01'), ['Moussa Fall'])
        self.assertEqual(self.names(joined_to='2026-02-09'), ['Aminata Ndiaye'])
        self.assertEqual(self.names(joined_from='2026-01-20', joined_to='2026-02-10'), ['Moussa Fall', 'Aminata Ndiaye'])

    def test_dates_invalides(self):
        response = self.client.get(self.url, {'joined_from': '12/03/2026'})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()['joined_from'], ['Saisissez une date valide au format AAAA-MM-JJ.'])
        response = self.client.get(self.url, {'joined_from': '2026-03-01', 'joined_to': '2026-01-01'})
        self.assertEqual(response.json()['joined_to'], ['La date de fin doit suivre la date de début.'])

    def test_filtres_combines_avec_la_recherche(self):
        self.assertEqual(self.names(territory=self.dakar_region.pk, search='fall'), [])
        self.assertEqual(self.names(joined_from='2026-01-01', search='aminata'), ['Aminata Ndiaye'])
