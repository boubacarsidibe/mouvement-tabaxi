# Déploiement sur Vercel

Deux projets Vercel, plus une base Neon et un service d'envoi de courriels (Gmail, par SMTP) :

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
