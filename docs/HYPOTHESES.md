# Hypothèses

Éléments retenus par défaut faute d'information précise. À confirmer ou corriger ; chaque changement est à reporter dans le planning et les issues.

## Calendrier

| Hypothèse | Détail |
|---|---|
| Durée d'un sprint | 2 jours ouvrés (réponse « 2 jours » au cadrage) |
| Début | Jeudi 15 octobre 2026, le jour du cadrage |
| Rendu | Jeudi 29 octobre 2026 (interprétation de « dans 2 semaines ») |
| Nombre de sprints | 6 (Sprint 0 à Sprint 5), plus un lot « Après le rendu » |
| Jours ouverts | Du lundi au vendredi, sans jour férié retiré |

## Équipe et organisation

- Les issues ne sont assignées à personne (choix du cadrage). Le dépôt n'a pas d'autre contributeur déclaré.
- Aucune licence n'est choisie : sans licence, le code reste protégé par défaut. Une licence est à décider par les fondateurs.
- Pas d'intégration ni de déploiement automatiques : la mise en ligne se fait à la main.

## Périmètre

- Le rendu du 29 octobre couvre la connexion, la demande d'adhésion et son examen par les fondateurs. Les 24 besoins du cahier des charges ne tiennent pas dans 11 jours ouvrés pour une personne ; le reste est dans le sprint « Après le rendu ».
- Les choix par défaut du cahier des charges (partie 13) restent valables tant qu'ils ne sont pas modifiés :
  1. Le membre ne change pas lui-même son nom ni son territoire.
  2. Coordonnateurs et fondateurs ont aussi une carte numérique.
  3. Numéro de membre au format TBX-année-numéro.
  4. Un membre ne voit que les programmes de son territoire.
  5. Pas de numéro de téléphone demandé à l'adhésion.
  6. Pas de cotisation ni de paiement en ligne.
  7. Un seul fondateur suffit pour accepter ou refuser une demande.
  8. Âge minimum à fixer par le bureau.
  9. Un fondateur est désigné pour les sauvegardes et la démarche auprès de la CDP.

## Statut des membres

Le cahier des charges (D5) demande un bouton de changement de statut, sans en préciser les règles. Choix retenus :

- Le motif est obligatoire pour suspendre ou radier (comme pour un refus de demande) et facultatif pour rendre un membre actif.
- Un fondateur ne change pas son propre statut : il reste toujours au moins un fondateur actif pour gérer les autres.
- Le statut s'applique à tous les dossiers, coordonnateurs et fondateurs compris (le modèle de données prévoit un statut pour les coordonnateurs).
- La suspension et la radiation ferment les sessions ouvertes ; rendre un membre actif ne rouvre pas ses anciennes sessions, il doit se reconnecter.
- Aucun courriel n'est envoyé au membre lors d'un changement de statut.
- Un membre radié peut être réactivé par un fondateur ; son numéro de membre ne change jamais.

## Technique

- Backend Django avec Django REST Framework, frontend Angular, base SQLite en développement.
- La base de production et l'hébergement ne sont pas choisis : voir la tâche de comparaison du Sprint 0.
- Authentification par session (cookie) entre Angular et Django.
