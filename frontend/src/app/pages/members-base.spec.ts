import { Component } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AuthService } from '../core/auth.service';
import { TEST_COORDINATOR, TEST_FOUNDER } from '../core/testing';
import { MemberDetail, MembersList } from './members-base';

const TERRITORY = { id: 4, name: 'Pikine', kind: 'commune', kind_label: 'Commune', path: 'Sénégal › Dakar › Pikine' };
const LISTED = {
  id: 12,
  number: 'TBX-2026-00012',
  first_name: 'Aminata',
  last_name: 'Ndiaye',
  email: 'aminata@example.org',
  role: 'membre',
  role_label: 'Membre simple',
  territory: TERRITORY,
  joined_on: '2026-03-12',
  status: 'actif',
  status_label: 'Actif',
};
const RECORD = {
  ...LISTED,
  phone: '+221 77 456 78 90',
  address: '18, rue de la Corniche',
  photo_url: null,
  status_history: [] as unknown[],
};
const MANAGED = [
  { id: 2, name: 'Dakar', kind_label: 'Région', path: 'Sénégal › Dakar' },
  { id: 4, name: 'Pikine', kind_label: 'Commune', path: 'Sénégal › Dakar › Pikine' },
];
const PAGE = (results: unknown[]) => ({ count: results.length, next: null, previous: null, results });

@Component({ imports: [MembersList], template: '<app-members-list role="coordonnateur" />' })
class CoordinatorsHost {}

describe('Base des membres', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;
  let root: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'bureau/membres', component: MembersList },
          { path: 'bureau/coordonnateurs', component: CoordinatorsHost },
          { path: 'bureau/membres/:id', component: MemberDetail },
        ]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  async function open(url: string, user = TEST_FOUNDER) {
    TestBed.inject(AuthService).signedIn(user);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    root = harness.routeNativeElement as HTMLElement;
    http.match('/api/territories/managed/').forEach((req) => req.flush(MANAGED));
  }
  async function settle() {
    await harness.fixture.whenStable();
    harness.detectChanges();
  }
  const button = (label: string) =>
    Array.from(root.querySelectorAll('button')).find((b) => b.textContent?.includes(label));

  it('liste les membres du serveur, sans données fictives', async () => {
    await open('/bureau/membres');
    http.expectOne('/api/members/').flush(PAGE([LISTED]));
    await settle();
    expect(root.textContent).toContain('Aminata Ndiaye');
    expect(root.textContent).toContain('TBX-2026-00012');
    expect(root.textContent).toContain('Pikine');
    expect(root.textContent).toContain('12/03/2026');
    expect(root.textContent).toContain('1 résultat');
    expect(root.querySelector('a.row-action')?.getAttribute('href')).toBe('/bureau/membres/12');
  });

  it('filtre par statut et recherche par nom', async () => {
    await open('/bureau/membres');
    http.expectOne('/api/members/').flush(PAGE([]));
    await settle();
    const select = root.querySelector('select') as HTMLSelectElement;
    select.value = 'suspendu';
    select.dispatchEvent(new Event('change'));
    http
      .expectOne((req) => req.url === '/api/members/' && req.params.get('status') === 'suspendu')
      .flush(PAGE([{ ...LISTED, status: 'suspendu', status_label: 'Suspendu' }]));
    await settle();
    expect(root.textContent).toContain('Suspendu');

    const input = root.querySelector('input') as HTMLInputElement;
    input.value = 'Ndiaye';
    input.dispatchEvent(new Event('input'));
    button('Rechercher')!.click();
    http
      .expectOne((req) => req.params.get('search') === 'Ndiaye' && req.params.get('status') === 'suspendu')
      .flush(PAGE([]));
    await settle();
  });

  it('filtre par localité et par date d’adhésion', async () => {
    await open('/bureau/membres');
    http.expectOne('/api/members/').flush(PAGE([]));
    await settle();
    const selects = root.querySelectorAll('select');
    expect(selects[1].textContent).toContain('Sénégal › Dakar › Pikine');
    selects[1].value = selects[1].options[2].value;
    selects[1].dispatchEvent(new Event('change'));
    http.expectOne((req) => req.params.get('territory') === '4').flush(PAGE([LISTED]));
    await settle();
    const dates = root.querySelectorAll<HTMLInputElement>('input[type=date]');
    dates[0].value = '2026-01-01';
    dates[0].dispatchEvent(new Event('input'));
    http
      .expectOne(
        (req) => req.params.get('territory') === '4' && req.params.get('joined_from') === '2026-01-01',
      )
      .flush(PAGE([LISTED]));
    await settle();
    expect(root.textContent).toContain('Aminata Ndiaye');
    button('Réinitialiser')!.click();
    http
      .expectOne((req) => req.url === '/api/members/' && !req.params.has('territory') && !req.params.has('joined_from'))
      .flush(PAGE([]));
    await settle();
  });

  it('affiche la base des coordonnateurs', async () => {
    TestBed.inject(AuthService).signedIn(TEST_FOUNDER);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/bureau/coordonnateurs');
    root = harness.routeNativeElement as HTMLElement;
    http.match('/api/territories/managed/').forEach((req) => req.flush(MANAGED));
    http
      .expectOne((req) => req.url === '/api/members/' && req.params.get('role') === 'coordonnateur')
      .flush(PAGE([{ ...LISTED, role: 'coordonnateur', role_label: 'Coordonnateur' }]));
    await settle();
    expect(root.textContent).toContain('Aminata Ndiaye');
  });

  it('trie par nom', async () => {
    await open('/bureau/membres');
    http.expectOne('/api/members/').flush(PAGE([]));
    await settle();
    button('Nom complet')!.click();
    http.expectOne((req) => req.params.get('ordering') === 'name').flush(PAGE([]));
    await settle();
    button('Nom complet')!.click();
    http.expectOne((req) => req.params.get('ordering') === '-name').flush(PAGE([]));
    await settle();
  });

  it('affiche l’erreur du serveur', async () => {
    await open('/bureau/membres');
    http
      .expectOne('/api/members/')
      .flush({ detail: 'Cette fonction est réservée au bureau exécutif.' }, { status: 403, statusText: 'Forbidden' });
    await settle();
    expect(root.textContent).toContain('réservée au bureau exécutif');
  });
});

