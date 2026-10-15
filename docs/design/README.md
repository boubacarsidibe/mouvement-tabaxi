# Direction produit TABAXI

Cette direction transpose le cahier des charges en une interface mobile-first sobre, lisible et cohérente.

## Système visuel

- Couleur principale : vert profond `#00583A`
- Accent : jaune doré `#F7C84A`
- Fond : vert-gris très clair `#F2F6F1`
- Surface : blanc `#FFFFFF`
- Texte : anthracite `#111827`
- Texte secondaire : sauge grisé `#728079`
- Erreur : rouge `#E54D55`
- Typographie : `Segoe UI`, puis Arial/Helvetica en secours
- Grille : rythme de 8 px, largeur de contenu adaptée aux postes de travail et navigation mobile horizontale
- Rayon : 7 à 10 px, sans coins excessifs

Les titres utilisent une graisse normale de produit (`700`) et les textes courants restent à `400–500`. Les effets sont limités aux bordures fines, à une ombre légère et à un déplacement discret au survol.

## Planches ImageGen

- `public-auth-pages.png` : accueil, mouvement, programmes publics, adhésion, connexion et récupération du mot de passe
- `member-pages.png` : tableau de bord membre, profil, programmes, activité, carte et sécurité
- `admin-pages.png` : tableau de bord du bureau, demandes, examen, membres, coordonnateurs et fiche membre
- `operations-pages.png` : programmes, création, planification, compte rendu, présences, territoires et journal

Les planches ont été générées avec l’outil ImageGen intégré. Les trois captures fournies ont servi de références de marque et de structure, sans être utilisées comme images finales de l’interface.

## Couverture des parcours

| Besoin                           | Écran principal                                                  |
| -------------------------------- | ---------------------------------------------------------------- |
| A1 Découvrir le mouvement        | `/`                                                              |
| A2 Déposer une demande           | `/adherer`                                                       |
| A3 Recevoir et suivre la réponse | `/adherer/confirmation`                                          |
| A4 Finaliser l’inscription       | `/finaliser`                                                     |
| B1 Se connecter                  | `/connexion`                                                     |
| B2 Retrouver le mot de passe     | `/mot-de-passe-oublie`                                           |
| B3 Inviter un coordonnateur      | `/bureau/comptes/inviter`                                        |
| B4 Expiration de session         | représentée dans l’interface de sécurité, à raccorder au backend |
| C1 Gérer le profil               | `/membre/profil`                                                 |
| C2 Carte numérique               | `/membre/carte`                                                  |
| C3 Programmes du territoire      | `/membre/programmes`                                             |
| C4 Inscription à une activité    | `/membre/activites/brigades-citoyennes`                          |
| D1 Tableau de bord               | `/bureau`                                                        |
| D2 Examiner une demande          | `/bureau/demandes` et `/bureau/demandes/awa-ndiaye`              |
| D3 Base des membres              | `/bureau/membres`                                                |
| D4 Base des coordonnateurs       | `/bureau/coordonnateurs`                                         |
| D5 Suspendre ou radier           | `/bureau/membres/aminata-ndiaye`                                 |
| D6 Exporter une liste            | action prévue sur les listes, à raccorder au backend             |
| D7 Gérer les territoires         | `/bureau/territoires`                                            |
| D8 Journal des actions           | `/bureau/journal`                                                |
| E1 Créer un programme            | `/bureau/programmes/nouveau`                                     |
| E2 Planifier une activité        | `/bureau/activites/nouvelle`                                     |
| E3 Rendre compte                 | `/bureau/activites/brigade-dakar/compte-rendu`                   |
| E4 Noter les présences           | `/bureau/activites/brigade-dakar/presences`                      |

## Principes des prompts ImageGen

Les quatre prompts utilisent le type `ui-mockup`, demandent une interface réaliste et codable, une typographie sans-serif ordinaire, une grille stricte de 8 px, un contraste AA, un seul appel à l’action principal par écran et la palette TABAXI. Ils excluent les dégradés criards, le néon, le glassmorphism, les ombres lourdes, les emojis et les titres artificiellement surdimensionnés.
