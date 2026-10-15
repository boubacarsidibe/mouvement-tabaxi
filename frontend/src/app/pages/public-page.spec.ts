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

  it('propose une connexion identifiée', () => {
    const card = page.querySelector('a.role-login') as HTMLAnchorElement;
    expect(card.getAttribute('href')).toBe('/connexion');
    expect(card.textContent).toContain('Se connecter');
  });

  it('garde la demande d’adhésion', () => {
    expect(links()).toContain('/adherer');
    expect(page.querySelector('a.role-join')?.textContent).toContain('devenir membre');
  });

  it('ne propose plus de choix de profil', () => {
    expect(page.textContent).not.toContain('Membre fondateur');
    expect(page.textContent).not.toContain('Membre simple');
    expect(page.querySelectorAll('.role-row .role-card').length).toBe(2);
  });
});
