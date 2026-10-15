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
- Backend : blocage temporaire de la connexion après 5 échecs pour un compte ou 20 depuis une adresse (#32).
- Backend : fermeture de la session du bureau après 30 minutes sans action ; chaque erreur de l'API porte un code stable (#31).
- Backend : mots de passe en Argon2id, https obligatoire et cookies sécurisés en production, en-têtes de sécurité (CSP), refus de démarrer sans vraie clé secrète (#63).
- Backend : chiffrement en base des données sensibles des demandes (motivation, motif de refus, note interne), avec changement de clé sans perte (#64).
- Backend : rattachement des comptes à un territoire et règle d'accès par territoire (un coordonnateur voit son territoire et ceux qui en dépendent, un fondateur voit tout) (#36).
- Backend : dossier de membre avec numéro TBX-AAAA-NNNNN attribué automatiquement, unique et jamais réutilisé (#34).
- Backend : finalisation de l'inscription avec le lien personnel (mot de passe, adresse et téléphone chiffrés, photo nettoyée), création du compte membre et passage de la demande à « Inscrite » (#25).
- Backend : mot de passe oublié (lien valable une heure, utilisable une fois) et changement du mot de passe une fois connecté (#29).
- Backend : invitation d'un coordonnateur ou d'un fondateur par un fondateur, avec lien personnel pour choisir son mot de passe (#30).

### Modifié

- Backend : sans `DJANGO_DEBUG=1`, le serveur se comporte désormais comme en production. En local, copier `backend/.env.example` en `backend/.env` (#63).
