# Mouvement TABAXI — Plateforme web

Plateforme web du Mouvement TABAXI : organiser le mouvement, accueillir ses membres et suivre ses programmes. Interface en français, utilisable sur téléphone et ordinateur.

## Objectifs

- **Accueillir** de nouveaux membres de façon organisée et contrôlée.
- **Connaître les membres** et les retrouver par territoire et par date d'adhésion.
- **Donner à chaque membre une carte numérique.**
- **Organiser et suivre les programmes** et activités du mouvement.

## Fonctionnalités

Le détail complet est dans le [cahier des charges](docs/Cahier-des-charges-TABAXI.pdf) : 24 besoins écrits en histoires d'utilisateurs, répartis en cinq familles.

| Famille | Contenu |
|---|---|
| A. Adhésion | Page d'accueil, demande d'adhésion, réponse par courriel, finalisation par lien personnel |
| B. Connexion | Connexion unique par rôle, mot de passe oublié, invitation du bureau, déconnexion automatique |
| C. Espace membre | Profil, carte numérique, programmes du territoire, inscription aux activités |
| D. Bureau exécutif | Tableau de bord, examen des demandes, bases de membres, territoires, journal |
| E. Programmes | Programmes, activités, comptes rendus, présences |

**Rôles :** visiteur, membre simple, coordonnateur, membre fondateur. Le bureau exécutif réunit les coordonnateurs et les fondateurs.

## État du projet

| Élément | État |
|---|---|
| Cahier des charges (v1.0) | Rédigé, à valider par les fondateurs |
| Backend Django | API REST sous `/api/` : adhésion, examen des demandes, finalisation, connexion, espace membre, bases du bureau, programmes, journal des actions |
| Frontend Angular | Écrans publics, espace membre et interface du bureau reliés à l'API, sans données fictives |
| Mise en ligne | En production sur Vercel (site et API) avec une base PostgreSQL Neon ; Railway préparé pour l'API (voir [DEPLOIEMENT.md](docs/DEPLOIEMENT.md)) |
| Organisation | Sprints, issues et documentation en place |

Rendu prévu le **29 octobre 2026** : demande d'adhésion, examen par un fondateur, acceptation et courriel, finalisation de l'inscription, espace membre. Le déroulé de la démonstration est dans [DEMONSTRATION.md](docs/DEMONSTRATION.md).

## Stack technique

- **Backend :** Python 3.12, Django 6, Django REST Framework
- **Frontend :** Angular, TypeScript
- **Base de données :** SQLite en local ; PostgreSQL (Neon) en ligne
- **Hébergement :** Vercel pour le site et l'API ; Railway visé pour l'API (voir [DEPLOIEMENT.md](docs/DEPLOIEMENT.md))

## Structure du dépôt

```
backend/       API Django
frontend/      application Angular
docs/          documentation du projet
.github/       modèles d'issues et de Pull Request
```

| Document | Contenu |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Vue d'ensemble technique |
| [docs/DEMONSTRATION.md](docs/DEMONSTRATION.md) | Parcours de démonstration du rendu |
| [docs/DEPLOIEMENT.md](docs/DEPLOIEMENT.md) | Hébergement actuel et mise en ligne |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Feuille de route par sprint |
| [docs/PLANNING.md](docs/PLANNING.md) | Calendrier détaillé |
| [docs/BACKLOG.md](docs/BACKLOG.md) | Liste priorisée des tâches |
| [docs/GLOSSAIRE.md](docs/GLOSSAIRE.md) | Termes du projet |
| [docs/HYPOTHESES.md](docs/HYPOTHESES.md) | Hypothèses prises |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Façon de travailler |
| [CHANGELOG.md](CHANGELOG.md) | Journal des modifications |

## Installation et utilisation

Prérequis : Python 3.12 ou plus, Node.js 22 ou plus. Lancer d'abord le backend, puis le frontend, chacun dans son terminal.

### 1. Backend (port 8000)

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
python manage.py migrate
python manage.py comptes_demo
python manage.py runserver
```

`backend/.env` contient `DJANGO_DEBUG=1` : sans cette ligne, le serveur se comporte comme en production et refuse de démarrer sans vraie clé secrète.

Comptes de démonstration, un par rôle (développement seulement) : `python manage.py comptes_demo` crée `fondateur.demo@example.org`, `coordonnateur.demo@example.org` (région de Dakar) et `membre.demo@example.org` (Pikine) et affiche leurs mots de passe aléatoires ; `--mot-de-passe MOT` en fixe un commun. La commande peut être relancée pour réinitialiser les mots de passe.

Pour un vrai compte, `python manage.py createsuperuser` : le premier compte créé ainsi reçoit le rôle de membre fondateur. L'administration Django est sur `http://localhost:8000/admin/`, en développement seulement : en ligne, elle est fermée, sauf avec `DJANGO_ADMIN_ENABLED=1`.

En local, les courriels (acceptation, liens personnels, mot de passe oublié) s'affichent dans ce terminal au lieu de partir.

### 2. Frontend (port 4200)

```powershell
cd frontend
npm ci
npm start
```

Le site s'ouvre sur `http://localhost:4200/`. Les appels `/api` sont redirigés vers le backend (`frontend/proxy.conf.json`).

### Tests

```powershell
cd backend
python manage.py test
python manage.py makemigrations --check --dry-run
```

```powershell
cd frontend
npm run build
npx ng test --watch=false
```

Le parcours complet d'adhésion, de la demande à l'espace membre, a son propre test : `python manage.py test applications.tests.test_parcours`.

## Modifier le cahier des charges

1. Modifier `docs/cahier-des-charges-tabaxi.html`.
2. Régénérer le PDF depuis le dossier `docs` (Windows, avec Microsoft Edge) :

```powershell
& "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --headless --disable-gpu --no-pdf-header-footer --print-to-pdf="$PWD\Cahier-des-charges-TABAXI.pdf" "file:///$($PWD.Path -replace '\\','/')/cahier-des-charges-tabaxi.html"
```

## Équipe

Projet porté par le bureau exécutif du Mouvement TABAXI. Développement : [@boubacarsidibe](https://github.com/boubacarsidibe).

## Contribuer

Lire [CONTRIBUTING.md](CONTRIBUTING.md) et le [code de conduite](CODE_OF_CONDUCT.md). Les tâches sont suivies dans les [issues](https://github.com/boubacarsidibe/mouvement-tabaxi/issues) et les [sprints](https://github.com/boubacarsidibe/mouvement-tabaxi/milestones).

## Licence

Aucune licence n'est choisie pour le moment : tous droits réservés par défaut. Décision à prendre par les fondateurs.
