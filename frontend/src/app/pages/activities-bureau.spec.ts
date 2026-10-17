import { Component } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { FRENCH } from '../core/testing';
import { ActivityAttendance, ActivityDetail, ActivityForm, ActivityReport } from './activities-bureau';

@Component({ selector: 'app-blank', template: '' })
class Blank {}

const PROGRAM = {
  id: 7,
  name: 'Brigades citoyennes',
  objective: 'Mobiliser les jeunes.',
  territory: { id: 4, name: 'Pikine', kind: 'commune', kind_label: 'Commune', path: 'Sénégal › Dakar › Pikine' },
  manager: null,
  start_date: '2026-09-15',
  end_date: '2026-12-20',
  status: 'en_cours',
  status_label: 'En cours',
  activities_count: 1,
  activities: [],
};
const ACTIVITY = {
  id: 12,
  program: { id: 7, name: 'Brigades citoyennes', status: 'en_cours', status_label: 'En cours', territory: 'Pikine' },
  title: 'Nettoyage de la plage',
  starts_at: '2026-10-10T09:00:00Z',
  ends_at: '2026-10-10T12:00:00Z',
  place: 'Plage de Yoff',
  description: 'Collecte des déchets.',
  report: '',
  report_author: null,
  reported_at: null,
  has_started: true,
  is_over: true,
  registrations_count: 2,
  attendance_noted: false,
  attendance_count: null,
};
const REGISTRANTS = {
  count: 2,
  results: [
    { member: 31, number: 'TBX-2026-00031', first_name: 'Bineta', last_name: 'Fall', email: 'bineta@example.org', territory: 'Pikine', registered_at: '2026-10-01T10:00:00Z' },
    { member: 32, number: 'TBX-2026-00032', first_name: 'Awa', last_name: 'Ndiaye', email: 'awa@example.org', territory: 'Pikine', registered_at: '2026-10-02T10:00:00Z' },
  ],
};

