import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { UiIcon } from '../shared/ui-icon';
import { readProblem } from '../core/api-problem';
import {
  ApplicationFilters,
  ApplicationPage,
  ApplicationStatus,
  ReviewService,
  ReviewedApplication,
} from '../core/review.service';
import { ExportButton } from '../shared/export-button';

const STATUSES: { value: ApplicationStatus | ''; label: string }[] = [
  { value: '', label: 'Tous les statuts' },
  { value: 'a_examiner', label: 'À examiner' },
  { value: 'acceptee', label: 'Acceptée' },
  { value: 'rejetee', label: 'Rejetée' },
  { value: 'inscrite', label: 'Inscrite' },
];

function badgeClass(status: ApplicationStatus) {
  return {
    success: status === 'acceptee' || status === 'inscrite',
    warning: status === 'a_examiner',
    danger: status === 'rejetee',
  };
}

/** Liste des demandes d'adhésion, filtrable par statut et par recherche. */
@Component({
  selector: 'app-requests-list',
  imports: [FormsModule, RouterLink, DatePipe, ExportButton, UiIcon],
  template: `
    <div class="filter-bar">
      <label
        ><input
          aria-label="Rechercher une demande"
          placeholder="Rechercher un nom, un courriel, une référence…"
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
            <th>Nom complet</th>
            <th>Localité</th>
            <th>Profession</th>
            <th>Date de demande</th>
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
              <td data-label="Localité">{{ item.territory.name }}</td>
              <td data-label="Profession">{{ item.profession }}</td>
              <td data-label="Demande">{{ item.created_at | date: 'dd/MM/yyyy' }}</td>
              <td data-label="Statut">
                <span class="badge" [class.success]="cls(item).success"
                  [class.warning]="cls(item).warning" [class.danger]="cls(item).danger">{{
                  item.status_label
                }}</span>
              </td>
              <td>
                <a
                  class="row-action"
                  [routerLink]="['/bureau/demandes', item.id]"
                  [attr.aria-label]="'Examiner la demande de ' + item.first_name + ' ' + item.last_name"
                  >Examiner</a
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
export class RequestsList implements OnInit {
  private readonly review = inject(ReviewService);
  protected readonly statuses = STATUSES;
  protected readonly status = signal<ApplicationStatus | ''>('');
  protected readonly search = signal('');
  protected readonly page = signal<ApplicationPage | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  private current = 1;
  /** Filtres de la liste affichée : l'export les reprend tels quels. */
  private applied: ApplicationFilters = {};
  protected readonly exportRun = () => this.review.exportList(this.applied);

  ngOnInit() {
    void this.load();
  }

  protected cls(item: ReviewedApplication) {
    return badgeClass(item.status);
  }

  protected reload() {
    this.current = 1;
    void this.load();
  }

  protected reset() {
    this.status.set('');
    this.search.set('');
    this.reload();
  }

  protected go(step: number) {
    this.current += step;
    void this.load();
  }

  private async load() {
    this.loading.set(true);
    this.error.set('');
    const filters: ApplicationFilters = { status: this.status(), search: this.search() };
    try {
      this.page.set(await this.review.list({ ...filters, page: this.current }));
      this.applied = filters;
    } catch (error) {
      this.error.set(readProblem(error).message);
    } finally {
      this.loading.set(false);
    }
  }
}

/** Fiche d'une demande : informations déposées, décision (acceptation ou refus motivé). */
@Component({
  selector: 'app-request-detail',
  imports: [FormsModule, DatePipe],
  template: `
    @if (error() && !application()) {
      <p class="form-error" role="alert">{{ error() }}</p>
    }
    @if (application(); as app) {
      <section class="review-grid">
        <article class="panel review-main">
          <div class="identity-row">
            <span class="identity-avatar">{{ app.first_name.charAt(0) }}{{ app.last_name.charAt(0) }}</span>
            <div>
              <p class="eyebrow">Demande {{ app.reference }}</p>
              <h2>{{ app.first_name }} {{ app.last_name }}</h2>
              <p>Déposée le {{ app.created_at | date: 'dd/MM/yyyy à HH:mm' }}</p>
            </div>
            <span class="badge" [class.success]="cls(app).success" [class.warning]="cls(app).warning"
              [class.danger]="cls(app).danger">{{ app.status_label }}</span>
          </div>
          <dl class="detail-list">
            <div><dt>Adresse courriel</dt><dd>{{ app.email }}</dd></div>
            <div><dt>Profession</dt><dd>{{ app.profession }}</dd></div>
            <div><dt>Localité souhaitée</dt><dd>{{ app.territory.path }}</dd></div>
            @if (app.decided_at) {
              <div>
                <dt>Décision</dt>
                <dd>
                  le {{ app.decided_at | date: 'dd/MM/yyyy' }} par
                  {{ app.decided_by?.first_name }} {{ app.decided_by?.last_name }}
                </dd>
              </div>
            }
            @if (app.rejection_reason) {
              <div><dt>Motif du refus</dt><dd>{{ app.rejection_reason }}</dd></div>
            }
          </dl>
          <div class="motivation-box">
            <h3>Motivation</h3>
            <p>{{ app.motivation }}</p>
          </div>
        </article>
        <aside class="panel decision-panel">
          <h2>Examiner la demande</h2>
          @if (app.status === 'a_examiner') {
            <p>Chaque décision est datée et ajoutée au journal d’actions.</p>
            <label
              >Note interne<textarea rows="3" [ngModel]="note()" (ngModelChange)="note.set($event)"
                placeholder="Ajouter une note utile au bureau…"></textarea
            ></label>
            @if (rejecting()) {
              <label
                >Motif du refus (envoyé à la personne)<textarea rows="4" [ngModel]="reason()"
                  (ngModelChange)="reason.set($event)"></textarea
              ></label>
            }
            @if (error()) {
              <p class="form-error" role="alert">{{ error() }}</p>
            }
            @if (!rejecting()) {
              <button class="btn btn-green btn-wide" type="button" [disabled]="busy()" (click)="accept()">
                Accepter la demande
              </button>
              <button class="btn btn-danger-outline btn-wide" type="button" (click)="rejecting.set(true)">
                Refuser avec un motif
              </button>
            } @else {
              <button class="btn btn-danger-outline btn-wide" type="button" [disabled]="busy()" (click)="reject()">
                Confirmer le refus
              </button>
              <button class="btn btn-wide" type="button" (click)="rejecting.set(false)">Annuler</button>
            }
          } @else if (app.status === 'acceptee') {
            <p>
              Demande acceptée : la personne doit finaliser son inscription avec son lien personnel.
              @if (app.link_expires_at) {
                @if (linkExpired(app)) {
                  Son lien a expiré le {{ app.link_expires_at | date: 'dd/MM/yyyy à HH:mm' }}.
                } @else {
                  Son lien est valable jusqu’au {{ app.link_expires_at | date: 'dd/MM/yyyy à HH:mm' }}.
                }
              }
            </p>
            <p>Si le lien a expiré ou s’est perdu, envoyez-en un nouveau : l’ancien cessera de fonctionner.</p>
            @if (error()) {
              <p class="form-error" role="alert">{{ error() }}</p>
            }
            <button class="btn btn-green btn-wide" type="button" [disabled]="busy()" (click)="resendLink()">
              Renvoyer le lien d’inscription
            </button>
          } @else {
            <p>Cette demande est déjà traitée : {{ app.status_label }}.</p>
          }
          @if (done()) {
            <p class="inline-success" role="status">✓ {{ done() }}</p>
          }
        </aside>
      </section>
    }
  `,
})
export class RequestDetail implements OnInit {
  private readonly review = inject(ReviewService);
  private readonly route = inject(ActivatedRoute);
  protected readonly application = signal<ReviewedApplication | null>(null);
  protected readonly note = signal('');
  protected readonly reason = signal('');
  protected readonly rejecting = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly done = signal('');

  async ngOnInit() {
    try {
      this.application.set(await this.review.get(this.route.snapshot.paramMap.get('id') ?? ''));
    } catch (error) {
      this.error.set(readProblem(error).message);
    }
  }

  protected cls(item: ReviewedApplication) {
    return badgeClass(item.status);
  }

  protected accept() {
    return this.decide(
      (id) => this.review.accept(id, this.note()),
      'Demande acceptée : le lien d’inscription a été envoyé par courriel.',
    );
  }

  protected linkExpired(item: ReviewedApplication) {
    return !!item.link_expires_at && new Date(item.link_expires_at).getTime() <= Date.now();
  }

  protected resendLink() {
    return this.decide(
      (id) => this.review.resendLink(id),
      'Un nouveau lien d’inscription a été envoyé par courriel. L’ancien ne fonctionne plus.',
    );
  }

  protected reject() {
    if (!this.reason().trim()) {
      this.error.set('Le motif du refus est obligatoire.');
      return Promise.resolve();
    }
    return this.decide(
      (id) => this.review.reject(id, this.reason(), this.note()),
      'Demande refusée : le motif a été envoyé par courriel.',
    );
  }

  private async decide(run: (id: string) => Promise<ReviewedApplication>, success: string) {
    const current = this.application();
    if (!current) return;
    this.busy.set(true);
    this.error.set('');
    try {
      this.application.set(await run(current.id));
      this.rejecting.set(false);
      this.done.set(success);
    } catch (error) {
      // L'échec d'envoi du courriel est affiché tel quel : la demande reste « À examiner ».
      this.error.set(readProblem(error).message);
    } finally {
      this.busy.set(false);
    }
  }
}
