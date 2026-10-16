import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { readProblem } from '../core/api-problem';
import { AuthService } from '../core/auth.service';
import {
  Manager,
  PROGRAM_STATUSES,
  ProgramFilters,
  ProgramInput,
  ProgramPage,
  ProgramRecord,
  ProgramRow,
  ProgramStatus,
  ProgramsService,
  statusBadge,
} from '../core/programs.service';
import { TerritoryChoice, TerritoryService, territoryChoices } from '../core/territories.service';
import { ExportButton } from '../shared/export-button';

/** Liste des programmes du périmètre : recherche, filtres par localité et par état, pages, export Excel. */
@Component({
  selector: 'app-programs-list',
  imports: [FormsModule, RouterLink, DatePipe, ExportButton],
  template: `
    <div class="filter-bar filter-bar-wide">
      <label
        ><input
          aria-label="Rechercher un programme"
          placeholder="Rechercher un programme…"
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
          <option value="">Localité · Toutes</option>
          @for (option of territoryOptions(); track option.id) {
            <option [value]="option.id">{{ option.label }}</option>
          }
        </select>
      }
      <select
        aria-label="Filtrer par état"
        [ngModel]="status()"
        (ngModelChange)="status.set($event); reload()"
      >
        <option value="">État · Tous</option>
        @for (item of statuses; track item.value) {
          <option [value]="item.value">{{ item.label }}</option>
        }
      </select>
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
            <th>Programme</th>
            <th>Localité</th>
            <th>Responsable</th>
            <th>Période</th>
            <th>État</th>
            <th>Activités</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          @for (program of page()?.results ?? []; track program.id) {
            <tr>
              <td>
                <strong>{{ program.name }}</strong>
              </td>
              <td data-label="Localité">{{ program.territory.name }}</td>
              <td data-label="Responsable">{{ program.manager?.name ?? 'Non désigné' }}</td>
              <td data-label="Période">
                {{ program.start_date | date: 'dd/MM/yyyy' }} – {{ program.end_date | date: 'dd/MM/yyyy' }}
              </td>
              <td data-label="État">
                <span
                  class="badge"
                  [class.success]="badge(program).success"
                  [class.warning]="badge(program).warning"
                  [class.danger]="badge(program).danger"
                  >{{ program.status_label }}</span
                >
              </td>
              <td data-label="Activités">{{ program.activities_count }}</td>
              <td>
                <a
                  class="row-action"
                  [routerLink]="['/bureau/programmes', program.id]"
                  [attr.aria-label]="'Ouvrir le programme ' + program.name"
                  >Ouvrir</a
                >
              </td>
            </tr>
          }
        </tbody>
      </table>
      @if (!loading() && !(page()?.results?.length)) {
        <p class="audit-empty">Aucun programme ne correspond à ces filtres.</p>
      }
      <footer class="table-footer">
        @if (loading()) {
          <span>Chargement…</span>
        } @else {
          <span>{{ page()?.count ?? 0 }} programme(s)</span>
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
export class ProgramsList implements OnInit {
  private readonly programs = inject(ProgramsService);
  private readonly territories = inject(TerritoryService);
  protected readonly statuses = PROGRAM_STATUSES;
  protected readonly search = signal('');
  protected readonly territory = signal('');
  protected readonly status = signal<ProgramStatus | ''>('');
  protected readonly page = signal<ProgramPage | null>(null);
  protected readonly territoryOptions = signal<TerritoryChoice[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  private current = 1;
  /** Filtres de la liste affichée : l'export les reprend tels quels. */
  private applied: ProgramFilters = {};
  protected readonly exportRun = () => this.programs.exportList(this.applied);

  ngOnInit() {
    this.territories.managed().then(
      (list) => this.territoryOptions.set(territoryChoices(list)),
      () => this.territoryOptions.set([]),
    );
    void this.load();
  }

  protected badge(program: ProgramRow) {
    return statusBadge(program.status);
  }

  protected reload() {
    this.current = 1;
    void this.load();
  }

  protected reset() {
    this.search.set('');
    this.territory.set('');
    this.status.set('');
    this.reload();
  }

  protected go(step: number) {
    this.current += step;
    void this.load();
  }

  private async load() {
    this.loading.set(true);
    this.error.set('');
    const filters: ProgramFilters = {
      status: this.status(),
      territory: this.territory() ? Number(this.territory()) : '',
      search: this.search(),
    };
    try {
      this.page.set(await this.programs.list({ ...filters, page: this.current }));
      this.applied = filters;
    } catch (error) {
      const problem = readProblem(error);
      this.error.set(Object.values(problem.fields)[0] ?? problem.message);
    } finally {
      this.loading.set(false);
    }
  }
}

/** Formulaire d'un programme : création, ou modification quand l'adresse porte un identifiant. */
@Component({
  selector: 'app-program-form',
  imports: [FormsModule, RouterLink],
  template: `
    <form class="workspace-form panel admin-form" (submit)="save($event)" novalidate>
      <h2>{{ editing() ? 'Modifier le programme' : 'Créer un nouveau programme' }}</h2>
      <p>Cadrez l’objectif, la localité et la période avant de planifier les activités.</p>
      @if (error()) {
        <p class="inline-error" role="alert">{{ error() }}</p>
      }
      <label
        >Nom du programme
        <input name="name" maxlength="150" placeholder="Ex. Lecture pour tous" [ngModel]="name()" (ngModelChange)="name.set($event)" />
        @if (fieldErrors()['name']; as message) {
          <small class="field-error" role="alert">{{ message }}</small>
        }
      </label>
      <label
        >Objectif
        <textarea
          name="objective"
          rows="4"
          maxlength="2000"
          placeholder="Quel changement ce programme doit-il produire ?"
          [ngModel]="objective()"
          (ngModelChange)="objective.set($event)"
        ></textarea>
        @if (fieldErrors()['objective']; as message) {
          <small class="field-error" role="alert">{{ message }}</small>
        }
      </label>
      <div class="field-grid">
        <label
          >Localité concernée
          <select name="territory" [ngModel]="territory()" (ngModelChange)="chooseTerritory($event)">
            <option value="">Choisir une localité</option>
            @for (option of territoryOptions(); track option.id) {
              <option [value]="option.id">{{ option.label }}</option>
            }
          </select>
          @if (fieldErrors()['territory']; as message) {
            <small class="field-error" role="alert">{{ message }}</small>
          }
        </label>
        <label
          >Responsable
          <select name="manager" [ngModel]="manager()" (ngModelChange)="manager.set($event)">
            <option value="">Aucun responsable</option>
            @for (person of managers(); track person.id) {
              <option [value]="person.id">{{ person.name }} · {{ person.role_label }}</option>
            }
          </select>
          @if (fieldErrors()['manager']; as message) {
            <small class="field-error" role="alert">{{ message }}</small>
          }
        </label>
      </div>
      <div class="field-grid">
        <label
          >Date de début
          <input type="date" name="start_date" [ngModel]="start()" (ngModelChange)="start.set($event)" />
          @if (fieldErrors()['start_date']; as message) {
            <small class="field-error" role="alert">{{ message }}</small>
          }
        </label>
        <label
          >Date de fin
          <input type="date" name="end_date" [ngModel]="end()" (ngModelChange)="end.set($event)" />
          @if (fieldErrors()['end_date']; as message) {
            <small class="field-error" role="alert">{{ message }}</small>
          }
        </label>
      </div>
      <label
        >État
        <select name="status" [ngModel]="status()" (ngModelChange)="status.set($event)">
          @for (item of statuses; track item.value) {
            <option [value]="item.value">{{ item.label }}</option>
          }
        </select>
        @if (fieldErrors()['status']; as message) {
          <small class="field-error" role="alert">{{ message }}</small>
        }
      </label>
      <div class="form-actions">
        <a class="btn btn-outline" [routerLink]="backLink()">Annuler</a>
        <button class="btn btn-green" type="submit" [disabled]="busy()">
          {{ busy() ? 'Enregistrement…' : 'Enregistrer' }}
        </button>
      </div>
    </form>
  `,
})
export class ProgramForm implements OnInit {
  private readonly programs = inject(ProgramsService);
  private readonly territories = inject(TerritoryService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  protected readonly statuses = PROGRAM_STATUSES;
  private readonly id = Number(this.route.snapshot.paramMap.get('id')) || null;
  protected readonly editing = computed(() => this.id !== null);
  protected readonly backLink = computed(() => (this.id ? ['/bureau/programmes', this.id] : ['/bureau/programmes']));

  protected readonly name = signal('');
  protected readonly objective = signal('');
  protected readonly territory = signal('');
  protected readonly manager = signal('');
  protected readonly start = signal('');
  protected readonly end = signal('');
  protected readonly status = signal<ProgramStatus>('prevu');
  protected readonly territoryOptions = signal<TerritoryChoice[]>([]);
  protected readonly managers = signal<Manager[]>([]);
  protected readonly fieldErrors = signal<Record<string, string>>({});
  protected readonly error = signal('');
  protected readonly busy = signal(false);

  async ngOnInit() {
    let current: ProgramRecord | null = null;
    if (this.id) {
      try {
        current = await this.programs.get(this.id);
      } catch (error) {
        this.error.set(readProblem(error).message);
        return;
      }
      this.name.set(current.name);
      this.objective.set(current.objective);
      this.start.set(current.start_date);
      this.end.set(current.end_date);
      this.status.set(current.status);
    }
    try {
      const list = await this.territories.managed();
      // Une localité devenue inactive reste choisissable pour le programme qui y est déjà.
      this.territoryOptions.set(
        territoryChoices(list.filter((item) => item.is_active || item.id === current?.territory.id)),
      );
    } catch {
      this.territoryOptions.set([]);
    }
    const territory = current?.territory.id ?? this.auth.user()?.territory?.id ?? null;
    if (territory) {
      this.territory.set(String(territory));
      await this.loadManagers(String(current?.manager?.id ?? this.auth.user()?.id ?? ''));
    }
  }

  protected async chooseTerritory(value: string) {
    this.territory.set(value);
    await this.loadManagers(this.manager());
  }

  /** Responsables possibles de la localité ; le choix actuel est gardé s'il l'est encore. */
  private async loadManagers(preferred: string) {
    if (!this.territory()) {
      this.managers.set([]);
      this.manager.set('');
      return;
    }
    try {
      const list = await this.programs.managers(Number(this.territory()));
      this.managers.set(list);
      this.manager.set(list.some((person) => String(person.id) === preferred) ? preferred : '');
    } catch {
      this.managers.set([]);
      this.manager.set('');
    }
  }

  protected async save(event: Event) {
    event.preventDefault();
    this.busy.set(true);
    this.error.set('');
    this.fieldErrors.set({});
    const input = {
      name: this.name().trim(),
      objective: this.objective().trim(),
      territory: this.territory() ? Number(this.territory()) : null,
      manager: this.manager() ? Number(this.manager()) : null,
      start_date: this.start(),
      end_date: this.end(),
      status: this.status(),
    };
    try {
      const saved = this.id
        ? await this.programs.update(this.id, input as Partial<ProgramInput>)
        : await this.programs.create(input as ProgramInput);
      await this.router.navigate(['/bureau/programmes', saved.id]);
    } catch (error) {
      const problem = readProblem(error);
      this.fieldErrors.set(problem.fields);
      this.error.set(Object.keys(problem.fields).length ? '' : problem.message);
    } finally {
      this.busy.set(false);
    }
  }
}

/** Fiche d'un programme : informations, état, et ses activités par ordre de date. */
@Component({
  selector: 'app-program-detail',
  imports: [RouterLink, DatePipe],
  template: `
    @if (error() && !program()) {
      <p class="form-error" role="alert">{{ error() }}</p>
    }
    @if (program(); as item) {
      <section class="review-grid">
        <article class="panel review-main">
          <div class="identity-row">
            <div>
              <p class="eyebrow">{{ item.territory.path }}</p>
              <h2>{{ item.name }}</h2>
              <p>
                Du {{ item.start_date | date: 'd MMMM y' }} au {{ item.end_date | date: 'd MMMM y' }} ·
                Responsable : {{ item.manager?.name ?? 'non désigné' }}
              </p>
            </div>
            <span
              class="badge"
              [class.success]="badge().success"
              [class.warning]="badge().warning"
              [class.danger]="badge().danger"
              >{{ item.status_label }}</span
            >
          </div>
          <div class="motivation-box">
            <h3>Objectif</h3>
            <p>{{ item.objective }}</p>
          </div>
          <h3>Activités</h3>
          @for (activity of item.activities; track activity.id) {
            <div class="history-row activity-row">
              <span>
                <strong>{{ activity.title }}</strong>
                <small
                  >{{ activity.starts_at | date: 'EEEE d MMMM y' }} à {{ activity.starts_at | date: 'HH:mm' }} ·
                  {{ activity.place }}</small
                >
                <small>
                  {{ activity.registrations_count }} inscrit(s) ·
                  @if (activity.attendance_noted) {
                    {{ activity.attendance_count }} présent(s)
                  } @else {
                    présences non notées
                  }
                  ·
                  {{ activity.report ? 'compte rendu écrit' : 'pas de compte rendu' }}
                </small>
              </span>
              <a class="row-action" [routerLink]="['/bureau/activites', activity.id]">Ouvrir</a>
            </div>
          } @empty {
            <p class="history-empty">Aucune activité planifiée pour ce programme.</p>
          }
        </article>
        <aside class="panel decision-panel">
          <h2>Gérer le programme</h2>
          <a class="btn btn-green btn-wide" [routerLink]="['/bureau/programmes', item.id, 'activites', 'nouvelle']"
            >Planifier une activité</a
          >
          <a class="btn btn-outline btn-wide" [routerLink]="['/bureau/programmes', item.id, 'modifier']"
            >Modifier le programme</a
          >
        </aside>
      </section>
    }
  `,
})
export class ProgramDetail implements OnInit {
  private readonly programs = inject(ProgramsService);
  private readonly route = inject(ActivatedRoute);
  protected readonly program = signal<ProgramRecord | null>(null);
  protected readonly error = signal('');
  protected readonly badge = computed(() => statusBadge(this.program()?.status ?? 'prevu'));

  async ngOnInit() {
    try {
      this.program.set(await this.programs.get(Number(this.route.snapshot.paramMap.get('id'))));
    } catch (error) {
      const problem = readProblem(error);
      this.error.set(
        problem.status === 404
          ? 'Ce programme est introuvable ou ne fait pas partie de votre territoire.'
          : problem.message,
      );
    }
  }
}
