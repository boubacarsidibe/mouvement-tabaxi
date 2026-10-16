import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AuthService } from '../core/auth.service';
import { FRENCH, TEST_MEMBER } from '../core/testing';
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
  phone: '',
  photo_url: null,
  coordinator: { first_name: 'Rokhaya', last_name: 'Gueye', email: 'rokhaya@example.org', territory: 'Podor' },
};
const inDays = (days: number) => new Date(Date.now() + days * 86400000).toISOString();
const ACTIVITY = (id: number, title: string, startsInDays: number, extra: object = {}) => ({
  id,
  program: { id: 7, name: 'Brigades citoyennes', status: 'en_cours', status_label: 'En cours', territory: 'Podor', manager: null },
  title,
  starts_at: inDays(startsInDays),
  ends_at: null,
  place: 'Plage de Yoff',
  description: 'Collecte.',
  registered: false,
  registrations_count: 1,
  registration_open: startsInDays > 0,
  ...extra,
});

describe('Espace membre : accueil', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;
  let root: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        FRENCH,
        provideRouter([{ path: 'membre', component: MemberPage, data: { view: 'home' } }]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  async function open(programs: object[], profile: object = PROFILE) {
    TestBed.inject(AuthService).signedIn(TEST_MEMBER);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/membre');
    root = harness.routeNativeElement as HTMLElement;
    http.expectOne('/api/members/me/').flush(profile);
    http
      .expectOne((req) => req.url === '/api/member/programs/')
      .flush({ count: programs.length, next: null, previous: null, results: programs });
    await harness.fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    harness.detectChanges();
  }
  const program = (activities: object[]) => ({
    id: 7,
    name: 'Brigades citoyennes',
    objective: 'Mobiliser.',
    territory: TEST_MEMBER.territory,
    manager: null,
    start_date: '2026-09-15',
    end_date: '2026-12-20',
    status: 'en_cours',
    status_label: 'En cours',
    activities,
  });

  it('montre mon coordonnateur réel', async () => {
    await open([]);
    const text = root.textContent ?? '';
    expect(text).toContain('Rokhaya Gueye');
    expect(text).toContain('Coordonnateur · Podor');
    expect(root.querySelector('a[href="mailto:rokhaya@example.org"]')).not.toBeNull();
    expect(text).not.toContain('Mamadou Diop'); // l'ancien exemple
    expect(text).not.toContain('+221 77 123 45 67');
  });

  it('dit quand aucun coordonnateur n’est rattaché', async () => {
    await open([], { ...PROFILE, coordinator: null });
    expect(root.textContent).toContain('Aucun coordonnateur n’est encore rattaché à votre territoire.');
  });

  it('compte les programmes, les activités à venir et mes inscriptions', async () => {
    await open([
      program([
        ACTIVITY(1, 'Nettoyage passé', -3, { registered: true }),
        ACTIVITY(2, 'Atelier de quartier', 5, { registered: true }),
        ACTIVITY(3, 'Causerie', 9),
      ]),
    ]);
    const tiles = Array.from(root.querySelectorAll('.member-stats article')).map((tile) => [
      tile.querySelector('strong')?.textContent,
      tile.querySelector('p')?.firstChild?.textContent,
    ]);
    expect(tiles).toEqual([
      ['1', 'Programmes'],
      ['2', 'Activités à venir'], // l'activité passée n'est pas comptée
      ['1', 'Mes inscriptions'],
    ]);
  });

  it('liste mes prochaines activités, sans actualités ni exemples', async () => {
    await open([program([ACTIVITY(1, 'Nettoyage passé', -3, { registered: true }), ACTIVITY(2, 'Atelier de quartier', 5, { registered: true }), ACTIVITY(3, 'Causerie', 9)])]);
    const text = root.textContent ?? '';
    expect(text).toContain('Atelier de quartier');
    expect(text).not.toContain('Nettoyage passé'); // déjà passée
    expect(text).not.toContain('Causerie'); // pas inscrit
    expect(root.querySelector('a[href="/membre/activites/2"]')).not.toBeNull();
    expect(text).not.toContain('Actualités du mouvement');
    expect(text).not.toMatch(/1 248|Lancement du programme de reboisement|Brigades citoyennes · Dakar/);
  });

  it('invite à découvrir les programmes quand aucune inscription n’est à venir', async () => {
    await open([program([ACTIVITY(3, 'Causerie', 9)])]);
    expect(root.textContent).toContain('Vous n’êtes inscrit(e) à aucune activité à venir.');
    expect(root.querySelector('a[href="/membre/programmes"]')).not.toBeNull();
  });
});
