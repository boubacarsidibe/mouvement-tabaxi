import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { RequestDetail, RequestsList } from './requests-review';

const APPLICATION = {
  id: 7,
  reference: 'TAB-2026-00007',
  first_name: 'Awa',
  last_name: 'Ndiaye',
  email: 'awa@example.org',
  territory: { id: 1, name: 'Podor', kind: 'commune', kind_label: 'Commune', path: 'Sénégal › Podor' },
  profession: 'Enseignante',
  motivation: 'Je veux aider.',
  status: 'a_examiner',
  status_label: 'À examiner',
  created_at: '2026-10-12T10:24:00Z',
  consent_at: '2026-10-12T10:24:00Z',
  decided_by: null,
  decided_at: null,
  rejection_reason: '',
  internal_note: '',
  link_expires_at: null,
};

const ACCEPTED = {
  ...APPLICATION,
  status: 'acceptee',
  status_label: 'Acceptée',
  decided_by: { id: 1, first_name: 'Boubacar', last_name: 'Sidibe', email: 'fondateur@example.org' },
  decided_at: '2026-10-01T09:00:00Z',
  link_expires_at: '2026-10-08T09:00:00Z',
};

describe('Examen des demandes', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;
  let root: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'bureau/demandes', component: RequestsList },
          { path: 'bureau/demandes/:id', component: RequestDetail },
        ]),
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

  async function open(url: string) {
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    root = harness.routeNativeElement as HTMLElement;
  }

  async function settle() {
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  it('liste les demandes du serveur, sans données fictives', async () => {
    await open('/bureau/demandes');
    http
      .expectOne('/api/applications/')
      .flush({ count: 1, next: null, previous: null, results: [APPLICATION] });
    await settle();
    expect(root.textContent).toContain('Awa Ndiaye');
    expect(root.textContent).toContain('1 résultat');
  });

  it('filtre par statut', async () => {
    await open('/bureau/demandes');
    http.expectOne('/api/applications/').flush({ count: 0, next: null, previous: null, results: [] });
    await settle();
    const select = root.querySelector('select') as HTMLSelectElement;
    select.value = 'rejetee';
    select.dispatchEvent(new Event('change'));
    http
      .expectOne((req) => req.url === '/api/applications/' && req.params.get('status') === 'rejetee')
      .flush({ count: 0, next: null, previous: null, results: [] });
    await settle();
  });

  it('exige un motif pour refuser', async () => {
    await open('/bureau/demandes/7');
    http.expectOne('/api/applications/7/').flush(APPLICATION);
    await settle();
    const buttons = Array.from(root.querySelectorAll('button'));
    buttons.find((b) => b.textContent?.includes('Refuser'))!.click();
    await settle();
    Array.from(root.querySelectorAll('button'))
      .find((b) => b.textContent?.includes('Confirmer le refus'))!
      .click();
    await settle();
    expect(root.textContent).toContain('Le motif du refus est obligatoire.');
  });

  it('affiche l’erreur d’envoi du courriel', async () => {
    await open('/bureau/demandes/7');
    http.expectOne('/api/applications/7/').flush(APPLICATION);
    await settle();
    Array.from(root.querySelectorAll('button'))
      .find((b) => b.textContent?.includes('Accepter'))!
      .click();
    http
      .expectOne('/api/applications/7/accept/')
      .flush(
        { detail: 'Le courriel n’a pas pu être envoyé : la demande reste « À examiner ».', code: 'email_not_sent' },
        { status: 503, statusText: 'Service Unavailable' },
      );
    await settle();
    expect(root.textContent).toContain('Le courriel n’a pas pu être envoyé');
  });

  it('exporte la liste des demandes affichée, avec son statut', async () => {
    const saved: string[] = [];
    URL.createObjectURL = vi.fn(() => 'blob:test');
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      saved.push(this.download);
    });
    await open('/bureau/demandes');
    http.expectOne('/api/applications/').flush({ count: 0, next: null, previous: null, results: [] });
    await settle();
    const select = root.querySelector('select') as HTMLSelectElement;
    select.value = 'rejetee';
    select.dispatchEvent(new Event('change'));
    http
      .expectOne((req) => req.url === '/api/applications/' && req.params.get('status') === 'rejetee')
      .flush({ count: 0, next: null, previous: null, results: [] });
    await settle();
    Array.from(root.querySelectorAll('button'))
      .find((b) => b.textContent?.includes('Exporter'))!
      .click();
    const request = http.expectOne((req) => req.url === '/api/applications/export/');
    expect(request.request.params.get('status')).toBe('rejetee');
    request.flush(new Blob(['x']), {
      headers: { 'Content-Disposition': 'attachment; filename="demandes-2026-10-16.xlsx"' },
    });
    await settle();
    expect(saved).toEqual(['demandes-2026-10-16.xlsx']);
  });

  it('renvoie un lien d’inscription expiré à une personne acceptée', async () => {
    await open('/bureau/demandes/7');
    http.expectOne('/api/applications/7/').flush(ACCEPTED);
    await settle();
    expect(root.textContent).toContain('Son lien a expiré le 08/10/2026');
    const button = Array.from(root.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Renvoyer le lien'),
    )!;
    button.click();
    const request = http.expectOne('/api/applications/7/resend-link/');
    expect(request.request.method).toBe('POST');
    request.flush({ ...ACCEPTED, link_expires_at: '2099-01-01T09:00:00Z' });
    await settle();
    expect(root.textContent).toContain('Un nouveau lien d’inscription a été envoyé');
    expect(root.textContent).toContain('Son lien est valable jusqu’au 01/01/2099');
  });

  it('affiche le message du serveur si le nouveau lien ne part pas', async () => {
    await open('/bureau/demandes/7');
    http.expectOne('/api/applications/7/').flush(ACCEPTED);
    await settle();
    Array.from(root.querySelectorAll('button'))
      .find((b) => b.textContent?.includes('Renvoyer le lien'))!
      .click();
    http
      .expectOne('/api/applications/7/resend-link/')
      .flush(
        { detail: 'Le courriel n’a pas pu être envoyé : aucun nouveau lien n’a été créé.', code: 'email_not_sent' },
        { status: 503, statusText: 'Service Unavailable' },
      );
    await settle();
    expect(root.querySelector('[role=alert]')?.textContent).toContain('aucun nouveau lien');
  });

  it.each(['a_examiner', 'rejetee', 'inscrite'])(
    'ne propose pas de renvoyer un lien pour une demande au statut %s',
    async (status) => {
      await open('/bureau/demandes/7');
      http.expectOne('/api/applications/7/').flush({ ...APPLICATION, status });
      await settle();
      expect(root.textContent).not.toContain('Renvoyer le lien');
    },
  );
});
