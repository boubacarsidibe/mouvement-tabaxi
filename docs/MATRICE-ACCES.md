# Matrice d’accès TABAXI

Cette matrice décrit les accès appliqués par l’interface et les guards Angular après validation du 16 octobre 2026.

Légende : **Lecture** = consulter sans action sensible ; **Gestion** = créer ou modifier ; **Décision** = accepter, rejeter, suspendre ou radier ; **—** = aucun accès.

| Page / route                                      |                    Visiteur |                      Membre |               Coordonnateur |                        Fondateur |
| ------------------------------------------------- | --------------------------: | --------------------------: | --------------------------: | -------------------------------: |
| Accueil `/`                                       |                     Lecture |                     Lecture |                     Lecture |                          Lecture |
| Adhésion `/adherer`                               |       Gestion de sa demande |       Gestion de sa demande |       Gestion de sa demande |            Gestion de sa demande |
| Confirmation `/adherer/confirmation`              |                     Lecture |                     Lecture |                     Lecture |                          Lecture |
| Finalisation `/finaliser`                         | Gestion avec lien personnel | Gestion avec lien personnel | Gestion avec lien personnel |      Gestion avec lien personnel |
| Connexion et récupération                         |                     Lecture |                     Lecture |                     Lecture |                          Lecture |
| Confidentialité `/confidentialite`                |                     Lecture |                     Lecture |                     Lecture |                          Lecture |
| Espace membre `/membre`                           |                           — |                     Lecture |                     Lecture |                          Lecture |
| Programmes du membre `/membre/programmes`         |                           — |                     Lecture |                     Lecture |                          Lecture |
| Carte `/membre/carte`                             |                           — |            Lecture / export |            Lecture / export |                 Lecture / export |
| Profil `/membre/profil`                           |                           — |  Gestion de ses coordonnées |  Gestion de ses coordonnées |       Gestion de ses coordonnées |
| Sécurité `/membre/securite`                       |                           — | Gestion de son mot de passe | Gestion de son mot de passe |      Gestion de son mot de passe |
| Activité membre `/membre/activites/...`           |                           — |       Lecture / inscription |       Lecture / inscription |            Lecture / inscription |
| Tableau de bord `/bureau`                         |                           — |                           — |      Lecture opérationnelle |                  Lecture globale |
| Demandes `/bureau/demandes`                       |                           — |                           — |                           — |               Lecture / décision |
| Détail d’une demande `/bureau/demandes/:id`       |                           — |                           — |                           — |               Lecture / décision |
| Membres `/bureau/membres`                         |                           — |                           — |                     Lecture |                          Lecture |
| Fiche membre `/bureau/membres/...`                |                           — |                           — |                     Lecture | Lecture / décision sur le statut |
| Coordonnateurs `/bureau/coordonnateurs`           |                           — |                           — |                     Lecture |             Lecture / invitation |
| Programmes `/bureau/programmes`                   |                           — |                           — |                     Gestion |                          Gestion |
| Nouveau programme `/bureau/programmes/nouveau`    |                           — |                           — |                     Gestion |                          Gestion |
| Détail d’un programme `/bureau/programmes/...`    |                           — |                           — |                     Gestion |                          Gestion |
| Nouvelle activité `/bureau/activites/nouvelle`    |                           — |                           — |                     Gestion |                          Gestion |
| Compte rendu `/bureau/activites/.../compte-rendu` |                           — |                           — |                     Gestion |                          Gestion |
| Présences `/bureau/activites/.../presences`       |                           — |                           — |              Enregistrement |                   Enregistrement |
| Territoires `/bureau/territoires`                 |                           — |                           — |                     Lecture |                          Lecture |
| Comptes `/bureau/comptes`                         |                           — |                           — |                     Lecture |             Lecture / invitation |
| Invitation `/bureau/comptes/inviter`              |                           — |                           — |                           — |                          Gestion |
| Journal `/bureau/journal`                         |                           — |                           — |                           — |                          Lecture |

## Application côté serveur

Les API existantes respectent déjà les limites suivantes :

- dépôt d’une demande : public ;
- finalisation : accessible uniquement avec le lien personnel ;
- liste, détail et décision sur une demande : fondateur uniquement ;
- session et identité : utilisateur authentifié.

Les écrans de membres, programmes, comptes, territoires, présences et journal utilisent encore des données de démonstration et n’ont pas d’API métier dédiée. Lors de leur raccordement au serveur, les mêmes capacités devront être contrôlées par les permissions Django, et pas seulement par les guards Angular.

## Point restant à modéliser

Le compte coordonnateur n’a pas encore de territoire d’affectation dans le modèle utilisateur. L’interface affiche donc le périmètre prévu, mais le filtrage serveur « uniquement son territoire » devra être ajouté en même temps que les API métier concernées.
