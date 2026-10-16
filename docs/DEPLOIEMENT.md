# Déploiement

Hébergement actuel (16 octobre 2026) : tout est sur Vercel, en production.

| Élément | Projet | Adresse |
|---|---|---|
| Site Angular | Vercel `mouvement-tabaxi-app` | `https://mouvement-tabaxi-app.vercel.app` |
| API Django | Vercel `mouvement-tabaxi-api` | `https://mouvement-tabaxi-api.vercel.app`, appelée par le site sous `/api` |
| Base PostgreSQL | Neon `mouvement-tabaxi-db`, reliée au projet `mouvement-tabaxi-api` | variable `DATABASE_URL` |

Le navigateur ne parle qu'au site : `frontend/vercel.json` renvoie `/api/…` vers l'API. Les cookies de session et la protection CSRF restent donc sur un seul domaine.

À terme, l'API passera sur Railway et le site restera sur Vercel. La configuration Railway est prête dans le dépôt (voir [Railway](#railway--serveur-django-préparé)) ; la bascule attend le choix d'un plan Railway.

Vérification rapide : `https://mouvement-tabaxi-app.vercel.app/api/health/` répond `{"status": "ready"}` quand l'API et la base répondent.

## Vercel : API Django (`mouvement-tabaxi-api`)

- Dépôt `boubacarsidibe/mouvement-tabaxi`, **Root Directory : `backend`**, préréglage **Django** : Vercel trouve `manage.py` et sert `config.wsgi.application` sans autre fichier.
- `backend/vercel.json` lance `python manage.py migrate --noinput` pendant chaque construction : les migrations s'appliquent sur la base de `DATABASE_URL` sans que son adresse quitte Vercel.
- Sans `DATABASE_URL`, la construction et le serveur s'arrêtent avec un message clair (un fichier SQLite serait figé en lecture seule sur Vercel).
- Les erreurs du serveur sont écrites dans le journal du projet (onglet Logs).
- Variables d'environnement (Production) :

| Variable | Valeur |
|---|---|
| `DATABASE_URL` | Fournie par l'intégration Neon (base `mouvement-tabaxi-db`). |
| `DJANGO_SECRET_KEY` | Longue valeur aléatoire (`python -c "import secrets; print(secrets.token_urlsafe(64))"`). |
| `FIELD_ENCRYPTION_KEYS` | Clé Fernet (voir `backend/.env.example`), à sauvegarder hors de Vercel : la perdre, c'est perdre les données chiffrées. |
| `DJANGO_ALLOWED_HOSTS` | `mouvement-tabaxi-api.vercel.app` |
| `CORS_ALLOWED_ORIGINS` | `https://mouvement-tabaxi-app.vercel.app` |
| `CSRF_TRUSTED_ORIGINS` | Facultatif ; par défaut les origines CORS, plus l'origine de `FRONTEND_URL`. |
| `FRONTEND_URL` | `https://mouvement-tabaxi-app.vercel.app` (liens des courriels). |
| `DJANGO_BEHIND_HTTPS_PROXY` | `1` |
| `LOGIN_TRUSTED_PROXIES` | `1` |
| `DJANGO_MEDIA_ROOT` | `/tmp/media` |
| `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `DEFAULT_FROM_EMAIL` | Service SMTP. Sans `EMAIL_HOST`, aucun courriel ne part : ils sont seulement écrits dans le journal. |

- Premier compte fondateur : depuis un poste, avec la même `DATABASE_URL` et les mêmes clés que la production, `python manage.py createsuperuser`. Les autres membres du bureau s'invitent ensuite depuis la plateforme (« Comptes d'accès »).

## Vercel : site Angular (`mouvement-tabaxi-app`)

- **Root Directory : `frontend`**. `frontend/vercel.json` règle la compilation (`npm ci`, `npm run build`, dossier `dist/frontend/browser`) et deux réécritures, dans cet ordre :
  - `/api/(.*)` → `https://mouvement-tabaxi-api.vercel.app/api/$1` ;
  - toutes les autres adresses → `index.html` (routes d'Angular).
- Si l'adresse du site change (domaine personnalisé), mettre à jour `CORS_ALLOWED_ORIGINS` et `FRONTEND_URL` côté API.

## Limites à connaître

- **Photos de profil** : le disque de Vercel est temporaire (`/tmp/media`) ; les photos envoyées disparaissent. Un stockage durable (volume Railway, stockage d'objets) est nécessaire avant l'ouverture au public.
- **Limites d'envoi** (demandes d'adhésion, mot de passe oublié, liens personnels) : comptées dans la mémoire de chaque instance, donc moins strictes quand plusieurs instances tournent. Le blocage de la connexion après des échecs, lui, est enregistré en base et vaut pour toutes les instances.
- Les fonctions s'endorment, comme la base Neon : la première requête après une pause est plus lente.

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