describe('Fiche d’un membre', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;
  let root: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'bureau/membres/:id', component: MemberDetail }]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  async function open(user = TEST_FOUNDER, record: object = RECORD) {
    TestBed.inject(AuthService).signedIn(user);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/bureau/membres/12');
    root = harness.routeNativeElement as HTMLElement;
    http.expectOne('/api/members/12/').flush(record);
    await settle();
  }
  async function settle() {
    await harness.fixture.whenStable();
    harness.detectChanges();
  }
  const button = (label: string) =>
    Array.from(root.querySelectorAll('button')).find((b) => b.textContent?.includes(label));

  it('affiche les informations réelles du membre', async () => {
    await open();
    expect(root.textContent).toContain('Aminata Ndiaye');
    expect(root.textContent).toContain('TBX-2026-00012');
    expect(root.textContent).toContain('aminata@example.org');
    expect(root.textContent).toContain('18, rue de la Corniche');
    expect(root.textContent).toContain('12/03/2026');
    expect(root.textContent).toContain('Aucun changement de statut');
  });

  it('suspend avec un motif obligatoire', async () => {
    await open();
    button('Suspendre')!.click();
    await settle();
    button('Confirmer la suspension')!.click();
    await settle();
    expect(root.textContent).toContain('Indiquez le motif de la suspension.');

    const reason = root.querySelector('textarea') as HTMLTextAreaElement;
    reason.value = 'Propos contraires au règlement.';
    reason.dispatchEvent(new Event('input'));
    button('Confirmer la suspension')!.click();
    const request = http.expectOne('/api/members/12/status/');
    expect(request.request.body).toEqual({ status: 'suspendu', reason: 'Propos contraires au règlement.' });
    request.flush({
      ...RECORD,
      status: 'suspendu',
      status_label: 'Suspendu',
      status_history: [
        {
          id: 1,
          from_status: 'actif',
          from_status_label: 'Actif',
          to_status: 'suspendu',
          to_status_label: 'Suspendu',
          reason: 'Propos contraires au règlement.',
          changed_by: { id: 3, first_name: 'Moussa', last_name: 'Diop' },
          changed_at: '2026-10-16T09:30:00Z',
        },
      ],
    });
    await settle();
    expect(root.textContent).toContain('le compte ne peut plus se connecter');
    expect(root.textContent).toContain('Actif → Suspendu');
    expect(root.textContent).toContain('par Moussa Diop');
    expect(root.textContent).toContain('Motif : Propos contraires au règlement.');
    expect(button('Suspendre')).toBeUndefined();
    expect(button('Rendre actif')).toBeDefined();
  });

  it('radie après confirmation', async () => {
    await open();
    button('Radier')!.click();
    await settle();
    const reason = root.querySelector('textarea') as HTMLTextAreaElement;
    reason.value = 'Fraude constatée.';
    reason.dispatchEvent(new Event('input'));
    button('Confirmer la radiation')!.click();
    const request = http.expectOne('/api/members/12/status/');
    expect(request.request.body).toEqual({ status: 'radie', reason: 'Fraude constatée.' });
    request.flush({ ...RECORD, status: 'radie', status_label: 'Radié' });
    await settle();
    expect(root.textContent).toContain('Membre radié');
  });

  it('rend le membre actif sans motif', async () => {
    await open(TEST_FOUNDER, { ...RECORD, status: 'suspendu', status_label: 'Suspendu' });
    button('Rendre actif')!.click();
    const request = http.expectOne('/api/members/12/status/');
    expect(request.request.body).toEqual({ status: 'actif', reason: '' });
    request.flush(RECORD);
    await settle();
    expect(root.textContent).toContain('de nouveau actif');
  });

  it('affiche l’erreur du serveur et garde le statut', async () => {
    await open();
    button('Suspendre')!.click();
    await settle();
    const reason = root.querySelector('textarea') as HTMLTextAreaElement;
    reason.value = 'Motif.';
    reason.dispatchEvent(new Event('input'));
    button('Confirmer la suspension')!.click();
    http
      .expectOne('/api/members/12/status/')
      .flush(
        { detail: 'Ce membre est déjà « Suspendu » : rien à changer.', code: 'same_status' },
        { status: 409, statusText: 'Conflict' },
      );
    await settle();
    expect(root.textContent).toContain('déjà « Suspendu »');
    expect(root.textContent).not.toContain('le compte ne peut plus se connecter');
  });

  it('ne propose aucun changement de statut à un coordonnateur', async () => {
    await open(TEST_COORDINATOR, { ...RECORD, status_history: null });
    expect(root.textContent).toContain('Seuls les membres fondateurs');
    expect(button('Suspendre')).toBeUndefined();
    expect(button('Radier')).toBeUndefined();
    expect(root.textContent).not.toContain('Historique du statut');
  });

  it('ne laisse pas un fondateur changer son propre statut', async () => {
    await open(TEST_FOUNDER, { ...RECORD, email: TEST_FOUNDER.email });
    expect(root.textContent).toContain('Vous ne pouvez pas changer votre propre statut.');
    expect(button('Radier')).toBeUndefined();
  });

  it('explique qu’un membre est introuvable', async () => {
    TestBed.inject(AuthService).signedIn(TEST_FOUNDER);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/bureau/membres/12');
    root = harness.routeNativeElement as HTMLElement;
    http.expectOne('/api/members/12/').flush({ detail: 'Pas trouvé.' }, { status: 404, statusText: 'Not Found' });
    await settle();
    expect(root.textContent).toContain('introuvable ou ne fait pas partie de votre territoire');
  });
});
