import re
from unittest import mock

from django.core.cache import cache
from django.db import IntegrityError
from django.db.models import ProtectedError
from django.test import TestCase
from django.utils import timezone
from rest_framework.throttling import ScopedRateThrottle

from accounts.models import User
from applications.models import Application
from territories.models import Territory

from .helpers import make_application

URL = '/api/applications/'


class SubmitTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.commune = Territory.objects.get(name='Saint-Louis', kind=Territory.Kind.COMMUNE)

    def setUp(self):
        cache.clear()  # remet à zéro la limite d'envois

    def payload(self, **changes):
        data = {
            'first_name': 'Awa',
            'last_name': 'Ndiaye',
            'email': 'awa.ndiaye@example.org',
            'territory': self.commune.pk,
            'profession': 'Enseignante',
            'motivation': "Contribuer à l'éducation civique des jeunes de Saint-Louis.",
            'consent': True,
        }
        data.update(changes)
        return {key: value for key, value in data.items() if value is not None}

    def submit(self, **changes):
        return self.client.post(URL, self.payload(**changes), content_type='application/json')


class ValidSubmissionTests(SubmitTestCase):
    def test_demande_valide_enregistree_a_examiner(self):
        response = self.submit()
        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertEqual(data['status'], 'a_examiner')
        self.assertEqual(data['status_label'], 'À examiner')
        application = Application.objects.get()
        self.assertEqual(application.status, Application.Status.A_EXAMINER)
        self.assertEqual(application.territory, self.commune)
        self.assertEqual(application.profession, 'Enseignante')
        self.assertIsNotNone(application.consent_at)

    def test_reference_au_format_tab_annee_numero(self):
        data = self.submit().json()
        self.assertRegex(data['reference'], r'^TAB-\d{4}-\d{5}$')
        application = Application.objects.get()
        self.assertEqual(data['reference'], f'TAB-{timezone.localtime(application.created_at).year}-{application.pk:05d}')

    def test_reponse_sans_donnees_personnelles(self):
        data = self.submit().json()
        self.assertEqual(set(data), {'reference', 'status', 'status_label', 'created_at'})

    def test_sans_compte_ni_jeton_csrf(self):
        self.client.handler.enforce_csrf_checks = True
        self.assertEqual(self.submit().status_code, 201)

    def test_statut_impose_par_le_serveur(self):
        self.submit(status='acceptee')
        self.assertEqual(Application.objects.get().status, Application.Status.A_EXAMINER)


class IncompleteSubmissionTests(SubmitTestCase):
    def test_demande_vide_refusee_avec_un_message_par_champ(self):
        response = self.client.post(URL, {}, content_type='application/json')
        self.assertEqual(response.status_code, 400)
        errors = response.json()
        for field in ('first_name', 'last_name', 'email', 'profession', 'motivation'):
            self.assertEqual(errors[field], ['Ce champ est obligatoire.'], field)
        self.assertEqual(errors['territory'], ['Choisissez une localité dans la liste.'])
        self.assertEqual(
            errors['consent'], ['Vous devez accepter le traitement de vos données pour envoyer la demande.']
        )
        self.assertFalse(Application.objects.exists())

    def test_champ_vide_refuse(self):
        response = self.submit(motivation='   ')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()['motivation'], ['Ce champ ne peut être vide.'])

    def test_courriel_invalide(self):
        response = self.submit(email='pas-un-courriel')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()['email'], ['Saisissez une adresse e-mail valide.'])

    def test_consentement_refuse(self):
        response = self.submit(consent=False)
        self.assertEqual(response.status_code, 400)
        self.assertIn('accepter le traitement de vos données', response.json()['consent'][0])

    def test_motivation_trop_longue(self):
        response = self.submit(motivation='x' * 2001)
        self.assertEqual(response.status_code, 400)
        self.assertIn('2000', response.json()['motivation'][0])


