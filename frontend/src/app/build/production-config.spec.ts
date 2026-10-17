import angularConfig from '../../../angular.json';

// La CSP de l'aperçu (script-src 'self') bloque le petit script écrit dans index.html
// qui passe la feuille de style de media="print" à media="all". Le CSS critique ne doit
// donc pas être inséré dans la page en production.
describe('Configuration de production', () => {
  const production = angularConfig.projects.frontend.architect.build.configurations.production;

  it('ne met pas le CSS critique dans index.html', () => {
    expect(production.optimization.styles.inlineCritical).toBe(false);
  });

  it('garde la minification des scripts, des styles et des polices', () => {
    expect(production.optimization.scripts).toBe(true);
    expect(production.optimization.styles.minify).toBe(true);
    expect(production.optimization.fonts).toBe(true);
  });
});
