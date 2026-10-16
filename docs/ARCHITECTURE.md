# Architecture technique

Vue d'ensemble de la plateforme. Document vivant, mis à jour avec le code.

## Vue d'ensemble

```mermaid
flowchart LR
    V[Visiteur ou membre<br/>navigateur sur téléphone ou ordinateur] --> F[Frontend Angular]
    F -- "requêtes /api (JSON, cookie de session)" --> B[Backend Django REST]
    B --> DB[(Base de données)]
    B --> M[Service de courriels]
```

## Composants

| Composant | Dossier | Rôle |
|---|---|---|
| Frontend | `frontend/` | Application Angular : pages publiques, interface membre, interface bureau exécutif |
| Backend | `backend/` | API Django REST : comptes, territoires, demandes, membres, programmes |
| Base de données | SQLite en local, à choisir en production | Stockage des données |
| Courriels | Service d'envoi configurable | Réponses aux demandes, liens personnels, réinitialisation de mot de passe |

## Backend

- **Django 6** et **Django REST Framework**.
- Compte unique `accounts.User` : connexion par courriel, rôle `membre`, `coordonnateur` ou `fondateur`. Le bureau exécutif réunit coordonnateurs et fondateurs.
- Droits : vérifiés par le serveur à chaque requête, selon le rôle et le territoire.
- Configuration sensible lue dans l'environnement. En local, `backend/.env` (copie de `backend/.env.example`, jamais versionnée) est chargé au démarrage ; une variable déjà définie dans l'environnement est prioritaire.

### Applications Django

```
backend/
  config/        réglages, routes, lecture du fichier .env
  core/          socle commun : point de contrôle /api/health/, courriels, chiffrement, historiques non modifiables
  accounts/      comptes et rôles
  territories/   territoires emboîtés pays, région, commune
  applications/  demandes d'adhésion et leur examen
  members/       membres, numéros, statuts, cartes
  audit/         journal des actions, non modifiable
```

L'application `programs` (programmes, activités, présences) sera ajoutée avec ses fonctionnalités.

Chaque application regroupe ses modèles, son administration, ses routes (`urls.py`), ses vues et ses tests (`tests.py`).

### Territoires

Modèle `territories.Territory` : nom, type (`pays`, `region`, `commune`), territoire parent, actif ou non.

- Une commune est rattachée à une région, une région à un pays, un pays à rien. Vérifié à chaque enregistrement et par une contrainte en base.
- Un nom est unique parmi les territoires d'un même parent (une commune peut porter le nom de sa région).
- Un territoire utilisé ne peut pas être supprimé (protection en base) : on le désactive.
- Chaque compte peut être rattaché à un territoire (`User.territory`) : territoire du membre, ou territoire de coordination du coordonnateur (obligatoire pour lui). Un fondateur n'en a pas besoin.
- Règle d'accès réutilisable (`territories/scope.py`) : un fondateur voit tout ; un coordonnateur voit son territoire et tous ceux qui en dépendent ; un membre simple ne voit rien au bureau. Toute liste du bureau passe par `scope_queryset(...)`. Un objet hors du périmètre répond 404, pas 403, pour ne pas révéler son existence.
- Territoires de départ chargés par la migration `0002` : le Sénégal, ses 14 régions et 47 communes (chefs-lieux des 46 départements, plus Touba), à compléter par les fondateurs depuis l'administration.

### Demandes d'adhésion

Modèle `applications.Application` : référence, prénom, nom, courriel, localité souhaitée (territoire), profession, motivation, date du consentement, statut, dates de dépôt et de modification.

