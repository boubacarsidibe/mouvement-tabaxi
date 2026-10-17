import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { UiIcon } from '../shared/ui-icon';
import { readProblem } from '../core/api-problem';
import { AuthService } from '../core/auth.service';
import {
  ListedMember,
  MemberFilters,
  MemberOrdering,
  MemberPage,
  MemberRecord,
  MemberStatus,
  MembersService,
} from '../core/members.service';
import { TerritoryService, territoryChoices } from '../core/territories.service';
import { ExportButton } from '../shared/export-button';

const STATUSES: { value: MemberStatus | ''; label: string }[] = [
  { value: '', label: 'Tous les statuts' },
  { value: 'actif', label: 'Actif' },
  { value: 'suspendu', label: 'Suspendu' },
  { value: 'radie', label: 'Radié' },
];

function badgeClass(status: MemberStatus) {
  return {
    success: status === 'actif',
    warning: status === 'suspendu',
    danger: status === 'radie',
  };
}

type SortKey = 'name' | 'place' | 'date';

/** Quelle base afficher : les membres simples, le bureau exécutif, ou les comptes d'accès (le bureau avec les courriels). */
export type MembersListKind = 'members' | 'bureau' | 'accounts';

const BUREAU_ROLES = 'coordonnateur,fondateur';
const FUNCTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Toutes les fonctions' },
  { value: 'coordonnateur', label: 'Coordonnateur' },
  { value: 'fondateur', label: 'Membre fondateur' },
];
const BAD_PERIOD = 'La date de fin doit être égale ou postérieure à la date de début.';

/** Message le plus utile d'une erreur de l'API : celui du premier champ en cause, sinon le message général. */
function messageOf(error: unknown): string {
  const problem = readProblem(error);
  return Object.values(problem.fields)[0] ?? problem.message;
}

/**
 * Base des membres ou du bureau : recherche par nom, filtres par territoire, statut et date
 * d'adhésion, tri, pages de 20. Ce que voit la personne est limité à son territoire par le serveur.
 */
