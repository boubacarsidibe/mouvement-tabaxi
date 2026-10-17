import { HttpParams, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AuditJournal } from './audit-journal';

const ENTRY = {
  id: 9,
  action: 'demande_refusee',
  action_label: 'Demande refusée',
  category: 'adhesion',
  category_label: 'Adhésion',
  subject: 'Moussa Fall',
  detail: 'TAB-2026-00002 · Dakar · Motif : Dossier incomplet.',
  actor: { id: 3, name: 'Ibrahima Sow' },
  created_at: '2026-10-16T09:30:00Z',
};
const PAGE = (results: unknown[]) => ({ count: results.length, next: null, previous: null, results });
const ACTORS = [
  { id: 3, name: 'Ibrahima Sow' },
  { id: 4, name: 'Aïssatou Ba' },
];

describe('Journal des actions', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;
  let root: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'bureau/journal', component: AuditJournal }]),
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

  async function open(results: unknown[] = [ENTRY]) {
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/bureau/journal');
    root = harness.routeNativeElement as HTMLElement;
    http.expectOne('/api/audit/actors/').flush(ACTORS);
    http.expectOne((req) => req.url === '/api/audit/').flush(PAGE(results));
    await settle();
  }
  async function settle() {
    await harness.fixture.whenStable();
    harness.detectChanges();
  }
  const next = (match: (params: HttpParams) => boolean = () => true) =>
    http.expectOne((req) => req.url === '/api/audit/' && match(req.params));
  const select = (label: string) => root.querySelector(`select[aria-label="${label}"]`) as HTMLSelectElement;
  function choose(element: HTMLSelectElement, value: string) {
    element.value = value;
    element.dispatchEvent(new Event('change'));
  }
  function type(label: string, value: string) {
    const input = root.querySelector(`input[aria-label="${label}"]`) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  it('affiche les actions enregistrées, sans données fictives', async () => {
    await open();
    const text = root.textContent ?? '';
    expect(text).toContain('Demande refusée · Moussa Fall');
    expect(text).toContain('TAB-2026-00002 · Dakar · Motif : Dossier incomplet.');
    expect(text).toContain('Ibrahima Sow');
    expect(text).toContain('16/10/2026');
    expect(text).toContain('Adhésion');
    expect(text).toContain('1 action(s)');
    expect(text).toContain('ne peut être ni modifié ni effacé');
  });

  it('n’offre aucun moyen de modifier ou d’effacer une ligne', async () => {
    await open();
    const labels = Array.from(root.querySelectorAll('button')).map((b) => b.textContent?.trim());
    expect(labels).toEqual(['Rechercher', 'Réinitialiser', 'Exporter en Excel']);
    expect(root.querySelector('article a, article button, article input')).toBeNull();
  });

  it('dit quand aucune action ne correspond', async () => {
    await open([]);
    expect(root.textContent).toContain('Aucune action ne correspond à ces filtres.');
  });

  it('filtre par action, auteur, recherche et période', async () => {
    await open();
    choose(select('Filtrer par action'), 'liste_exportee');
    next((p) => p.get('action') === 'liste_exportee').flush(PAGE([]));
    await settle();
    expect(Array.from(select('Filtrer par auteur').options).map((o) => o.textContent)).toEqual([
      'Tous les auteurs',
      'Ibrahima Sow',
      'Aïssatou Ba',
    ]);
    choose(select('Filtrer par auteur'), '4');
    next((p) => p.get('actor') === '4' && p.get('action') === 'liste_exportee').flush(PAGE([]));
    await settle();
    type('Date de début', '2026-10-01');
    next((p) => p.get('date_from') === '2026-10-01').flush(PAGE([]));
    await settle();
    type('Date de fin', '2026-10-31');
    next((p) => p.get('date_to') === '2026-10-31').flush(PAGE([]));
    await settle();
    type('Rechercher dans le journal', 'Fall');
    (root.querySelector('.filter-bar button') as HTMLButtonElement).click();
    const request = next((p) => p.get('search') === 'Fall');
    expect(request.request.params.get('action')).toBe('liste_exportee');
    expect(request.request.params.get('actor')).toBe('4');
    request.flush(PAGE([ENTRY]));
    await settle();
  });

  it('réinitialise les filtres', async () => {
    await open();
    choose(select('Filtrer par action'), 'statut_modifie');
    next().flush(PAGE([]));
    await settle();
    Array.from(root.querySelectorAll('button')).find((b) => b.textContent?.includes('Réinitialiser'))!.click();
    const request = next();
    expect(['action', 'actor', 'search', 'date_from', 'date_to'].some((k) => request.request.params.has(k))).toBe(false);
    request.flush(PAGE([ENTRY]));
    await settle();
  });

  it('refuse une période à l’envers sans interroger le serveur', async () => {
    await open();
    type('Date de début', '2026-10-31');
    next().flush(PAGE([]));
    await settle();
    type('Date de fin', '2026-10-01');
    await settle();
    expect(root.textContent).toContain('La date de fin doit être égale ou postérieure à la date de début.');
  });

  it('affiche l’erreur du serveur', async () => {
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/bureau/journal');
    root = harness.routeNativeElement as HTMLElement;
    http.expectOne('/api/audit/actors/').flush(ACTORS);
    next().flush(
      { detail: 'Seuls les membres fondateurs ont accès à cette fonction.' },
      { status: 403, statusText: 'Forbidden' },
    );
    await settle();
    expect(root.textContent).toContain('Seuls les membres fondateurs');
  });

  it('exporte le journal affiché, avec ses filtres', async () => {
    const saved: string[] = [];
    URL.createObjectURL = vi.fn(() => 'blob:test');
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      saved.push(this.download);
    });
    await open();
    choose(select('Filtrer par action'), 'liste_exportee');
    next().flush(PAGE([ENTRY]));
    await settle();
    Array.from(root.querySelectorAll('button')).find((b) => b.textContent?.includes('Exporter'))!.click();
    const request = http.expectOne((req) => req.url === '/api/audit/export/');
    expect(request.request.params.get('action')).toBe('liste_exportee');
    request.flush(new Blob(['x']), {
      headers: { 'Content-Disposition': 'attachment; filename="journal-2026-10-16.xlsx"' },
    });
    await settle();
    expect(saved).toEqual(['journal-2026-10-16.xlsx']);
    expect(root.textContent).toContain('noté dans le journal des actions');
  });
});
