# Déploiement sur Vercel

La plateforme est mise en ligne **à la main**, avec la ligne de commande Vercel : aucun déploiement automatique à chaque envoi sur GitHub (choix du propriétaire du projet).

## Ce qui tourne où

| Élément | Chez Vercel | Détail |
|---|---|---|
| Écrans Angular | fichiers statiques | construits par `npm run build` dans `frontend/` |
| API Django | fonction Python `api/index.py` | reçoit `/api/…`, `/admin/…` et `/static/…` (voir `vercel.json`) |
| Base de données | Postgres (Neon, offre gratuite) | adresse dans `DATABASE_URL`, connexion chiffrée exigée |
| Photos de profil | dans la base, chiffrées | `DJANGO_FILE_STORAGE=database` : le disque des fonctions Vercel est éphémère |
| Fichiers de l'administration | servis par l'API (WhiteNoise) | pas d'étape `collectstatic` |

Écrans et API partagent la même adresse : le cookie de session et la protection CSRF fonctionnent sans réglage de domaine.

## Variables d'environnement

À définir dans le projet Vercel (`vercel env add NOM preview` ou `production`). Aucune n'est versionnée.

| Variable | Valeur |
|---|---|
| `DJANGO_SECRET_KEY` | valeur aléatoire de 50 caractères au moins |
| `FIELD_ENCRYPTION_KEYS` | clé Fernet ; **à sauvegarder hors de Vercel** : la perdre, c'est perdre les données chiffrées |
| `DATABASE_URL` | fournie par l'intégration Neon |
| `DJANGO_ALLOWED_HOSTS` | `.vercel.app` (puis le nom de domaine définitif) |
| `DJANGO_BEHIND_HTTPS_PROXY` | `1` |
| `LOGIN_TRUSTED_PROXIES` | `1` |
| `DJANGO_FILE_STORAGE` | `database` |
| `EMAIL_HOST`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `DEFAULT_FROM_EMAIL` | serveur d'envoi des courriels |
| `EMAIL_CONSOLE_IN_PRODUCTION` | `1` **seulement pour un aperçu de test sans serveur d'envoi** : les courriels apparaissent alors dans les journaux Vercel au lieu de partir |

`FRONTEND_URL` est facultative : sans elle, les liens envoyés par courriel pointent vers l'adresse du déploiement (`VERCEL_URL`).

## Mettre en ligne

Le déploiement part d'un dossier sans historique Git, pour que Vercel ne se relie pas au dépôt et ne déploie rien automatiquement.

```powershell
# 1. Préparer le dossier à envoyer (depuis la racine du dépôt, sur la branche à déployer)
git archive --format=zip -o $env:TEMP\tabaxi.zip HEAD
Expand-Archive $env:TEMP\tabaxi.zip -DestinationPath $env:TEMP\tabaxi-deploiement -Force
cd $env:TEMP\tabaxi-deploiement

# 2. La première fois seulement : relier le dossier au projet Vercel
vercel link --project tabaxi

# 3. Aperçu protégé (réservé aux membres du compte Vercel)
vercel deploy

# 4. Plus tard, mise en ligne publique, après la démarche auprès de la CDP
vercel deploy --prod
```

## Base de données

Les migrations se lancent depuis un poste, avec l'adresse de la base de Vercel :

```powershell
cd backend
vercel env pull ..\.env.vercel --environment=preview
# Charger DATABASE_URL, DJANGO_SECRET_KEY et FIELD_ENCRYPTION_KEYS depuis .env.vercel, puis :
python manage.py migrate
python manage.py createsuperuser
```

`createsuperuser` crée le premier compte fondateur ; les autres membres du bureau sont ensuite invités depuis la plateforme. Supprimer `.env.vercel` après usage : il contient les secrets.

## Vérifier

- `https://<adresse>/api/health/` répond `{"status": "ready"}`.
- La page d'accueil s'affiche, la connexion fonctionne.
- Les en-têtes de sécurité sont présents (CSP, HSTS, X-Frame-Options).

## Limites connues

- Les limites d'envois (formulaire d'adhésion, liens) sont comptées par instance de fonction : une protection d'appoint, le blocage de connexion, lui, est enregistré en base.
- La base gratuite Neon se met en veille sans activité : la première requête après une pause est plus lente.
