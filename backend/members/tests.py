import re
from datetime import date

from django.db import IntegrityError
from django.test import TestCase

from accounts.models import User

from .models import Member

PASSWORD = 'un-mot-de-passe-long'


def make_member(email, **extra):
    return Member.objects.create(user=User.objects.create_user(email, PASSWORD), **extra)


class MemberNumberTests(TestCase):
    def test_numero_attribue_automatiquement(self):
        member = make_member('awa@example.org', joined_on=date(2026, 10, 24))
        self.assertEqual(member.number, f'TBX-2026-{member.pk:05d}')
        member.refresh_from_db()
        self.assertRegex(member.number, r'^TBX-2026-\d{5}$')

    def test_deux_membres_n_ont_jamais_le_meme_numero(self):
        numbers = {make_member(f'm{i}@example.org').number for i in range(20)}
        self.assertEqual(len(numbers), 20)

    def test_numero_unique_en_base(self):
        first = make_member('a@example.org')
        second = make_member('b@example.org')
        with self.assertRaises(IntegrityError):
            Member.objects.filter(pk=second.pk).update(number=first.number)

    def test_numero_non_reutilise_apres_suppression(self):
        first = make_member('a@example.org')
        old_number = first.number
        first.delete()
        self.assertNotEqual(make_member('b@example.org').number, old_number)

    def test_annee_d_adhesion(self):
        member = make_member('a@example.org', joined_on=date(2027, 1, 5))
        self.assertTrue(member.number.startswith('TBX-2027-'))

    def test_numero_inchange_a_la_modification(self):
        member = make_member('a@example.org')
        number = member.number
        member.joined_on = date(2030, 1, 1)
        member.save()
        member.refresh_from_db()
        self.assertEqual(member.number, number)

    def test_un_seul_dossier_par_compte(self):
        member = make_member('a@example.org')
        with self.assertRaises(IntegrityError):
            Member.objects.create(user=member.user)

    def test_administration(self):
        member = make_member('a@example.org')
        self.client.force_login(User.objects.create_superuser('f@example.org', PASSWORD))
        self.assertContains(self.client.get('/admin/members/member/'), member.number)
        self.assertTrue(re.match(r'TBX-\d{4}-\d{5}', member.number))
