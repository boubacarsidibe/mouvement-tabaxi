import { HttpParams, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, withComponentInputBinding } from '@angular/router';
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
  can_change_status: true,
};
const PAGE = (results: unknown[]) => ({ count: results.length, next: null, previous: null, results });

const TERRITORIES = [
  { id: 1, name: 'Sénégal', kind: 'pays', kind_label: 'Pays', path: 'Sénégal', parent: null, is_active: true },
  { id: 2, name: 'Dakar', kind: 'region', kind_label: 'Région', path: 'Sénégal › Dakar', parent: 1, is_active: true },
  { id: 4, name: 'Pikine', kind: 'commune', kind_label: 'Commune', path: 'Sénégal › Dakar › Pikine', parent: 2, is_active: true },
];
const COORDINATOR = {
  ...LISTED,
  id: 20,
  first_name: 'Mamadou',
  last_name: 'Diop',
  email: 'mamadou@example.org',
  role: 'coordonnateur',
  role_label: 'Coordonnateur',
};
const FOUNDER_ROW = {
  ...LISTED,
  id: 21,
  first_name: 'Ibrahima',
  last_name: 'Sow',
  email: 'ibrahima@example.org',
  role: 'fondateur',
  role_label: 'Membre fondateur',
  territory: null,
};

describe('Base des membres', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;
  let root: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(
          [
            { path: 'bureau/membres', component: MembersList, data: { kind: 'members' } },
            { path: 'bureau/coordonnateurs', component: MembersList, data: { kind: 'bureau' } },
            { path: 'bureau/comptes', component: MembersList, data: { kind: 'accounts' } },
            { path: 'bureau/membres/:id', component: MemberDetail },
          ],
          withComponentInputBinding(),
        ),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });

  /** Ouvre une base : le serveur reçoit la demande des territoires puis celle de la liste. */
  async function open(url: string, results: unknown[] = [LISTED], user = TEST_FOUNDER) {
    TestBed.inject(AuthService).signedIn(user);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    root = harness.routeNativeElement as HTMLElement;
    http.expectOne('/api/territories/managed/').flush(TERRITORIES);
    const first = http.expectOne((req) => req.url === '/api/members/');
    const params = first.request.params;
    first.flush(PAGE(results));
    await settle();
    return params;
  }
  async function settle() {
    await harness.fixture.whenStable();
    harness.detectChanges();
  }
  const button = (label: string) =>
    Array.from(root.querySelectorAll('button')).find((b) => b.textContent?.includes(label));
  const select = (label: string) =>
    root.querySelector(`select[aria-label="${label}"]`) as HTMLSelectElement | null;
  /** La prochaine demande de liste, avec ses paramètres. */
  const nextList = (match: (params: HttpParams) => boolean = () => true) =>
    http.expectOne((req) => req.url === '/api/members/' && match(req.params));
  function choose(element: HTMLSelectElement, value: string) {
    element.value = value;
    element.dispatchEvent(new Event('change'));
  }
  function type(label: string, value: string) {
    const input = root.querySelector(`input[aria-label="${label}"]`) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  it('liste les membres du serveur, sans données fictives', async () => {
    const params = await open('/bureau/membres');
    expect(params.has('role')).toBe(false); // les membres simples par défaut
    expect(root.textContent).toContain('Aminata Ndiaye');
    expect(root.textContent).toContain('TBX-2026-00012');
    expect(root.textContent).toContain('Pikine');
    expect(root.textContent).toContain('12/03/2026');
    expect(root.textContent).toContain('1 résultat');
    expect(root.querySelector('a.row-action')?.getAttribute('href')).toBe('/bureau/membres/12');
  });

  it('propose les territoires du périmètre, les communes sous leur région', async () => {
    await open('/bureau/membres');
    const labels = Array.from(select('Filtrer par localité')!.options).map((o) => o.textContent);
    expect(labels).toEqual(['Toutes les localités', 'Sénégal', '  Dakar', '    Pikine']);
  });

  it('filtre par territoire', async () => {
    await open('/bureau/membres');
    choose(select('Filtrer par localité')!, '2');
    nextList((params) => params.get('territory') === '2').flush(PAGE([LISTED]));
    await settle();
  });

  it('filtre par période d’adhésion', async () => {
    await open('/bureau/membres');
    type('Date de début', '2026-01-01');
    nextList((params) => params.get('joined_from') === '2026-01-01' && !params.has('joined_to')).flush(PAGE([LISTED]));
    await settle();
    type('Date de fin', '2026-03-31');
    nextList(
      (params) => params.get('joined_from') === '2026-01-01' && params.get('joined_to') === '2026-03-31',
    ).flush(PAGE([LISTED]));
    await settle();
  });

  it('combine territoire, période, statut et recherche', async () => {
    await open('/bureau/membres');
    choose(select('Filtrer par localité')!, '2');
    nextList().flush(PAGE([]));
    type('Date de début', '2026-01-01');
    nextList().flush(PAGE([]));
    type('Date de fin', '2026-03-31');
    nextList().flush(PAGE([]));
    choose(select('Filtrer par statut')!, 'actif');
    nextList().flush(PAGE([]));
    type('Rechercher un membre', 'Ndiaye');
    button('Rechercher')!.click();
    const params = nextList((p) => p.get('search') === 'Ndiaye');
    expect(params.request.params.get('territory')).toBe('2');
    expect(params.request.params.get('joined_from')).toBe('2026-01-01');
    expect(params.request.params.get('joined_to')).toBe('2026-03-31');
    expect(params.request.params.get('status')).toBe('actif');
    params.flush(PAGE([LISTED]));
    await settle();
  });

  it('refuse une période à l’envers sans interroger le serveur', async () => {
    await open('/bureau/membres');
    type('Date de début', '2026-03-01');
    nextList().flush(PAGE([]));
    type('Date de fin', '2026-01-01');
    await settle();
    expect(root.textContent).toContain('La date de fin doit être égale ou postérieure à la date de début.');
  });

  it('affiche le message du serveur pour une date invalide', async () => {
    await open('/bureau/membres');
    type('Date de début', '2026-01-01');
    nextList().flush(
      { joined_from: ['Saisissez une date valide au format AAAA-MM-JJ.'] },
      { status: 400, statusText: 'Bad Request' },
    );
    await settle();
    expect(root.textContent).toContain('Saisissez une date valide au format AAAA-MM-JJ.');
  });

  it('réinitialise tous les filtres', async () => {
    await open('/bureau/membres');
    choose(select('Filtrer par localité')!, '4');
    nextList().flush(PAGE([]));
    type('Date de début', '2026-01-01');
    nextList().flush(PAGE([]));
    button('Réinitialiser')!.click();
    const request = nextList();
    expect(['territory', 'joined_from', 'joined_to', 'status', 'search'].some((k) => request.request.params.has(k))).toBe(false);
    request.flush(PAGE([LISTED]));
    await settle();
  });

  it('filtre par statut et recherche par nom', async () => {
    await open('/bureau/membres', []);
    choose(select('Filtrer par statut')!, 'suspendu');
    nextList((params) => params.get('status') === 'suspendu').flush(
      PAGE([{ ...LISTED, status: 'suspendu', status_label: 'Suspendu' }]),
    );
    await settle();
    expect(root.textContent).toContain('Suspendu');

    type('Rechercher un membre', 'Ndiaye');
    button('Rechercher')!.click();
    nextList((params) => params.get('search') === 'Ndiaye' && params.get('status') === 'suspendu').flush(PAGE([]));
    await settle();
  });

  it('trie par nom', async () => {
    await open('/bureau/membres', []);
    button('Nom complet')!.click();
    nextList((params) => params.get('ordering') === 'name').flush(PAGE([]));
    await settle();
    button('Nom complet')!.click();
    nextList((params) => params.get('ordering') === '-name').flush(PAGE([]));
    await settle();
  });

  it('affiche l’erreur du serveur', async () => {
    TestBed.inject(AuthService).signedIn(TEST_FOUNDER);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/bureau/membres');
    root = harness.routeNativeElement as HTMLElement;
    http.expectOne('/api/territories/managed/').flush(TERRITORIES);
    nextList().flush(
      { detail: 'Cette fonction est réservée au bureau exécutif.' },
      { status: 403, statusText: 'Forbidden' },
    );
    await settle();
    expect(root.textContent).toContain('réservée au bureau exécutif');
  });

  it('base des coordonnateurs : le bureau exécutif, avec les mêmes filtres', async () => {
    const params = await open('/bureau/coordonnateurs', [COORDINATOR, FOUNDER_ROW]);
    expect(params.get('role')).toBe('coordonnateur,fondateur');
    expect(root.textContent).toContain('Mamadou Diop');
    expect(root.textContent).toContain('Coordonnateur');
    expect(root.textContent).toContain('Ibrahima Sow');
    expect(root.textContent).toContain('Membre fondateur');
    expect(root.textContent).toContain('Tous les territoires'); // un fondateur n'est rattaché à aucun territoire
    expect(root.textContent).toContain('Date d’entrée');
    expect(root.textContent).not.toContain('N° d’adhérent');

    choose(select('Filtrer par fonction')!, 'fondateur');
    nextList((p) => p.get('role') === 'fondateur').flush(PAGE([FOUNDER_ROW]));
    await settle();
    choose(select('Filtrer par localité')!, '2');
    nextList((p) => p.get('role') === 'fondateur' && p.get('territory') === '2').flush(PAGE([]));
    await settle();
    button('Réinitialiser')!.click();
    nextList((p) => p.get('role') === 'coordonnateur,fondateur' && !p.has('territory')).flush(PAGE([]));
    await settle();
  });

  /** Remplace le téléchargement du navigateur : renvoie les noms de fichiers « enregistrés ». */
  function stubDownload() {
    const saved: string[] = [];
    URL.createObjectURL = vi.fn(() => 'blob:test');
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      saved.push(this.download);
    });
    return saved;
  }
  const file = (name: string) => ({
    headers: { 'Content-Disposition': `attachment; filename="${name}"` },
  });

  it('exporte la liste affichée avec les mêmes filtres et le dit', async () => {
    const saved = stubDownload();
    await open('/bureau/membres');
    choose(select('Filtrer par localité')!, '2');
    nextList().flush(PAGE([LISTED]));
    type('Date de début', '2026-01-01');
    nextList().flush(PAGE([LISTED]));
    choose(select('Filtrer par statut')!, 'actif');
    nextList().flush(PAGE([LISTED]));
    await settle();

    button('Exporter en Excel')!.click();
    const request = http.expectOne((req) => req.url === '/api/members/export/');
    expect(request.request.params.get('territory')).toBe('2');
    expect(request.request.params.get('joined_from')).toBe('2026-01-01');
    expect(request.request.params.get('status')).toBe('actif');
    expect(request.request.params.has('page')).toBe(false); // tout le fichier, pas une page
    request.flush(new Blob(['x']), file('membres-2026-10-16.xlsx'));
    await settle();
    expect(saved).toEqual(['membres-2026-10-16.xlsx']);
    expect(root.textContent).toContain('« membres-2026-10-16.xlsx » téléchargé');
    expect(root.textContent).toContain('noté dans le journal des actions');
  });

  it('exporte la liste telle qu’elle est affichée, pas une saisie pas encore validée', async () => {
    stubDownload();
    await open('/bureau/membres');
    type('Rechercher un membre', 'Ndiaye'); // saisi, mais ni Entrée ni « Rechercher »
    button('Exporter en Excel')!.click();
    const request = http.expectOne((req) => req.url === '/api/members/export/');
    expect(request.request.params.has('search')).toBe(false);
    request.flush(new Blob(['x']), file('membres-2026-10-16.xlsx'));
    await settle();
  });

  it('exporte la base des coordonnateurs avec ses filtres', async () => {
    const saved = stubDownload();
    await open('/bureau/coordonnateurs', [COORDINATOR]);
    button('Exporter en Excel')!.click();
    const request = http.expectOne((req) => req.url === '/api/members/export/');
    expect(request.request.params.get('role')).toBe('coordonnateur,fondateur');
    request.flush(new Blob(['x']), file('coordonnateurs-2026-10-16.xlsx'));
    await settle();
    expect(saved).toEqual(['coordonnateurs-2026-10-16.xlsx']);
  });

  it('affiche l’erreur du serveur quand l’export échoue', async () => {
    const saved = stubDownload();
    await open('/bureau/membres');
    button('Exporter en Excel')!.click();
    http
      .expectOne((req) => req.url === '/api/members/export/')
      .flush(new Blob([JSON.stringify({ detail: 'Cette fonction est réservée au bureau exécutif.' })]), {
        status: 403,
        statusText: 'Forbidden',
      });
    await settle();
    expect(root.textContent).toContain('réservée au bureau exécutif');
    expect(saved).toEqual([]);
    expect(button('Exporter en Excel')!.disabled).toBe(false); // on peut réessayer
  });

  it('comptes d’accès : le bureau avec les courriels', async () => {
    const params = await open('/bureau/comptes', [COORDINATOR]);
    expect(params.get('role')).toBe('coordonnateur,fondateur');
    expect(root.textContent).toContain('Courriel');
    expect(root.textContent).toContain('mamadou@example.org');
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

  it('un coordonnateur suspend un membre simple de sa zone', async () => {
    await open(TEST_COORDINATOR);
    button('Suspendre')!.click();
    await settle();
    const reason = root.querySelector('textarea') as HTMLTextAreaElement;
    reason.value = 'Absences répétées.';
    reason.dispatchEvent(new Event('input'));
    button('Confirmer la suspension')!.click();
    const request = http.expectOne('/api/members/12/status/');
    expect(request.request.body).toEqual({ status: 'suspendu', reason: 'Absences répétées.' });
    request.flush({ ...RECORD, status: 'suspendu', status_label: 'Suspendu' });
    await settle();
    expect(root.textContent).toContain('le compte ne peut plus se connecter');
  });

  it('ne propose aucun changement de statut sur la fiche d’un autre membre du bureau', async () => {
    await open(TEST_COORDINATOR, { ...RECORD, role: 'coordonnateur', status_history: null, can_change_status: false });
    // Aucun encadré « Gérer l'accès » : il ne servirait à rien ; la fiche prend toute la largeur.
    expect(root.querySelector('.decision-panel')).toBeNull();
    expect(root.querySelector('.member-detail-grid')?.classList).toContain('single');
    expect(button('Suspendre')).toBeUndefined();
    expect(button('Radier')).toBeUndefined();
    expect(root.textContent).not.toContain('Historique du statut');
  });

  it('ne laisse pas un fondateur changer son propre statut', async () => {
    await open(TEST_FOUNDER, { ...RECORD, email: TEST_FOUNDER.email, can_change_status: false });
    expect(root.querySelector('.decision-panel')).toBeNull();
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