- Statuts : `a_examiner` (À examiner), `acceptee` (Acceptée), `rejetee` (Rejetée), `inscrite` (Inscrite). Une demande est « en cours » tant qu'elle est à examiner ou acceptée.
- Un même courriel (sans tenir compte des majuscules) ne peut avoir qu'une demande en cours : vérifié par l'API et par une contrainte en base. Un courriel déjà utilisé par un compte est refusé.
- Référence `TAB-AAAA-NNNNN` : année de dépôt et numéro unique de la demande (exemple : `TAB-2026-00418`). Le numéro ne repart pas de zéro chaque année.
- La localité est un territoire actif (commune ou région) dont les parents sont actifs.
- Le consentement au traitement des données est obligatoire ; sa date est conservée.
- Dépôt public limité à 10 envois par heure depuis une même adresse (variable `ADHESION_RATE`).
- Dans l'administration Django, les demandes sont en lecture seule : les décisions passent par l'API d'examen, qui envoie les courriels.
- Examen réservé aux fondateurs (`accounts.permissions.IsFounder`). Seule une demande « À examiner » peut être acceptée ou refusée ; chaque décision enregistre son auteur, sa date et une note interne facultative.
- Un refus exige un motif écrit, envoyé par courriel à la personne. Toute décision n'est enregistrée que si son courriel est parti : sinon la demande reste « À examiner » et le fondateur voit l'erreur (`503 email_not_sent`). Logique dans `applications/services.py`.
- L'acceptation crée un lien personnel (`RegistrationLink`) et l'envoie par courriel : `FRONTEND_URL/finaliser?jeton=…`. Le jeton (256 bits aléatoires) n'est jamais conservé, seule son empreinte SHA-256 l'est (`core/tokens.py`). Le lien est valable 7 jours et ne sert qu'une fois (consommation atomique). Si le courriel ne part pas, le lien n'existe pas et la demande reste « À examiner ».
- Écran du bureau (`/bureau/demandes`, `/bureau/demandes/:id`, fondateurs seulement) : `core/review.service.ts` appelle `GET /api/applications/` (filtre `status`, recherche `search`, pagination), `GET /api/applications/:id/`, `POST …/accept/` et `POST …/reject/` (motif obligatoire, contrôlé aussi côté serveur). L'erreur `email_not_sent` est affichée telle quelle ; la demande reste « À examiner ». Aucune donnée fictive.

### Membres

Modèle `members.Member`, relié à un compte (un dossier par compte) : numéro de membre, date d'adhésion.

