"""Parcours complet du rendu, tel qu'il est montré en démonstration (docs/DEMONSTRATION.md).

Demande depuis le site → examen par un fondateur → acceptation et courriel →
finalisation avec le lien personnel → espace membre. Chaque étape passe par l'API,
comme les écrans, avec un client par personne.
"""

import re
import shutil
import tempfile
from io import BytesIO
from urllib.parse import parse_qs, urlparse

from django.core import mail
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client, TestCase, override_settings
from PIL import Image

from accounts.models import User
from applications.models import Application

FOUNDER_PASSWORD = 'fondateur-mot-de-passe'
MEMBER_PASSWORD = 'Baobab-solide-2026'
MEDIA_ROOT = tempfile.mkdtemp(prefix='tabaxi-parcours-')


def photo():
    buffer = BytesIO()
    Image.new('RGB', (800, 600), (14, 90, 60)).save(buffer, format='JPEG')
    return SimpleUploadedFile('photo.jpg', buffer.getvalue(), content_type='image/jpeg')


def find(nodes, name):
    """Territoire de l'arbre public (/api/territories/), cherché par son nom."""
    for node in nodes:
        if node['name'] == name:
            return node
        found = find(node['children'], name)
        if found:
            return found
    return None


@override_settings(MEDIA_ROOT=MEDIA_ROOT, FRONTEND_URL='https://tabaxi.example.org')
class ParcoursTests(TestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(MEDIA_ROOT, ignore_errors=True)

    @classmethod
    def setUpTestData(cls):
        User.objects.create_user('fondateur@example.org', FOUNDER_PASSWORD, role=User.Role.FONDATEUR)

    def setUp(self):
        cache.clear()  # remet à zéro les limites d'envoi
        self.visiteur = Client()
        self.fondateur = Client()
        response = self.fondateur.post(
            '/api/auth/login/', {'email': 'fondateur@example.org', 'password': FOUNDER_PASSWORD}, content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)

    def deposer(self, email, commune='Podor'):
        """Étape 1 : la personne remplit le formulaire « Présentez-vous au mouvement »."""
        territories = self.visiteur.get('/api/territories/')
        self.assertEqual(territories.status_code, 200)
        response = self.visiteur.post('/api/applications/', {
            'first_name': 'Awa', 'last_name': 'Ndiaye', 'email': email,
            'territory': find(territories.json(), commune)['id'],
            'profession': 'Enseignante', 'motivation': 'Agir pour ma commune.', 'consent': True,
        }, content_type='application/json')
        self.assertEqual(response.status_code, 201, response.content)
        return response.json()

    def demandes(self, status):
        """Liste « Demandes d'adhésion » du bureau, filtrée par statut."""
        response = self.fondateur.get('/api/applications/', {'status': status})
        self.assertEqual(response.status_code, 200)
        return {item['reference']: item for item in response.json()['results']}

    def test_de_la_demande_a_l_espace_membre(self):
        # 1. Demande : « À examiner », avec une référence à donner au bureau.
        depot = self.deposer('awa.ndiaye@example.org')
        self.assertEqual((depot['status'], depot['status_label']), ('a_examiner', 'À examiner'))
        self.assertRegex(depot['reference'], r'^TAB-\d{4}-\d{5}$')
        reference = depot['reference']

        # 2. Examen : le fondateur la retrouve parmi les demandes à examiner et ouvre sa fiche.
        demande = self.demandes('a_examiner')[reference]
        self.assertEqual(demande['status_label'], 'À examiner')
        fiche = self.fondateur.get(f'/api/applications/{demande["id"]}/')
        self.assertEqual(fiche.status_code, 200)
        self.assertEqual(fiche.json()['motivation'], 'Agir pour ma commune.')

        # 3. Acceptation : « Acceptée », et le courriel part avec le lien personnel.
        response = self.fondateur.post(f'/api/applications/{demande["id"]}/accept/', {}, content_type='application/json')
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()['status_label'], 'Acceptée')
        self.assertEqual(len(mail.outbox), 1)
        courriel = mail.outbox[0]
        self.assertEqual(courriel.to, ['awa.ndiaye@example.org'])
        self.assertIn(reference, courriel.body)
        url = re.search(r'https://tabaxi\.example\.org/finaliser\?\S+', courriel.body).group(0)
        jeton = parse_qs(urlparse(url).query)['jeton'][0]
        self.assertIn(reference, self.demandes('acceptee'))

        # 4. Finalisation : la page du lien reconnaît la personne, puis crée son compte.
        personne = Client()
        verification = personne.post('/api/registration/check/', {'token': jeton}, content_type='application/json')
        self.assertEqual(verification.status_code, 200)
        self.assertEqual(verification.json()['email'], 'awa.ndiaye@example.org')
        response = personne.post('/api/registration/', {
            'token': jeton, 'address': '12, rue Blaise-Diagne, Podor', 'phone': '+221 77 123 45 67',
            'photo': photo(), 'password': MEMBER_PASSWORD, 'password_confirm': MEMBER_PASSWORD,
            'accept_rules': 'true',
        })
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(Application.objects.get(reference=reference).status, Application.Status.INSCRITE)
        self.assertEqual(self.demandes('inscrite')[reference]['status_label'], 'Inscrite')
        # Le lien ne sert qu'une fois.
        self.assertEqual(Client().post('/api/registration/check/', {'token': jeton}, content_type='application/json').status_code, 410)

        # 5. Espace membre : la personne est connectée et a son numéro de membre.
        moi = personne.get('/api/members/me/')
        self.assertEqual(moi.status_code, 200)
        self.assertRegex(moi.json()['number'], r'^TBX-\d{4}-\d{5}$')
        self.assertEqual(moi.json()['territory']['name'], 'Podor')
        self.assertEqual(personne.get('/api/auth/me/').json()['role'], 'membre')

        # Elle peut ensuite se reconnecter avec le mot de passe choisi.
        nouvelle_visite = Client()
        response = nouvelle_visite.post(
            '/api/auth/login/', {'email': 'awa.ndiaye@example.org', 'password': MEMBER_PASSWORD}, content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(nouvelle_visite.get('/api/members/me/').json()['number'], moi.json()['number'])

    def test_refus_avec_motif(self):
        depot = self.deposer('moussa.fall@example.org', commune='Pikine')
        demande = self.demandes('a_examiner')[depot['reference']]
        response = self.fondateur.post(
            f'/api/applications/{demande["id"]}/reject/', {'reason': 'Dossier incomplet.'}, content_type='application/json'
        )
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()['status_label'], 'Rejetée')
        self.assertIn(depot['reference'], self.demandes('rejetee'))
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('Dossier incomplet.', mail.outbox[0].body)
        # Aucun lien d'inscription n'est envoyé à une personne refusée.
        self.assertNotIn('/finaliser', mail.outbox[0].body)