class TerritoryChoiceTests(SubmitTestCase):
    def test_territoire_inconnu(self):
        response = self.submit(territory=999999)
        self.assertEqual(response.json()['territory'], ['Choisissez une localité dans la liste.'])

    def test_territoire_inactif(self):
        Territory.objects.filter(pk=self.commune.pk).update(is_active=False)
        response = self.submit()
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()['territory'], ['Choisissez une localité dans la liste.'])

    def test_commune_d_une_region_inactive(self):
        Territory.objects.filter(pk=self.commune.parent_id).update(is_active=False)
        response = self.submit()
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()['territory'], ['Choisissez une localité dans la liste.'])

    def test_une_region_peut_etre_choisie(self):
        self.assertEqual(self.submit(territory=self.commune.parent_id).status_code, 201)

    def test_territoire_d_une_demande_non_supprimable(self):
        make_application(self.commune)
        with self.assertRaises(ProtectedError):
            Territory.objects.get(pk=self.commune.pk).delete()


class DuplicateTests(SubmitTestCase):
    def test_deux_demandes_en_cours_avec_le_meme_courriel_interdites(self):
        self.assertEqual(self.submit().status_code, 201)
        response = self.submit(email='Awa.Ndiaye@Example.org')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()['email'], ['Une demande est déjà en cours pour ce courriel.'])
        self.assertEqual(Application.objects.count(), 1)

    def test_demande_acceptee_toujours_en_cours(self):
        make_application(self.commune, status=Application.Status.ACCEPTEE)
        self.assertEqual(self.submit().status_code, 400)

    def test_nouvelle_demande_possible_apres_un_refus(self):
        make_application(self.commune, status=Application.Status.REJETEE)
        self.assertEqual(self.submit().status_code, 201)

    def test_courriel_deja_utilise_par_un_compte(self):
        User.objects.create_user('awa.ndiaye@example.org', 'un-mot-de-passe-long')
        response = self.submit()
        self.assertEqual(response.status_code, 400)
        self.assertIn('déjà associé à un compte', response.json()['email'][0])

    def test_doublon_bloque_aussi_en_base(self):
        make_application(self.commune)
        with self.assertRaises(IntegrityError):
            make_application(self.commune, email='AWA.NDIAYE@example.org')


class ThrottleTests(SubmitTestCase):
    @mock.patch.object(ScopedRateThrottle, 'THROTTLE_RATES', {'adhesion': '2/hour'})
    def test_envois_repetes_limites(self):
        self.assertEqual(self.submit(email='a@example.org').status_code, 201)
        self.assertEqual(self.submit(email='b@example.org').status_code, 201)
        response = self.submit(email='c@example.org')
        self.assertEqual(response.status_code, 429)


class ApplicationModelTests(TestCase):
    def test_references_uniques(self):
        commune = Territory.objects.get(name='Dakar', kind=Territory.Kind.COMMUNE)
        first = make_application(commune, email='a@example.org')
        second = make_application(commune, email='b@example.org')
        self.assertNotEqual(first.reference, second.reference)
        self.assertTrue(all(re.fullmatch(r'TAB-\d{4}-\d{5}', a.reference) for a in (first, second)))
        first.refresh_from_db()
        self.assertEqual(first.reference, f'TAB-{timezone.localtime(first.created_at).year}-{first.pk:05d}')


class ApplicationAdminTests(TestCase):
    def test_consultation_dans_l_administration(self):
        commune = Territory.objects.get(name='Dakar', kind=Territory.Kind.COMMUNE)
        application = make_application(commune)
        self.client.force_login(User.objects.create_superuser('fondateur@example.org', 'un-mot-de-passe-long'))
        self.assertContains(self.client.get('/admin/applications/application/'), application.reference)
        response = self.client.get(f'/admin/applications/application/{application.pk}/change/')
        self.assertEqual(response.status_code, 200)
        self.assertNotContains(response, 'name="_save"')  # lecture seule
