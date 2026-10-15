import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { JoinPage } from './join-page';
import { RequestStatusPage } from './request-status-page';

const TERRITORIES = [
  {
    id: 1,
    name: 'Sénégal',
    kind: 'pays',
    kind_label: 'Pays',
    children: [
      {
        id: 2,
        name: 'Dakar',
        kind: 'region',
        kind_label: 'Région',
        children: [
          { id: 3, name: 'Pikine', kind: 'commune', kind_label: 'Commune', children: [] },
          { id: 4, name: 'Rufisque', kind: 'commune', kind_label: 'Commune', children: [] },
        ],
      },
      {
        id: 5,
        name: 'Saint-Louis',
        kind: 'region',
        kind_label: 'Région',
        children: [{ id: 6, name: 'Podor', kind: 'commune', kind_label: 'Commune', children: [] }],
      },
    ],
  },
];

describe('Formulaire de demande d’adhésion', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;
  let root: HTMLElement;

  async function open() {
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/adherer');
    http.expectOne('/api/territories/').flush(TERRITORIES);
    await harness.fixture.whenStable();
    harness.detectChanges();
    root = harness.routeNativeElement as HTMLElement;
  }

  function fill(values: Record<string, string>) {
    for (const [name, value] of Object.entries(values)) {
      const field = root.querySelector(`[name=${name}]`) as
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
      field.value = value;
    }
    (root.querySelector('input[name=consent]') as HTMLInputElement).checked = true;
  }

  function send() {
    root.querySelector('form')!.dispatchEvent(new SubmitEvent('submit', { cancelable: true }));
  }

  const VALID = {
    firstName: 'Awa',
    lastName: 'Ndiaye',
    email: 'awa.ndiaye@example.org',
    territory: '6',
    profession: 'Enseignante',
    motivation: 'Contribuer à l’éducation civique des jeunes de Podor.',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'adherer', component: JoinPage, data: { mode: 'request' } },
          { path: 'adherer/confirmation', component: RequestStatusPage },
        ]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('propose les vraies localités, groupées par région', async () => {
    await open();
    const groups = [...root.querySelectorAll('optgroup')].map((group) => group.label);
    expect(groups).toEqual(['Dakar', 'Saint-Louis']);
    const communes = [...root.querySelectorAll('select[name=territory] option')].map((option) =>
      option.textContent?.trim(),
    );
    expect(communes).toEqual(['Sélectionnez une localité', 'Pikine', 'Rufisque', 'Podor']);
  });

  it('envoie la demande au serveur avec l’identifiant de la localité', async () => {
    await open();
    fill(VALID);
    send();
    const request = http.expectOne('/api/applications/');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      first_name: 'Awa',
      last_name: 'Ndiaye',
      email: 'awa.ndiaye@example.org',
      territory: 6,
      profession: 'Enseignante',
      motivation: 'Contribuer à l’éducation civique des jeunes de Podor.',
      consent: true,
    });
    request.flush({
      reference: 'TAB-2026-00007',
      status: 'a_examiner',
      status_label: 'À examiner',
      created_at: '2026-10-15T16:42:00Z',
    });
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/adherer/confirmation');
  });

  it('affiche la vraie référence et la vraie date sur la page de confirmation', async () => {
    await open();
    fill(VALID);
    send();
    http.expectOne('/api/applications/').flush({
      reference: 'TAB-2026-00007',
      status: 'a_examiner',
      status_label: 'À examiner',
      created_at: '2026-10-15T16:42:00Z',
    });
    await harness.fixture.whenStable();
    harness.detectChanges();
    const text = (harness.routeNativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('TAB-2026-00007');
    expect(text).not.toContain('TAB-2026-00418');
    expect(text).toContain('15 octobre · 16 h 42');
  });

  it('affiche sous chaque champ le message du serveur', async () => {
    await open();
    fill(VALID);
    send();
    http.expectOne('/api/applications/').flush(
      {
        email: ['Une demande est déjà en cours pour ce courriel.'],
        territory: ['Choisissez une localité dans la liste.'],
      },
      { status: 400, statusText: 'Bad Request' },
    );
    await harness.fixture.whenStable();
    harness.detectChanges();
    const errors = [...root.querySelectorAll('.field-error')].map((e) => e.textContent?.trim());
    expect(errors).toEqual([
      'Une demande est déjà en cours pour ce courriel.',
      'Choisissez une localité dans la liste.',
    ]);
    expect(root.querySelector('[role=alert].form-alert')?.textContent).toContain(
      'Certains champs sont à corriger',
    );
    expect(TestBed.inject(Router).url).toBe('/adherer');
  });

  it('explique une limite d’envois atteinte', async () => {
    await open();
    fill(VALID);
    send();
    http
      .expectOne('/api/applications/')
      .flush(
        { detail: 'Trop de requêtes. Réessayez plus tard.', code: 'throttled' },
        { status: 429, statusText: 'Too Many Requests' },
      );
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(root.querySelector('.form-alert')?.textContent).toContain('Trop de requêtes');
  });

  it('permet de réessayer si la liste des localités ne charge pas', async () => {
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/adherer');
    http
      .expectOne('/api/territories/')
      .flush(null, { status: 503, statusText: 'Service Unavailable' });
    await harness.fixture.whenStable();
    harness.detectChanges();
    root = harness.routeNativeElement as HTMLElement;
    expect(root.textContent).toContain('La liste des localités n’a pas pu être chargée.');
    (root.querySelector('.link-button') as HTMLButtonElement).click();
    http.expectOne('/api/territories/').flush(TERRITORIES);
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(root.querySelectorAll('optgroup').length).toBe(2);
    expect(root.textContent).not.toContain('n’a pas pu être chargée');
  });
});
