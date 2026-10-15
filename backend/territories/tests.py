from django.core.exceptions import ValidationError
from django.db import IntegrityError
from django.db.models import ProtectedError
from django.test import TestCase

from accounts.models import User

from .models import Territory


class TerritoryHierarchyTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.pays = Territory.objects.create(name='Pays test', kind=Territory.Kind.PAYS)
        cls.region = Territory.objects.create(name='Région test', kind=Territory.Kind.REGION, parent=cls.pays)

    def test_commune_rattachee_a_une_region_elle_meme_rattachee_a_un_pays(self):
        commune = Territory.objects.create(name='Commune test', kind=Territory.Kind.COMMUNE, parent=self.region)
        self.assertEqual(commune.parent, self.region)
        self.assertEqual(commune.parent.parent, self.pays)

    def test_commune_sans_region_refusee(self):
        with self.assertRaisesMessage(ValidationError, 'Une commune doit être rattachée à une région.'):
            Territory.objects.create(name='Commune isolée', kind=Territory.Kind.COMMUNE)

    def test_commune_rattachee_a_un_pays_refusee(self):
        with self.assertRaisesMessage(ValidationError, 'Une commune doit être rattachée à une région.'):
            Territory.objects.create(name='Commune mal placée', kind=Territory.Kind.COMMUNE, parent=self.pays)

    def test_region_rattachee_a_un_pays(self):
        with self.assertRaisesMessage(ValidationError, 'Une région doit être rattachée à un pays.'):
            Territory.objects.create(name='Région sans pays', kind=Territory.Kind.REGION)
        commune = Territory.objects.create(name='Commune', kind=Territory.Kind.COMMUNE, parent=self.region)
        with self.assertRaisesMessage(ValidationError, 'Une région doit être rattachée à un pays.'):
            Territory.objects.create(name='Région sous une commune', kind=Territory.Kind.REGION, parent=commune)

    def test_pays_sans_parent(self):
        with self.assertRaisesMessage(ValidationError, "Un pays n'est rattaché à aucun territoire."):
            Territory.objects.create(name='Pays rattaché', kind=Territory.Kind.PAYS, parent=self.pays)

    def test_type_fige_quand_le_territoire_contient_des_territoires(self):
        Territory.objects.create(name='Commune', kind=Territory.Kind.COMMUNE, parent=self.region)
        self.region.kind = Territory.Kind.COMMUNE
        with self.assertRaises(ValidationError):
            self.region.save()

    def test_nom_unique_dans_le_meme_parent(self):
        with self.assertRaises(IntegrityError):
            Territory.objects.create(name='Région test', kind=Territory.Kind.REGION, parent=self.pays)

    def test_meme_nom_possible_a_deux_niveaux(self):
        # La commune chef-lieu porte souvent le nom de sa région.
        commune = Territory.objects.create(name='Région test', kind=Territory.Kind.COMMUNE, parent=self.region)
        self.assertEqual(str(commune), 'Région test (commune)')


class TerritoryDeletionTests(TestCase):
    def setUp(self):
        self.pays = Territory.objects.create(name='Pays test', kind=Territory.Kind.PAYS)
        self.region = Territory.objects.create(name='Région test', kind=Territory.Kind.REGION, parent=self.pays)
        self.commune = Territory.objects.create(name='Commune test', kind=Territory.Kind.COMMUNE, parent=self.region)

    def test_territoire_utilise_non_supprimable(self):
        with self.assertRaises(ProtectedError):
            self.region.delete()
        with self.assertRaises(ProtectedError):
            self.pays.delete()
        self.assertTrue(Territory.objects.filter(pk=self.region.pk).exists())

    def test_territoire_inutilise_supprimable(self):
        self.commune.delete()
        self.assertFalse(Territory.objects.filter(pk=self.commune.pk).exists())


class StartingTerritoriesTests(TestCase):
    def test_senegal_et_ses_14_regions(self):
        senegal = Territory.objects.get(name='Sénégal', kind=Territory.Kind.PAYS)
        regions = Territory.objects.filter(parent=senegal, kind=Territory.Kind.REGION)
        self.assertEqual(regions.count(), 14)

    def test_chaque_region_a_ses_communes(self):
        regions = Territory.objects.filter(kind=Territory.Kind.REGION, parent__name='Sénégal')
        for region in regions:
            self.assertTrue(region.children.filter(kind=Territory.Kind.COMMUNE).exists(), region.name)
        communes = Territory.objects.filter(kind=Territory.Kind.COMMUNE, parent__in=regions)
        self.assertEqual(communes.count(), 47)


class TerritoryAdminTests(TestCase):
    def setUp(self):
        self.client.force_login(User.objects.create_superuser('fondateur@example.org', 'un-mot-de-passe-long'))

    def test_suppression_bloquee_dans_l_administration(self):
        region = Territory.objects.get(name='Dakar', kind=Territory.Kind.REGION)
        response = self.client.post(f'/admin/territories/territory/{region.pk}/delete/', {'post': 'yes'})
        # Django affiche une page d'explication au lieu de supprimer.
        self.assertEqual(response.status_code, 200)
        self.assertTrue(Territory.objects.filter(pk=region.pk).exists())

    def test_liste_dans_l_administration(self):
        response = self.client.get('/admin/territories/territory/')
        self.assertContains(response, 'Ziguinchor')

    def test_creation_incoherente_refusee_dans_l_administration(self):
        pays = Territory.objects.get(name='Sénégal')
        response = self.client.post(
            '/admin/territories/territory/add/',
            {'name': 'Nouvelle commune', 'kind': 'commune', 'parent': pays.pk, 'is_active': 'on'},
        )
        self.assertContains(response, 'Une commune doit être rattachée à une région.')
        self.assertFalse(Territory.objects.filter(name='Nouvelle commune').exists())
