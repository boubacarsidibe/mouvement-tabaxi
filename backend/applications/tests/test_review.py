from django.core import mail
from django.test import Client, TestCase, override_settings

from accounts.models import User
from applications.models import Application
from territories.models import Territory

from .helpers import make_application

PASSWORD = 'un-mot-de-passe-long'
FAILING_MAILER = {'default': {'BACKEND': 'core.tests.FailingBackend'}}


class ReviewTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.fondateur = User.objects.create_user(
            'fondateur@example.org', PASSWORD, role=User.Role.FONDATEUR, first_name='Moussa', last_name='Diop'
        )
        cls.coordonnateur = User.objects.create_user('coord@example.org', PASSWORD, role=User.Role.COORDONNATEUR)
        cls.membre = User.objects.create_user('membre@example.org', PASSWORD)
        cls.podor = Territory.objects.get(name='Podor')
        cls.dakar = Territory.objects.get(name='Dakar', kind=Territory.Kind.COMMUNE)
        cls.awa = make_application(cls.podor, email='awa.ndiaye@example.org')
        cls.khady = make_application(cls.dakar, email='khady.fall@example.org', first_name='Khady', last_name='Fall')
        cls.ibrahima = make_application(
            cls.dakar, email='i.cisse@example.org', first_name='Ibrahima', last_name='Cissé',
            status=Application.Status.REJETEE,
        )

    def setUp(self):
        self.client.force_login(self.fondateur)


class AccessTests(ReviewTestCase):
    def urls(self):
        return [
            ('get', '/api/applications/'),
            ('get', f'/api/applications/{self.awa.pk}/'),
            ('post', f'/api/applications/{self.awa.pk}/reject/'),
        ]

    def test_coordonnateur_non_fondateur_refuse(self):
        self.client.force_login(self.coordonnateur)
        for method, url in self.urls():
            response = getattr(self.client, method)(url, {'reason': 'Motif'}, content_type='application/json')
            self.assertEqual(response.status_code, 403, url)
            self.assertEqual(response.json()['detail'], 'Seuls les membres fondateurs ont accès à cette fonction.')
        self.assertEqual(Application.objects.get(pk=self.awa.pk).status, Application.Status.A_EXAMINER)

    def test_membre_simple_refuse(self):
        self.client.force_login(self.membre)
        for method, url in self.urls():
            self.assertEqual(getattr(self.client, method)(url).status_code, 403, url)

    def test_personne_non_connectee(self):
        self.client.logout()
        for method, url in self.urls():
            self.assertEqual(getattr(self.client, method)(url).status_code, 401, url)

    def test_jeton_csrf_exige_pour_decider(self):
        client = Client(enforce_csrf_checks=True)
        client.force_login(self.fondateur)
        response = client.post(f'/api/applications/{self.awa.pk}/reject/', {'reason': 'Motif'}, content_type='application/json')
        self.assertEqual(response.status_code, 403)


class ListTests(ReviewTestCase):
    def test_liste_des_demandes(self):
        response = self.client.get('/api/applications/')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['count'], 3)
        # Les plus récentes d'abord.
        self.assertEqual([a['reference'] for a in data['results']], [self.ibrahima.reference, self.khady.reference, self.awa.reference])

    def test_filtre_par_statut(self):
        data = self.client.get('/api/applications/', {'status': 'a_examiner'}).json()
        self.assertEqual({a['id'] for a in data['results']}, {self.awa.pk, self.khady.pk})
        data = self.client.get('/api/applications/', {'status': 'rejetee'}).json()
        self.assertEqual([a['id'] for a in data['results']], [self.ibrahima.pk])

    def test_statut_inconnu(self):
        response = self.client.get('/api/applications/', {'status': 'nimporte'})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()['status'], ['Statut inconnu.'])

    def test_recherche(self):
        for term in ('khady', 'FALL', 'khady.fall@', self.khady.reference):
            data = self.client.get('/api/applications/', {'search': term}).json()
            self.assertEqual([a['id'] for a in data['results']], [self.khady.pk], term)

    def test_pagination(self):
        data = self.client.get('/api/applications/', {'page_size': 2}).json()
        self.assertEqual(len(data['results']), 2)
        self.assertIsNotNone(data['next'])

    def test_nombre_de_requetes_constant(self):
        self.client.get('/api/applications/')  # première requête : enregistre l'heure d'activité
        with self.assertNumQueries(4):  # session, utilisateur, comptage, page
            self.client.get('/api/applications/')


