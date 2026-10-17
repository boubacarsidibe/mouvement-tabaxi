import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { TEST_FOUNDER, TEST_MEMBER } from '../core/testing';
import { AuthPage } from './auth-page';

@Component({ template: '' })
class Blank {}

describe('Page de connexion', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;

  async function open(url = '/connexion') {
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
  }

  function fill(email: string, password: string) {
    const root = harness.routeNativeElement as HTMLElement;
    (root.querySelector('input[name=email]') as HTMLInputElement).value = email;
    (root.querySelector('input[name=password]') as HTMLInputElement).value = password;
    root.querySelector('form')!.dispatchEvent(new SubmitEvent('submit', { cancelable: true }));
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'connexion', component: AuthPage, data: { mode: 'login' } },
          { path: 'bureau', component: Blank },
          { path: 'membre', component: Blank },
          { path: 'bureau/membres', component: Blank },
        ]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('ouvre le bureau après la connexion d’un fondateur', async () => {
    await open();
    fill('fondateur@example.org', 'mot-de-passe-long');
    const login = http.expectOne('/api/auth/login/');
    expect(login.request.body).toEqual({
      email: 'fondateur@example.org',
      password: 'mot-de-passe-long',
      remember: false,
    });
    login.flush(TEST_FOUNDER);
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/bureau');
  });

  it('ouvre l’espace membre après la connexion d’un membre simple', async () => {
    await open();
    fill('membre@example.org', 'mot-de-passe-long');
    http.expectOne('/api/auth/login/').flush(TEST_MEMBER);
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/membre');
  });

  it('revient sur la page demandée avant la connexion', async () => {
    await open('/connexion?suivant=%2Fbureau%2Fmembres');
    fill('fondateur@example.org', 'mot-de-passe-long');
    http.expectOne('/api/auth/login/').flush(TEST_FOUNDER);
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/bureau/membres');
  });

  it('n’accepte pas une adresse de retour extérieure au site', async () => {
    await open('/connexion?suivant=%2F%2Fexemple.com');
    fill('membre@example.org', 'mot-de-passe-long');
    http.expectOne('/api/auth/login/').flush(TEST_MEMBER);
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/membre');
  });

  it('affiche en français l’erreur renvoyée par le serveur', async () => {
    await open();
    fill('membre@example.org', 'mauvais-mot-de-passe');
    http
      .expectOne('/api/auth/login/')
      .flush(
        { detail: 'Courriel ou mot de passe incorrect.', code: 'invalid_credentials' },
        { status: 400, statusText: 'Bad Request' },
      );
    await harness.fixture.whenStable();
    harness.detectChanges();
    const alert = (harness.routeNativeElement as HTMLElement).querySelector('[role=alert]');
    expect(alert?.textContent).toContain('Courriel ou mot de passe incorrect.');
    expect(TestBed.inject(Router).url).toBe('/connexion');
  });

  it('explique une session fermée pour inactivité', async () => {
    await open('/connexion?motif=inactivite');
    const notice = (harness.routeNativeElement as HTMLElement).querySelector('.form-notice');
    expect(notice?.textContent).toContain('30 minutes sans activité');
  });

  it('affiche le blocage après plusieurs échecs', async () => {
    await open();
    fill('membre@example.org', 'mauvais-mot-de-passe');
    http.expectOne('/api/auth/login/').flush(
      {
        detail: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.',
        code: 'too_many_attempts',
      },
      { status: 429, statusText: 'Too Many Requests' },
    );
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect((harness.routeNativeElement as HTMLElement).textContent).toContain(
      'Réessayez dans 15 minutes',
    );
  });

  it('n’évoque pas d’identifiants transmis : la personne a choisi son mot de passe', async () => {
    await open();
    const text = (harness.routeNativeElement as HTMLElement).textContent ?? '';
    expect(text).not.toContain('identifiants transmis');
    expect(text).toContain('mot de passe que vous avez choisi');
  });
});
