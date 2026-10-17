# Déploiement

Aujourd'hui, tout tourne sur deux projets Vercel, avec une base Neon et un service d'envoi de courriels (Gmail, par SMTP). À terme, le serveur Django passera sur Railway et le site restera sur Vercel : la configuration Railway est prête dans le dépôt (voir [Railway](#railway--serveur-django-préparé)), la bascule attend le choix d'un plan Railway.

| Élément | Où | Détail |
|---|---|---|
| Site Angular | projet `mouvement-tabaxi-app`, dossier racine `frontend` | `frontend/vercel.json` renvoie `/api/…` vers l'API et les autres pages vers `index.html` |
| API Django | projet `mouvement-tabaxi-api`, dossier racine `backend`, préréglage Django | `backend/vercel.json` applique les migrations à chaque mise en ligne |
| Base de données | Neon `mouvement-tabaxi-db`, reliée au projet de l'API | fournit `DATABASE_URL` |
| Photos de profil | dans la base, chiffrées | par défaut en production (le disque de Vercel est effacé entre deux appels) |
| Courriels | Gmail du mouvement, par SMTP | obligatoire en production |

Le navigateur reste sur l'adresse du site : les cookies de session et la protection CSRF fonctionnent sans réglage de domaine.

## Variables de l'API (Production)

| Variable | Valeur |
|---|---|
| `DJANGO_SECRET_KEY` | valeur aléatoire de 50 caractères au moins |
| `FIELD_ENCRYPTION_KEYS` | clé Fernet (voir `backend/.env.example`), **à sauvegarder hors de Vercel** |
| `DATABASE_URL` | fournie par Neon (obligatoire : sans elle, l'API refuse de démarrer) |
| `DJANGO_ALLOWED_HOSTS` | domaine de l'API, par exemple `mouvement-tabaxi-api.vercel.app` |
| `CORS_ALLOWED_ORIGINS` | adresse https du site (sert aussi à la protection CSRF) |
| `FRONTEND_URL` | adresse https du site (liens envoyés par courriel) |
| `DJANGO_BEHIND_HTTPS_PROXY` | `1` |
| `LOGIN_TRUSTED_PROXIES` | `1` |
| `EMAIL_HOST` | `smtp.gmail.com` |
| `EMAIL_PORT` | `587` |
| `EMAIL_HOST_USER` | adresse Gmail qui envoie |
| `EMAIL_HOST_PASSWORD` | mot de passe d'application Gmail (type « Secret » sur Vercel) |
| `DEFAULT_FROM_EMAIL` | `Mouvement TABAXI <la même adresse Gmail>` |

Une variable modifiée ne s'applique qu'au déploiement suivant : relancer `vercel deploy --prod` depuis `backend/`.

## Courriels

**Aujourd'hui : Gmail.** Les courriels partent du compte Gmail du mouvement, par son propre serveur SMTP
(environ 500 par jour au plus) :

1. Activer la validation en deux étapes du compte Google : https://myaccount.google.com/signinoptions/twosv
2. Créer un mot de passe d'application : https://myaccount.google.com/apppasswords
3. Renseigner les variables `EMAIL_*` et `DEFAULT_FROM_EMAIL` ci-dessus, puis redéployer l'API.
4. Tester vers une **autre** adresse que celle du compte : un courriel envoyé à sa propre adresse Gmail
   n'apparaît que dans « Messages envoyés ».

**Pourquoi pas Brevo pour l'instant.** Brevo accepte les courriels mais refuse de les distribuer quand
l'expéditeur est une adresse `@gmail.com` (journal Brevo : « Envoyé » puis « Erreur ») : Gmail exige que
ses adresses envoient depuis ses propres serveurs. Avec un nom de domaine du mouvement, déclaré dans Brevo
(« Domains », enregistrements DKIM et DMARC), on pourra revenir à Brevo en changeant seulement les
variables `EMAIL_*` (`smtp-relay.brevo.com`, identifiant et clé SMTP Brevo).

## Mettre en ligne

```bash
cd backend && vercel deploy --prod      # API (projet mouvement-tabaxi-api) : migrations comprises
cd .. && vercel deploy --prod           # site (projet mouvement-tabaxi-app), depuis la racine du dépôt
```

Premier compte fondateur : `python manage.py createsuperuser` depuis un poste, avec `DATABASE_URL` de Neon et `DJANGO_DEBUG=1` (le fichier téléchargé par `vercel env pull` contient des valeurs masquées `[SENSITIVE]` à retirer).

## Limites connues

- Les limites d'envoi des formulaires publics sont comptées par instance de fonction ; le blocage de connexion après plusieurs échecs, lui, est enregistré en base.
- La base gratuite Neon se met en veille sans activité : la première requête après une pause est plus lente.

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
| `DJANGO_FILE_STORAGE` | Facultatif. Par défaut en production, les photos de profil sont gardées en base, chiffrées, et rien n'est à prévoir. Avec `filesystem`, elles vont sur disque : ajouter alors `DJANGO_MEDIA_ROOT=/data/media` et un volume Railway monté sur `/data`, sinon elles disparaissent à chaque déploiement. |
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
