# Mouvement TABAXI — Plateforme web

Plateforme web du Mouvement TABAXI : organiser le mouvement, accueillir ses membres et suivre ses programmes. Interface en français, utilisable sur téléphone et ordinateur.

## État du projet

| Élément | État |
|---|---|
| Cahier des charges (v1.0) | Rédigé, à valider par les fondateurs |
| Backend Django | Squelette : configuration, compte utilisateur par courriel avec rôles |
| Frontend Angular | Squelette : page d'accueil minimale |

## Organisation du dépôt

```
docs/        cahier des charges (PDF et source HTML)
backend/     API Django (Django REST Framework)
frontend/    application Angular
```

## Démarrer en local

Prérequis : Python 3.12 ou plus, Node.js 22 ou plus.

### Backend (port 8000)

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

Le premier compte créé avec `createsuperuser` reçoit le rôle de membre fondateur. L'administration Django est sur `http://localhost:8000/admin/`.

Tests : `python manage.py test`

### Frontend (port 4200)

```powershell
cd frontend
npm install
npm start
```

Le site s'ouvre sur `http://localhost:4200/`. Les appels commençant par `/api` sont redirigés vers le backend (fichier `frontend/proxy.conf.json`).

Tests : `npm test`

## Choix de départ

- **Connexion unique** par courriel et mot de passe pour tous les rôles ; le rôle (membre, coordonnateur, fondateur) est porté par le compte (`backend/accounts`).
- **Mot de passe** d'au moins 10 caractères, conformément au cahier des charges.
- **Langue et fuseau** : français, Africa/Dakar.
- **Configuration sensible** (clé secrète, hôtes autorisés) lue dans l'environnement ; voir `backend/.env.example`. Aucun secret n'est versionné.

## Prochaines étapes

Elles suivent les besoins du cahier des charges : adhésion (A1 à A4), connexion (B1 à B4), interface membre (C1 à C4), interface bureau exécutif (D1 à D8), programmes (E1 à E4).

## Modifier le cahier des charges

1. Modifier `docs/cahier-des-charges-tabaxi.html`.
2. Régénérer le PDF depuis le dossier `docs` (Windows, avec Microsoft Edge) :

```powershell
& "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --headless --disable-gpu --no-pdf-header-footer --print-to-pdf="$PWD\Cahier-des-charges-TABAXI.pdf" "file:///$($PWD.Path -replace '\\','/')/cahier-des-charges-tabaxi.html"
```

## Conventions

- Un commit par changement cohérent, message court en français expliquant le pourquoi.
- Les numéros des besoins (A1 à E4) sont repris dans le planning : si un besoin change, mettre à jour le planning.
- Ne jamais versionner de secrets (mots de passe, clés, jetons) ni de données de membres.