@Component({
  selector: 'app-members-list',
  imports: [FormsModule, RouterLink, DatePipe, ExportButton, UiIcon],
  template: `
    <div class="filter-bar filter-bar-wide">
      <label
        ><input
          [attr.aria-label]="kind() === 'members' ? 'Rechercher un membre' : 'Rechercher un coordonnateur'"
          placeholder="Rechercher un nom, un courriel, un numéro…"
          [ngModel]="search()"
          (ngModelChange)="search.set($event)"
          (keydown.enter)="reload()"
      /></label>
      @if (territoryOptions().length) {
        <select
          aria-label="Filtrer par localité"
          [ngModel]="territory()"
          (ngModelChange)="territory.set($event); reload()"
        >
          <option value="">Toutes les localités</option>
          @for (option of territoryOptions(); track option.id) {
            <option [value]="option.id">{{ option.label }}</option>
          }
        </select>
      }
      @if (kind() !== 'members') {
        <select
          aria-label="Filtrer par fonction"
          [ngModel]="role()"
          (ngModelChange)="role.set($event); reload()"
        >
          @for (item of functions; track item.value) {
            <option [value]="item.value">{{ item.label }}</option>
          }
        </select>
      }
      <select
        aria-label="Filtrer par statut"
        [ngModel]="status()"
        (ngModelChange)="status.set($event); reload()"
      >
        @for (item of statuses; track item.value) {
          <option [value]="item.value">{{ item.label }}</option>
        }
      </select>
      <label class="date-filter"
        ><span><span class="date-word">{{ kind() === 'members' ? 'Adhésion' : 'Entrée' }} </span>du</span
        ><input
          type="date"
          name="joined_from"
          aria-label="Date de début"
          [ngModel]="from()"
          (ngModelChange)="from.set($event); reload()"
      /></label>
      <label class="date-filter"
        ><span>au</span
        ><input
          type="date"
          name="joined_to"
          aria-label="Date de fin"
          [ngModel]="to()"
          (ngModelChange)="to.set($event); reload()"
      /></label>
      <button type="button" (click)="reload()" aria-label="Rechercher"><ui-icon name="search" /><span>Rechercher</span></button>
      <button type="button" (click)="reset()" aria-label="Réinitialiser"><ui-icon name="close" /><span>Réinitialiser</span></button>
    </div>
    @if (error()) {
      <p class="form-error" role="alert">{{ error() }}</p>
    }
    <div class="table-wrap responsive-table">
      <table>
        <thead>
          <tr>
            <th [attr.aria-sort]="ariaSort('name')">
              <button class="th-sort" type="button" (click)="sortBy('name')">
                Nom complet <span aria-hidden="true">{{ sortIndicator('name') }}</span>
              </button>
            </th>
            @if (kind() === 'members') {
              <th>N° d’adhérent</th>
            } @else {
              @if (kind() === 'accounts') {
                <th>Courriel</th>
              }
              <th>Fonction</th>
            }
            <th [attr.aria-sort]="ariaSort('place')">
              <button class="th-sort" type="button" (click)="sortBy('place')">
                Localité <span aria-hidden="true">{{ sortIndicator('place') }}</span>
              </button>
            </th>
            <th [attr.aria-sort]="ariaSort('date')">
              <button class="th-sort" type="button" (click)="sortBy('date')">
                {{ kind() === 'members' ? 'Date d’adhésion' : 'Date d’entrée' }}
                <span aria-hidden="true">{{ sortIndicator('date') }}</span>
              </button>
            </th>
            <th>Statut</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          @for (item of page()?.results ?? []; track item.id) {
            <tr>
              <td>
                <strong>{{ item.first_name }} {{ item.last_name }}</strong>
              </td>
              @if (kind() === 'members') {
                <td data-label="N° d’adhérent">{{ item.number }}</td>
              } @else {
                @if (kind() === 'accounts') {
                  <td data-label="Courriel">{{ item.email }}</td>
                }
                <td data-label="Fonction">{{ item.role_label }}</td>
              }
              <td data-label="Localité">{{ item.territory?.name ?? 'Tous les territoires' }}</td>
              <td data-label="Date">{{ item.joined_on | date: 'dd/MM/yyyy' }}</td>
              <td data-label="Statut">
                <span
                  class="badge"
                  [class.success]="cls(item).success"
                  [class.warning]="cls(item).warning"
                  [class.danger]="cls(item).danger"
                  >{{ item.status_label }}</span
                >
              </td>
              <td>
                <a
                  class="row-action"
                  [routerLink]="['/bureau/membres', item.id]"
                  [attr.aria-label]="'Voir la fiche de ' + item.first_name + ' ' + item.last_name"
                  >Voir</a
                >
              </td>
            </tr>
          }
        </tbody>
      </table>
      <footer class="table-footer">
        @if (loading()) {
          <span>Chargement…</span>
        } @else {
          <span>{{ page()?.count ?? 0 }} résultat(s)</span>
        }
        <app-export-button [run]="exportRun" />
        @if (page()?.previous || page()?.next) {
          <span>
            <button type="button" [disabled]="!page()?.previous" (click)="go(-1)">Précédent</button>
            <button type="button" [disabled]="!page()?.next" (click)="go(1)">Suivant</button>
          </span>
        }
      </footer>
    </div>
  `,
})
export class MembersList implements OnInit {
  private readonly members = inject(MembersService);
  private readonly territories = inject(TerritoryService);
  readonly kind = input<MembersListKind>('members');
  protected readonly statuses = STATUSES;
  protected readonly functions = FUNCTIONS;
  protected readonly status = signal<MemberStatus | ''>('');
  protected readonly search = signal('');
  protected readonly territory = signal('');
  protected readonly role = signal('');
  protected readonly from = signal('');
  protected readonly to = signal('');
  protected readonly ordering = signal<MemberOrdering>('-date');
  protected readonly page = signal<MemberPage | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly territoryOptions = signal<{ id: number; label: string }[]>([]);
  private current = 1;
  /** Filtres de la liste affichée : l'export les reprend tels quels, pas ceux d'une saisie pas encore validée. */
  private applied: MemberFilters = {};
  protected readonly exportRun = () => this.members.exportList(this.applied);

  ngOnInit() {
    void this.loadTerritories();
    void this.load();
  }

  protected cls(item: ListedMember) {
    return badgeClass(item.status);
  }

  protected reload() {
    this.current = 1;
    void this.load();
  }

  protected reset() {
    this.status.set('');
    this.search.set('');
    this.territory.set('');
    this.role.set('');
    this.from.set('');
    this.to.set('');
    this.ordering.set('-date');
    this.reload();
  }

  protected go(step: number) {
    this.current += step;
    void this.load();
  }

  /** Un premier clic trie en ordre croissant (les dates : les plus récentes d'abord), un second inverse. */
  protected sortBy(key: SortKey) {
    const current = this.ordering();
    if (current === key || current === `-${key}`) {
      this.ordering.set(current.startsWith('-') ? key : (`-${key}` as MemberOrdering));
    } else {
      this.ordering.set(key === 'date' ? '-date' : key);
    }
    this.reload();
  }

