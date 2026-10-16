import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AuthPage } from './auth-page';
import { ResetPasswordPage } from './reset-password-page';

describe('Mot de passe oublié', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'mot-de-passe-oublie', component: AuthPage, data: { mode: 'forgot' } },
          { path: 'nouveau-mot-de-passe', component: ResetPasswordPage },
        ]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const root = () => harness.routeNativeElement as HTMLElement;
  const flush = async () => {
    await harness.fixture.whenStable();
    harness.detectChanges();
  };
  function input(name: string, value: string) {
    (root().querySelector(`input[name=${name}]`) as HTMLInputElement).value = value;
  }
  const submit = () =>
    root().querySelector('form')!.dispatchEvent(new SubmitEvent('submit', { cancelable: true }));

  it('demande le lien puis confirme sans révéler si le compte existe', async () => {
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/mot-de-passe-oublie');
    input('email', 'awa@example.org');
    submit();
    http.expectOne('/api/auth/password/forgot/').flush({ detail: 'ok' }, { status: 202, statusText: 'Accepted' });
    await flush();
    expect(root().textContent).toContain('Vérifiez votre messagerie');
  });

  it('refuse un lien expiré et propose d’en demander un autre', async () => {
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/nouveau-mot-de-passe?jeton=abc');
    http
      .expectOne('/api/auth/password/reset/check/')
      .flush({ detail: 'Ce lien a expiré : il était valable une heure.', code: 'link_expired' }, { status: 410, statusText: 'Gone' });
    await flush();
    expect(root().textContent).toContain('Ce lien a expiré');
    expect(root().querySelector('a[href="/mot-de-passe-oublie"]')).not.toBeNull();
  });

  it('enregistre le nouveau mot de passe', async () => {
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/nouveau-mot-de-passe?jeton=abc');
    http.expectOne('/api/auth/password/reset/check/').flush({ valid: true, expires_at: '2026-01-01T00:00:00Z' });
    await flush();
    input('password', 'un-mot-de-passe-solide');
    input('passwordConfirm', 'un-mot-de-passe-solide');
    submit();
    const req = http.expectOne('/api/auth/password/reset/');
    expect(req.request.body).toEqual({
      token: 'abc',
      password: 'un-mot-de-passe-solide',
      password_confirm: 'un-mot-de-passe-solide',
    });
    req.flush({ detail: 'ok' });
    await flush();
    expect(root().textContent).toContain('Mot de passe modifié');
  });
});
