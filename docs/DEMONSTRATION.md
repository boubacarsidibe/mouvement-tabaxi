# Démonstration du rendu

Parcours à montrer le 29 octobre 2026 : une personne demande à adhérer, un fondateur examine et accepte sa demande, la personne reçoit un courriel, finalise son inscription et arrive dans son espace membre. Compter une quinzaine de minutes.

Ce parcours est vérifié de bout en bout par un test automatique : `backend/applications/tests/test_parcours.py`.

## Statuts d'une demande

| Statut | Ce qui s'est passé | Suite possible |
|---|---|---|
| **À examiner** | La demande vient d'être déposée depuis le site. | Un fondateur l'accepte ou la refuse. |
| **Acceptée** | Un fondateur l'a acceptée, et le courriel avec le lien personnel est parti. | La personne finalise son inscription avec ce lien (7 jours, une seule fois). Un fondateur peut renvoyer un nouveau lien. |
| **Rejetée** | Un fondateur l'a refusée avec un motif, envoyé par courriel. | Aucune. La personne pourra déposer une nouvelle demande. |
| **Inscrite** | La personne a finalisé : son compte et son numéro de membre existent. | Elle se connecte à son espace membre. |

```
À examiner ──► Acceptée ──► Inscrite
     │
     └──────► Rejetée
```

Une décision n'est enregistrée que si le courriel qui l'annonce est parti. Si l'envoi échoue, la demande reste « À examiner » et le fondateur voit l'erreur.

## Préparer

### En local (conseillé)

En local, les courriels ne partent pas : ils s'affichent dans le terminal du backend. On y copie le lien personnel pendant la démonstration.

1. Backend, dans un premier terminal (voir le [README](../README.md) pour l'installation) :

   ```powershell
   cd backend
   .\.venv\Scripts\activate
   python manage.py migrate
   python manage.py comptes_demo
   python manage.py runserver
   ```

   `comptes_demo` affiche les mots de passe de `fondateur.demo@example.org`, `coordonnateur.demo@example.org` et `membre.demo@example.org`. Les noter avant de commencer.

2. Frontend, dans un second terminal :

   ```powershell
   cd frontend
   npm start
   ```

3. Ouvrir `http://localhost:4200/` dans une fenêtre normale (le fondateur) et une fenêtre de navigation privée (la personne qui adhère).

### En ligne

Le site est sur `https://mouvement-tabaxi-app.vercel.app` (voir [DEPLOIEMENT.md](DEPLOIEMENT.md)). Il faut alors :

- un vrai compte fondateur (`comptes_demo` ne fonctionne qu'en développement) ;
- pour la personne qui adhère, une adresse courriel que l'on peut consulter pendant la démonstration ;
- un service d'envoi configuré (`EMAIL_HOST`). Sans lui, le courriel n'est écrit que dans le journal de Vercel.

Les photos envoyées en ligne ne sont pas conservées durablement (limite de Vercel, voir [DEPLOIEMENT.md](DEPLOIEMENT.md)).

## Parcours

### 1. Demande d'adhésion (fenêtre privée)

1. Page d'accueil → **Adhérer** (ou **Commencer ma demande**) : page `/adherer`.
2. Remplir prénom, nom, courriel, localité (communes rangées par région), profession et motivation, puis cocher le consentement.
3. **Envoyer ma demande**. La page de confirmation affiche la référence `TAB-2026-NNNNN` et les étapes à venir.

À montrer au besoin : un champ manquant est signalé sous le champ ; une seconde demande avec le même courriel est refusée tant que la première est en cours.

La demande est maintenant **À examiner**.

### 2. Examen par un fondateur (fenêtre normale)

1. **Se connecter** (`/connexion`) avec le compte fondateur. On arrive sur le tableau de bord du bureau (`/bureau`), qui compte les demandes à examiner.
2. Menu **Demandes d'adhésion** (`/bureau/demandes`) : filtrer sur « À examiner », retrouver la demande par le nom ou la référence.
3. **Examiner** : la fiche montre l'identité, la localité, la profession et la motivation. Une note interne peut être ajoutée pour le bureau.

À montrer au besoin : le compte coordonnateur n'a pas ce menu, l'examen est réservé aux fondateurs.

### 3. Acceptation et courriel

1. **Accepter la demande**. Le statut passe à **Acceptée**.
2. Le courriel « Votre demande d'adhésion au Mouvement TABAXI » part vers la personne. Il contient le lien personnel `…/finaliser?jeton=…`, valable 7 jours et utilisable une seule fois. En local, le copier depuis le terminal du backend.
3. Menu **Journal des actions** (`/bureau/journal`) : l'acceptation y figure avec son auteur et sa date.

Variante, sur une autre demande : **Refuser avec un motif**, écrire le motif (obligatoire), **Confirmer le refus**. Le statut passe à **Rejetée** et la personne reçoit le motif par courriel.

Si le lien a expiré ou s'est perdu : sur la fiche d'une demande « Acceptée », **Renvoyer le lien d'inscription**. L'ancien lien cesse de fonctionner.

### 4. Finalisation (fenêtre privée)

1. Ouvrir le lien du courriel : page « Finalisez votre adhésion ».
2. Saisir l'adresse, le téléphone (facultatif), une photo (JPG ou PNG, 5 Mo au plus) et un mot de passe de 10 caractères au moins, deux fois. Accepter les statuts et le règlement intérieur.
3. **Finaliser mon adhésion**. Le compte est créé, la personne est connectée et arrive dans **Mon espace** (`/membre`).

La demande est maintenant **Inscrite**. Rouvrir le même lien affiche qu'il a déjà servi et propose de se connecter.

### 5. Espace membre (fenêtre privée)

1. **Mon espace** : accueil au nom de la personne, sa localité et sa carte de membre avec le numéro `TBX-2026-NNNNN`.
2. **Ma carte numérique** (`/membre/carte`) : la carte avec la photo, et **Télécharger en image**.
3. **Mon profil** (`/membre/profil`) : modifier l'adresse, le téléphone ou la photo. Le nom et la localité sont réservés au bureau.

Retour dans la fenêtre du fondateur : la demande apparaît « Inscrite » dans **Demandes d'adhésion**, et la personne figure dans **Bases de membres** (`/bureau/membres`).

## Repartir de zéro (local)

Arrêter le backend, supprimer `backend/db.sqlite3`, puis relancer `python manage.py migrate` et `python manage.py comptes_demo`.