- Numéro `TBX-AAAA-NNNNN` attribué automatiquement à la création : année d'adhésion et numéro d'ordre unique, jamais réutilisé (exemple : `TBX-2026-00125`). Unicité garantie en base.
- Adresse et téléphone (facultatif) chiffrés en base ; photo, date d'acceptation des statuts et du règlement, demande d'origine.
- Finalisation (`members/registration.py`) : le lien personnel reçu à l'acceptation permet de choisir son mot de passe (règles de sécurité de Django : 10 caractères au moins, pas seulement des chiffres, pas un mot de passe courant, pas semblable au nom ou au courriel), de donner son adresse et sa photo. Le compte membre (actif, rattaché au territoire de la demande) et son dossier sont créés, le lien est consommé et la demande passe « Inscrite », en une seule transaction ; la session s'ouvre. Lien inconnu : 404 `invalid_link` ; expiré : 410 `link_expired` ; déjà utilisé : 410 `link_used`, chacun avec un message qui dit quoi faire.
- Statut : `actif` (Actif), `suspendu` (Suspendu) ou `radie` (Radié), `actif` par défaut. Un seul point d'entrée le change, `members/status.py` (`change_status`), en une transaction : suspendu ou radié désactive le compte (plus de connexion) et ferme ses sessions ouvertes (`accounts/sessions.py`), actif le réactive, et chaque changement ajoute une ligne à l'historique `members.MemberStatusChange` (ancien et nouveau statut, motif, auteur, date). Rien n'est supprimé : le dossier, le numéro et les données restent, un dossier ne se supprime pas (même dans l'administration, où le statut est en lecture seule et l'accès `is_active` d'un membre aussi).
- Historique non modifiable : `MemberStatusChange` repose sur `core/append_only.py` (ni `save` sur une ligne existante, ni `delete`, ni `update`/`delete` en lot : `ImmutableRecordError`). Seuls les fondateurs voient l'historique.
- Règles du changement de statut : réservé aux fondateurs ; un motif est obligatoire pour suspendre ou radier ; on ne change pas son propre statut ; changer vers le statut actuel est refusé (409). Les coordonnateurs et fondateurs invités ont aussi un dossier de membre, créé à l'acceptation de l'invitation.
- Bases du bureau : `GET /api/members/` (membres simples, ou coordonnateurs et fondateurs avec `role=coordonnateur,fondateur`) et la fiche `GET /api/members/<id>/` sont limitées au territoire de la personne connectée (`territories/scope.py`) ; hors périmètre, la fiche répond 404 et une liste filtrée sur un autre territoire reste vide. Un fondateur n'étant rattaché à aucun territoire, seuls les fondateurs le voient dans la base du bureau.
- Dossier du bureau : chaque compte du bureau a un dossier de membre (numéro, date d'entrée, statut, carte) : à l'acceptation de l'invitation, à la création d'un fondateur par `createsuperuser`, ou depuis l'administration pour un compte créé avec un mot de passe ; la migration `members/0004` ouvre celui des comptes du bureau existants.
- Photos : vérifiées (vraie image JPG ou PNG, 5 Mo au plus), réenregistrées en JPEG de 800 pixels au plus, sans aucune métadonnée (position GPS comprise), sous un nom aléatoire dans `MEDIA_ROOT/photos/`. Jamais servies directement : seulement par l'API, à la personne concernée.

### Journal des actions

Modèle `audit.AuditEntry` : action, auteur (avec son nom du moment, la ligne reste lisible si le compte change), personne ou liste concernée, détails, date.

- Actions enregistrées automatiquement : acceptation et refus d'une demande (avec le motif), changement de statut d'un membre (avec l'ancien et le nouveau statut et le motif), invitation au bureau, export d'une liste. `audit.services.record` est appelé dans la transaction de l'action : un courriel qui ne part pas annule la décision et sa ligne de journal, et une action refusée n'écrit rien.
- Non modifiable : `AuditEntry` repose sur `core/append_only.py` (ni `save` sur une ligne existante, ni `delete`, ni `update`/`delete`/`bulk_update` en lot : `ImmutableRecordError`), aucune route n'écrit dans le journal (`GET` seulement, les autres méthodes répondent 405) et l'administration Django le montre en lecture seule, sans ajout, modification ni suppression. Un compte qui a agi ne peut pas être supprimé.
- Les détails (motifs, courriels, filtres d'export) sont chiffrés en base (`core.fields.EncryptedJSONField`) comme les motifs de refus des demandes ; `manage.py rechiffrer` change la clé du journal sans en modifier le contenu (`AppendOnlyQuerySet.reencrypt`).
- Consultation réservée aux fondateurs : `GET /api/audit/`, du plus récent au plus ancien, filtres `action`, `actor`, `search`, `date_from`, `date_to`.

### Exports Excel

Chaque liste du bureau a son export `.xlsx` : `GET /api/members/export/` (base des membres et, avec `role=coordonnateur,fondateur`, base des coordonnateurs), `GET /api/applications/export/` (demandes, fondateurs) et `GET /api/audit/export/` (journal, fondateurs).

- Le fichier contient exactement la liste filtrée : l'export prend les mêmes paramètres que la liste (`members/filters.py`, `applications/filters.py`, `audit/filters.py`), le même périmètre de territoire et le même ordre, sans les pages. Un filtre invalide répond 400 : ni fichier ni ligne de journal.
- Chaque export est noté dans le journal des actions (action « Liste exportée » : auteur, liste, nombre de lignes, filtres en clair, nom du fichier), dans la même transaction que la fabrication du fichier (`audit/exports.py`).
- Colonnes limitées à ce que la liste montre, plus le courriel : l'adresse et le téléphone des membres, la motivation et les notes des demandes ne sont jamais exportés.
- Sécurité du fichier (`core/xlsx.py`) : tout texte est écrit comme du texte, jamais comme une formule, donc un nom saisi sous la forme `=HYPERLINK(…)` s'ouvre tel quel dans Excel ; réponse `Cache-Control: no-store`.

### Courriels

- Service unique `core.mail.send_email(to=…, subject=…, body=…)` : il lève `EmailNotSent` si le courriel ne part pas (serveur injoignable, refus, envoi non confirmé). L'échec est écrit dans le journal du serveur, sans l'adresse du destinataire.
- Configuration par variables d'environnement (`backend/.env.example`) : sans `EMAIL_HOST`, les courriels s'affichent dans la console du serveur ; avec `EMAIL_HOST`, ils partent par SMTP (`EMAIL_PORT`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `EMAIL_USE_TLS` ou `EMAIL_USE_SSL`, `EMAIL_TIMEOUT`). Expéditeur : `DEFAULT_FROM_EMAIL`.
- Aucun identifiant dans le code : ils ne vivent que dans l'environnement ou dans `backend/.env`, ignoré par Git.

### Conventions de l'API

- Toutes les routes commencent par `/api/` et se terminent par une barre oblique (`/api/health/`).
- Échanges en JSON uniquement. L'interface navigable de Django REST Framework n'est active qu'en développement (`DJANGO_DEBUG=1`).
- Par défaut, une route exige une connexion ; les routes publiques le déclarent explicitement.
- Messages d'erreur en français. Une erreur générale a toujours la forme `{"detail": "…", "code": "…"}` (`not_authenticated`, `permission_denied`, `not_found`, `session_expired`…, voir `core/exceptions.py`) ; une erreur de saisie liste les messages par champ (`{"email": ["Ce champ est obligatoire."]}`).
- `401` : personne n'est connecté (le frontend renvoie vers la connexion). `403` : la personne connectée n'a pas le droit.

### Connexion et sécurité des requêtes

- Session Django par cookie, sur le même domaine que le frontend (le proxy Angular renvoie `/api` vers Django en développement).
- Courriel reconnu sans tenir compte des majuscules ; un courriel ne sert qu'à un seul compte (contrainte en base).
- Un compte désactivé (suspendu ou radié) ne peut plus se connecter (`403 inactive_account`, avec un message propre à la suspension ou à la radiation, donné seulement à la personne qui connaît son mot de passe), et sa session en cours cesse aussitôt d'être valable.
- Sans « rester connecté », la session se ferme avec le navigateur.
- La session d'un coordonnateur ou d'un fondateur se ferme après 30 minutes sans requête (`accounts.middleware.BureauInactivityMiddleware`, réglable par `BUREAU_INACTIVITY_MINUTES`) ; la requête suivante reçoit `401 session_expired`. Les membres simples ne sont pas concernés.
- Blocage temporaire (`accounts/lockout.py`) : après 5 échecs pour un même courriel, ou 20 depuis une même adresse IP, la connexion est refusée pendant 15 minutes (`429 too_many_attempts`, en-tête `Retry-After`), même avec le bon mot de passe. Une connexion réussie efface les échecs du compte ; les échecs sont effacés après un jour. Derrière un proxy en production, régler `LOGIN_TRUSTED_PROXIES` pour lire la vraie adresse du visiteur.
- Mot de passe oublié (`accounts/password_reset.py`) : lien par courriel vers `FRONTEND_URL/nouveau-mot-de-passe?jeton=…`, valable **une heure**, utilisable une fois ; un nouveau lien annule le précédent ; trois demandes par heure au plus par compte. La réponse est la même qu'un compte existe ou non. Le nouveau mot de passe ferme les autres sessions et lève le blocage de connexion.
- Invitation au bureau (`accounts/invitations.py`) : un fondateur saisit courriel, nom, fonction (coordonnateur ou fondateur) et territoire (obligatoire pour un coordonnateur). Le compte est créé sans mot de passe utilisable et un lien (7 jours, une fois) part vers `FRONTEND_URL/invitation?jeton=…` ; si le courriel ne part pas, rien n'est créé. En acceptant, la personne choisit son mot de passe, reçoit son dossier et son numéro, et sa session s'ouvre sur l'interface du bureau.
- Liens personnels (inscription, réinitialisation, invitation) : le jeton n'est jamais conservé, seule son empreinte l'est (`core/tokens.py`) ; un lien est valable un temps limité et ne sert qu'une fois.
- Protection CSRF aux noms attendus par Angular : Django dépose le cookie `XSRF-TOKEN` (à la connexion et sur `GET /api/auth/me/`), et chaque requête qui modifie renvoie sa valeur dans l'en-tête `X-XSRF-TOKEN`. Le client HTTP d'Angular le fait tout seul.

### Routes

| Méthode et route | Accès | Rôle |
|---|---|---|
| `GET /api/health/` | public | Contrôle de santé : `{"status": "ready"}` (200), ou `{"status": "unavailable"}` (503) si la base est injoignable |
| `POST /api/auth/login/` | public | Connexion. Corps : `email`, `password`, `remember` (facultatif). Renvoie l'utilisateur (200) ; 400 `invalid_credentials` ; 403 `inactive_account` ; 429 `too_many_attempts` |
| `POST /api/auth/logout/` | public | Déconnexion (204) |
| `GET /api/auth/me/` | connecté | Utilisateur connecté : `id`, `email`, `first_name`, `last_name`, `role`, `role_label`, `is_bureau`, `territory` ; 401 sinon |
| `POST /api/auth/password/forgot/` | public | Mot de passe oublié. Corps : `email`. Répond toujours 202 avec le même message, que le compte existe ou non ; envoie un lien valable 1 h (3 demandes par heure et par compte au plus, un nouveau lien annule le précédent ; pas de lien pour un compte suspendu ou radié) ; 429 si trop d'envois |
| `POST /api/auth/password/reset/check/` | public | Vérifie le lien. Corps : `token`. 200 `valid` ; 404 `invalid_link` ; 410 `link_used` ou `link_expired` |
| `POST /api/auth/password/reset/` | public | Nouveau mot de passe. Corps : `token`, `password`, `password_confirm` (règles de sécurité de Django, messages en français) ; le lien est consommé ; mêmes erreurs de lien que `check/` ; 400 avec un message par champ |
| `POST /api/auth/invitations/` | fondateur | Invite une personne au bureau. Corps : `email`, `first_name`, `last_name`, `role` (`coordonnateur` ou `fondateur`), `territory` (obligatoire pour un coordonnateur). Crée le compte sans mot de passe et envoie un lien valable 7 jours ; 201 ; 400 par champ (courriel déjà utilisé, demande d'adhésion en cours) ; 503 `email_not_sent` : aucun compte n'est créé ; 403 hors fondateur |
| `POST /api/auth/invitation/check/` | public | Vérifie le lien d'invitation. Corps : `token`. 200 avec la personne invitée ; 404 `invalid_link` ; 410 `link_used` ou `link_expired` |
| `POST /api/auth/invitation/accept/` | public | La personne invitée choisit son mot de passe (`token`, `password`, `password_confirm`) ; le lien est consommé, la session s'ouvre et l'utilisateur est renvoyé (201) |
| `POST /api/auth/password/change/` | connecté | Changement du mot de passe. Corps : `current_password`, `new_password`, `new_password_confirm`. La session reste ouverte, les autres sont fermées |
| `GET /api/territories/` | public | Territoires actifs en arbre pays > région > commune, par ordre alphabétique : `[{"id", "name", "kind", "kind_label", "children": [...]}]`. Un territoire dont un parent est inactif n'apparaît pas |
| `GET /api/territories/managed/` | bureau | Territoires du périmètre de la personne connectée, actifs ou non, en ordre d'arbre : `id`, `name`, `kind`, `kind_label`, `path`, `parent`, `is_active` |
| `GET /api/territories/managed/<id>/` | bureau | Un territoire du périmètre ; 404 s'il est hors périmètre |
| `POST /api/applications/` | public | Dépôt d'une demande. Corps : `first_name`, `last_name`, `email`, `territory` (identifiant), `profession`, `motivation`, `consent` (`true`). Renvoie `reference`, `status`, `status_label`, `created_at` (201) ; 400 avec un message par champ ; 429 si trop d'envois |
| `GET /api/applications/` | fondateur | Demandes, les plus récentes d'abord, par pages de 20 (`count`, `next`, `previous`, `results`). Filtres : `status`, `search` (nom, prénom, courriel, référence), `page`, `page_size` |
| `GET /api/applications/<id>/` | fondateur | Demande complète : identité, localité (`territory.path`), motivation, statut, décision (`decided_by`, `decided_at`, `rejection_reason`, `internal_note`) |
| `GET /api/applications/export/` | fondateur | Fichier Excel de la liste des demandes affichée (mêmes filtres `status` et `search`), sans motivation ni notes ; noté dans le journal |
| `POST /api/applications/<id>/accept/` | fondateur | Acceptation. Corps : `internal_note` (facultatif). Envoie le lien personnel d'inscription. 409 `already_decided` ; 503 `email_not_sent` (la demande reste « À examiner ») |
| `POST /api/registration/check/` | public | Vérifie un lien personnel. Corps : `token`. Renvoie `first_name`, `last_name`, `email`, `territory`, `expires_at` ; 404 `invalid_link`, 410 `link_expired` ou `link_used` |
| `POST /api/registration/` | public | Finalise l'inscription (formulaire multipart). Champs : `token`, `address`, `phone` (facultatif), `photo`, `password`, `password_confirm`, `accept_rules`. Renvoie `user` et `member_number` (201) et ouvre la session ; 400 avec un message par champ ; 409 `account_exists` |
| `GET /api/members/me/` | connecté | Profil et données de carte : `number`, `joined_on`, `first_name`, `last_name`, `email`, `role`, `role_label`, `territory`, `address`, `phone`, `photo_url` ; 404 sans dossier de membre |
| `PATCH /api/members/me/` | connecté | Modifie `address`, `phone`, `photo` (multipart pour la photo). Nom, courriel, territoire, numéro et date d'adhésion : 400 « Seul le bureau peut modifier cette information. » |
| `GET /api/members/me/photo/` | connecté | Photo de profil de la personne connectée (JPEG) ; 404 sans photo |
| `GET /api/members/` | bureau | Base des membres ou du bureau, limitée au périmètre (territoire du coordonnateur et ceux qui en dépendent ; tout pour un fondateur), par pages de 20. Filtres (`members/filters.py`) : `role` (un ou plusieurs rôles séparés par des virgules : `membre` par défaut, `coordonnateur,fondateur` pour la base des coordonnateurs), `status` (`actif`, `suspendu`, `radie`), `territory` (identifiant : le territoire et tous ceux qui en dépendent), `joined_from` et `joined_to` (date d'adhésion ou d'entrée, `AAAA-MM-JJ`, bornes comprises), `search` (prénom, nom, courriel ou numéro ; plusieurs mots doivent tous correspondre), `ordering` (`name`, `place`, `date`, précédé de `-` pour inverser ; plus récents d'abord par défaut), `page`, `page_size`. Lignes : `id`, `number`, `first_name`, `last_name`, `email`, `role`, `role_label`, `territory`, `joined_on`, `status`, `status_label` ; 400 par champ pour un filtre inconnu (`territory` : « Localité inconnue. », dates : « Saisissez une date valide au format AAAA-MM-JJ. », période à l'envers) ; un territoire hors du périmètre ne donne aucun résultat |
| `GET /api/members/export/` | bureau | Fichier Excel de la liste affichée : mêmes filtres que `GET /api/members/` (sans `page`), même périmètre et même ordre ; colonnes N° d'adhérent, Nom, Prénom, Courriel, Fonction, Localité, Date d'adhésion (ou d'entrée), Statut ; noté dans le journal ; 400 pour un filtre invalide |
| `GET /api/members/<id>/` | bureau | Fiche d'un membre : la ligne ci-dessus plus `phone`, `address`, `photo_url` et, pour les fondateurs seulement, `status_history` ; 404 hors périmètre |
| `GET /api/audit/` | fondateur | Journal des actions, par pages de 20, du plus récent au plus ancien. Filtres : `action` (`demande_acceptee`, `demande_refusee`, `statut_modifie`, `invitation_envoyee`, `liste_exportee`), `actor` (identifiant), `search` (auteur ou personne concernée), `date_from`, `date_to` (`AAAA-MM-JJ`, bornes comprises). Lignes : `id`, `action`, `action_label`, `category`, `category_label`, `subject`, `detail`, `actor` (`id`, `name`), `created_at` ; 400 par champ pour un filtre inconnu ; aucune méthode d'écriture (405) |
| `GET /api/audit/export/` | fondateur | Fichier Excel du journal affiché (mêmes filtres que `GET /api/audit/`) ; l'export est noté dans le journal |
| `GET /api/audit/actors/` | fondateur | Personnes qui ont agi (`id`, `name`), pour le filtre par auteur |
| `GET /api/members/<id>/photo/` | bureau | Photo d'un membre du périmètre (JPEG) ; 404 sans photo ou hors périmètre |
| `POST /api/members/<id>/status/` | fondateur | Change le statut. Corps : `status` (`actif`, `suspendu`, `radie`), `reason` (obligatoire pour suspendre ou radier). Renvoie la fiche ; 400 par champ ; 409 `same_status` (déjà dans ce statut) ou `own_status` (son propre statut) ; 403 hors fondateur |
| `POST /api/applications/<id>/reject/` | fondateur | Refus. Corps : `reason` (obligatoire), `internal_note`. Envoie le motif par courriel. 409 `already_decided` ; 503 `email_not_sent` |

## Frontend

- **Angular** (composants autonomes), appels à l'API sous `/api` (redirigés vers le backend en développement par `proxy.conf.json`).
- Interface mobile d'abord, en français.
- Deux espaces : membre et bureau exécutif, ouverts selon le rôle renvoyé après la connexion.
- Espace membre : le tableau de bord, le profil et la carte numérique lisent `GET /api/members/me/` (`core/profile.service.ts`) ; le profil enregistre l'adresse, le téléphone et la photo par `PATCH /api/members/me/` (formulaire multipart) et le mot de passe se change par `POST /api/auth/password/change/`. La carte (affichage, image téléchargée, impression) est dessinée à partir de ces mêmes données. Un compte sans dossier de membre (bureau seul) voit un message clair.
- Bureau : chaque liste (bases des membres et des coordonnateurs, demandes, journal) a un bouton « Exporter en Excel » (`shared/export-button.ts`, `core/download.ts`) qui télécharge la liste telle qu'elle est affichée, avec les filtres appliqués (pas une saisie pas encore validée), et rappelle que l'export est noté dans le journal.
- Bureau : « Journal des actions » (`pages/audit-journal.ts`, `core/audit.service.ts`, réservé aux fondateurs) liste les actions du serveur avec recherche, filtres par action, auteur et période, sans aucun bouton de modification ni de suppression.
- Bureau : « Bases de membres » (`pages/members-base.ts`, `core/members.service.ts`) liste les membres du serveur (recherche par nom, filtre par statut, tri, pages) et ouvre leur fiche ; les fondateurs y voient les boutons Rendre actif, Suspendre et Radier (motif obligatoire pour les deux derniers) et l'historique du statut, les coordonnateurs lisent le statut sans pouvoir le changer. « Coordonnateurs » (le bureau exécutif, fondateurs compris, avec un filtre par fonction) et « Comptes d'accès » (même base, avec les courriels, pour les fondateurs) utilisent la même liste. Filtres : recherche par nom, localité (les territoires du périmètre, du `GET /api/territories/managed/`), statut et période d'adhésion ou d'entrée.

## Flux principal : demande d'adhésion

```mermaid
sequenceDiagram
    actor Visiteur
    actor Fondateur
    participant F as Frontend
    participant B as Backend
    participant M as Courriel
    Visiteur->>F: Remplit le formulaire
    F->>B: POST demande
    B-->>F: Demande enregistrée (À examiner)
    Fondateur->>F: Ouvre la demande
    F->>B: Accepter ou refuser
    B->>M: Courriel (lien personnel ou motif)
    M-->>Visiteur: Réponse
    Note over B: Acceptée seulement si le courriel est parti
```

## Sécurité

- Mot de passe d'au moins 10 caractères, stocké sous forme d'empreinte Argon2id ; les anciennes empreintes PBKDF2 sont converties à la connexion suivante.
- Sans `DJANGO_DEBUG=1`, le serveur se comporte comme en production : il refuse de démarrer sans vraie clé secrète (50 caractères au moins), redirige tout vers https, active HSTS (un an) et n'envoie les cookies qu'en https. Derrière un hébergeur qui termine le https, `DJANGO_BEHIND_HTTPS_PROXY=1`. Contrôle : `python manage.py check --deploy`.
- En-têtes sur toutes les réponses de Django : politique de contenu (CSP) stricte, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin`, `Cross-Origin-Opener-Policy: same-origin`. Le frontend, servi à part, devra avoir les mêmes en-têtes chez son hébergeur.
- Cookie de session `HttpOnly` (illisible par le JavaScript) et `SameSite=Lax` ; le cookie anti-CSRF reste lisible, car Angular doit le renvoyer.
- Liens personnels : jeton aléatoire, empreinte seule conservée, valable 7 jours, usage unique.
- Données sensibles chiffrées en base (`core.fields.EncryptedTextField`, Fernet : AES avec contrôle d'intégrité HMAC-SHA256) : motivation, motif de refus et note interne des demandes, motifs de suspension et de radiation, détails du journal des actions ; adresse et téléphone des membres dès qu'ils existeront. Une copie de la base ne suffit pas à les lire. On ne peut ni chercher ni trier sur ces champs.
- Clés dans `FIELD_ENCRYPTION_KEYS` (obligatoire en production, jamais versionnée) : la première chiffre, toutes déchiffrent. Changement de clé : `NOUVELLE,ANCIENNE`, puis `python manage.py rechiffrer`, puis retrait de l'ancienne. **Perdre la clé, c'est perdre ces données** : elle doit être sauvegardée à part, hors du serveur et hors de la sauvegarde de la base.
- Journal des actions importantes : voir « Journal des actions » ci-dessus ; lecture seule, réservé aux fondateurs, détails chiffrés.
- Aucune donnée de membre ni secret dans le dépôt.

## Décisions à prendre

- Hébergement et base de données de production : voir la tâche de comparaison du Sprint 0.
- Service d'envoi de courriels en production.
- Stockage des photos (dans la base ou à part).

## Décisions prises

| Date | Décision | Raison |
|---|---|---|
| 2026-10-15 | Django + Angular | Choix du propriétaire du projet |
| 2026-10-15 | Pas d'intégration ni de déploiement automatiques | Choix du propriétaire du projet |
