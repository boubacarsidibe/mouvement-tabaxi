# Référencement (Google)

Le site Angular est préparé pour les moteurs de recherche. Aucun réglage technique ne garantit
la première place sur Google : le classement dépend aussi de l'ancienneté du site, des liens
qui pointent vers lui et de la recherche tapée. Sur « Mouvement TABAXI » ou « TABAXI Sénégal »,
le site a toutes ses chances, car le nom est rare.

## Ce que fait le site

| Élément | Où |
| --- | --- |
| Titre et description de chaque page publique (accueil, adhésion, confidentialité) | `data.seo` et `title` dans `frontend/src/app/app.routes.ts` |
| Description, `robots`, lien canonique et balises de partage mis à jour à chaque page | `frontend/src/app/core/seo.service.ts` |
| Valeurs de la page d'accueil avant le chargement d'Angular, Open Graph, fiche de l'organisation (JSON-LD) | `frontend/src/index.html` |
| Pages proposées aux moteurs | `frontend/public/sitemap.xml` |
| Pages interdites aux moteurs (`/membre`, `/bureau`, liens personnels, connexion) | `frontend/public/robots.txt` |

Toute page sans `seo: { index: true }` dans sa route reçoit `noindex, nofollow`. Pour rendre une
nouvelle page publique visible, ajouter `seo` à sa route **et** son adresse dans `sitemap.xml`.

L'adresse du site (`https://mouvement-tabaxi-app.vercel.app`) figure dans `SITE_URL`
(`seo.service.ts`), `index.html`, `robots.txt` et `sitemap.xml`. Si un nom de domaine propre est
acheté (par exemple `tabaxi.sn`), la remplacer dans ces quatre fichiers.

## À faire par le propriétaire, après la mise en ligne

1. **Google Search Console** (<https://search.google.com/search-console>) : ajouter le site,
   prouver qu'il vous appartient (fichier ou balise fournis par Google, ou enregistrement DNS
   avec un domaine propre), puis envoyer `https://mouvement-tabaxi-app.vercel.app/sitemap.xml`.
2. Demander l'indexation de la page d'accueil (« Inspection de l'URL » puis « Demander une indexation »).
3. **Fiche d'établissement Google** (Google Business Profile) au nom du Mouvement TABAXI, avec le lien du site.
4. Mettre le lien du site sur les réseaux sociaux du mouvement, et le faire reprendre par la presse
   et les partenaires : ces liens comptent beaucoup pour le classement.
5. Un nom de domaine propre (`.sn` ou `.org`) inspire davantage confiance qu'une adresse `vercel.app`.

## Vérifications

- `https://mouvement-tabaxi-app.vercel.app/robots.txt` et `/sitemap.xml` s'affichent tels quels.
- Le [test des résultats enrichis](https://search.google.com/test/rich-results) reconnaît l'organisation.
- Un lien du site collé dans WhatsApp ou Facebook montre l'image, le titre et la description.
