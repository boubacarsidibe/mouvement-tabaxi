import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { readProblem } from '../core/api-problem';
import {
  AuditAction,
  AuditCategory,
  AuditEntry,
  AuditPage,
  AuditService,
} from '../core/audit.service';
import { UiIcon } from '../shared/ui-icon';

const ACTIONS: { value: AuditAction | ''; label: string }[] = [
  { value: '', label: 'Action · Toutes' },
  { value: 'demande_acceptee', label: 'Demande acceptée' },
  { value: 'demande_refusee', label: 'Demande refusée' },
  { value: 'statut_modifie', label: 'Statut modifié' },
  { value: 'invitation_envoyee', label: 'Invitation envoyée' },
  { value: 'liste_exportee', label: 'Liste exportée' },
];

const ICONS: Record<AuditCategory, string> = {
  adhesion: 'users',
  membres: 'clipboard',
  acces: 'key',
  export: 'download',
};
const BAD_PERIOD = 'La date de fin doit être égale ou postérieure à la date de début.';

/** Journal des actions : acceptations, refus, changements de statut, invitations et exports. Aucune modification possible. */
@Component({
  selector: 'app-audit-journal',
  imports: [FormsModule, DatePipe, UiIcon],
  template: `
    <div class="filter-bar filter-bar-wide audit-filters">
      <label
        ><ui-icon name="search" /><input
          aria-label="Rechercher dans le journal"
          placeholder="Rechercher un auteur ou une personne…"
          [ngModel]="search()"
          (ngModelChange)="search.set($event)"
          (keydown.enter)="reload()"
      /></label>
      <select
        aria-label="Filtrer par action"
        [ngModel]="action()"
        (ngModelChange)="action.set($event); reload()"
      >
        @for (item of actions; track item.value) {
          <option [value]="item.value">{{ item.label }}</option>
        }
      </select>
      <select
        aria-label="Filtrer par auteur"
        [ngModel]="actor()"
        (ngModelChange)="actor.set($event); reload()"
      >
        <option value="">Auteur · Tous</option>
        @for (person of actors(); track person.id) {
          <option [value]="person.id">{{ person.name }}</option>
        }
      </select>
      <label class="date-filter"
        ><span>Du</span
        ><input
          type="date"
          aria-label="Date de début"
          [ngModel]="from()"
          (ngModelChange)="from.set($event); reload()"
      /></label>
      <label class="date-filter"
        ><span>au</span
        ><input
          type="date"
          aria-label="Date de fin"
          [ngModel]="to()"
          (ngModelChange)="to.set($event); reload()"
      /></label>
      <button type="button" (click)="reload()">Rechercher</button>
      <button type="button" (click)="reset()">Réinitialiser</button>
    </div>
    @if (error()) {
      <p class="form-error" role="alert">{{ error() }}</p>
    }
    <section class="audit-list panel" aria-label="Actions enregistrées">
      @for (entry of page()?.results ?? []; track entry.id) {
        <article>
          <span class="audit-icon"><ui-icon [name]="icon(entry)" /></span>
          <div>
            <strong>{{ entry.action_label }} · {{ entry.subject }}</strong>
            @if (entry.detail) {
              <p>{{ entry.detail }}</p>
            }
            <small>{{ entry.actor.name }} · {{ entry.created_at | date: 'dd/MM/yyyy à HH:mm' }}</small>
          </div>
          <span class="badge">{{ entry.category_label }}</span>
        </article>
      } @empty {
        @if (!loading()) {
          <p class="audit-empty">Aucune action ne correspond à ces filtres.</p>
        }
      }
      <footer class="table-footer">
        @if (loading()) {
          <span>Chargement…</span>
        } @else {
          <span>{{ page()?.count ?? 0 }} action(s) · le journal ne peut être ni modifié ni effacé</span>
        }
        @if (page()?.previous || page()?.next) {
          <span>
            <button type="button" [disabled]="!page()?.previous" (click)="go(-1)">Précédent</button>
            <button type="button" [disabled]="!page()?.next" (click)="go(1)">Suivant</button>
          </span>
        }
      </footer>
    </section>
  `,
})
export class AuditJournal implements OnInit {
  private readonly audit = inject(AuditService);
  protected readonly actions = ACTIONS;
  protected readonly action = signal<AuditAction | ''>('');
  protected readonly actor = signal('');
  protected readonly search = signal('');
  protected readonly from = signal('');
  protected readonly to = signal('');
  protected readonly page = signal<AuditPage | null>(null);
  protected readonly actors = signal<{ id: number; name: string }[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  private current = 1;

  ngOnInit() {
    this.audit.actors().then(
      (list) => this.actors.set(list),
      () => this.actors.set([]), // sans la liste, on filtre quand même par recherche, action et date
    );
    void this.load();
  }

  protected icon(entry: AuditEntry): string {
    return ICONS[entry.category];
  }

  protected reload() {
    this.current = 1;
    void this.load();
  }

  protected reset() {
    this.action.set('');
    this.actor.set('');
    this.search.set('');
    this.from.set('');
    this.to.set('');
    this.reload();
  }

  protected go(step: number) {
    this.current += step;
    void this.load();
  }

  private async load() {
    if (this.from() && this.to() && this.to() < this.from()) {
      this.error.set(BAD_PERIOD);
      return;
    }
    this.loading.set(true);
    this.error.set('');
    try {
      this.page.set(
        await this.audit.list({
          action: this.action(),
          actor: this.actor() ? Number(this.actor()) : '',
          search: this.search(),
          date_from: this.from(),
          date_to: this.to(),
          page: this.current,
        }),
      );
    } catch (error) {
      const problem = readProblem(error);
      this.error.set(Object.values(problem.fields)[0] ?? problem.message);
    } finally {
      this.loading.set(false);
    }
  }
}
