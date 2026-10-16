import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AuthService } from '../core/auth.service';
import { TEST_MEMBER } from '../core/testing';
import { FinalizePage } from './finalize-page';

@Component({ template: '' })
class Blank {}

const INFO = {
  first_name: 'Khady',
  last_name: 'Fall',
  email: 'khady.fall@example.org',
  territory: {
    id: 1,
    name: 'Thiès',
    kind: 'commune',
    kind_label: 'Commune',
    path: 'Sénégal › Thiès › Thiès',
  },
  expires_at: '2026-10-22T10:00:00Z',
};

describe('Finalisation de l’inscription', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;
  let root: HTMLElement;

  async function open(url: string) {
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    root = harness.routeNativeElement as HTMLElement;
  }

  async function settle() {
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'finaliser', component: FinalizePage },
          { path: 'membre', component: Blank },
        ]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('vérifie le lien sans le mettre dans l’adresse de la requête', async () => {
    await open('/finaliser?jeton=abc');
    const request = http.expectOne('/api/registration/check/');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ token: 'abc' });
    request.flush(INFO);
    await settle();
    expect(root.textContent).toContain('Finalisez votre adhésion, Khady');
    expect(root.textContent).toContain('khady.fall@example.org');
    expect(root.textContent).toContain('Sénégal › Thiès › Thiès');
    expect(root.textContent).not.toContain('Aminata');
  });

  it('explique un lien expiré', async () => {
    await open('/finaliser?jeton=abc');
    http
      .expectOne('/api/registration/check/')
      .flush(
        { detail: 'Ce lien a expiré : il était valable 7 jours.', code: 'link_expired' },
        { status: 410, statusText: 'Gone' },
      );
    await settle();
    expect(root.querySelector('[role=alert]')?.textContent).toContain('a expiré');
    expect(root.querySelector('form')).toBeNull();
  });

  it('propose de se connecter si le lien a déjà servi', async () => {
    await open('/finaliser?jeton=abc');
    http
      .expectOne('/api/registration/check/')
      .flush(
        { detail: 'Ce lien a déjà servi.', code: 'link_used' },
        { status: 410, statusText: 'Gone' },
      );
    await settle();
    expect(root.querySelector('a[href="/connexion"]')).not.toBeNull();
  });

  it('explique un lien incomplet', async () => {
    await open('/finaliser');
    http
      .expectOne('/api/registration/check/')
      .flush({ detail: 'x', code: 'invalid_link' }, { status: 404, statusText: 'Not Found' });
    await settle();
    expect(root.textContent).toContain('Ce lien est incomplet');
  });

  it('crée le compte, ouvre la session et l’espace membre', async () => {
    await open('/finaliser?jeton=abc');
    http.expectOne('/api/registration/check/').flush(INFO);
    await settle();
    const form = root.querySelector('form')!;
    const set = (name: string, value: string) =>
      ((form.querySelector(`[name=${name}]`) as HTMLInputElement).value = value);
    set('address', '12, rue Blaise-Diagne, Thiès');
    set('password', 'Baobab-solide-2026');
    set('passwordConfirm', 'Baobab-solide-2026');
    (form.querySelector('[name=rules]') as HTMLInputElement).checked = true;
    // jsdom ne sait pas choisir un fichier : la validation native est neutralisée pour ce test.
    form.reportValidity = () => true;
    form.dispatchEvent(new SubmitEvent('submit', { cancelable: true }));
    const request = http.expectOne('/api/registration/');
    const body = request.request.body as FormData;
    expect(body.get('token')).toBe('abc');
    expect(body.get('accept_rules')).toBe('true');
    expect(body.get('password')).toBe('Baobab-solide-2026');
    expect(body.has('photo')).toBe(true);
    request.flush(
      { user: TEST_MEMBER, member_number: 'TBX-2026-00001' },
      { status: 201, statusText: 'Created' },
    );
    await settle();
    expect(TestBed.inject(Router).url).toBe('/membre');
    expect(TestBed.inject(AuthService).user()?.email).toBe(TEST_MEMBER.email);
  });
});
