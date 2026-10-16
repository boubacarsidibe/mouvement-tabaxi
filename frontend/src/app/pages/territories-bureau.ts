import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { readProblem } from '../core/api-problem';
import { AuthService } from '../core/auth.service';
import { ManagedTerritory, TerritoryService, TerritoryUsage } from '../core/territories.service';
import { UiIcon } from '../shared/ui-icon';

type Kind = ManagedTerritory['kind'];

const KINDS: { value: Kind; label: string }[] = [
  { value: 'pays', label: 'Pays' },
  { value: 'region', label: 'Région' },
  { value: 'commune', label: 'Commune' },
];
/** Type du territoire auquel chaque type se rattache : une commune à une région, une région à un pays. */
const PARENT_KIND: Record<Kind, Kind | null> = { pays: null, region: 'pays', commune: 'region' };

/** Gestion des territoires (D7) : les fondateurs ajoutent, renomment, rattachent, désactivent ou suppriment. */
@Component({
  selector: 'app-territories-manager',
  imports: [FormsModule, UiIcon],
  template: `
    <section class="territory-summary stat-grid">
      <article>
        <ui-icon name="location" /><strong>{{ count('pays') }}</strong>
        <p>Pays</p>
      </article>
      <article>
        <ui-icon name="location" /><strong>{{ count('region') }}</strong>
        <p>Régions</p>
      </article>
      <article>
        <ui-icon name="location" /><strong>{{ count('commune') }}</strong>
        <p>Communes</p>
      </article>
    </section>

    @if (canEdit()) {
      @if (formOpen()) {
        <form class="workspace-form panel admin-form" (submit)="save($event)" novalidate>
          <h2>{{ editing() ? 'Modifier ' + editing()!.name : 'Ajouter un territoire' }}</h2>
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
              >Rattaché à
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
            ><input
              type="checkbox"
              name="is_active"
              [ngModel]="active()"
              (ngModelChange)="active.set($event)"
            /><span>Proposé dans les formulaires (actif)</span></label
          >
          <div class="form-actions">
            <button class="btn btn-outline" type="button" (click)="closeForm()">Annuler</button>
            <button class="btn btn-green" type="submit" [disabled]="busy()">
              {{ editing() ? 'Enregistrer' : 'Ajouter' }}
            </button>
          </div>
        </form>
      } @else {
        <p>
          <button class="btn btn-green" type="button" (click)="openForm(null)">
            <ui-icon name="plus" />Ajouter un territoire
          </button>
        </p>
      }
    }

    @if (error()) {
      <p class="form-error" role="alert">{{ error() }}</p>
    }
    @if (notice()) {
      <p class="inline-success" role="status">{{ notice() }}</p>
    }

    <div class="table-wrap responsive-table">
      <table>
        <thead>
          <tr>
            <th>Territoire</th>
            <th>Type</th>
            <th>Membres</th>
            <th>Programmes</th>
            <th>État</th>
            @if (canEdit()) {
              <th>Actions</th>
            }
          </tr>
        </thead>
        <tbody>
          @for (item of territories(); track item.id) {
            <tr>
              <td>
                <strong>{{ item.name }}</strong><br /><small>{{ item.path }}</small>
              </td>
              <td data-label="Type">{{ item.kind_label }}</td>
              <td data-label="Membres">{{ item.members_count }}</td>
              <td data-label="Programmes">{{ item.programs_count }}</td>
              <td data-label="État">
                <span class="badge" [class.success]="item.is_active" [class.warning]="!item.is_active">{{
                  item.is_active ? 'Actif' : 'Inactif'
                }}</span>
              </td>
              @if (canEdit()) {
                <td>
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
                    [disabled]="!removable(item)"
                    [title]="removable(item) ? '' : 'Ce territoire n’est pas vide : désactivez-le plutôt.'"
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
      @if (!loading() && !territories().length) {
        <p class="audit-empty">Aucun territoire dans votre périmètre.</p>
      }
      <footer class="table-footer">
        @if (loading()) {
          <span>Chargement…</span>
        } @else {
          <span>{{ territories().length }} territoire(s)</span>
        }
      </footer>
    </div>
  `,
})
export class TerritoriesManager implements OnInit {
  private readonly service = inject(TerritoryService);
  private readonly auth = inject(AuthService);
  protected readonly kinds = KINDS;
  protected readonly canEdit = this.auth.isFounder;

  protected readonly territories = signal<TerritoryUsage[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly notice = signal('');

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

  ngOnInit(): void {
    void this.load();
  }

  protected count(kind: Kind): number {
    return this.territories().filter((item) => item.kind === kind).length;
  }

  protected removable(item: TerritoryUsage): boolean {
    return !item.members_count && !item.programs_count && !item.children_count;
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
    if (!input.name) fields['name'] = 'Indiquez le nom du territoire.';
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
      this.notice.set(current ? `${saved.name} a été enregistré.` : `${saved.name} a été ajouté.`);
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
      this.notice.set(`${item.name} a été supprimé.`);
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
