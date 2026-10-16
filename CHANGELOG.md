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
- Backend : blocage temporaire de la connexion après 5 échecs pour un compte ou 20 depuis une adresse (#32).
- Backend : fermeture de la session du bureau après 30 minutes sans action ; chaque erreur de l'API porte un code stable (#31).
- Backend : mots de passe en Argon2id, https obligatoire et cookies sécurisés en production, en-têtes de sécurité (CSP), refus de démarrer sans vraie clé secrète (#63).
- Backend : chiffrement en base des données sensibles des demandes (motivation, motif de refus, note interne), avec changement de clé sans perte (#64).
- Backend : rattachement des comptes à un territoire et règle d'accès par territoire (un coordonnateur voit son territoire et ceux qui en dépendent, un fondateur voit tout) (#36).
- Backend : dossier de membre avec numéro TBX-AAAA-NNNNN attribué automatiquement, unique et jamais réutilisé (#34).
- Backend : finalisation de l'inscription avec le lien personnel (mot de passe, adresse et téléphone chiffrés, photo nettoyée), création du compte membre et passage de la demande à « Inscrite » (#25).
- Backend : mot de passe oublié (lien valable une heure, utilisable une fois) et changement du mot de passe une fois connecté (#29).
- Backend : invitation d'un coordonnateur ou d'un fondateur par un fondateur, avec lien personnel pour choisir son mot de passe (#30).
- Backend : profil du membre connecté (lecture des données de la carte, modification de l'adresse, du téléphone et de la photo ; nom et territoire réservés au bureau) (#33).
- Frontend : « Mon profil » et « Ma carte numérique » relient `/api/members/me/` : nom, numéro, territoire, date d'adhésion et photo réels sur le tableau de bord et la carte (téléchargement en image compris), modification de l'adresse, du téléphone et de la photo, changement du mot de passe via `/api/auth/password/change/`, erreurs du serveur affichées en français ; plus aucune donnée de démonstration sur ces écrans (#33, #35).
- Statut du membre (Actif, Suspendu, Radié) : un fondateur change le statut depuis la fiche du membre (`POST /api/members/<id>/status/`, motif obligatoire pour suspendre ou radier) ; un compte suspendu ou radié ne peut plus se connecter (message propre à chaque cas), ses sessions ouvertes sont fermées, et l'historique des changements (auteur, date, motif) est conservé sans pouvoir être modifié ni effacé ; les coordonnateurs et fondateurs invités ont aussi un dossier de membre (#40).
- Backend : base des membres du bureau (`GET /api/members/`, fiche `GET /api/members/<id>/` et sa photo) limitée au territoire de la personne connectée, avec recherche par nom, filtre par statut, tri et pages.
- Frontend : écran « Bases de membres » relié à l'API (liste, fiche, changement de statut, historique réservé aux fondateurs), sans données fictives ; la page « Demandes d'adhésion » affiche désormais ses erreurs en rouge.
- Bases du bureau : filtres par territoire (le territoire et ceux qui en dépendent) et par période d'adhésion, recherche par nom, courriel ou numéro, base des coordonnateurs (`role=coordonnateur,fondateur`) avec les mêmes filtres, toutes limitées au territoire de la personne connectée ; chaque compte du bureau a son dossier de membre (fondateur créé par `createsuperuser`, comptes existants par migration) (#38, #39).
- Frontend : « Bases de membres », « Coordonnateurs » et « Comptes d'accès » affichent les vraies données avec filtres par localité, fonction, statut et période, sans personnes fictives.
- Journal des actions (`GET /api/audit/`, fondateurs) : acceptations et refus de demandes, changements de statut, invitations enregistrés automatiquement avec leur auteur, leur date et leur motif, dans la transaction de l'action ; les lignes ne se modifient ni ne s'effacent (code, routes, administration), leurs détails sont chiffrés en base, et le changement de clé de chiffrement les rechiffre sans en toucher le contenu (#42).
- Frontend : écran « Journal des actions » relié à l'API (recherche, filtres par action, auteur et période, pages), réservé aux fondateurs, sans données fictives.
- Les motifs de suspension et de radiation sont chiffrés en base, comme les motifs de refus.
- Export Excel des listes (`GET /api/members/export/`, `/api/applications/export/`, `/api/audit/export/`) : le fichier contient exactement la liste filtrée, dans le périmètre de la personne connectée, sans adresse, téléphone ni motivation ; les textes sont écrits comme du texte (aucune formule exécutée) ; chaque export est noté dans le journal des actions avec ses filtres et son nombre de lignes (#43).
- Frontend : bouton « Exporter en Excel » sous chaque liste du bureau, qui exporte la liste telle qu'elle est affichée.
- Commande `python manage.py comptes_demo` : crée un compte de démonstration par rôle (fondateur, coordonnateur, membre), réservée au développement ; aucun mot de passe n'est stocké dans le dépôt.
- Tableau de bord du bureau (`GET /api/dashboard/`) : membres actifs, coordonnateurs, demandes à examiner, répartition par territoire et adhésions des douze derniers mois, calculés dans le territoire de la personne connectée (un coordonnateur ne voit que le sien) avec les mêmes listes que les écrans, pour que les chiffres correspondent ; demandes en attente et dernières actions réservées aux fondateurs (#37).
- Frontend : l'écran « Tableau de bord » lit ces chiffres, sans valeur d'exemple ni bouton de date factice.

### Modifié

- Backend : sans `DJANGO_DEBUG=1`, le serveur se comporte désormais comme en production. En local, copier `backend/.env.example` en `backend/.env` (#63).
