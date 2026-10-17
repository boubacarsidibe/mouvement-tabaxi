import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AuthService } from '../core/auth.service';
import { TEST_COORDINATOR, TEST_FOUNDER } from '../core/testing';
import { TerritoryUsage } from '../core/territories.service';
import { TerritoriesManager } from './territories-bureau';

const URL = '/api/territories/managed/';
const usage = (item: Partial<TerritoryUsage> & Pick<TerritoryUsage, 'id' | 'name' | 'kind' | 'path'>): TerritoryUsage => {
  const row = {
    kind_label: { pays: 'Pays', region: 'Région', commune: 'Commune' }[item.kind],
    parent: null,
    is_active: true,
    members_count: 0,
    coordinators_count: 0,
    programs_count: 0,
    applications_count: 0,
    children_count: 0,
    ...item,
  };
  const empty = !(row.members_count || row.coordinators_count || row.programs_count || row.applications_count || row.children_count);
  return { deletable: empty, ...row };
};
const LIST = [
  usage({ id: 1, name: 'Sénégal', kind: 'pays', path: 'Sénégal', children_count: 2 }),
  usage({ id: 2, name: 'Dakar', kind: 'region', path: 'Sénégal › Dakar', parent: 1, children_count: 1 }),
  usage({ id: 3, name: 'Pikine', kind: 'commune', path: 'Sénégal › Dakar › Pikine', parent: 2, members_count: 4, coordinators_count: 1 }),
  usage({ id: 4, name: 'Thiès', kind: 'region', path: 'Sénégal › Thiès', parent: 1 }),
];