class DetailTests(ReviewTestCase):
    def test_lecture_d_une_demande(self):
        response = self.client.get(f'/api/applications/{self.awa.pk}/')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['reference'], self.awa.reference)
        self.assertEqual(data['email'], 'awa.ndiaye@example.org')
        self.assertEqual(data['profession'], 'Enseignante')
        self.assertEqual(data['status_label'], 'À examiner')
        self.assertEqual(data['territory']['name'], 'Podor')
        self.assertEqual(data['territory']['path'], 'Sénégal › Saint-Louis › Podor')
        self.assertIsNone(data['decided_by'])

    def test_demande_inconnue(self):
        self.assertEqual(self.client.get('/api/applications/999999/').status_code, 404)


class RejectTests(ReviewTestCase):
    def reject(self, application=None, **payload):
        application = application or self.awa
        return self.client.post(f'/api/applications/{application.pk}/reject/', payload, content_type='application/json')

    def test_refus_sans_motif_rejete(self):
        for payload in ({}, {'reason': ''}, {'reason': '   '}):
            response = self.reject(**payload)
            self.assertEqual(response.status_code, 400, payload)
            self.assertEqual(response.json()['reason'], ['Le motif du refus est obligatoire.'])
        self.awa.refresh_from_db()
        self.assertEqual(self.awa.status, Application.Status.A_EXAMINER)
        self.assertEqual(mail.outbox, [])

    def test_refus_avec_motif(self):
        response = self.reject(reason="Nous ne couvrons pas encore votre localité.", internal_note='À recontacter en 2027')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['status'], 'rejetee')
        self.assertEqual(data['status_label'], 'Rejetée')
        self.assertEqual(data['rejection_reason'], 'Nous ne couvrons pas encore votre localité.')
        self.assertEqual(data['internal_note'], 'À recontacter en 2027')

    def test_auteur_et_date_de_la_decision_enregistres(self):
        self.reject(reason='Motif')
        self.awa.refresh_from_db()
        self.assertEqual(self.awa.decided_by, self.fondateur)
        self.assertIsNotNone(self.awa.decided_at)
        data = self.client.get(f'/api/applications/{self.awa.pk}/').json()
        self.assertEqual(data['decided_by']['email'], 'fondateur@example.org')
        self.assertIsNotNone(data['decided_at'])

    def test_courriel_de_refus_avec_le_motif(self):
        self.reject(reason="Nous ne couvrons pas encore votre localité.")
        self.assertEqual(len(mail.outbox), 1)
        message = mail.outbox[0]
        self.assertEqual(message.to, ['awa.ndiaye@example.org'])
        self.assertIn("n'a pas été retenue", message.body)
        self.assertIn("Nous ne couvrons pas encore votre localité.", message.body)  # sans échappement HTML
        self.assertIn(self.awa.reference, message.body)
        self.assertNotIn('note interne', message.body.lower())

    def test_demande_deja_traitee(self):
        response = self.reject(self.ibrahima, reason='Motif')
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()['code'], 'already_decided')
        self.assertIn('Rejetée', response.json()['detail'])
        self.assertEqual(mail.outbox, [])

    @override_settings(MAILERS=FAILING_MAILER)
    def test_echec_du_courriel_refus_non_enregistre(self):
        with self.assertLogs('core.mail', level='ERROR'):
            response = self.reject(reason='Motif')
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()['code'], 'email_not_sent')
        self.awa.refresh_from_db()
        self.assertEqual(self.awa.status, Application.Status.A_EXAMINER)
        self.assertIsNone(self.awa.decided_by)
        self.assertEqual(self.awa.rejection_reason, '')

    def test_demande_inconnue(self):
        response = self.client.post('/api/applications/999999/reject/', {'reason': 'Motif'}, content_type='application/json')
        self.assertEqual(response.status_code, 404)