  protected sortIndicator(key: SortKey): string {
    const current = this.ordering();
    if (current !== key && current !== `-${key}`) return '↕';
    return current.startsWith('-') ? '↓' : '↑';
  }

  protected ariaSort(key: SortKey): string | null {
    const current = this.ordering();
    if (current !== key && current !== `-${key}`) return null;
    return current.startsWith('-') ? 'descending' : 'ascending';
  }

  /** Territoires du périmètre, présentés en arbre par un retrait : les communes sous leur région. */
  private async loadTerritories() {
    try {
      this.territoryOptions.set(territoryChoices(await this.territories.managed()));
    } catch {
      this.territoryOptions.set([]); // sans la liste, on filtre quand même par nom, statut et date
    }
  }

  private async load() {
    if (this.from() && this.to() && this.to() < this.from()) {
      this.error.set(BAD_PERIOD);
      return;
    }
    this.loading.set(true);
    this.error.set('');
    const filters: MemberFilters = {
      role: this.kind() === 'members' ? undefined : this.role() || BUREAU_ROLES,
      status: this.status(),
      territory: this.territory() ? Number(this.territory()) : '',
      joined_from: this.from(),
      joined_to: this.to(),
      search: this.search(),
      ordering: this.ordering(),
    };
    try {
      this.page.set(await this.members.list({ ...filters, page: this.current }));
      this.applied = filters;
    } catch (error) {
      this.error.set(messageOf(error));
    } finally {
      this.loading.set(false);
    }
  }
}

const CHANGED: Record<MemberStatus, string> = {
  actif: 'Le compte est de nouveau actif : la personne peut se connecter.',
  suspendu: 'Membre suspendu : le compte ne peut plus se connecter. L’historique est conservé.',
  radie: 'Membre radié : le compte ne peut plus se connecter. L’historique est conservé.',
};

const REASON_REQUIRED: Partial<Record<MemberStatus, string>> = {
  suspendu: 'Indiquez le motif de la suspension.',
  radie: 'Indiquez le motif de la radiation.',
};

