import { Component } from '@angular/core';
import { HttpParams, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AuthService } from '../core/auth.service';
import { FRENCH, TEST_COORDINATOR, TEST_FOUNDER } from '../core/testing';
import { ProgramDetail, ProgramForm, ProgramsList } from './programs-bureau';

@Component({ selector: 'app-blank', template: '' })
class Blank {}

const TERRITORY = { id: 4, name: 'Pikine', kind: 'commune', kind_label: 'Commune', path: 'Sénégal › Dakar › Pikine' };
const MANAGED = [
  { id: 2, name: 'Dakar', kind: 'region', kind_label: 'Région', path: 'Sénégal › Dakar', parent: 1, is_active: true },
  { ...TERRITORY, parent: 2, is_active: true },
];
const PROGRAM = {
  id: 7,
  name: 'Brigades citoyennes',
  objective: 'Mobiliser les jeunes.',
  territory: TERRITORY,
  manager: { id: 2, name: 'Mamadou Diop' },
  start_date: '2026-09-15',
  end_date: '2026-12-20',
  status: 'en_cours',
  status_label: 'En cours',
  activities_count: 2,
};
const ACTIVITY = (id: number, title: string, starts_at: string, extra: object = {}) => ({
  id,
  program: { id: 7, name: 'Brigades citoyennes', status: 'en_cours', status_label: 'En cours', territory: 'Pikine' },
  title,
  starts_at,
  ends_at: null,
  place: 'Plage de Yoff',
  description: 'Collecte des déchets.',
  report: '',
  report_author: null,
  reported_at: null,
  has_started: false,
  is_over: false,
  registrations_count: 0,
  attendance_noted: false,
  attendance_count: null,
  ...extra,
});
const RECORD = {
  ...PROGRAM,
  activities: [
    ACTIVITY(11, 'Nettoyage de la plage', '2026-10-10T09:00:00Z', { has_started: true, registrations_count: 12, attendance_noted: true, attendance_count: 9, report: 'Bilan.' }),
    ACTIVITY(12, 'Atelier de quartier', '2026-11-05T15:00:00Z', { registrations_count: 3 }),
  ],
};
const PAGE = (results: unknown[]) => ({ count: results.length, next: null, previous: null, results });

