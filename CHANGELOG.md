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
