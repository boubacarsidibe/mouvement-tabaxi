import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AuthService } from '../core/auth.service';
import { PhotoService } from '../core/photo.service';
import { TEST_MEMBER } from '../core/testing';
import { MemberPage } from './member-page';

const PROFILE = {
  number: 'TBX-2026-00007',
  joined_on: '2026-03-12',
  first_name: 'Awa',
  last_name: 'Ndiaye',
  email: 'membre@example.org',
  role: 'membre',
  role_label: 'Membre simple',
  territory: TEST_MEMBER.territory,
  address: '18, rue de la Corniche',
  phone: '+221 77 456 78 90',
  photo_url: '/api/members/me/photo/?v=a1b2',
};

describe('Profil et carte du membre', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;
  let photos: { prepare: ReturnType<typeof vi.fn> };

  async function open(view: string) {
    photos = { prepare: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'membre', component: MemberPage, data: { view } }]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PhotoService, useValue: photos },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(AuthService).signedIn(TEST_MEMBER);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/membre');
  }
  const root = () => harness.routeNativeElement as HTMLElement;
  const settle = async () => {
    await harness.fixture.whenStable();
    harness.detectChanges();
  };

  afterEach(() => http.verify());

  it('affiche sur la carte les vraies informations du membre', async () => {
    await open('card');
    http.expectOne('/api/members/me/').flush(PROFILE);
    await settle();
    const text = root().textContent ?? '';
    expect(text).toContain('Awa Ndiaye');
    expect(text).toContain('TBX-2026-00007');
    expect(text).toContain('12/03/2026');
    expect(text).toContain('Podor');
    expect(text).not.toContain('Aminata');
    expect(root().querySelector('.card-portrait')?.getAttribute('src')).toContain('/api/members/me/photo/');
  });

  it('dit clairement qu’aucun dossier n’existe pour ce compte', async () => {
    await open('card');
    http.expectOne('/api/members/me/').flush({ detail: 'Introuvable.' }, { status: 404, statusText: 'Not Found' });
    await settle();
    expect(root().textContent).toContain('Aucun dossier de membre');
  });

  it('enregistre l’adresse et le téléphone modifiés', async () => {
    await open('profile');
    http.expectOne('/api/members/me/').flush(PROFILE);
    await settle();
    const address = root().querySelector('[name=address]') as HTMLInputElement;
    expect(address.value).toBe('18, rue de la Corniche');
    address.value = '5, avenue Cheikh Anta Diop';
    root().querySelector('form')!.dispatchEvent(new SubmitEvent('submit', { cancelable: true }));
    const request = http.expectOne('/api/members/me/');
    expect(request.request.method).toBe('PATCH');
    expect((request.request.body as FormData).get('address')).toBe('5, avenue Cheikh Anta Diop');
    request.flush({ ...PROFILE, address: '5, avenue Cheikh Anta Diop' });
    await settle();
    expect(root().textContent).toContain('Vos informations ont été enregistrées');
  });

  it('affiche en français l’erreur du serveur', async () => {
    await open('profile');
    http.expectOne('/api/members/me/').flush(PROFILE);
    await settle();
    root().querySelector('form')!.dispatchEvent(new SubmitEvent('submit', { cancelable: true }));
    http
      .expectOne('/api/members/me/')
      .flush({ phone: ['Numéro de téléphone invalide.'] }, { status: 400, statusText: 'Bad Request' });
    await settle();
    expect(root().textContent).toContain('Numéro de téléphone invalide.');
  });

  it('envoie la nouvelle photo réduite', async () => {
    await open('profile');
    http.expectOne('/api/members/me/').flush(PROFILE);
    await settle();
    const original = new File([new Uint8Array(3_800_000)], 'photo.jpeg', { type: 'image/jpeg' });
    const reduced = new File([new Uint8Array(150_000)], 'photo.jpg', { type: 'image/jpeg' });
    photos.prepare.mockResolvedValue(reduced);
    const input = root().querySelector('[name=photo]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [original], configurable: true });
    input.dispatchEvent(new Event('change'));
    expect(photos.prepare).toHaveBeenCalledWith(original);
    root().querySelector('form')!.dispatchEvent(new SubmitEvent('submit', { cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve));
    const request = http.expectOne('/api/members/me/');
    expect(request.request.method).toBe('PATCH');
    expect(((request.request.body as FormData).get('photo') as File).size).toBe(150_000);
    request.flush(PROFILE);
    await settle();
    expect(root().textContent).toContain('Vos informations ont été enregistrées');
  });

  it('fait renseigner le prénom et le nom quand ils manquent (compte créé sans nom)', async () => {
    await open('profile');
    http.expectOne('/api/members/me/').flush({ ...PROFILE, first_name: '', last_name: '', territory: null, locality: 'Sénégal' });
    await settle();
    const first = root().querySelector('[name=first_name]') as HTMLInputElement;
    const last = root().querySelector('[name=last_name]') as HTMLInputElement;
    expect(first.disabled).toBe(false);
    first.value = 'Boubacar';
    last.value = 'Sidibe';
    root().querySelector('form')!.dispatchEvent(new SubmitEvent('submit', { cancelable: true }));
    const request = http.expectOne('/api/members/me/');
    const body = request.request.body as FormData;
    expect([body.get('first_name'), body.get('last_name')]).toEqual(['Boubacar', 'Sidibe']);
    request.flush({ ...PROFILE, first_name: 'Boubacar', last_name: 'Sidibe', territory: null, locality: 'Sénégal' });
    await settle();
    expect(TestBed.inject(AuthService).displayName()).toBe('Boubacar Sidibe');
  });

  it('permet de changer un nom déjà renseigné', async () => {
    await open('profile');
    http.expectOne('/api/members/me/').flush(PROFILE);
    await settle();
    const first = root().querySelector('[name=first_name]') as HTMLInputElement;
    const last = root().querySelector('[name=last_name]') as HTMLInputElement;
    expect([first.value, last.value, first.disabled]).toEqual(['Awa', 'Ndiaye', false]);
    last.value = 'Fall';
    root().querySelector('form')!.dispatchEvent(new SubmitEvent('submit', { cancelable: true }));
    const request = http.expectOne('/api/members/me/');
    const body = request.request.body as FormData;
    expect([body.get('first_name'), body.get('last_name')]).toEqual(['Awa', 'Fall']);
    request.flush({ ...PROFILE, last_name: 'Fall' });
    await settle();
    expect(TestBed.inject(AuthService).displayName()).toBe('Awa Fall');
  });

  it('montre la nouvelle photo après chaque changement', async () => {
    await open('profile');
    http.expectOne('/api/members/me/').flush(PROFILE);
    await settle();
    const portrait = () => root().querySelector('.profile-identity img')?.getAttribute('src');
    expect(portrait()).toBe('/api/members/me/photo/?v=a1b2');
    const input = root().querySelector('[name=photo]') as HTMLInputElement;
    for (const version of ['c3d4', 'e5f6']) {
      const file = new File([new Uint8Array(1000)], `${version}.jpg`, { type: 'image/jpeg' });
      photos.prepare.mockResolvedValue(file);
      Object.defineProperty(input, 'files', { value: [file], configurable: true });
      input.dispatchEvent(new Event('change'));
      root().querySelector('form')!.dispatchEvent(new SubmitEvent('submit', { cancelable: true }));
      await new Promise((resolve) => setTimeout(resolve));
      const request = http.expectOne('/api/members/me/');
      expect((request.request.body as FormData).get('photo')).toBe(file);
      request.flush({ ...PROFILE, photo_url: `/api/members/me/photo/?v=${version}` });
      await settle();
      // L'adresse renvoyée par le serveur est propre à la photo : l'image affichée est la nouvelle.
      expect(portrait()).toBe(`/api/members/me/photo/?v=${version}`);
    }
  });

  it('retire la photo de profil après confirmation', async () => {
    await open('profile');
    http.expectOne('/api/members/me/').flush(PROFILE);
    await settle();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    const remove = () =>
      [...root().querySelectorAll('button')].find((button) => button.textContent?.includes('Retirer la photo'))!;
    remove().click();
    http.expectNone('/api/members/me/photo/'); // annulé : rien n'est envoyé
    remove().click();
    const request = http.expectOne('/api/members/me/photo/');
    expect(request.request.method).toBe('DELETE');
    request.flush(null, { status: 204, statusText: 'No Content' });
    await settle();
    expect(root().querySelector('.profile-identity img')).toBeNull();
    expect(root().textContent).not.toContain('Retirer la photo');
    expect(confirm).toHaveBeenCalledTimes(2);
    confirm.mockRestore();
  });

  it('montre le pays sur la carte d’un compte de niveau national', async () => {
    await open('card');
    http.expectOne('/api/members/me/').flush({ ...PROFILE, territory: null, locality: 'Sénégal' });
    await settle();
    expect(root().textContent).toContain('Sénégal');
  });
});
