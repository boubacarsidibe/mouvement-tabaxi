import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Dashboard, niceTop } from './dashboard';

const TERRITORY = (id: number, name: string, kind = 'commune', kind_label = 'Commune') => ({
  id,
  name,
  kind,
  kind_label,
  path: `Sénégal › ${name}`,
});

/** Douze mois de novembre 2025 à octobre 2026, avec des adhésions sur quelques mois seulement. */
const MONTHLY = Array.from({ length: 12 }, (_, index) => {
  const month = ((index + 10) % 12) + 1;
  const year = index < 2 ? 2025 : 2026;
  return { month: `${year}-${String(month).padStart(2, '0')}`, count: [0, 0, 3, 0, 0, 1, 0, 0, 2, 0, 0, 6][index] };
});

const FOUNDER_DATA = {
  scope: { all: true, territory: null },
  active_members: 128,
  joined_this_month: 6,
  coordinators: 9,
  pending_applications: 4,
  territories: [
    { territory: TERRITORY(4, 'Pikine'), members: 80, coordinators: 2 },
    { territory: TERRITORY(5, 'Mbour'), members: 40, coordinators: 0 },
    { territory: TERRITORY(2, 'Dakar', 'region', 'Région'), members: 0, coordinators: 1 },
  ],
  monthly_joined: MONTHLY,
  recent_applications: [
    { id: 11, reference: 'TAB-2026-00011', first_name: 'Omar', last_name: 'Niang', territory: 'Podor', created_at: '2026-10-14T09:00:00Z' },
  ],
  recent_actions: [
    {
      id: 5,
      action: 'statut_modifie',
      action_label: 'Statut modifié',
      category: 'membres',
      category_label: 'Membres',
      subject: 'Aminata Ndiaye',
      detail: '',
      actor: { id: 3, name: 'Ibrahima Sow' },
      created_at: '2026-10-15T18:30:00Z',
    },
  ],
};

describe('Tableau de bord', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;
  let root: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: 'bureau', component: Dashboard }]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  async function open(data: object = FOUNDER_DATA) {
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/bureau');
    root = harness.routeNativeElement as HTMLElement;
    http.expectOne('/api/dashboard/').flush(data);
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  it('affiche les chiffres du serveur, sans données fictives', async () => {
    await open();
    const text = root.textContent ?? '';
    expect(text).toContain('tous les territoires');
    expect(text).toContain('Membres actifs');
    expect(text).toContain('128');
    expect(text).toContain('dont 6 adhésion(s) ce mois-ci');
    expect(text).toContain('Coordonnateurs actifs');
    expect(text).toContain('Demandes à examiner');
    expect(text).not.toMatch(/1 248|\+12%|Éducation civique/); // les anciennes valeurs d'exemple
  });

  it('montre la répartition par territoire', async () => {
    await open();
    const rows = Array.from(root.querySelectorAll('.territory-panel li')).map((li) => li.textContent?.replace(/\s+/g, ' ').trim());
    expect(rows[0]).toContain('Pikine');
    expect(rows[0]).toContain('80 membre(s)');
    expect(rows[0]).toContain('2 coordonnateur(s)');
    expect(rows[1]).toContain('Mbour');
    expect(rows[1]).not.toContain('coordonnateur'); // aucun coordonnateur : rien à dire
    expect(rows[2]).toContain('Région');
    const bars = Array.from(root.querySelectorAll('.territory-bar i')).map((bar) => (bar as HTMLElement).style.width);
    expect(bars).toEqual(['100%', '50%', '0%']);
  });

  it('trace la courbe des douze derniers mois avec une échelle adaptée', async () => {
    await open();
    expect(root.querySelectorAll('.line-chart circle').length).toBe(12);
    const ticks = Array.from(root.querySelectorAll('.chart-y span')).map((span) => span.textContent);
    expect(ticks).toEqual(['8', '6', '4', '2', '0']); // le plus grand mois compte 6 adhésions
    const months = Array.from(root.querySelectorAll('.chart-months span')).map((span) => span.textContent);
    expect(months[0]).toBe('nov.');
    expect(months[11]).toBe('oct.');
    const label = root.querySelector('.line-chart')!.getAttribute('aria-label');
    expect(label).toContain('0 en nov. 2025');
    expect(label).toContain('6 en oct. 2026');
    // Le dernier mois (6 sur 8) est tracé aux trois quarts de la hauteur.
    const last = Array.from(root.querySelectorAll('.line-chart circle')).pop()!;
    expect(Number(last.getAttribute('cy'))).toBeCloseTo(50, 5);
  });

  it('propose les demandes à examiner et les dernières actions aux fondateurs', async () => {
    await open();
    expect(root.textContent).toContain('Omar Niang');
    expect(root.textContent).toContain('Statut modifié · Aminata Ndiaye');
    expect(root.textContent).toContain('Ibrahima Sow');
    expect(root.querySelector('a[href="/bureau/demandes/11"]')).not.toBeNull();
    expect(root.querySelector('a[href="/bureau/journal"]')).not.toBeNull();
  });

  it('un coordonnateur voit son territoire, sans demandes ni journal', async () => {
    await open({
      ...FOUNDER_DATA,
      scope: { all: false, territory: TERRITORY(2, 'Dakar', 'region', 'Région') },
      recent_applications: null,
      recent_actions: null,
    });
    const text = root.textContent ?? '';
    expect(text).toContain('Périmètre : Dakar et les territoires qui en dépendent');
    expect(text).toContain('dans votre périmètre');
    expect(text).not.toContain('Voir les demandes');
    expect(root.querySelector('a[href="/bureau/journal"]')).toBeNull();
    expect(root.querySelector('a[href="/bureau/demandes"]')).toBeNull();
  });

  it('dit quand aucun membre n’est actif', async () => {
    await open({ ...FOUNDER_DATA, active_members: 0, territories: [], monthly_joined: MONTHLY.map((m) => ({ ...m, count: 0 })), recent_applications: [] });
    expect(root.textContent).toContain('Aucun membre actif dans ce périmètre.');
    expect(root.textContent).toContain('Aucune demande en attente.');
    const ticks = Array.from(root.querySelectorAll('.chart-y span')).map((span) => span.textContent);
    expect(ticks).toEqual(['4', '3', '2', '1', '0']);
  });

  it('affiche l’erreur du serveur', async () => {
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/bureau');
    root = harness.routeNativeElement as HTMLElement;
    http
      .expectOne('/api/dashboard/')
      .flush({ detail: 'Cette fonction est réservée au bureau exécutif.' }, { status: 403, statusText: 'Forbidden' });
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(root.textContent).toContain('réservée au bureau exécutif');
    expect(root.textContent).not.toContain('Chargement');
  });

  it('choisit une échelle ronde pour chaque ordre de grandeur', () => {
    expect([0, 1, 4, 5, 8, 9, 20, 21, 40, 41, 80, 81, 200, 201, 4000].map(niceTop)).toEqual([
      4, 4, 4, 8, 8, 20, 20, 40, 40, 80, 80, 200, 200, 400, 4000,
    ]);
  });
});
