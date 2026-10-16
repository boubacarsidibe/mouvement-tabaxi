# Déploiement

Aujourd'hui, le site et le serveur Django sont sur Vercel (deux projets liés au même dépôt GitHub), avec une base PostgreSQL Neon. À terme, le serveur Django passera sur Railway et le site restera sur Vercel : la configuration Railway est prête dans le dépôt (voir [Railway](#railway--serveur-django-préparé)), la bascule attend le choix d'un plan Railway.

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

## Railway : serveur Django (préparé)

Rien n'est déployé sur Railway tant que les fondateurs n'ont pas choisi un plan. Le site reste sur Vercel ; seule l'adresse vers laquelle il renvoie `/api` changera.

### Ce que contient le dépôt

| Fichier | Rôle |
|---|---|
| `backend/railway.json` | Construction Railpack ; démarrage `gunicorn config.wsgi --config gunicorn.conf.py` ; `python manage.py migrate --noinput` avant chaque mise en service ; contrôle de santé sur `/api/health/` ; redémarrage en cas de panne. |
| `backend/gunicorn.conf.py` | Écoute sur `0.0.0.0:$PORT` (port fixé par Railway), 2 processus (`WEB_CONCURRENCY`), délai de 60 s (`GUNICORN_TIMEOUT`), une ligne de journal par requête. |
| `backend/.python-version` | Python 3.12, la version utilisée par défaut sur Vercel. |
| `backend/requirements.txt` | `gunicorn` figé à une version précise. |

Ordre d'une mise en service : construction, migrations, démarrage, contrôle de santé. Si les migrations échouent ou si `/api/health/` ne répond pas 200 (il ne le fait que si la base répond), la version précédente reste en ligne.

Le contrôle de santé de Railway appelle `/api/health/` en http, directement sur le port du serveur, avec l'hôte `healthcheck.railway.app`. Django accepte donc cet hôte sur Railway et ne redirige pas cette adresse vers https ; toutes les autres le restent.

### Mise en place (une fois)

1. Railway → New Project → Deploy from GitHub repo → `boubacarsidibe/mouvement-tabaxi`.
2. Réglages du service Django :
   - **Root Directory** : `backend` ;
   - **Config file** : `/backend/railway.json`, en chemin absolu (ce fichier ne suit pas le Root Directory) ;
   - Networking → **Generate Domain** : une adresse `….up.railway.app`.
3. New → Database → **PostgreSQL**, dans le même projet.
4. Variables du service Django (tableau ci-dessous), puis Deploy.
5. Premier compte fondateur, si la base est neuve : `railway ssh` sur le service, puis `python manage.py createsuperuser`.

### Variables

| Variable | Valeur |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` : référence vers la base du projet, jointe par le réseau privé de Railway. |
| `DJANGO_SECRET_KEY` | Longue valeur aléatoire (`python -c "import secrets; print(secrets.token_urlsafe(64))"`). |
| `FIELD_ENCRYPTION_KEYS` | **Les mêmes clés que sur Vercel** si les données sont reprises : sans elles, motivations, adresses et téléphones restent illisibles. |
| `DJANGO_ALLOWED_HOSTS` | Domaine personnalisé éventuel. Le domaine public du service (`RAILWAY_PUBLIC_DOMAIN`) et `healthcheck.railway.app` sont ajoutés d'office. |
| `CORS_ALLOWED_ORIGINS` | Adresse https du site, par exemple `https://mouvement-tabaxi-app.vercel.app`. |
| `CSRF_TRUSTED_ORIGINS` | Facultatif. Par défaut, les origines CORS ; l'origine de `FRONTEND_URL` est toujours ajoutée. |
| `FRONTEND_URL` | Adresse https du site, utilisée dans les liens des courriels. `python manage.py check --deploy` signale une adresse en http ou locale. |
| `DJANGO_BEHIND_HTTPS_PROXY` | `1` : Railway termine le https devant Django. |
| `LOGIN_TRUSTED_PROXIES` | `2` quand les appels passent par la réécriture `/api` du site Vercel puis par Railway, `1` si le site appelle Railway directement. À vérifier au premier essai : l'adresse notée lors d'un échec de connexion doit être celle du visiteur. |
| `DJANGO_MEDIA_ROOT` | `/data/media`, avec un volume Railway monté sur `/data`. Sans volume, les photos de profil disparaissent à chaque déploiement. |
| `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `DEFAULT_FROM_EMAIL` | Service SMTP, comme sur Vercel. |
| `WEB_CONCURRENCY` | Facultatif : nombre de processus gunicorn (2 par défaut). |

Les secrets se saisissent dans l'interface de Railway, jamais dans le dépôt.

### Base PostgreSQL et migrations

- Les migrations s'appliquent seules avant chaque mise en service (`preDeployCommand`). Pour les lancer à la main : `railway ssh`, puis `python manage.py migrate`.
- Reprise des données de Neon, une fois, avant la bascule (les deux adresses se copient depuis Neon et depuis l'onglet Connect de la base Railway, `DATABASE_PUBLIC_URL`) :

  ```bash
  pg_dump --format=custom --no-owner --no-acl "ADRESSE_NEON" --file tabaxi.dump
  pg_restore --no-owner --no-acl --dbname "ADRESSE_PUBLIQUE_RAILWAY" tabaxi.dump
  ```

  Garder les mêmes `FIELD_ENCRYPTION_KEYS` ; supprimer `tabaxi.dump` ensuite, il contient les données des membres.

### Bascule du site vers Railway

1. Vérifier que `https://….up.railway.app/api/health/` répond `{"status": "ready"}`.
2. Dans `frontend/vercel.json`, remplacer la destination de la règle `/api/(.*)` par `https://….up.railway.app/api/$1`, puis redéployer le site.
3. Une fois le site vérifié, arrêter le projet Vercel du serveur. `backend/vercel.json` peut alors être retiré.
