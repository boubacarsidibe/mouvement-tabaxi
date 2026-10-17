import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AuthService } from '../core/auth.service';
import { PHOTO_TOO_LARGE, PhotoService } from '../core/photo.service';
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

/** Choisit un fichier dans le champ, comme la personne depuis son téléphone. */
function choose(input: HTMLInputElement, file: File) {
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  input.dispatchEvent(new Event('change'));
}

const tick = () => new Promise((resolve) => setTimeout(resolve));

describe('Finalisation de l’inscription', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;
  let root: HTMLElement;
  let photos: { prepare: ReturnType<typeof vi.fn> };

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
    photos = { prepare: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'finaliser', component: FinalizePage },
          { path: 'membre', component: Blank },
        ]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PhotoService, useValue: photos },
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

  async function fillForm() {
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
    form.reportValidity = () => true;
    return form;
  }

  it('envoie la photo réduite, et non la photo d’origine', async () => {
    const original = new File([new Uint8Array(4_600_000)], 'IMG_2041.JPG', { type: 'image/jpeg' });
    const reduced = new File([new Uint8Array(180_000)], 'IMG_2041.jpg', { type: 'image/jpeg' });
    photos.prepare.mockResolvedValue(reduced);
    const form = await fillForm();
    choose(form.querySelector('[name=photo]') as HTMLInputElement, original);
    expect(photos.prepare).toHaveBeenCalledWith(original);
    form.dispatchEvent(new SubmitEvent('submit', { cancelable: true }));
    await tick();
    const request = http.expectOne('/api/registration/');
    const sent = (request.request.body as FormData).get('photo') as File;
    expect(sent.name).toBe('IMG_2041.jpg');
    expect(sent.size).toBe(180_000);
    request.flush(
      { user: TEST_MEMBER, member_number: 'TBX-2026-00001' },
      { status: 201, statusText: 'Created' },
    );
    await tick();
    await settle();
    expect(TestBed.inject(Router).url).toBe('/membre');
  });

  it('n’envoie rien si la photo reste trop lourde', async () => {
    photos.prepare.mockRejectedValue(new Error(PHOTO_TOO_LARGE));
    const form = await fillForm();
    const big = new File([new Uint8Array(10)], 'scan.png', { type: 'image/png' });
    choose(form.querySelector('[name=photo]') as HTMLInputElement, big);
    form.dispatchEvent(new SubmitEvent('submit', { cancelable: true }));
    await tick();
    await settle();
    http.expectNone('/api/registration/');
    expect(root.textContent).toContain('La photo dépasse 5 Mo');
  });

  it('annonce que les photos lourdes sont réduites', async () => {
    await fillForm();
    expect(root.textContent).toContain('les photos lourdes sont réduites avant l’envoi');
    expect(root.textContent).not.toContain('5 Mo maximum');
  });
});