describe('Activités du bureau', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;
  let root: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        FRENCH,
        provideRouter([
          { path: 'bureau/programmes/:id', component: Blank },
          { path: 'bureau/programmes/:programId/activites/nouvelle', component: ActivityForm },
          { path: 'bureau/activites/:id', component: ActivityDetail },
          { path: 'bureau/activites/:id/modifier', component: ActivityForm },
          { path: 'bureau/activites/:id/compte-rendu', component: ActivityReport },
          { path: 'bureau/activites/:id/presences', component: ActivityAttendance },
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
  async function open(url: string) {
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    root = harness.routeNativeElement as HTMLElement;
  }
  const button = (label: string) => Array.from(root.querySelectorAll('button')).find((b) => b.textContent?.includes(label));
  const field = (name: string) => root.querySelector(`[name=${name}]`) as HTMLInputElement;
  function type(name: string, value: string) {
    const element = field(name);
    element.value = value;
    element.dispatchEvent(new Event(element.tagName === 'SELECT' ? 'change' : 'input'));
  }
  const submit = () => root.querySelector('form')!.dispatchEvent(new SubmitEvent('submit', { cancelable: true }));

  describe('formulaire', () => {
    it('planifie une activité dans le programme', async () => {
      await open('/bureau/programmes/7/activites/nouvelle');
      http.expectOne('/api/programs/7/').flush(PROGRAM);
      await settle();
      expect(root.textContent).toContain('Programme : Brigades citoyennes, du 15 septembre 2026 au 20 décembre 2026');
      type('title', 'Distribution de livres');
      type('starts_at', '2026-11-05T09:00');
      type('ends_at', '2026-11-05T12:00');
      type('place', 'Bibliothèque de Pikine');
      type('description', 'Distribution de livres aux enfants.');
      submit();
      const request = http.expectOne('/api/programs/7/activities/');
      expect(request.request.method).toBe('POST');
      const body = request.request.body as { title: string; starts_at: string; ends_at: string; place: string };
      expect(body.title).toBe('Distribution de livres');
      expect(new Date(body.starts_at).getTime()).toBe(new Date('2026-11-05T09:00').getTime()); // l'heure saisie, avec son fuseau
      expect(new Date(body.ends_at).getTime() - new Date(body.starts_at).getTime()).toBe(3 * 3600 * 1000);
      request.flush({ ...ACTIVITY, id: 30 }, { status: 201, statusText: 'Created' });
      await settle();
      expect(TestBed.inject(Router).url).toBe('/bureau/activites/30');
      http.expectOne('/api/activities/30/').flush({ ...ACTIVITY, id: 30 });
      http.expectOne('/api/activities/30/registrations/').flush({ count: 0, results: [] });
      await settle();
    });

    it('envoie une fin vide quand elle n’est pas renseignée', async () => {
      await open('/bureau/programmes/7/activites/nouvelle');
      http.expectOne('/api/programs/7/').flush(PROGRAM);
      await settle();
      type('title', 'Réunion');
      type('starts_at', '2026-11-05T18:00');
      submit();
      const request = http.expectOne('/api/programs/7/activities/');
      expect((request.request.body as { ends_at: unknown }).ends_at).toBeNull();
      request.flush({ starts_at: ['La date de l\'activité doit se situer entre le 15/09/2026 et le 20/12/2026, dates du programme.'] }, { status: 400, statusText: 'Bad Request' });
      await settle();
    });

    it('affiche les erreurs du serveur en français', async () => {
      await open('/bureau/programmes/7/activites/nouvelle');
      http.expectOne('/api/programs/7/').flush(PROGRAM);
      await settle();
      submit();
      http.expectOne('/api/programs/7/activities/').flush(
        {
          title: ["Donnez un titre à l'activité."],
          place: ["Indiquez le lieu de l'activité."],
          description: ["Décrivez l'activité."],
          starts_at: ["Indiquez la date et l'heure de l'activité."],
        },
        { status: 400, statusText: 'Bad Request' },
      );
      await settle();
      const text = root.textContent ?? '';
      expect(text).toContain("Donnez un titre à l'activité.");
      expect(text).toContain("Indiquez le lieu de l'activité.");
      expect(text).toContain("Décrivez l'activité.");
      expect(text).toContain("Indiquez la date et l'heure de l'activité.");
    });

    it('dit qu’un programme annulé n’accepte plus d’activité', async () => {
      await open('/bureau/programmes/7/activites/nouvelle');
      http.expectOne('/api/programs/7/').flush(PROGRAM);
      await settle();
      submit();
      http.expectOne('/api/programs/7/activities/').flush(
        { detail: ["Ce programme est annulé : on n'y planifie plus d'activité."] },
        { status: 400, statusText: 'Bad Request' },
      );
      await settle();
      expect(root.textContent).toContain("Ce programme est annulé : on n'y planifie plus d'activité.");
    });

    it('modifie une activité existante', async () => {
      await open('/bureau/activites/12/modifier');
      http.expectOne('/api/activities/12/').flush(ACTIVITY);
      await settle();
      http.expectOne('/api/programs/7/').flush(PROGRAM);
      await settle();
      expect(root.textContent).toContain('Modifier l’activité');
      expect(field('title').value).toBe('Nettoyage de la plage');
      expect(field('place').value).toBe('Plage de Yoff');
      type('place', 'Corniche de Yoff');
      submit();
      const request = http.expectOne('/api/activities/12/');
      expect(request.request.method).toBe('PATCH');
      expect((request.request.body as { place: string }).place).toBe('Corniche de Yoff');
      request.flush({ ...ACTIVITY, place: 'Corniche de Yoff' });
      await settle();
      http.expectOne('/api/activities/12/').flush({ ...ACTIVITY, place: 'Corniche de Yoff' });
      http.expectOne('/api/activities/12/registrations/').flush(REGISTRANTS);
      await settle();
      root = harness.routeNativeElement as HTMLElement; // la fiche remplace le formulaire
      expect(root.textContent).toContain('Corniche de Yoff');
    });
  });

  describe('fiche', () => {
    async function openDetail(activity: object = ACTIVITY) {
      await open('/bureau/activites/12');
      http.expectOne('/api/activities/12/').flush(activity);
      http.expectOne('/api/activities/12/registrations/').flush(REGISTRANTS);
      await settle();
    }

    it('montre l’activité, ses inscrits et le nombre de participants', async () => {
      await openDetail({ ...ACTIVITY, attendance_noted: true, attendance_count: 9, report: 'Bilan de la journée.', report_author: { id: 2, name: 'Mamadou Diop' }, reported_at: '2026-10-11T08:00:00Z' });
      const text = root.textContent ?? '';
      expect(text).toContain('Nettoyage de la plage');
      expect(text).toContain('samedi 10 octobre 2026');
      expect(text).toContain('Plage de Yoff');
      expect(text).toContain('9 présent(s)');
      expect(text).toContain('Bilan de la journée.');
      expect(text).toContain('Écrit par Mamadou Diop');
      expect(text).toContain('Bineta Fall');
      expect(text).toContain('TBX-2026-00032');
      expect(text).toContain('2 inscrit(s)');
      expect(root.querySelector('a[href="/bureau/activites/12/compte-rendu"]')?.textContent).toContain('Modifier le compte rendu');
      expect(root.querySelector('a[href="/bureau/activites/12/presences"]')?.textContent).toContain('Modifier les présences');
    });

    it('propose le compte rendu et les présences après l’activité seulement', async () => {
      await openDetail({ ...ACTIVITY, has_started: false, is_over: false });
      expect(root.querySelector('a[href="/bureau/activites/12/compte-rendu"]')).toBeNull();
      expect(root.querySelector('a[href="/bureau/activites/12/presences"]')).toBeNull();
      expect(root.textContent).toContain('se renseignent une fois l’activité commencée');
      expect(root.querySelector('a[href="/bureau/activites/12/modifier"]')).not.toBeNull();
    });

    it('exporte les inscrits', async () => {
      const saved: string[] = [];
      URL.createObjectURL = vi.fn(() => 'blob:test');
      URL.revokeObjectURL = vi.fn();
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
        saved.push(this.download);
      });
      await openDetail();
      button('Exporter en Excel')!.click();
      http
        .expectOne('/api/activities/12/registrations/export/')
        .flush(new Blob(['x']), { headers: { 'Content-Disposition': 'attachment; filename="inscrits-2026-10-16.xlsx"' } });
      await settle();
      expect(saved).toEqual(['inscrits-2026-10-16.xlsx']);
    });

    it('dit quand personne ne s’est inscrit', async () => {
      await open('/bureau/activites/12');
      http.expectOne('/api/activities/12/').flush(ACTIVITY);
      http.expectOne('/api/activities/12/registrations/').flush({ count: 0, results: [] });
      await settle();
      expect(root.textContent).toContain('Personne ne s’est encore inscrit.');
      expect(root.textContent).toContain('Aucun compte rendu pour le moment.');
    });

    it('explique qu’une activité hors périmètre est introuvable', async () => {
      await open('/bureau/activites/99');
      http.expectOne('/api/activities/99/').flush({ detail: 'Pas trouvé.' }, { status: 404, statusText: 'Not Found' });
      http.expectOne('/api/activities/99/registrations/').flush({ detail: 'Pas trouvé.' }, { status: 404, statusText: 'Not Found' });
      await settle();
      expect(root.textContent).toContain('introuvable ou ne fait pas partie de votre territoire');
    });
  });

  describe('compte rendu', () => {
    it('publie le compte rendu et met à jour l’état du programme', async () => {
      await open('/bureau/activites/12/compte-rendu');
      http.expectOne('/api/activities/12/').flush(ACTIVITY);
      await settle();
      expect((field('program_status') as unknown as HTMLSelectElement).value).toBe('en_cours');
      type('report', '  40 participants, 12 sacs ramassés.  ');
      type('program_status', 'termine');
      submit();
      const request = http.expectOne('/api/activities/12/report/');
      expect(request.request.method).toBe('PUT');
      expect(request.request.body).toEqual({ report: '40 participants, 12 sacs ramassés.', program_status: 'termine' });
      request.flush({ ...ACTIVITY, report: '40 participants, 12 sacs ramassés.' });
      await settle();
      expect(TestBed.inject(Router).url).toBe('/bureau/activites/12');
      http.expectOne('/api/activities/12/').flush(ACTIVITY);
      http.expectOne('/api/activities/12/registrations/').flush(REGISTRANTS);
      await settle();
    });

    it('reprend le compte rendu déjà écrit', async () => {
      await open('/bureau/activites/12/compte-rendu');
      http.expectOne('/api/activities/12/').flush({ ...ACTIVITY, report: 'Premier jet.' });
      await settle();
      expect(field('report').value).toBe('Premier jet.');
    });

    it('refuse d’écrire avant l’activité', async () => {
      await open('/bureau/activites/12/compte-rendu');
      http.expectOne('/api/activities/12/').flush({ ...ACTIVITY, has_started: false });
      await settle();
      expect(root.textContent).toContain('Cette activité n’a pas encore eu lieu : le compte rendu s’écrit après.');
      expect(button('Publier le compte rendu')!.disabled).toBe(true);
    });

    it('affiche l’erreur du serveur', async () => {
      await open('/bureau/activites/12/compte-rendu');
      http.expectOne('/api/activities/12/').flush(ACTIVITY);
      await settle();
      submit();
      http
        .expectOne('/api/activities/12/report/')
        .flush({ report: ["Écrivez le compte rendu de l'activité."] }, { status: 400, statusText: 'Bad Request' });
      await settle();
      expect(root.textContent).toContain("Écrivez le compte rendu de l'activité.");
    });
  });

  describe('présences', () => {
    const MEMBERS = [
      { id: 1, number: 'TBX-2026-00001', first_name: 'Awa', last_name: 'Ndiaye', territory: 'Pikine', registered: true, present: false },
      { id: 2, number: 'TBX-2026-00002', first_name: 'Bineta', last_name: 'Fall', territory: 'Pikine', registered: false, present: true },
      { id: 3, number: 'TBX-2026-00003', first_name: 'Cheikh', last_name: 'Sarr', territory: 'Pikine', registered: true, present: false },
    ];
    const SHEET = (members = MEMBERS) => ({
      noted: false,
      noted_at: null,
      noted_by: null,
      present_count: members.filter((m) => m.present).length,
      members,
    });
    const checkbox = (name: string) => root.querySelector(`input[aria-label="Présence de ${name}"]`) as HTMLInputElement;

    async function openSheet(activity: object = ACTIVITY) {
      await open('/bureau/activites/12/presences');
      http.expectOne('/api/activities/12/').flush(activity);
      await settle();
      http.expectOne('/api/activities/12/attendance/').flush(SHEET());
      await settle();
    }

    it('liste les membres à cocher avec le total des présents', async () => {
      await openSheet();
      expect(root.textContent).toContain('Awa Ndiaye');
      expect(root.textContent).toContain('TBX-2026-00002');
      expect(checkbox('Bineta Fall').checked).toBe(true);
      expect(checkbox('Awa Ndiaye').checked).toBe(false);
      expect(root.textContent).toContain('1 présent(s) sur 3 membre(s)');
      checkbox('Awa Ndiaye').click();
      await settle();
      expect(root.textContent).toContain('2 présent(s) sur 3 membre(s)');
      checkbox('Bineta Fall').click();
      await settle();
      expect(root.textContent).toContain('1 présent(s) sur 3 membre(s)');
    });

    it('coche les inscrits, décoche tout, cherche un membre', async () => {
      await openSheet();
      button('Cocher les inscrits')!.click();
      await settle();
      expect(root.textContent).toContain('3 présent(s) sur 3 membre(s)');
      button('Tout décocher')!.click();
      await settle();
      expect(root.textContent).toContain('0 présent(s) sur 3 membre(s)');
      const search = root.querySelector('input[aria-label="Rechercher un membre"]') as HTMLInputElement;
      search.value = 'sarr';
      search.dispatchEvent(new Event('input'));
      await settle();
      expect(root.querySelectorAll('tbody tr').length).toBe(1);
      expect(root.textContent).toContain('Cheikh Sarr');
      search.value = 'inconnu';
      search.dispatchEvent(new Event('input'));
      await settle();
      expect(root.textContent).toContain('Aucun membre à afficher.');
    });

    it('enregistre la liste des présents', async () => {
      await openSheet();
      checkbox('Awa Ndiaye').click();
      await settle();
      button('Enregistrer les présences')!.click();
      const request = http.expectOne('/api/activities/12/attendance/');
      expect(request.request.method).toBe('PUT');
      expect((request.request.body as { members: number[] }).members.sort()).toEqual([1, 2]);
      request.flush({ ...SHEET(MEMBERS.map((m) => (m.id === 3 ? m : { ...m, present: true }))), noted: true });
      await settle();
      expect(root.textContent).toContain('Présences enregistrées : 2 présent(s).');
    });

    it('affiche l’erreur du serveur', async () => {
      await openSheet();
      button('Enregistrer les présences')!.click();
      http.expectOne('/api/activities/12/attendance/').flush(
        { members: ['Certains membres ne font pas partie de la localité du programme ni des inscrits : ils ne peuvent pas être cochés.'] },
        { status: 400, statusText: 'Bad Request' },
      );
      await settle();
      expect(root.textContent).toContain('ne peuvent pas être cochés');
    });

    it('n’enregistre pas avant l’activité', async () => {
      await openSheet({ ...ACTIVITY, has_started: false });
      expect(root.textContent).toContain('Cette activité n’a pas encore eu lieu : les présences se notent après.');
      expect(button('Enregistrer les présences')!.disabled).toBe(true);
    });
  });
});
