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
});