/** Fiche d'un membre : coordonnées, statut du compte et, pour qui en a le droit, le changement de statut. */
@Component({
  selector: 'app-member-detail',
  imports: [FormsModule, DatePipe],
  template: `
    @if (error() && !member()) {
      <p class="form-error" role="alert">{{ error() }}</p>
    }
    @if (member(); as person) {
      <section class="review-grid member-detail-grid" [class.single]="!canManage()">
        <article class="panel member-record">
          <div class="identity-row">
            @if (person.photo_url) {
              <img [src]="person.photo_url" [alt]="'Photo de ' + person.first_name + ' ' + person.last_name" />
            } @else {
              <span class="identity-avatar">{{ person.first_name.charAt(0) }}{{ person.last_name.charAt(0) }}</span>
            }
            <div>
              <p class="eyebrow">{{ person.number }}</p>
              <h2>{{ person.first_name }} {{ person.last_name }}</h2>
              <p>{{ person.role_label }}{{ person.territory ? ' · ' + person.territory.name : '' }}</p>
            </div>
            <span
              class="badge"
              [class.success]="cls().success"
              [class.warning]="cls().warning"
              [class.danger]="cls().danger"
              >{{ person.status_label }}</span
            >
          </div>
          <dl class="detail-list">
            <div>
              <dt>Courriel</dt>
              <dd>{{ person.email }}</dd>
            </div>
            <div>
              <dt>Téléphone</dt>
              <dd>{{ person.phone || 'Non renseigné' }}</dd>
            </div>
            <div>
              <dt>Adresse</dt>
              <dd>{{ person.address || 'Non renseignée' }}</dd>
            </div>
            <div>
              <dt>Territoire</dt>
              <dd>{{ person.territory?.path }}</dd>
            </div>
            <div>
              <dt>{{ isBureauFile() ? 'Date d’entrée' : 'Date d’adhésion' }}</dt>
              <dd>{{ person.joined_on | date: 'dd/MM/yyyy' }}</dd>
            </div>
          </dl>
          @if (person.status_history; as history) {
            <h3>Historique du statut</h3>
            @for (change of history; track change.id) {
              <div class="history-row">
                <span
                  ><strong>{{ change.from_status_label }} → {{ change.to_status_label }}</strong
                  ><small
                    >{{ change.changed_at | date: 'dd/MM/yyyy à HH:mm' }}
                    @if (change.changed_by; as author) {
                      · par {{ author.first_name }} {{ author.last_name }}
                    }</small
                  >
                  @if (change.reason) {
                    <small>Motif : {{ change.reason }}</small>
                  }
                </span>
              </div>
            } @empty {
              <p class="history-empty">Aucun changement de statut depuis l’adhésion.</p>
            }
          }
        </article>
        @if (canManage()) {
        <aside class="panel decision-panel">
          <h2>Gérer l’accès</h2>
            <p>
              Une suspension ou une radiation bloque immédiatement la connexion sans effacer
              l’historique.
            </p>
            @if (target(); as next) {
              <label
                >Motif {{ next === 'radie' ? 'de la radiation' : 'de la suspension' }}
                <textarea
                  rows="4"
                  name="reason"
                  [ngModel]="reason()"
                  (ngModelChange)="reason.set($event)"
                ></textarea>
              </label>
              @if (error()) {
                <p class="form-error" role="alert">{{ error() }}</p>
              }
              <button
                class="btn btn-danger-outline btn-wide"
                type="button"
                [disabled]="busy()"
                (click)="apply(next)"
              >
                Confirmer {{ next === 'radie' ? 'la radiation' : 'la suspension' }}
              </button>
              <button class="btn btn-wide" type="button" (click)="cancel()">Annuler</button>
            } @else {
              @if (error()) {
                <p class="form-error" role="alert">{{ error() }}</p>
              }
              @if (person.status !== 'actif') {
                <button
                  class="btn btn-outline btn-wide"
                  type="button"
                  [disabled]="busy()"
                  (click)="apply('actif')"
                >
                  Rendre actif
                </button>
              }
              @if (person.status !== 'suspendu') {
                <button class="btn btn-gold-outline btn-wide" type="button" (click)="ask('suspendu')">
                  Suspendre
                </button>
              }
              @if (person.status !== 'radie') {
                <button class="btn btn-danger-outline btn-wide" type="button" (click)="ask('radie')">
                  Radier
                </button>
              }
            }
          @if (done()) {
            <p class="inline-success" role="status">✓ {{ done() }}</p>
          }
        </aside>
        }
      </section>
    }
  `,
})
export class MemberDetail implements OnInit {
  private readonly members = inject(MembersService);
  private readonly route = inject(ActivatedRoute);
  protected readonly auth = inject(AuthService);
  protected readonly member = signal<MemberRecord | null>(null);
  /** Statut en cours de saisie du motif (suspension ou radiation), `null` sinon. */
  protected readonly target = signal<MemberStatus | null>(null);
  protected readonly reason = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly done = signal('');
  protected readonly cls = computed(() => badgeClass(this.member()?.status ?? 'actif'));
  protected readonly isBureauFile = computed(() => {
    const role = this.member()?.role;
    return role === 'coordonnateur' || role === 'fondateur';
  });
  protected readonly isSelf = computed(
    () => !!this.member() && this.member()?.email === this.auth.user()?.email,
  );
  /** « Gérer l'accès » : le serveur dit qui peut agir (fondateur, ou coordonnateur pour un membre simple de sa zone). */
  protected readonly canManage = computed(() => !!this.member()?.can_change_status && !this.isSelf());

  async ngOnInit() {
    try {
      this.member.set(await this.members.get(Number(this.route.snapshot.paramMap.get('id'))));
    } catch (error) {
      const problem = readProblem(error);
      this.error.set(
        problem.status === 404
          ? 'Ce membre est introuvable ou ne fait pas partie de votre territoire.'
          : problem.message,
      );
    }
  }

  protected ask(status: MemberStatus) {
    this.error.set('');
    this.done.set('');
    this.reason.set('');
    this.target.set(status);
  }

  protected cancel() {
    this.error.set('');
    this.target.set(null);
  }

  protected async apply(status: MemberStatus) {
    const current = this.member();
    if (!current) return;
    const reason = this.reason().trim();
    const required = REASON_REQUIRED[status];
    if (required && !reason) {
      this.error.set(required);
      return;
    }
    this.busy.set(true);
    this.error.set('');
    this.done.set('');
    try {
      this.member.set(await this.members.changeStatus(current.id, status, reason));
      this.target.set(null);
      this.reason.set('');
      this.done.set(CHANGED[status]);
    } catch (error) {
      const problem = readProblem(error);
      this.error.set(problem.fields['reason'] ?? problem.fields['status'] ?? problem.message);
    } finally {
      this.busy.set(false);
    }
  }
}
