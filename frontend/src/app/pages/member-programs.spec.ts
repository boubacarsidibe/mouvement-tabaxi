import { HttpParams, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AuthService } from '../core/auth.service';
import { FRENCH, TEST_MEMBER } from '../core/testing';
import { MemberActivityPage, MemberPrograms } from './member-programs';

const TERRITORY = { id: 4, name: 'Pikine', kind: 'commune', kind_label: 'Commune', path: 'Sénégal › Dakar › Pikine' };
const SUMMARY = { id: 7, name: 'Brigades citoyennes', status: 'en_cours', status_label: 'En cours', territory: 'Pikine', manager: { id: 2, name: 'Mamadou Diop' } };
const ACTIVITY = (id: number, title: string, extra: object = {}) => ({
  id,
  program: SUMMARY,
  title,
  starts_at: '2026-11-05T09:00:00Z',
  ends_at: '2026-11-05T12:00:00Z',
  place: 'Plage de Yoff',
  description: 'Collecte des déchets.',
  registered: false,
  registrations_count: 3,
  registration_open: true,
  ...extra,
});
const PROGRAM = (extra: object = {}) => ({
  id: 7,
  name: 'Brigades citoyennes',
  objective: 'Mobiliser les jeunes.',
  territory: TERRITORY,
  manager: { id: 2, name: 'Mamadou Diop' },
  start_date: '2026-09-15',
  end_date: '2026-12-20',
  status: 'en_cours',
  status_label: 'En cours',
  activities: [ACTIVITY(11, 'Nettoyage de la plage'), ACTIVITY(12, 'Atelier de quartier', { registered: true, registrations_count: 4 })],
  ...extra,
});
const PAGE = (results: unknown[]) => ({ count: results.length, next: null, previous: null, results });

