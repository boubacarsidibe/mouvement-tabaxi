# Contribuer au projet

Ce guide explique comment travailler sur le dépôt de façon claire et organisée.

## Principe de travail

1. Chaque travail part d'une **issue** GitHub. Si elle n'existe pas, la créer avec le modèle adapté.
2. On travaille dans une **branche**, jamais directement sur `main`.
3. On ouvre une **Pull Request** vers `main`, relue avant fusion.
4. Les issues sont regroupées en **sprints** (milestones) et suivies dans le [backlog](docs/BACKLOG.md).

## Branches

| Type | Nom | Exemple |
|---|---|---|
| Fonctionnalité | `feature/<n° issue>-<résumé>` | `feature/20-formulaire-adhesion` |
| Correction | `fix/<n° issue>-<résumé>` | `fix/31-lien-expire` |
| Documentation | `docs/<résumé>` | `docs/organisation-projet` |

Le résumé est court, en minuscules, sans accents, avec des tirets.

## Messages de commit

Format [Conventional Commits](https://www.conventionalcommits.org/fr/), en français :

```
type(portée facultative): résumé court à l'impératif
```

Types utilisés : `feat` (fonctionnalité), `fix` (correction), `docs` (documentation), `chore` (organisation, outillage), `refactor`, `test`.

Exemples :

- `feat(adhesion): ajoute le formulaire de demande`
- `fix(connexion): refuse les comptes suspendus`
- `docs: met à jour le planning du sprint 2`

Un commit = un changement cohérent. Le message explique le pourquoi quand ce n'est pas évident.

## Pull Request

- Titre au même format qu'un commit.
- Décrire ce qui change et pourquoi, lier l'issue (`Closes #N`).
- Remplir la liste de contrôle du modèle.
- Ne pas fusionner soi-même sans relecture, sauf accord du propriétaire du dépôt.

## Définition de « terminé »

Une issue est terminée quand :

- [ ] tous ses critères d'acceptation sont vérifiés ;
- [ ] le code est testé (tests automatisés lancés en local quand ils existent) ;
- [ ] l'écran fonctionne sur téléphone et sur ordinateur, en français ;
- [ ] les droits d'accès sont vérifiés côté serveur ;
- [ ] la documentation concernée est à jour (README, CHANGELOG, docs) ;
- [ ] aucun secret ni donnée de membre n'est versionné ;
- [ ] la Pull Request est relue et fusionnée.

## Sécurité et données

- Ne jamais versionner de mot de passe, clé ou fichier `.env`.
- Ne jamais mettre de vraies données de membres dans le dépôt, même pour un test.
- Pour signaler une faille, écrire directement au propriétaire du dépôt plutôt que d'ouvrir une issue publique.

## Lancer le projet

Voir le [README](README.md).
