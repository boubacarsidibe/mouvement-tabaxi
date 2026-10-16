"""La documentation du rendu correspond à l'état réel du code (#24).

README.md, docs/DEMONSTRATION.md et docs/DEPLOIEMENT.md citent des statuts, des
commandes, des adresses de l'API et des pages du site : chacun doit exister.
"""

import json
import re
from pathlib import Path
from urllib.parse import urlsplit

from django.conf import settings
from django.core.management import get_commands
from django.test import SimpleTestCase
from django.urls import Resolver404, resolve

from applications.models import Application
from core.management.commands.comptes_demo import ACCOUNTS

ROOT = Path(settings.BASE_DIR).parent
DOCS = ('README.md', 'docs/DEMONSTRATION.md', 'docs/DEPLOIEMENT.md')


def read(name):
    return (ROOT / name).read_text(encoding='utf-8')


def frontend_routes():
    """Chemins déclarés dans frontend/src/app/app.routes.ts."""
    source = read('frontend/src/app/app.routes.ts')
    return set(re.findall(r"path: '([^']*)'", source)) | set(re.findall(r"(?:member|bureau)\('([^']*)'", source))


class DocumentationTests(SimpleTestCase):
    def test_les_quatre_statuts_de_la_demonstration(self):
        text = read('docs/DEMONSTRATION.md')
        for label in Application.Status.labels:
            self.assertIn(f'**{label}**', text, label)

    def test_commandes_existantes(self):
        commands = get_commands()
        for name in DOCS:
            for command in re.findall(r'python manage\.py ([a-z_]+)', read(name)):
                self.assertIn(command, commands, f'{name} : manage.py {command}')

    def test_adresses_de_l_api_existantes(self):
        for name in DOCS:
            for path in re.findall(r'/api/(?:[a-z_-]+/)+', read(name)):
                try:
                    resolve(path)
                except Resolver404:
                    self.fail(f'{name} : {path} ne correspond à aucune adresse de l\'API')

    def test_pages_du_site_existantes(self):
        routes = frontend_routes()
        pages = re.findall(r'`(/[a-z/-]*)`', read('docs/DEMONSTRATION.md'))
        self.assertIn('/adherer', pages)
        for page in pages:
            if not page.startswith('/api/'):
                self.assertIn(page.strip('/'), routes, page)

    def test_comptes_de_demonstration(self):
        for name in ('README.md', 'docs/DEMONSTRATION.md'):
            text = read(name)
            for email, *_ in ACCOUNTS:
                self.assertIn(email, text, name)

    def test_liens_entre_documents(self):
        for name in DOCS:
            for target in re.findall(r'\]\(([^)#:]+\.md)\)', read(name)):
                self.assertTrue(((ROOT / name).parent / target).exists(), f'{name} : {target}')


class HostingDocumentationTests(SimpleTestCase):
    def test_adresse_de_l_api_appelee_par_le_site(self):
        config = json.loads(read('frontend/vercel.json'))
        api = next(rule for rule in config['rewrites'] if rule['source'].startswith('/api/'))
        host = urlsplit(api['destination']).hostname
        self.assertIn(f'`https://{host}`', read('docs/DEPLOIEMENT.md'))
        self.assertIn(f'`{api["destination"]}`', read('docs/DEPLOIEMENT.md'))

    def test_migrations_a_chaque_mise_en_ligne(self):
        doc = read('docs/DEPLOIEMENT.md')
        vercel = json.loads(read('backend/vercel.json'))
        self.assertIn(f'`{vercel["buildCommand"]}`', doc)
        railway = json.loads(read('backend/railway.json'))
        self.assertIn(f'`{railway["deploy"]["startCommand"]}`', doc)
        self.assertIn(f'`{railway["deploy"]["healthcheckPath"]}`', doc)

    def test_journal_des_modifications_cite_l_hebergement(self):
        changelog = read('CHANGELOG.md')
        self.assertIn('Vercel', changelog)
        self.assertIn('Railway', changelog)