describe('Programmes du membre', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;
  let root: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        FRENCH,
        provideRouter([
          { path: 'membre/programmes', component: MemberPrograms },
          { path: 'membre/activites/:id', component: MemberActivityPage },
        ]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  async function settle() {
    await harness.fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    harness.detectChanges();
  }
  async function open(url: string) {
    TestBed.inject(AuthService).signedIn(TEST_MEMBER);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    root = harness.routeNativeElement as HTMLElement;
  }
  const buttons = (label: string) => Array.from(root.querySelectorAll('button')).filter((b) => b.textContent?.includes(label));
  const list = (match: (params: HttpParams) => boolean = () => true) =>
    http.expectOne((req) => req.url === '/api/member/programs/' && match(req.params));

  describe('liste', () => {
    async function openList(results: unknown[] = [PROGRAM()]) {
      await open('/membre/programmes');
      list().flush(PAGE(results));
      await settle();
    }

    it('affiche les programmes du territoire avec leurs activités par ordre de date', async () => {
      await openList();
      const text = root.textContent ?? '';
      expect(text).toContain('Brigades citoyennes');
      expect(text).toContain('Du 15 septembre 2026 au 20 décembre 2026');
      expect(text).toContain('Pikine');
      expect(text).toContain('Responsable : Mamadou Diop');
      expect(text).toContain('Mobiliser les jeunes.');
      expect(text).toContain('jeudi 5 novembre 2026');
      expect(text).toContain('Plage de Yoff');
      expect(text).toContain('3 inscrit(s)');
      const titles = Array.from(root.querySelectorAll('.member-activities li strong')).map((e) => e.textContent?.trim());
      expect(titles).toEqual(['Nettoyage de la plage', 'Atelier de quartier']);
      expect(text).not.toContain('Santé communautaire'); // l'ancien exemple
    });

    it('propose S’inscrire ou Se désinscrire sur chaque activité', async () => {
      await openList();
      expect(buttons('S’inscrire').length).toBe(1);
      expect(buttons('Se désinscrire').length).toBe(1);
    });

    it('inscrit puis désinscrit, et met le nombre d’inscrits à jour', async () => {
      await openList();
      buttons('S’inscrire')[0].click();
      const request = http.expectOne('/api/member/activities/11/registration/');
      expect(request.request.method).toBe('POST');
      request.flush(ACTIVITY(11, 'Nettoyage de la plage', { registered: true, registrations_count: 4 }), { status: 201, statusText: 'Created' });
      await settle();
      expect(root.textContent).toContain('4 inscrit(s)');
      expect(buttons('S’inscrire').length).toBe(0);
      expect(buttons('Se désinscrire').length).toBe(2);

      buttons('Se désinscrire')[0].click();
      const removal = http.expectOne('/api/member/activities/11/registration/');
      expect(removal.request.method).toBe('DELETE');
      removal.flush(ACTIVITY(11, 'Nettoyage de la plage', { registered: false, registrations_count: 3 }));
      await settle();
      expect(buttons('S’inscrire').length).toBe(1);
      expect(root.textContent).toContain('3 inscrit(s)');
    });

    it('affiche l’erreur du serveur quand les inscriptions sont closes', async () => {
      await openList();
      buttons('S’inscrire')[0].click();
      http
        .expectOne('/api/member/activities/11/registration/')
        .flush(
          { detail: "L'activité a déjà commencé : les inscriptions sont closes.", code: 'registration_closed' },
          { status: 409, statusText: 'Conflict' },
        );
      await settle();
      expect(root.textContent).toContain("L'activité a déjà commencé : les inscriptions sont closes.");
      expect(buttons('S’inscrire').length).toBe(1); // l'état affiché ne change pas
    });

    it('n’offre pas d’inscription quand elle est close', async () => {
      await openList([
        PROGRAM({
          activities: [
            ACTIVITY(11, 'Nettoyage passé', { registration_open: false }),
            ACTIVITY(12, 'Atelier suivi', { registered: true, registration_open: false }),
          ],
        }),
      ]);
      expect(buttons('S’inscrire').length).toBe(0);
      expect(buttons('Se désinscrire').length).toBe(0);
      expect(root.textContent).toContain('Inscriptions closes');
      expect(root.textContent).toContain('Inscrit(e)');
    });

    it('change d’onglet, cherche et réinitialise', async () => {
      await openList();
      buttons('Terminés')[0].click();
      list((p) => p.get('status') === 'termine').flush(PAGE([]));
      await settle();
      expect(root.textContent).toContain('Aucun programme à afficher pour votre territoire.');
      buttons('À venir')[0].click();
      list((p) => p.get('status') === 'prevu').flush(PAGE([]));
      await settle();
      const search = root.querySelector('input[aria-label="Rechercher un programme"]') as HTMLInputElement;
      search.value = 'brigades';
      search.dispatchEvent(new Event('input'));
      buttons('Rechercher')[0].click();
      list((p) => p.get('search') === 'brigades' && p.get('status') === 'prevu').flush(PAGE([PROGRAM()]));
      await settle();
      buttons('Réinitialiser')[0].click();
      const request = list();
      expect(request.request.params.has('status') || request.request.params.has('search')).toBe(false);
      request.flush(PAGE([PROGRAM()]));
      await settle();
    });

    it('lit la recherche du haut de l’écran dans l’adresse', async () => {
      await open('/membre/programmes?q=brigades');
      list((p) => p.get('search') === 'brigades').flush(PAGE([PROGRAM()]));
      await settle();
      expect((root.querySelector('input[aria-label="Rechercher un programme"]') as HTMLInputElement).value).toBe('brigades');
    });

    it('affiche l’erreur du serveur', async () => {
      await open('/membre/programmes');
      list().flush({ detail: 'Vous devez être connecté.' }, { status: 401, statusText: 'Unauthorized' });
      await settle();
      expect(root.textContent).toContain('Vous devez être connecté.');
    });
  });

  describe('activité', () => {
    it('montre l’activité et permet de s’inscrire', async () => {
      await open('/membre/activites/11');
      http.expectOne('/api/member/activities/11/').flush(ACTIVITY(11, 'Nettoyage de la plage'));
      await settle();
      const text = root.textContent ?? '';
      expect(text).toContain('Nettoyage de la plage');
      expect(text).toContain('Brigades citoyennes · Pikine');
      expect(text).toContain('Collecte des déchets.');
      expect(text).toContain('jeudi 5 novembre 2026');
      expect(text).toContain('3 inscrit(s)');
      expect(text).toContain('Responsable');
      expect(text).toContain('Mamadou Diop');
      expect(text).toContain('Participez avec nous');
      buttons('S’inscrire')[0].click();
      http
        .expectOne('/api/member/activities/11/registration/')
        .flush(ACTIVITY(11, 'Nettoyage de la plage', { registered: true, registrations_count: 4 }), { status: 201, statusText: 'Created' });
      await settle();
      expect(root.textContent).toContain('Inscription confirmée');
      expect(root.textContent).toContain('4 inscrit(s)');
      expect(buttons('Se désinscrire').length).toBe(1);
    });

    it('dit quand les inscriptions sont closes', async () => {
      await open('/membre/activites/11');
      http.expectOne('/api/member/activities/11/').flush(ACTIVITY(11, 'Nettoyage passé', { registration_open: false }));
      await settle();
      expect(root.textContent).toContain('Les inscriptions à cette activité sont closes.');
    });

    it('explique qu’une activité d’un autre territoire est introuvable', async () => {
      await open('/membre/activites/99');
      http.expectOne('/api/member/activities/99/').flush({ detail: 'Pas trouvé.' }, { status: 404, statusText: 'Not Found' });
      await settle();
      expect(root.textContent).toContain('introuvable ou ne concerne pas votre territoire');
    });
  });
});
