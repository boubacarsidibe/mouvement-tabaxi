import { DatePipe } from '@angular/common';
import { Component, Input, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { readProblem } from '../core/api-problem';
import { AuthService } from '../core/auth.service';
import { TerritoryService } from '../core/territories.service';
import {
  ListedMember,
  MemberOrdering,
  MemberPage,
  MemberRecord,
  MemberStatus,
  MembersService,
} from '../core/members.service';

const STATUSES: { value: MemberStatus | ''; label: string }[] = [
  { value: '', label: 'Statut · Tous' },
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

/** Base des membres : recherche par nom, filtre par statut, tri, pages de 20. */
@Component({
  selector: 'app-members-list',
  imports: [FormsModule, RouterLink, DatePipe],
  template: `
    <div class="filter-bar">
      <label
        ><input
          aria-label="Rechercher un membre"
          placeholder="Rechercher un nom, un courriel, un numéro…"
          [ngModel]="search()"
          (ngModelChange)="search.set($event)"
          (keydown.enter)="reload()"
      /></label>
      <select
        aria-label="Filtrer par statut"
        [ngModel]="status()"
        (ngModelChange)="status.set($event); reload()"
      >
        @for (item of statuses; track item.value) {
          <option [value]="item.value">{{ item.label }}</option>
        }
      </select>
      <select
        aria-label="Filtrer par localité"
        [ngModel]="territory()"
        (ngModelChange)="territory.set($event); reload()"
      >
        <option [ngValue]="null">Localité · Toutes</option>
        @for (item of territories(); track item.id) {
          <option [ngValue]="item.id">{{ item.path }}</option>
        }
      </select>
      <label
        >Adhésion du<input
          type="date"
          aria-label="Adhésion à partir du"
          [ngModel]="joinedFrom()"
          (ngModelChange)="joinedFrom.set($event); reload()"
      /></label>
      <label
        >au<input
          type="date"
          aria-label="Adhésion jusqu’au"
          [ngModel]="joinedTo()"
          (ngModelChange)="joinedTo.set($event); reload()"
      /></label>
      <button type="button" (click)="reload()">Rechercher</button>
      <button type="button" (click)="reset()">Réinitialiser</button>
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
            <th>N° d’adhérent</th>
            <th [attr.aria-sort]="ariaSort('place')">
              <button class="th-sort" type="button" (click)="sortBy('place')">
                Localité <span aria-hidden="true">{{ sortIndicator('place') }}</span>
              </button>
            </th>
            <th [attr.aria-sort]="ariaSort('date')">
              <button class="th-sort" type="button" (click)="sortBy('date')">
                Date d’adhésion <span aria-hidden="true">{{ sortIndicator('date') }}</span>
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
              <td data-label="N° d’adhérent">{{ item.number }}</td>
              <td data-label="Localité">{{ item.territory?.name }}</td>
              <td data-label="Adhésion">{{ item.joined_on | date: 'dd/MM/yyyy' }}</td>
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
  private readonly territoryService = inject(TerritoryService);
  /** `membre` pour la base des membres, `coordonnateur` pour celle des coordonnateurs. */
  @Input() role: 'membre' | 'coordonnateur' = 'membre';
  protected readonly statuses = STATUSES;
  protected readonly territory = signal<number | null>(null);
  protected readonly territories = signal<{ id: number; path: string }[]>([]);
  protected readonly joinedFrom = signal('');
  protected readonly joinedTo = signal('');
  protected readonly status = signal<MemberStatus | ''>('');
  protected readonly search = signal('');
  protected readonly ordering = signal<MemberOrdering>('-date');
  protected readonly page = signal<MemberPage | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  private current = 1;

  ngOnInit() {
    void this.load();
    // La liste des localités ne montre que le périmètre de la personne connectée.
    this.territoryService.managed().then(
      (list) => this.territories.set(list),
      () => this.territories.set([]),
    );
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
    this.territory.set(null);
    this.joinedFrom.set('');
    this.joinedTo.set('');
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

  private async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      this.page.set(
        await this.members.list({
          role: this.role,
          territory: this.territory(),
          joinedFrom: this.joinedFrom(),
          joinedTo: this.joinedTo(),
          status: this.status(),
          search: this.search(),
          ordering: this.ordering(),
          page: this.current,
        }),
      );
    } catch (error) {
      this.error.set(readProblem(error).message);
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

/** Fiche d'un membre : coordonnées, statut du compte, et pour les fondateurs le changement de statut. */
@Component({
  selector: 'app-member-detail',
  imports: [FormsModule, RouterLink, DatePipe],
  template: `
    <a class="back-link" routerLink="/bureau/membres">← Retour à la base des membres</a>
    @if (error() && !member()) {
      <p class="form-error" role="alert">{{ error() }}</p>
    }
    @if (member(); as person) {
      <section class="review-grid member-detail-grid">
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
              <dt>Date d’adhésion</dt>
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
        <aside class="panel decision-panel">
          <p class="eyebrow">Statut du compte</p>
          <h2>Gérer l’accès</h2>
          @if (!auth.isFounder()) {
            <p>Seuls les membres fondateurs peuvent changer le statut d’un membre.</p>
          } @else if (isSelf()) {
            <p>Vous ne pouvez pas changer votre propre statut.</p>
          } @else {
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
          }
          @if (done()) {
            <p class="inline-success" role="status">✓ {{ done() }}</p>
          }
        </aside>
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
  protected readonly isSelf = computed(
    () => !!this.member() && this.member()?.email === this.auth.user()?.email,
  );

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
