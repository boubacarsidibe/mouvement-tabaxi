// Vérifie, après `npm run build`, que index.html charge la feuille de style normalement :
// pas de media="print", pas d'attribut onload, pas de <script> écrit dans la page.
// Une CSP script-src 'self' laisse alors le site s'afficher avec son CSS.
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../dist/frontend/browser/index.html', import.meta.url), 'utf8');
const erreurs = [];

if (!/<link rel="stylesheet" href="styles-[^"]+\.css">/.test(html)) {
  erreurs.push('aucune balise <link rel="stylesheet" href="styles-….css"> simple');
}
if (/media="print"/.test(html)) erreurs.push('une feuille de style est chargée avec media="print"');
if (/\sonload=/.test(html)) erreurs.push('un attribut onload est présent');
if (/<script(?![^>]*\bsrc=)[^>]*>/.test(html)) erreurs.push('un <script> est écrit dans la page');

if (erreurs.length) {
  console.error('index.html de production incorrect :\n- ' + erreurs.join('\n- '));
  process.exit(1);
}
console.log('index.html de production correct : CSS chargé normalement, aucun script dans la page.');
