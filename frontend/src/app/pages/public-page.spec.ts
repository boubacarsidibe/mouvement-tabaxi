import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { PublicPage } from './public-page';

describe('Page d’accueil', () => {
  let page: HTMLElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: '', component: PublicPage }])],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/');
    page = harness.routeNativeElement as HTMLElement;
  });

  const links = () =>
    [...page.querySelectorAll('a[href]')].map((link) => link.getAttribute('href') ?? '');

  it('ne mène directement ni à l’interface du bureau ni à l’espace membre', () => {
    expect(links().filter((href) => /^\/(bureau|membre)(\/|$)/.test(href))).toEqual([]);
  });

  it('ne propose plus de cartes d’accès : l’en-tête garde Adhérer et Se connecter', () => {
    expect(page.querySelectorAll('.role-row, .role-card').length).toBe(0);
    expect(links()).toContain('/adherer');
    expect(links()).toContain('/connexion');
  });

  it('n’affiche ni actualités ni programmes inventés', () => {
    const text = page.textContent ?? '';
    for (const invented of [
      'Saint-Louis accueille',
      'arbres plantés à Ziguinchor',
      'écoles de Thiès',
      'Brigades citoyennes',
      'Éducation civique',
      'Autonomie des femmes',
      'Actualités',
    ]) {
      expect(text).not.toContain(invented);
    }
    expect(page.querySelector('#actualites')).toBeNull();
    expect(links().some((href) => href.includes('#actualites'))).toBe(false);
  });

  it('le lien « Découvrir les programmes » mène à une section qui existe', () => {
    expect(links()).toContain('/#programmes');
    expect(page.querySelector('#programmes')).not.toBeNull();
  });
});
