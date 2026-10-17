import { Component, ElementRef, Injector, OnInit, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { readProblem } from '../core/api-problem';
import { AuthService } from '../core/auth.service';
import { ManagedTerritory, TerritoryService, TerritoryUsage } from '../core/territories.service';
import { UiIcon } from '../shared/ui-icon';

type Kind = ManagedTerritory['kind'];

const KINDS: { value: Kind; label: string; plural: string }[] = [
  { value: 'pays', label: 'Pays', plural: 'Pays' },
  { value: 'region', label: 'Région', plural: 'Régions' },
  { value: 'commune', label: 'Commune', plural: 'Communes' },
];
/** Type du territoire auquel chaque type se rattache : une commune à une région, une région à un pays. */
const PARENT_KIND: Record<Kind, Kind | null> = { pays: null, region: 'pays', commune: 'region' };

/** Comparaison sans accents ni majuscules : « thies » trouve « Thiès ». */
function folded(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Gestion des localités (D7) : les fondateurs ajoutent, renomment, rattachent, désactivent ou suppriment. */
@Component({
  selector: 'app-territories-manager',
  imports: [FormsModule, UiIcon],
  template: `
    <section class="dashboard-summary" aria-label="Totaux">
      <div>
        <strong>{{ count('region') }}</strong>
        <span>{{ count('region') > 1 ? 'régions' : 'région' }}</span>
      </div>
      <div>
        <strong>{{ count('commune') }}</strong>
        <span>{{ count('commune') > 1 ? 'communes' : 'commune' }}</span>
      </div>
      <div>
        <strong>{{ totals().coordinators }}</strong>
        <span>{{ totals().coordinators > 1 ? 'coordonnateurs' : 'coordonnateur' }}</span>
      </div>
      <div>
        <strong>{{ totals().members }}</strong>
        <span>{{ totals().members > 1 ? 'membres' : 'membre' }}</span>
      </div>
    </section>

    @if (formOpen()) {
      <form #territoryForm class="workspace-form panel admin-form territory-form" (submit)="save($event)" novalidate>
        <h2>{{ editing() ? 'Modifier ' + editing()!.name : 'Ajouter une localité' }}</h2>
        @if (formError()) {
          <p class="inline-error" role="alert">{{ formError() }}</p>
        }
        <div class="field-grid">
          <label
            >Nom
            <input name="name" maxlength="100" [ngModel]="name()" (ngModelChange)="name.set($event)" />
            @if (fieldErrors()['name']; as message) {
              <small class="field-error" role="alert">{{ message }}</small>
            }
          </label>
          <label
            >Type
            <select name="kind" [ngModel]="kind()" (ngModelChange)="chooseKind($event)">
              @for (item of kinds; track item.value) {
                <option [value]="item.value">{{ item.label }}</option>
              }
            </select>
            @if (fieldErrors()['kind']; as message) {
              <small class="field-error" role="alert">{{ message }}</small>
            }
          </label>
        </div>
        @if (parentKind()) {
          <label
            >Rattachée à
            <select name="parent" [ngModel]="parent()" (ngModelChange)="parent.set($event)">
              <option value="">Choisir {{ parentKind() === 'pays' ? 'un pays' : 'une région' }}</option>
              @for (option of parentOptions(); track option.id) {
                <option [value]="option.id">{{ option.path }}</option>
              }
            </select>
            @if (fieldErrors()['parent']; as message) {
              <small class="field-error" role="alert">{{ message }}</small>
            }
          </label>
        }
        <label class="enrollment-consent"
          ><input type="checkbox" name="is_active" [ngModel]="active()" (ngModelChange)="active.set($event)" /><span
            >Proposée dans les formulaires (active)</span
          ></label
        >
        <div class="form-actions">
          <button class="btn btn-outline" type="button" (click)="closeForm()">Annuler</button>
          <button class="btn btn-green" type="submit" [disabled]="busy()">
            {{ editing() ? 'Enregistrer' : 'Ajouter' }}
          </button>
        </div>
      </form>
    }

    @if (error()) {
      <p class="form-error" role="alert">{{ error() }}</p>
    }
    @if (notice()) {
      <p class="inline-success" role="status">{{ notice() }}</p>
    }

    <div class="filter-bar">
      <label
        ><input
          aria-label="Rechercher une localité"
          placeholder="Rechercher une localité…"
          [ngModel]="search()"
          (ngModelChange)="search.set($event)"
      /></label>
      <select aria-label="Filtrer par type" [ngModel]="kindFilter()" (ngModelChange)="kindFilter.set($event)">
        <option value="">Tous les types</option>
        @for (item of kinds; track item.value) {
          <option [value]="item.value">{{ item.plural }}</option>
        }
      </select>
      <select aria-label="Filtrer par état" [ngModel]="stateFilter()" (ngModelChange)="stateFilter.set($event)">
        <option value="">Tous les états</option>
        <option value="active">Actives</option>
        <option value="inactive">Inactives</option>
      </select>
      @if (canEdit()) {
        <button type="button" aria-label="Ajouter une localité" (click)="openForm(null)">
          <ui-icon name="plus" /><span>Ajouter une localité</span>
        </button>
      }
      <button class="filter-reset" type="button" aria-label="Réinitialiser" (click)="resetFilters()">
        <ui-icon name="close" /><span>Réinitialiser</span>
      </button>
    </div>

    <div class="table-wrap responsive-table">
      <table>
        <thead>
          <tr>
            <th>Localité</th>
            <th>Type</th>
            <th>Coordonnateurs</th>
            <th>Membres</th>
            <th>Programmes</th>
            <th>État</th>
            @if (canEdit()) {
              <th><span class="sr-only">Actions</span></th>
            }
          </tr>
        </thead>
        <tbody>
          @for (item of shown(); track item.id) {
            <tr>
              <td>
                <strong>{{ item.name }}</strong>
                @if (item.path !== item.name) {
                  <br /><small>{{ item.path }}</small>
                }
              </td>
              <td data-label="Type">{{ item.kind_label }}</td>
              <td data-label="Coordonnateurs">{{ item.coordinators_count }}</td>
              <td data-label="Membres">{{ item.members_count }}</td>
              <td data-label="Programmes">{{ item.programs_count }}</td>
              <td data-label="État">
                <span class="badge" [class.success]="item.is_active" [class.warning]="!item.is_active">{{
                  item.is_active ? 'Active' : 'Inactive'
                }}</span>
              </td>
              @if (canEdit()) {
                <td class="row-actions">
                  <button
                    class="row-action"
                    type="button"
                    [attr.aria-label]="'Modifier ' + item.name"
                    (click)="openForm(item)"
                  >
                    Modifier</button
                  ><button
                    class="row-action"
                    type="button"
                    [attr.aria-label]="'Supprimer ' + item.name"
                    [disabled]="!item.deletable"
                    [title]="item.deletable ? '' : 'Cette localité n’est pas vide : désactivez-la plutôt.'"
                    (click)="remove(item)"
                  >
                    Supprimer
                  </button>
                </td>
              }
            </tr>
          }
        </tbody>
      </table>
      @if (!loading() && !shown().length) {
        <p class="audit-empty">
          {{ territories().length ? 'Aucune localité ne correspond à ces filtres.' : 'Aucune localité dans votre périmètre.' }}
        </p>
      }
      <footer class="table-footer">
        @if (loading()) {
          <span>Chargement…</span>
        } @else {
          <span>{{ shown().length }} {{ shown().length > 1 ? 'localités' : 'localité' }}</span>
        }
      </footer>
    </div>
  `,
})
export class TerritoriesManager implements OnInit {
  private readonly service = inject(TerritoryService);
  private readonly auth = inject(AuthService);
  private readonly injector = inject(Injector);
  private readonly formElement = viewChild<ElementRef<HTMLFormElement>>('territoryForm');
  protected readonly kinds = KINDS;
  protected readonly canEdit = this.auth.isFounder;

  protected readonly territories = signal<TerritoryUsage[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly notice = signal('');

  protected readonly search = signal('');
  protected readonly kindFilter = signal<Kind | ''>('');
  protected readonly stateFilter = signal<'' | 'active' | 'inactive'>('');

  protected readonly formOpen = signal(false);
  protected readonly editing = signal<TerritoryUsage | null>(null);
  protected readonly name = signal('');
  protected readonly kind = signal<Kind>('commune');
  protected readonly parent = signal<string>('');
  protected readonly active = signal(true);
  protected readonly busy = signal(false);
  protected readonly formError = signal('');
  protected readonly fieldErrors = signal<Record<string, string>>({});

  protected readonly parentKind = computed(() => PARENT_KIND[this.kind()]);
  protected readonly parentOptions = computed(() =>
    this.territories().filter((item) => item.kind === this.parentKind() && item.id !== this.editing()?.id),
  );

  /** Effectifs du périmètre : chaque personne est rattachée à une seule localité, la somme ne compte personne deux fois. */
  protected readonly totals = computed(() => {
    const rows = this.territories();
    return {
      members: rows.reduce((sum, row) => sum + row.members_count, 0),
      coordinators: rows.reduce((sum, row) => sum + row.coordinators_count, 0),
    };
  });

  protected readonly shown = computed(() => {
    const words = folded(this.search().trim());
    const kind = this.kindFilter();
    const state = this.stateFilter();
    return this.territories().filter(
      (item) =>
        (!words || folded(item.path).includes(words)) &&
        (!kind || item.kind === kind) &&
        (!state || item.is_active === (state === 'active')),
    );
  });

  ngOnInit(): void {
    void this.load();
  }

  protected count(kind: Kind): number {
    return this.territories().filter((item) => item.kind === kind).length;
  }

  protected resetFilters(): void {
    this.search.set('');
    this.kindFilter.set('');
    this.stateFilter.set('');
  }

  protected openForm(item: TerritoryUsage | null): void {
    this.editing.set(item);
    this.name.set(item?.name ?? '');
    this.kind.set(item?.kind ?? 'commune');
    this.parent.set(item?.parent ? String(item.parent) : '');
    this.active.set(item?.is_active ?? true);
    this.formError.set('');
    this.fieldErrors.set({});
    this.notice.set('');
    this.formOpen.set(true);
    // Le formulaire s'ouvre en haut de la liste : on l'amène à l'écran, même depuis la dernière ligne.
    afterNextRender(() => this.formElement()?.nativeElement.scrollIntoView?.({ block: 'start', behavior: 'smooth' }), {
      injector: this.injector,
    });
  }

  protected closeForm(): void {
    this.formOpen.set(false);
    this.editing.set(null);
  }

  protected chooseKind(kind: Kind): void {
    this.kind.set(kind);
    // Le rattachement précédent n'a plus de sens pour un autre type.
    if (!this.parentOptions().some((option) => String(option.id) === this.parent())) this.parent.set('');
  }

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    if (this.busy()) return;
    const input = {
      name: this.name().trim(),
      kind: this.kind(),
      parent: this.parentKind() && this.parent() ? Number(this.parent()) : null,
      is_active: this.active(),
    };
    const fields: Record<string, string> = {};
    if (!input.name) fields['name'] = 'Indiquez le nom de la localité.';
    if (this.parentKind() && input.parent === null)
      fields['parent'] = this.parentKind() === 'pays' ? 'Choisissez un pays.' : 'Choisissez une région.';
    this.fieldErrors.set(fields);
    if (Object.keys(fields).length) {
      this.formError.set('Certains champs sont à corriger.');
      return;
    }
    this.busy.set(true);
    this.formError.set('');
    const current = this.editing();
    try {
      const saved = current ? await this.service.update(current.id, input) : await this.service.create(input);
      this.closeForm();
      this.notice.set(current ? `Modifications enregistrées pour ${saved.name}.` : `Localité ajoutée : ${saved.name}.`);
      await this.load();
    } catch (error) {
      const problem = readProblem(error);
      this.formError.set(problem.message);
      this.fieldErrors.set(problem.fields);
    } finally {
      this.busy.set(false);
    }
  }

  protected async remove(item: TerritoryUsage): Promise<void> {
    if (!window.confirm(`Supprimer définitivement ${item.name} ?`)) return;
    this.error.set('');
    this.notice.set('');
    try {
      await this.service.remove(item.id);
      this.notice.set(`Localité supprimée : ${item.name}.`);
      await this.load();
    } catch (error) {
      this.error.set(readProblem(error).message);
    }
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.territories.set(await this.service.usage());
      this.error.set('');
    } catch (error) {
      this.error.set(readProblem(error).message);
    } finally {
      this.loading.set(false);
    }
  }
}
