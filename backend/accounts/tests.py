from django.test import TestCase

from .models import User


class UserTests(TestCase):
    def test_creation_par_courriel(self):
        user = User.objects.create_user('membre@example.org', 'un-mot-de-passe-long')
        self.assertEqual(user.role, User.Role.MEMBRE)
        self.assertFalse(user.is_bureau)
        self.assertTrue(user.check_password('un-mot-de-passe-long'))

    def test_bureau_executif(self):
        coord = User.objects.create_user('coord@example.org', 'un-mot-de-passe-long', role=User.Role.COORDONNATEUR)
        self.assertTrue(coord.is_bureau)

    def test_superuser_est_fondateur(self):
        admin = User.objects.create_superuser('fondateur@example.org', 'un-mot-de-passe-long')
        self.assertEqual(admin.role, User.Role.FONDATEUR)

    def test_courriel_unique(self):
        User.objects.create_user('a@example.org', 'un-mot-de-passe-long')
        with self.assertRaises(Exception):
            User.objects.create_user('a@example.org', 'un-mot-de-passe-long')
