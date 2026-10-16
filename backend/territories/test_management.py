"""Gestion des territoires par le bureau (#41) : ajouter, renommer, rattacher, supprimer."""

import datetime

from accounts.models import User
from applications.tests.helpers import make_application
from programs.models import Program

from .models import Territory
from .test_scope import PASSWORD, ScopeTestCase

URL = '/api/territories/managed/'


class TerritoryManagementTests(ScopeTestCase):
    def setUp(self):
        self.client.force_login(self.fondateur)

    def add(self, **data):
        return self.client.post(URL, data, content_type='application/json')

    def edit(self, territory, **data):
        return self.client.patch(f'{URL}{territory.pk}/', data, content_type='application/json')

    def test_fondateur_ajoute_une_commune_dans_une_region(self):
        response = self.add(name='  Thiaroye   sur Mer ', kind='commune', parent=self.region_dakar.pk)
        self.assertEqual(response.status_code, 201, response.content)
        data = response.json()
        self.assertEqual(data['name'], 'Thiaroye sur Mer')
        self.assertEqual(data['path'], 'Sénégal › Dakar › Thiaroye sur Mer')
        self.assertEqual((data['members_count'], data['programs_count'], data['children_count']), (0, 0, 0))
        self.assertTrue(Territory.objects.filter(name='Thiaroye sur Mer', parent=self.region_dakar).exists())

    def test_hierarchie_respectee_a_l_ajout(self):
        response = self.add(name='Commune perdue', kind='commune', parent=self.senegal.pk)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()['parent'], ['Une commune doit être rattachée à une région.'])
        response = self.add(name='Région orpheline', kind='region')
        self.assertEqual(response.status_code, 400)
        self.assertIn('parent', response.json())

    def test_nom_deja_pris_au_meme_endroit(self):
        response = self.add(name='pikine', kind='commune', parent=self.region_dakar.pk)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()['name'], ['Un territoire porte déjà ce nom à cet endroit.'])
        # Le même nom reste possible ailleurs.
        self.assertEqual(self.add(name='Pikine', kind='commune', parent=self.region_thies.pk).status_code, 201)

    def test_fondateur_renomme_un_territoire(self):
        response = self.edit(self.mbour, name='Mbour Ville')
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()['path'], 'Sénégal › Thiès › Mbour Ville')
        self.mbour.refresh_from_db()
        self.assertEqual(self.mbour.name, 'Mbour Ville')

    def test_fondateur_rattache_une_commune_a_une_autre_region(self):
        response = self.edit(self.mbour, parent=self.region_dakar.pk)
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()['path'], 'Sénégal › Dakar › Mbour')
        response = self.edit(self.mbour, parent=self.senegal.pk)
        self.assertEqual(response.status_code, 400)

    def test_type_fige_si_le_territoire_contient_des_territoires(self):
        response = self.edit(self.region_dakar, kind='commune', parent=self.region_thies.pk)
        self.assertEqual(response.status_code, 400)
        self.assertIn('kind', response.json())

    def test_fondateur_desactive_un_territoire(self):
        response = self.edit(self.mbour, is_active=False)
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json()['is_active'])

    def test_territoire_vide_supprimable(self):
        commune = Territory.objects.create(name='Vide', kind='commune', parent=self.region_thies)
        self.assertEqual(self.client.delete(f'{URL}{commune.pk}/').status_code, 204)
        self.assertFalse(Territory.objects.filter(pk=commune.pk).exists())

    def test_territoire_contenant_des_membres_non_supprimable(self):
        commune = Territory.objects.create(name='Habitée', kind='commune', parent=self.region_thies)
        User.objects.create_user('habitant@example.org', PASSWORD, role=User.Role.MEMBRE, territory=commune)
        response = self.client.delete(f'{URL}{commune.pk}/')
        self.assertEqual(response.status_code, 409)
        self.assertIn('des membres y sont rattachés', response.json()['detail'])
        self.assertIn('Désactivez-le plutôt', response.json()['detail'])
        self.assertTrue(Territory.objects.filter(pk=commune.pk).exists())

    def test_territoire_contenant_des_programmes_non_supprimable(self):
        commune = Territory.objects.create(name='Active', kind='commune', parent=self.region_thies)
        Program.objects.create(
            name='Nettoyage', objective='Quartier propre', territory=commune,
            start_date=datetime.date(2026, 11, 1), end_date=datetime.date(2026, 11, 30),
        )
        response = self.client.delete(f'{URL}{commune.pk}/')
        self.assertEqual(response.status_code, 409)
        self.assertIn('des programmes y sont rattachés', response.json()['detail'])
        self.assertTrue(Territory.objects.filter(pk=commune.pk).exists())

    def test_territoire_contenant_des_territoires_ou_des_demandes_non_supprimable(self):
        response = self.client.delete(f'{URL}{self.region_thies.pk}/')
        self.assertEqual(response.status_code, 409)
        self.assertIn("il contient d'autres territoires", response.json()['detail'])
        commune = Territory.objects.create(name='Demandée', kind='commune', parent=self.region_thies)
        make_application(commune, email='candidat@example.org')
        self.assertEqual(self.client.delete(f'{URL}{commune.pk}/').status_code, 409)

    def test_liste_avec_le_contenu_de_chaque_territoire(self):
        data = {t['id']: t for t in self.client.get(URL).json()}
        pikine = data[self.pikine.pk]
        # Le coordonnateur de Pikine et le membre simple y sont rattachés.
        self.assertEqual(pikine['members_count'], 2)
        self.assertGreater(data[self.region_dakar.pk]['children_count'], 0)


class TerritoryManagementRightsTests(ScopeTestCase):
    def test_un_coordonnateur_lit_son_perimetre_mais_ne_modifie_rien(self):
        self.client.force_login(self.coord_dakar)
        self.assertEqual(self.client.get(f'{URL}{self.pikine.pk}/').status_code, 200)
        created = self.client.post(
            URL, {'name': 'Nouvelle', 'kind': 'commune', 'parent': self.region_dakar.pk}, content_type='application/json'
        )
        self.assertEqual(created.status_code, 403)
        renamed = self.client.patch(f'{URL}{self.pikine.pk}/', {'name': 'X'}, content_type='application/json')
        self.assertEqual(renamed.status_code, 403)
        self.assertEqual(self.client.delete(f'{URL}{self.pikine.pk}/').status_code, 403)
        self.pikine.refresh_from_db()
        self.assertEqual(self.pikine.name, 'Pikine')
        self.assertFalse(Territory.objects.filter(name='Nouvelle').exists())

    def test_hors_perimetre_toujours_404_en_lecture(self):
        self.client.force_login(self.coord_dakar)
        self.assertEqual(self.client.get(f'{URL}{self.mbour.pk}/').status_code, 404)

    def test_membre_simple_et_visiteur_refuses(self):
        self.client.force_login(self.membre)
        self.assertEqual(self.client.post(URL, {}, content_type='application/json').status_code, 403)
        self.assertEqual(self.client.delete(f'{URL}{self.pikine.pk}/').status_code, 403)
        self.client.logout()
        self.assertEqual(self.client.delete(f'{URL}{self.pikine.pk}/').status_code, 401)
