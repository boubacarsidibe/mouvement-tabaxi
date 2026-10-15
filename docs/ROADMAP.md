# Feuille de route

La feuille de route suit le [cahier des charges](Cahier-des-charges-TABAXI.pdf) et les sprints GitHub. Le détail des dates est dans [PLANNING.md](PLANNING.md), la liste complète des tâches dans [BACKLOG.md](BACKLOG.md).

## Vision

Une plateforme web en français, utilisable sur téléphone, pour accueillir les membres du Mouvement TABAXI, les organiser par territoire et suivre ses programmes.

## Jalons

### Sprint 0 – Cadrage et mise en place

- **Dates :** jeudi 15 et vendredi 16 octobre 2026
- **Objectif :** Cadrer le projet, documenter le dépôt et décider de l'hébergement.
- **Livrables :**
  - Mettre en place la documentation et l'organisation du dépôt
  - Comparer des solutions d'hébergement pour Django et Angular
  - Valider les points ouverts du cahier des charges avec les fondateurs
  - Préparer la démarche auprès de la CDP

### Sprint 1 – Socle et connexion

- **Dates :** lundi 19 et mardi 20 octobre 2026
- **Objectif :** Poser le socle du backend, les territoires et l'API de connexion.
- **Livrables :**
  - Structurer le backend : applications, API REST et point de contrôle de santé
  - Créer le modèle des territoires hiérarchiques (pays, région, commune)
  - Créer l'API de connexion et de déconnexion par courriel

### Sprint 2 – Connexion et demandes d'adhésion

- **Dates :** mercredi 21 et jeudi 22 octobre 2026
- **Objectif :** Écran de connexion avec redirection par rôle, et dépôt de demandes côté serveur.
- **Livrables :**
  - Créer la page de connexion et la redirection selon le rôle
  - Créer le modèle de demande d'adhésion et l'API de dépôt
  - Exposer la liste publique des territoires pour le formulaire

### Sprint 3 – Formulaire d'adhésion et courriels

- **Dates :** vendredi 23 et lundi 26 octobre 2026
- **Objectif :** Page d'accueil, formulaire d'adhésion et envoi de courriels.
- **Livrables :**
  - Créer le formulaire de demande d'adhésion
  - Créer la page d'accueil publique
  - Mettre en place l'envoi de courriels

### Sprint 4 – Examen des demandes

- **Dates :** mardi 27 et mercredi 28 octobre 2026
- **Objectif :** Examen des demandes par les fondateurs et acceptation avec lien personnel.
- **Livrables :**
  - Créer l'API d'examen des demandes réservée aux fondateurs
  - Accepter une demande : lien personnel à usage unique et courriel

### Sprint 5 – Stabilisation et rendu

- **Dates :** jeudi 29 octobre 2026 (rendu)
- **Objectif :** Écran d'examen, stabilisation, documentation finale et présentation du rendu.
- **Livrables :**
  - Créer l'écran d'examen des demandes
  - Stabiliser, mettre à jour la documentation et préparer la présentation du rendu

### Après le rendu

- **Dates :** après le rendu, à planifier
- **Objectif :** Fonctionnalités restantes du cahier des charges, par ordre de priorité.
- **Livrables :**
  - Finaliser l'inscription : API du lien personnel
  - Créer la page de finalisation de l'inscription
  - Réduire automatiquement les photos avant envoi
  - Ajouter la page « données personnelles » et la case de consentement
  - Créer le mot de passe oublié par courriel
  - Inviter un coordonnateur ou un fondateur par courriel
  - Déconnecter automatiquement après inactivité
  - Bloquer temporairement la connexion après plusieurs échecs
  - Créer la page de profil du membre
  - Générer automatiquement le numéro de membre
  - Créer la carte numérique (affichage, téléchargement, impression)
  - Appliquer les droits d'accès par territoire
  - Créer le tableau de bord du bureau exécutif
  - Créer la base des membres simples avec filtres
  - Créer la base des coordonnateurs
  - Suspendre ou radier un membre
  - Créer l'écran de gestion des territoires
  - Créer le journal des actions
  - Exporter la liste affichée en fichier Excel
  - Créer et modifier un programme
  - Afficher les programmes du territoire au membre
  - Planifier des activités dans un programme
  - Permettre au membre de s'inscrire à une activité
  - Rédiger le compte rendu d'une activité
  - Noter les présences à une activité
  - Mettre en place la sauvegarde hebdomadaire de la base
  - Préparer et exécuter la recette avec le bureau
  - Mettre en ligne la plateforme sur l'hébergement choisi

## Ce que le rendu du 29 octobre contient (et ne contient pas)

**Inclus :** connexion par rôle, formulaire de demande d'adhésion, examen des demandes par les fondateurs, acceptation avec courriel et lien personnel.

**Pas inclus :** finalisation de l'inscription, carte numérique, bases de membres, programmes, tableau de bord. Ces éléments sont dans le milestone « Après le rendu ».
