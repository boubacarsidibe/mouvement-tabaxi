import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AuthService } from '../core/auth.service';
import { TEST_COORDINATOR, TEST_FOUNDER } from '../core/testing';
import { InvitationPage } from './invitation-page';
import { InviteForm } from './invite-form';

const INFO = {
  email: 'mamadou@example.org',
  first_name: 'Mamadou',
  last_name: 'Diop',
  role: 'coordonnateur',
  role_label: 'Coordonnateur',
  territory: 5,
  territory_name: 'Dakar',
  expires_at: '2026-10-30T10:00:00Z',
};
const TREE = [
  { id: 1, name: 'Sénégal', kind: 'pays', kind_label: 'Pays', children: [
    { id: 5, name: 'Dakar', kind: 'region', kind_label: 'Région', children: [] },
  ] },
];

@Component({ selector: 'app-blank', template: '' })
class Blank {}

describe('Invitation au bureau', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'invitation', component: InvitationPage },
          { path: 'inviter', component: InviteForm },
          { path: 'bureau', component: Blank },
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
  const submit = () =>
    root().querySelector('form')!.dispatchEvent(new SubmitEvent('submit', { cancelable: true }));
  function input(name: string, value: string) {
    (root().querySelector(`[name=${name}]`) as HTMLInputElement).value = value;
  }

  it('envoie l’invitation et confirme', async () => {
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/inviter');
    http.expectOne('/api/territories/').flush(TREE);
    await flush();
    input('first_name', 'Mamadou');
    input('last_name', 'Diop');
    input('email', 'mamadou@example.org');
    input('territory', '5');
    submit();
    const request = http.expectOne('/api/auth/invitations/');
    expect(request.request.body).toEqual({
      email: 'mamadou@example.org', first_name: 'Mamadou', last_name: 'Diop',
      role: 'coordonnateur', territory: 5,
    });
    request.flush({ ...INFO }, { status: 201, statusText: 'Created' });
    await flush();
    expect(root().textContent).toContain('Invitation envoyée à mamadou@example.org');
  });

  it('affiche l’échec d’envoi du courriel', async () => {
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/inviter');
    http.expectOne('/api/territories/').flush(TREE);
    await flush();
    input('first_name', 'Mamadou');
    input('last_name', 'Diop');
    input('email', 'mamadou@example.org');
    submit();
    http.expectOne('/api/auth/invitations/').flush(
      { detail: 'Le courriel d’invitation n’a pas pu être envoyé : aucun compte n’a été créé.', code: 'email_not_sent' },
      { status: 503, statusText: 'Service Unavailable' },
    );
    await flush();
    expect(root().textContent).toContain('aucun compte n’a été créé');
  });

  it('refuse une invitation expirée', async () => {
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/invitation?jeton=abc');
    http.expectOne('/api/auth/invitation/check/').flush(
      { detail: 'Cette invitation a expiré : elle était valable 7 jours.', code: 'link_expired' },
      { status: 410, statusText: 'Gone' },
    );
    await flush();
    expect(root().textContent).toContain('Cette invitation a expiré');
  });

  it('ouvre la session et mène au bureau après l’acceptation', async () => {
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/invitation?jeton=abc');
    http.expectOne('/api/auth/invitation/check/').flush(INFO);
    await flush();
    expect(root().textContent).toContain('Mamadou Diop');
    input('password', 'Bureau-executif-2026');
    input('passwordConfirm', 'Bureau-executif-2026');
    submit();
    const request = http.expectOne('/api/auth/invitation/accept/');
    expect(request.request.body.token).toBe('abc');
    request.flush(TEST_COORDINATOR, { status: 201, statusText: 'Created' });
    await flush();
    expect(TestBed.inject(AuthService).user()).toEqual(TEST_COORDINATOR);
    expect(TEST_FOUNDER.role).toBe('fondateur');
  });
});
