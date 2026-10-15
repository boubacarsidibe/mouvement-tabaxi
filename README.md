# Mouvement TABAXI — Plateforme web

Dépôt de la plateforme web du Mouvement TABAXI : organiser le mouvement, accueillir ses membres et suivre ses programmes. Interface en français, utilisable sur téléphone et ordinateur.

## État du projet

| Élément | État |
|---|---|
| Cahier des charges (v1.0) | Rédigé, à valider par les fondateurs |
| Plateforme | Pas encore versionnée dans ce dépôt |

## Contenu actuel

| Fichier | Rôle |
|---|---|
| `Cahier-des-charges-TABAXI.pdf` | Cahier des charges à diffuser |
| `cahier-des-charges-tabaxi.html` | Source modifiable du cahier des charges |
| `logo-tabaxi.png` | Logo utilisé dans le document |

## Ce que décrit le cahier des charges

- **Rôles** : visiteur, membre simple, coordonnateur, membre fondateur.
- **Deux interfaces** derrière une connexion unique : interface membre et interface bureau exécutif.
- **24 besoins** écrits en histoires d'utilisateurs (« En tant que… je veux… afin de… »), classés en 5 familles : adhésion (A), connexion (B), membre (C), bureau exécutif (D), programmes (E).
- Chaque besoin a une priorité (Indispensable, Important, Souhaitable), une manière de le réaliser et des critères de réussite servant à la recette.
- Règles de fonctionnement, données conservées, qualité attendue, protection des données personnelles, planning, points à valider.

## Modifier le cahier des charges

1. Modifier `cahier-des-charges-tabaxi.html` dans un éditeur de texte.
2. Régénérer le PDF depuis ce dossier (Windows, avec Microsoft Edge) :

```powershell
& "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --headless --disable-gpu --no-pdf-header-footer --print-to-pdf="$PWD\Cahier-des-charges-TABAXI.pdf" "file:///$($PWD.Path -replace '\\','/')/cahier-des-charges-tabaxi.html"
```

3. Vérifier le PDF : couverture sans numéro de page, une partie par page, aucune histoire d'utilisateur coupée entre deux pages.

## Conventions

- Un commit par changement cohérent, message court en français expliquant le pourquoi.
- Les numéros des besoins (A1 à E4) sont repris dans le planning : si un besoin change, mettre à jour le planning.
- Ne jamais versionner de secrets (mots de passe, clés, jetons) ni de données de membres.

## Organisation prévue du dépôt

Quand la plateforme sera ajoutée, le dépôt sera organisé ainsi :

```
docs/          cahier des charges
public/        pages du site
functions/     fonctions serveur (API)
migrations/    structure de la base de données
```

## Version

1.0 — 15 octobre 2026
