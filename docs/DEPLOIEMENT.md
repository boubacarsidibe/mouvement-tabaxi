# Déploiement sur Vercel

Deux projets Vercel liés au même dépôt GitHub.

## 1. Base de données PostgreSQL

Créer une base PostgreSQL (Neon ou Supabase, via la Marketplace de Vercel) et copier son adresse de connexion : elle devient `DATABASE_URL`. Sans elle, Django retombe sur SQLite, qui ne survit pas sur Vercel.

## 2. Projet backend (Django)

- Nouveau projet Vercel, dépôt `mouvement-tabaxi`, **Root Directory : `backend`**, Framework : Other.
- Variables d'environnement (Production) :

| Variable | Valeur |
|---|---|
| `DJANGO_SECRET_KEY` | longue valeur aléatoire (`python -c "import secrets; print(secrets.token_urlsafe(64))"`) |
| `FIELD_ENCRYPTION_KEYS` | clé Fernet (voir `backend/.env.example`), à sauvegarder hors de Vercel |
| `DATABASE_URL` | adresse PostgreSQL |
| `DJANGO_ALLOWED_HOSTS` | domaine du projet backend, par exemple `mouvement-tabaxi-cye7.vercel.app` |
| `CORS_ALLOWED_ORIGINS` | adresse https du frontend |
| `FRONTEND_URL` | adresse https du frontend (liens des courriels) |
| `DJANGO_BEHIND_HTTPS_PROXY` | `1` |
| `LOGIN_TRUSTED_PROXIES` | `1` |
| `DJANGO_MEDIA_ROOT` | `/tmp/media` |
| `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `DEFAULT_FROM_EMAIL` | service SMTP |

- Migrations, depuis un poste avec les mêmes variables : `python manage.py migrate`, puis `python manage.py createsuperuser`.

## 3. Projet frontend (Angular)

- **Root Directory : `frontend`** ; `frontend/vercel.json` règle la compilation (`dist/frontend/browser`) et renvoie toutes les pages vers `index.html`.
- `frontend/vercel.json` renvoie `/api/…` vers le projet du serveur, `mouvement-tabaxi-cye7` :
  `{ "source": "/api/(.*)", "destination": "https://mouvement-tabaxi-cye7.vercel.app/api/$1" }`, placé avant la règle de `index.html`.
- Côté serveur, `CORS_ALLOWED_ORIGINS` doit contenir l'adresse exacte du site (par exemple `https://mouvement-tabaxi-app-git-….vercel.app`) : elle sert aussi à la protection CSRF des formulaires.
  Le navigateur reste ainsi sur un seul domaine : les cookies de session et la protection CSRF fonctionnent sans réglage.

## Limites à connaître

- **Photos de profil** : le disque de Vercel est temporaire ; les photos envoyées disparaissent. Un stockage d'objets (S3, Vercel Blob…) est nécessaire avant l'ouverture au public.
- **Blocage de connexion** après échecs : compteur gardé en mémoire de chaque instance, donc moins strict qu'avec un cache partagé.
- Les fonctions s'endorment : la première requête après une pause est plus lente.
