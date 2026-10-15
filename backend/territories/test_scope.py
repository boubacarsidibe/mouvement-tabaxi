from django.core.exceptions import ValidationError
from django.test import TestCase

from accounts.models import User
from applications.models import Application
from applications.tests.helpers import make_application

from .models import Territory
from .scope import can_access, scope_queryset, subtree_ids, visible_territory_ids

PASSWORD = 'un-mot-de-passe-long'


def get(name, kind):
    return Territory.objects.get(name=name, kind=kind)


class ScopeTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.senegal = get('Sénégal', Territory.Kind.PAYS)
        cls.region_dakar = get('Dakar', Territory.Kind.REGION)
        cls.region_thies = get('Thiès', Territory.Kind.REGION)
        cls.pikine = get('Pikine', Territory.Kind.COMMUNE)
        cls.mbour = get('Mbour', Territory.Kind.COMMUNE)

        def user(email, role, territory=None):
            return User.objects.create_user(email, PASSWORD, role=role, territory=territory)

        cls.fondateur = user('fondateur@example.org', User.Role.FONDATEUR)
        cls.coord_pays = user('pays@example.org', User.Role.COORDONNATEUR, cls.senegal)
        cls.coord_dakar = user('dakar@example.org', User.Role.COORDONNATEUR, cls.region_dakar)
        cls.coord_pikine = user('pikine@example.org', User.Role.COORDONNATEUR, cls.pikine)
        cls.membre = user('membre@example.org', User.Role.MEMBRE, cls.pikine)


class ScopeRuleTests(ScopeTestCase):
    def test_sous_arbre(self):
        ids = subtree_ids(self.region_dakar)
        names = set(Territory.objects.filter(pk__in=ids).values_list('name', flat=True))
        self.assertEqual(names, {'Dakar', 'Guédiawaye', 'Keur Massar', 'Pikine', 'Rufisque'})

    def test_fondateur_voit_tout(self):
        self.assertIsNone(visible_territory_ids(self.fondateur))
        self.assertTrue(can_access(self.fondateur, self.mbour))

    def test_coordonnateur_de_pays_voit_regions_et_communes(self):
        ids = visible_territory_ids(self.coord_pays)
        self.assertEqual(ids, set(Territory.objects.values_list('pk', flat=True)))

    def test_coordonnateur_de_region_voit_ses_communes_et_pas_les_autres(self):
        self.assertTrue(can_access(self.coord_dakar, self.region_dakar))
        self.assertTrue(can_access(self.coord_dakar, self.pikine))
        self.assertFalse(can_access(self.coord_dakar, self.region_thies))
        self.assertFalse(can_access(self.coord_dakar, self.mbour))
        self.assertFalse(can_access(self.coord_dakar, self.senegal))

    def test_coordonnateur_de_commune_voit_sa_seule_commune(self):
        self.assertEqual(visible_territory_ids(self.coord_pikine), {self.pikine.pk})

    def test_membre_simple_ne_voit_rien_au_bureau(self):
        self.assertEqual(visible_territory_ids(self.membre), set())

    def test_coordonnateur_sans_territoire_ne_voit_rien(self):
        orphan = User.objects.create_user('orphelin@example.org', PASSWORD, role=User.Role.COORDONNATEUR)
        self.assertEqual(visible_territory_ids(orphan), set())

    def test_regle_appliquee_a_une_liste(self):
        in_dakar = make_application(self.pikine, email='a@example.org')
        in_thies = make_application(self.mbour, email='b@example.org')
        visible = set(scope_queryset(Application.objects.all(), self.coord_dakar))
        self.assertEqual(visible, {in_dakar})
        self.assertEqual(set(scope_queryset(Application.objects.all(), self.fondateur)), {in_dakar, in_thies})
        self.assertEqual(set(scope_queryset(Application.objects.all(), self.membre)), set())


class ManagedTerritoryApiTests(ScopeTestCase):
    def names(self, user):
        self.client.force_login(user)
        response = self.client.get('/api/territories/managed/')
        self.assertEqual(response.status_code, 200)
        return [t['name'] for t in response.json()]

    def test_liste_du_coordonnateur_de_region(self):
        self.assertEqual(self.names(self.coord_dakar), ['Dakar', 'Dakar', 'Guédiawaye', 'Keur Massar', 'Pikine', 'Rufisque'])

    def test_liste_du_fondateur_avec_les_territoires_inactifs(self):
        Territory.objects.filter(pk=self.mbour.pk).update(is_active=False)
        self.client.force_login(self.fondateur)
        data = self.client.get('/api/territories/managed/').json()
        self.assertEqual(len(data), Territory.objects.count())
        mbour = next(t for t in data if t['id'] == self.mbour.pk)
        self.assertEqual((mbour['is_active'], mbour['path']), (False, 'Sénégal › Thiès › Mbour'))

    def test_un_coordonnateur_ne_lit_jamais_un_autre_territoire_meme_en_changeant_l_adresse(self):
        self.client.force_login(self.coord_dakar)
        self.assertEqual(self.client.get(f'/api/territories/managed/{self.pikine.pk}/').status_code, 200)
        for other in (self.mbour, self.region_thies, self.senegal):
            response = self.client.get(f'/api/territories/managed/{other.pk}/')
            self.assertEqual(response.status_code, 404, other.name)

    def test_coordonnateur_de_commune_ne_lit_pas_sa_region(self):
        self.client.force_login(self.coord_pikine)
        self.assertEqual(self.client.get(f'/api/territories/managed/{self.region_dakar.pk}/').status_code, 404)

    def test_membre_simple_refuse(self):
        self.client.force_login(self.membre)
        self.assertEqual(self.client.get('/api/territories/managed/').status_code, 403)
        self.assertEqual(self.client.get(f'/api/territories/managed/{self.pikine.pk}/').status_code, 403)

    def test_personne_non_connectee(self):
        self.assertEqual(self.client.get('/api/territories/managed/').status_code, 401)


class AccountTerritoryTests(ScopeTestCase):
    def test_coordonnateur_doit_avoir_un_territoire(self):
        coord = User(email='c@example.org', role=User.Role.COORDONNATEUR)
        with self.assertRaisesMessage(ValidationError, 'Un coordonnateur doit être rattaché à un territoire.'):
            coord.full_clean(exclude=['password'])

    def test_territoire_renvoye_a_la_connexion(self):
        self.client.force_login(self.coord_dakar)
        data = self.client.get('/api/auth/me/').json()
        self.assertEqual(data['territory']['name'], 'Dakar')
        self.assertEqual(data['territory']['kind'], 'region')
        self.assertEqual(data['territory']['path'], 'Sénégal › Dakar')

    def test_territoire_d_un_compte_non_supprimable(self):
        from django.db.models import ProtectedError

        Territory.objects.filter(parent=self.pikine).delete()
        with self.assertRaises(ProtectedError):
            Territory.objects.get(pk=self.pikine.pk).delete()
