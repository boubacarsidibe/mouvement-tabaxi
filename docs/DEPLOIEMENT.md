# Déploiement sur Vercel

Deux projets Vercel, plus une base Neon et un service d'envoi de courriels (Brevo) :

| Élément | Où | Détail |
|---|---|---|
| Site Angular | projet `mouvement-tabaxi-app`, dossier racine `frontend` | `frontend/vercel.json` renvoie `/api/…` vers l'API et les autres pages vers `index.html` |
| API Django | projet `mouvement-tabaxi-api`, dossier racine `backend`, préréglage Django | `backend/vercel.json` applique les migrations à chaque mise en ligne |
| Base de données | Neon `mouvement-tabaxi-db`, reliée au projet de l'API | fournit `DATABASE_URL` |
| Photos de profil | dans la base, chiffrées | par défaut en production (le disque de Vercel est effacé entre deux appels) |
| Courriels | Brevo, par SMTP | obligatoire en production |

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
| `EMAIL_HOST` | `smtp-relay.brevo.com` |
| `EMAIL_PORT` | `587` |
| `EMAIL_HOST_USER` | identifiant SMTP Brevo (de la forme `xxxx@smtp-brevo.com`) |
| `EMAIL_HOST_PASSWORD` | clé SMTP Brevo |
| `DEFAULT_FROM_EMAIL` | `Mouvement TABAXI <adresse d'expéditeur vérifiée dans Brevo>` |

Une variable modifiée ne s'applique qu'au déploiement suivant : relancer `vercel deploy --prod` depuis `backend/`.

## Courriels avec Brevo

1. Créer un compte gratuit sur https://www.brevo.com (300 courriels par jour).
2. Vérifier l'adresse d'expéditeur : « Senders, Domains & Dedicated IPs » → « Senders ».
3. Dans « SMTP & API » → « SMTP » : noter l'identifiant SMTP et créer une clé SMTP.
4. Renseigner les variables `EMAIL_*` et `DEFAULT_FROM_EMAIL` ci-dessus, puis redéployer l'API.
5. Tester avec « Mot de passe oublié » sur son propre compte.

Avec une adresse Gmail comme expéditeur, des courriels peuvent arriver dans les indésirables ; avec un nom de domaine du mouvement, le déclarer dans Brevo (« Domains ») améliore la remise.

## Mettre en ligne

```bash
cd backend && vercel deploy --prod      # API (projet mouvement-tabaxi-api) : migrations comprises
cd .. && vercel deploy --prod           # site (projet mouvement-tabaxi-app), depuis la racine du dépôt
```

Premier compte fondateur : `python manage.py createsuperuser` depuis un poste, avec `DATABASE_URL` de Neon et `DJANGO_DEBUG=1` (le fichier téléchargé par `vercel env pull` contient des valeurs masquées `[SENSITIVE]` à retirer).

## Limites connues

- Les limites d'envoi des formulaires publics sont comptées par instance de fonction ; le blocage de connexion après plusieurs échecs, lui, est enregistré en base.
- La base gratuite Neon se met en veille sans activité : la première requête après une pause est plus lente.
