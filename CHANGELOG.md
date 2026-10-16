# Journal des modifications

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/). Le projet suivra le [versionnage sémantique](https://semver.org/lang/fr/) à partir de la première version publiée.

## [Non publié]

### Ajouté

- Cahier des charges de la plateforme (version 1.0).
- Squelette du backend Django : configuration en français, compte utilisateur par courriel avec rôles.
- Squelette du frontend Angular.
- Documentation du dépôt : guide de contribution, code de conduite, architecture, feuille de route, planning, backlog, glossaire, hypothèses.
- Modèles d'issues et de Pull Request.
- Labels, sprints et issues GitHub.
- Backend : applications `core`, `territories`, `applications` et `members`, routes sous `/api/` et point de contrôle `/api/health/` (#12).
- Backend : lecture du fichier `backend/.env` au démarrage (#12).
- Backend : territoires emboîtés pays, région, commune, avec l'administration et les territoires de départ du Sénégal (#13).
- Backend : API de connexion, de déconnexion et de l'utilisateur connecté ; refus des comptes désactivés ; courriel sans distinction de casse (#14).
- Backend : liste publique des territoires actifs, en arbre pays > région > commune, pour le formulaire d'adhésion (#17).
- Backend : demandes d'adhésion (statuts À examiner, Acceptée, Rejetée, Inscrite) et dépôt public avec validation, référence TAB-AAAA-NNNNN et une seule demande en cours par courriel (#16).
- Backend : service d'envoi de courriels (console en développement, SMTP par variables d'environnement) qui détecte et remonte les échecs (#20).
- Backend : examen des demandes réservé aux fondateurs (liste filtrable, lecture, refus avec motif obligatoire envoyé par courriel, auteur et date de chaque décision) (#21).
- Backend : acceptation d'une demande avec envoi d'un lien personnel d'inscription (jeton aléatoire dont seule l'empreinte est stockée, valable 7 jours, usage unique) ; la demande n'est « Acceptée » que si le courriel est parti (#22).
- Frontend : écran d'examen des demandes du bureau relié à `/api/applications/` (liste filtrable par statut, fiche, acceptation, refus avec motif obligatoire, erreur d'envoi du courriel affichée), réservé aux fondateurs, sans données fictives (#21).
- Mot de passe oublié : `POST /api/auth/password/forgot/`, `reset/check/` et `reset/` (lien valable une heure, à usage unique, réponse identique que le compte existe ou non), écrans `/mot-de-passe-oublie` et `/nouveau-mot-de-passe` (#29).
- Invitation d'un coordonnateur ou d'un fondateur par un fondateur : compte du bureau rattaché à un territoire, lien personnel valable 7 jours, page `/invitation` pour choisir son mot de passe ; aucun compte n'est créé si le courriel ne part pas.