describe('Gestion des territoires', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;
  let root: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'bureau/territoires', component: TerritoriesManager }]),
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

  async function open(user = TEST_FOUNDER, list: TerritoryUsage[] = LIST) {
    TestBed.inject(AuthService).signedIn(user);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/bureau/territoires');
    root = harness.routeNativeElement as HTMLElement;
    http.expectOne(URL).flush(list);
    await settle();
  }
  async function settle() {
    await harness.fixture.whenStable();
    harness.detectChanges();
  }
  const button = (label: string) =>
    Array.from(root.querySelectorAll('button')).find(
      (b) => b.getAttribute('aria-label') === label || b.textContent?.trim() === label,
    ) as HTMLButtonElement;
  function fill(name: string, value: string) {
    const field = root.querySelector(`[name="${name}"], [aria-label="${name}"]`) as HTMLInputElement | HTMLSelectElement;
    field.value = value;
    field.dispatchEvent(new Event(field.tagName === 'SELECT' ? 'change' : 'input'));
  }
  async function submit() {
    (root.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    await settle();
  }

  it('affiche les territoires réels avec leur contenu, sans données d’exemple', async () => {
    await open();
    const text = root.textContent ?? '';
    expect(text).toContain('Sénégal › Dakar › Pikine');
    expect(text).toContain('4 localités');
    expect(text).not.toMatch(/Ziguinchor|1 248|Localités couvertes/);
    const pikine = Array.from(root.querySelectorAll('tbody tr')).find((row) => row.textContent?.includes('Pikine'))!;
    expect(pikine.querySelector('[data-label="Membres"]')?.textContent?.trim()).toBe('4');
    expect(pikine.querySelector('[data-label="Coordonnateurs"]')?.textContent?.trim()).toBe('1');
    const summary = Array.from(root.querySelectorAll('.dashboard-summary > div')).map((cell) =>
      Array.from(cell.children)
        .map((part) => part.textContent?.trim())
        .join(' '),
    );
    expect(summary).toEqual(['2 régions', '1 commune', '1 coordonnateur', '4 membres']);
  });

  it('un fondateur ajoute une commune rattachée à une région', async () => {
    await open();
    button('Ajouter une localité').click();
    await settle();
    fill('name', 'Thiaroye');
    fill('kind', 'commune');
    await settle();
    const parents = Array.from(root.querySelectorAll('select[name="parent"] option')).map((o) => o.textContent?.trim());
    expect(parents).toEqual(['Choisir une région', 'Sénégal › Dakar', 'Sénégal › Thiès']);
    fill('parent', '2');
    await submit();
    const request = http.expectOne((req) => req.url === URL && req.method === 'POST');
    expect(request.request.body).toEqual({ name: 'Thiaroye', kind: 'commune', parent: 2, is_active: true });
    request.flush(usage({ id: 9, name: 'Thiaroye', kind: 'commune', path: 'Sénégal › Dakar › Thiaroye', parent: 2 }));
    await settle();
    http.expectOne(URL).flush(LIST);
    await settle();
    expect(root.textContent).toContain('Localité ajoutée : Thiaroye.');
  });

  it('refuse d’envoyer une commune sans région', async () => {
    await open();
    button('Ajouter une localité').click();
    await settle();
    fill('name', 'Isolée');
    await submit();
    expect(root.textContent).toContain('Choisissez une région.');
    http.expectNone((req) => req.method === 'POST');
  });

  it('un fondateur renomme et rattache un territoire ailleurs', async () => {
    await open();
    button('Modifier Pikine').click();
    await settle();
    expect((root.querySelector('[name="name"]') as HTMLInputElement).value).toBe('Pikine');
    fill('name', 'Pikine Est');
    fill('parent', '4');
    await submit();
    const request = http.expectOne(`${URL}3/`);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ name: 'Pikine Est', kind: 'commune', parent: 4, is_active: true });
    request.flush(usage({ id: 3, name: 'Pikine Est', kind: 'commune', path: 'Sénégal › Thiès › Pikine Est', parent: 4 }));
    await settle();
    http.expectOne(URL).flush(LIST);
    await settle();
  });

  it('affiche le refus du serveur sur le bon champ', async () => {
    await open();
    button('Ajouter une localité').click();
    await settle();
    fill('name', 'Pikine');
    fill('parent', '2');
    await submit();
    http
      .expectOne((req) => req.method === 'POST')
      .flush({ name: ['Un territoire porte déjà ce nom à cet endroit.'] }, { status: 400, statusText: 'Bad Request' });
    await settle();
    expect(root.querySelector('.field-error')?.textContent).toContain('Un territoire porte déjà ce nom à cet endroit.');
  });

  it('un territoire contenant des membres ne peut pas être supprimé', async () => {
    await open();
    expect(button('Supprimer Pikine').disabled).toBe(true);
    expect(button('Supprimer Pikine').title).toContain('désactivez-la plutôt');
    expect(button('Supprimer Dakar').disabled).toBe(true);
    expect(button('Supprimer Thiès').disabled).toBe(false);
  });

  it('un territoire vide se supprime après confirmation, et le refus du serveur est affiché', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await open();
    button('Supprimer Thiès').click();
    http.expectNone((req) => req.method === 'DELETE');

    confirm.mockReturnValue(true);
    button('Supprimer Thiès').click();
    const refused = http.expectOne(`${URL}4/`);
    expect(refused.request.method).toBe('DELETE');
    refused.flush(
      { detail: 'Thiès ne peut pas être supprimé : des membres y sont rattachés. Désactivez-le plutôt.' },
      { status: 409, statusText: 'Conflict' },
    );
    await settle();
    expect(root.textContent).toContain('des membres y sont rattachés');

    button('Supprimer Thiès').click();
    http.expectOne(`${URL}4/`).flush(null, { status: 204, statusText: 'No Content' });
    await settle();
    http.expectOne(URL).flush(LIST.filter((item) => item.id !== 4));
    await settle();
    expect(root.textContent).toContain('Localité supprimée : Thiès.');
  });

  it('filtre la liste par nom, sans tenir compte des accents, et par type', async () => {
    await open();
    const names = () => Array.from(root.querySelectorAll('tbody tr strong')).map((cell) => cell.textContent?.trim());
    fill('Rechercher une localité', 'thies');
    await settle();
    expect(names()).toEqual(['Thiès']);
    button('Réinitialiser').click();
    await settle();
    expect(names()).toHaveLength(4);
    fill('Filtrer par type', 'region');
    await settle();
    expect(names()).toEqual(['Dakar', 'Thiès']);
    expect(root.textContent).toContain('2 localités');
  });

  it('un coordonnateur consulte son périmètre sans pouvoir le modifier', async () => {
    await open(TEST_COORDINATOR, LIST.slice(2));
    expect(root.textContent).toContain('Pikine');
    expect(button('Ajouter une localité')).toBeUndefined();
    expect(button('Modifier Pikine')).toBeUndefined();
    expect(button('Supprimer Pikine')).toBeUndefined();
  });
});