describe('Programmes du bureau', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;
  let root: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        FRENCH,
        provideRouter([
          { path: 'bureau/programmes', component: ProgramsList },
          { path: 'bureau/programmes/nouveau', component: ProgramForm },
          { path: 'bureau/programmes/:id', component: ProgramDetail },
          { path: 'bureau/programmes/:id/modifier', component: ProgramForm },
          { path: 'bureau/activites/:id', component: Blank },
          { path: 'bureau/programmes/:id/activites/nouvelle', component: Blank },
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

  async function settle() {
    await harness.fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve)); // laisse finir les promesses enchaînées
    harness.detectChanges();
  }
  async function open(url: string, user = TEST_COORDINATOR) {
    TestBed.inject(AuthService).signedIn(user);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    root = harness.routeNativeElement as HTMLElement;
  }
  const button = (label: string) => Array.from(root.querySelectorAll('button')).find((b) => b.textContent?.includes(label));
  const select = (label: string) => root.querySelector(`select[aria-label="${label}"]`) as HTMLSelectElement;
  const field = (name: string) => root.querySelector(`[name=${name}]`) as HTMLInputElement;
  function type(name: string, value: string) {
    const element = field(name);
    element.value = value;
    element.dispatchEvent(new Event(element.tagName === 'SELECT' ? 'change' : 'input'));
  }
  const listRequest = (match: (params: HttpParams) => boolean = () => true) =>
    http.expectOne((req) => req.url === '/api/programs/' && match(req.params));

  describe('liste', () => {
    async function openList(results: unknown[] = [PROGRAM]) {
      await open('/bureau/programmes');
      http.expectOne('/api/territories/managed/').flush(MANAGED);
      listRequest().flush(PAGE(results));
      await settle();
    }

    it('liste les programmes du serveur, sans données fictives', async () => {
      await openList();
      const text = root.textContent ?? '';
      expect(text).toContain('Brigades citoyennes');
      expect(text).toContain('Pikine');
      expect(text).toContain('Mamadou Diop');
      expect(text).toContain('15/09/2026 – 20/12/2026');
      expect(text).toContain('En cours');
      expect(text).toContain('1 programme(s)');
      expect(text).not.toContain('Éducation civique'); // l'ancien exemple
      expect(root.querySelector('a.row-action')?.getAttribute('href')).toBe('/bureau/programmes/7');
    });

    it('indique un programme sans responsable', async () => {
      await openList([{ ...PROGRAM, manager: null }]);
      expect(root.textContent).toContain('Non désigné');
    });

    it('dit quand rien ne correspond', async () => {
      await openList([]);
      expect(root.textContent).toContain('Aucun programme ne correspond à ces filtres.');
    });

    it('filtre par état, localité et recherche, puis exporte la liste affichée', async () => {
      const saved: string[] = [];
      URL.createObjectURL = vi.fn(() => 'blob:test');
      URL.revokeObjectURL = vi.fn();
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
        saved.push(this.download);
      });
      await openList();
      select('Filtrer par état').value = 'termine';
      select('Filtrer par état').dispatchEvent(new Event('change'));
      listRequest((p) => p.get('status') === 'termine').flush(PAGE([]));
      await settle();
      select('Filtrer par localité').value = '4';
      select('Filtrer par localité').dispatchEvent(new Event('change'));
      listRequest((p) => p.get('territory') === '4' && p.get('status') === 'termine').flush(PAGE([]));
      await settle();
      const search = root.querySelector('input[aria-label="Rechercher un programme"]') as HTMLInputElement;
      search.value = 'brigades';
      search.dispatchEvent(new Event('input'));
      button('Rechercher')!.click();
      listRequest((p) => p.get('search') === 'brigades').flush(PAGE([PROGRAM]));
      await settle();

      button('Exporter en Excel')!.click();
      const request = http.expectOne((req) => req.url === '/api/programs/export/');
      expect(request.request.params.get('status')).toBe('termine');
      expect(request.request.params.get('territory')).toBe('4');
      expect(request.request.params.get('search')).toBe('brigades');
      request.flush(new Blob(['x']), { headers: { 'Content-Disposition': 'attachment; filename="programmes-2026-10-16.xlsx"' } });
      await settle();
      expect(saved).toEqual(['programmes-2026-10-16.xlsx']);
    });

    it('affiche l’erreur du serveur', async () => {
      await open('/bureau/programmes');
      http.expectOne('/api/territories/managed/').flush(MANAGED);
      listRequest().flush({ detail: 'Cette fonction est réservée au bureau exécutif.' }, { status: 403, statusText: 'Forbidden' });
      await settle();
      expect(root.textContent).toContain('réservée au bureau exécutif');
    });
  });

  describe('formulaire', () => {
    const MANAGERS = [
      { id: 2, name: 'Mamadou Diop', role_label: 'Coordonnateur' },
      { id: 3, name: 'Ibrahima Sow', role_label: 'Membre fondateur' },
    ];

    async function openCreate(user = TEST_COORDINATOR) {
      await open('/bureau/programmes/nouveau', user);
      http.expectOne('/api/territories/managed/').flush(MANAGED);
      await settle();
    }

    it('propose les localités du périmètre et choisit celle du coordonnateur', async () => {
      await open('/bureau/programmes/nouveau', { ...TEST_COORDINATOR, id: 2, territory: TERRITORY as never });
      http.expectOne('/api/territories/managed/').flush(MANAGED);
      await settle();
      http.expectOne((req) => req.url === '/api/programs/managers/' && req.params.get('territory') === '4').flush(MANAGERS);
      await settle();
      expect(Array.from(field('territory').querySelectorAll('option')).map((o) => o.textContent)).toEqual([
        'Choisir une localité',
        'Dakar',
        '  Pikine',
      ]);
      expect((field('territory') as unknown as HTMLSelectElement).value).toBe('4');
      expect((field('manager') as unknown as HTMLSelectElement).value).toBe('2'); // lui-même, s'il peut être responsable
    });

    it('crée le programme et ouvre sa fiche', async () => {
      await openCreate(TEST_FOUNDER);
      type('name', 'Lecture pour tous');
      type('objective', 'Donner le goût de lire.');
      type('territory', '4');
      http.expectOne((req) => req.url === '/api/programs/managers/').flush(MANAGERS);
      await settle();
      type('manager', '3');
      type('start_date', '2026-11-01');
      type('end_date', '2026-12-31');
      type('status', 'prevu');
      root.querySelector('form')!.dispatchEvent(new SubmitEvent('submit', { cancelable: true }));
      const request = http.expectOne('/api/programs/');
      expect(request.request.method).toBe('POST');
      expect(request.request.body).toEqual({
        name: 'Lecture pour tous',
        objective: 'Donner le goût de lire.',
        territory: 4,
        manager: 3,
        start_date: '2026-11-01',
        end_date: '2026-12-31',
        status: 'prevu',
      });
      request.flush({ ...RECORD, id: 21 }, { status: 201, statusText: 'Created' });
      await settle();
      http.expectOne('/api/programs/21/').flush({ ...RECORD, id: 21 });
      await settle();
      expect(TestBed.inject(Router).url).toBe('/bureau/programmes/21');
    });

    it('affiche les erreurs du serveur en français, champ par champ', async () => {
      await openCreate(TEST_FOUNDER);
      root.querySelector('form')!.dispatchEvent(new SubmitEvent('submit', { cancelable: true }));
      http.expectOne('/api/programs/').flush(
        {
          name: ['Donnez un nom au programme.'],
          objective: ["Précisez l'objectif du programme."],
          territory: ['Choisissez la localité concernée.'],
          end_date: ['La date de fin doit être égale ou postérieure à la date de début.'],
        },
        { status: 400, statusText: 'Bad Request' },
      );
      await settle();
      const text = root.textContent ?? '';
      expect(text).toContain('Donnez un nom au programme.');
      expect(text).toContain("Précisez l'objectif du programme.");
      expect(text).toContain('Choisissez la localité concernée.');
      expect(text).toContain('La date de fin doit être égale ou postérieure à la date de début.');
      expect(TestBed.inject(Router).url).toBe('/bureau/programmes/nouveau');
    });

    it('modifie un programme existant', async () => {
      await open('/bureau/programmes/7/modifier');
      http.expectOne('/api/programs/7/').flush(RECORD);
      await settle();
      http.expectOne('/api/territories/managed/').flush(MANAGED);
      await settle();
      http.expectOne((req) => req.url === '/api/programs/managers/').flush(MANAGERS);
      await settle();
      expect(root.textContent).toContain('Modifier le programme');
      expect(field('name').value).toBe('Brigades citoyennes');
      expect(field('start_date').value).toBe('2026-09-15');
      expect((field('status') as unknown as HTMLSelectElement).value).toBe('en_cours');
      expect((field('manager') as unknown as HTMLSelectElement).value).toBe('2');
      type('status', 'termine');
      root.querySelector('form')!.dispatchEvent(new SubmitEvent('submit', { cancelable: true }));
      const request = http.expectOne('/api/programs/7/');
      expect(request.request.method).toBe('PATCH');
      expect((request.request.body as { status: string }).status).toBe('termine');
      request.flush({ ...RECORD, status: 'termine' });
      await settle();
      http.expectOne('/api/programs/7/').flush({ ...RECORD, status: 'termine' });
      await settle();
      expect(TestBed.inject(Router).url).toBe('/bureau/programmes/7');
    });
  });

  describe('fiche', () => {
    it('montre le programme et ses activités par ordre de date, avec les inscrits et les présents', async () => {
      await open('/bureau/programmes/7');
      http.expectOne('/api/programs/7/').flush(RECORD);
      await settle();
      const text = root.textContent ?? '';
      expect(text).toContain('Brigades citoyennes');
      expect(text).toContain('Mobiliser les jeunes.');
      expect(text).toContain('Responsable : Mamadou Diop');
      expect(text).toContain('15 septembre 2026');
      const rows = Array.from(root.querySelectorAll('.activity-row')).map((row) => row.textContent?.replace(/\s+/g, ' ').trim());
      expect(rows[0]).toContain('Nettoyage de la plage');
      expect(rows[0]).toContain('12 inscrit(s)');
      expect(rows[0]).toContain('9 présent(s)');
      expect(rows[0]).toContain('compte rendu écrit');
      expect(rows[1]).toContain('Atelier de quartier');
      expect(rows[1]).toContain('présences non notées');
      expect(rows[1]).toContain('pas de compte rendu');
      expect(root.querySelector('a[href="/bureau/programmes/7/activites/nouvelle"]')).not.toBeNull();
      expect(root.querySelector('a[href="/bureau/programmes/7/modifier"]')).not.toBeNull();
      expect(root.querySelector('a[href="/bureau/activites/12"]')).not.toBeNull();
    });

    it('dit quand le programme n’a pas d’activité', async () => {
      await open('/bureau/programmes/7');
      http.expectOne('/api/programs/7/').flush({ ...RECORD, activities: [] });
      await settle();
      expect(root.textContent).toContain('Aucune activité planifiée pour ce programme.');
    });

    it('explique qu’un programme hors périmètre est introuvable', async () => {
      await open('/bureau/programmes/9');
      http.expectOne('/api/programs/9/').flush({ detail: 'Pas trouvé.' }, { status: 404, statusText: 'Not Found' });
      await settle();
      expect(root.textContent).toContain('introuvable ou ne fait pas partie de votre territoire');
    });
  });
});
