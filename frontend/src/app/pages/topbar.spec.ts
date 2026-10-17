import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AuthService } from '../core/auth.service';
import { TEST_FOUNDER, TEST_MEMBER } from '../core/testing';
import { AdminPage } from './admin-page';
import { MemberPage } from './member-page';

/** Haut des écrans et page Sécurité : un simple titre, aucun bouton sans effet ni information inventée. */
describe('Haut des écrans et sécurité du compte', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;

  async function open(path: string, component: unknown, view: string, user = TEST_MEMBER) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path, component: component as never, data: { view } }]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(AuthService).signedIn(user);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/' + path);
  }
  const root = () => harness.routeNativeElement as HTMLElement;

  afterEach(() => {
    // Les données chargées par les écrans ne sont pas l'objet de ces tests.
    http.match(() => true).forEach((request) => request.flush({}));
  });

  it('espace membre : pas de bande en haut, le titre est une simple ligne de texte', async () => {
    await open('membre', MemberPage, 'security');
    expect(root().querySelector('.workspace-topbar')).toBeNull();
    expect(root().querySelector('[aria-label=Notifications]')).toBeNull();
    const heading = root().querySelector('.page-heading') as HTMLElement;
    expect(heading.querySelector('h1')?.textContent?.trim()).toBe('Sécurité du compte');
    expect(heading.querySelector('p')).toBeNull();
  });

  it('sécurité : pas de session inventée ni de promesse de gérer les connexions', async () => {
    await open('membre', MemberPage, 'security');
    const text = root().textContent ?? '';
    expect(text).not.toContain('Session active');
    expect(text).not.toContain('Windows');
    expect(text).not.toContain('connexions actives');
    expect(text).not.toContain('une lettre et un chiffre');
    expect(text).toContain('au moins 10 caractères');
  });

  it('carte : le bouton annonce une impression, pas un PDF', async () => {
    await open('membre', MemberPage, 'card');
    const text = root().textContent ?? '';
    expect(text).toContain('Imprimer la carte');
    expect(text).not.toContain('Enregistrer en PDF');
  });

  it('bureau : pas de bande en haut, le titre est une simple ligne de texte', async () => {
    await open('bureau', AdminPage, 'invite', TEST_FOUNDER);
    expect(root().querySelector('.workspace-topbar')).toBeNull();
    expect(root().textContent).not.toContain('Rechercher dans la plateforme');
    expect(root().textContent).not.toContain('Donner un accès au bureau exécutif');
    const heading = root().querySelector('.page-heading') as HTMLElement;
    expect(heading.querySelector('h1')?.textContent?.trim()).toBe('Inviter un coordonnateur');
    expect(heading.querySelector('p')).toBeNull();
  });
});
