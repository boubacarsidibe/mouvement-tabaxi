import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { readProblem } from '../core/api-problem';
import {
  AttendanceMember,
  AttendanceSheet,
  PROGRAM_STATUSES,
  ProgramActivity,
  ProgramRecord,
  ProgramStatus,
  ProgramsService,
  Registrant,
  statusBadge,
  toIso,
  toLocalInput,
} from '../core/programs.service';
import { ExportButton } from '../shared/export-button';

function problemText(error: unknown): string {
  const problem = readProblem(error);
  return Object.values(problem.fields)[0] ?? problem.message;
}

/** Formulaire d'une activité : planification dans un programme, ou modification d'une activité existante. */
@Component({
  selector: 'app-activity-form',
  imports: [FormsModule, RouterLink, DatePipe],
  template: `
    <form class="workspace-form panel admin-form" (submit)="save($event)" novalidate>
      <h2>{{ editing() ? 'Modifier l’activité' : 'Planifier une activité' }}</h2>
      @if (program(); as item) {
        <p>
          Programme : <strong>{{ item.name }}</strong>, du {{ item.start_date | date: 'd MMMM y' }} au
          {{ item.end_date | date: 'd MMMM y' }}. L’activité se déroule pendant cette période.
        </p>
      }
      @if (error()) {
        <p class="inline-error" role="alert">{{ error() }}</p>
      }
      <label
        >Titre
        <input name="title" maxlength="150" placeholder="Ex. Distribution de livres" [ngModel]="title()" (ngModelChange)="title.set($event)" />
        @if (fieldErrors()['title']; as message) {
          <small class="field-error" role="alert">{{ message }}</small>
        }
      </label>
      <div class="field-grid">
        <label
          >Début
          <input type="datetime-local" name="starts_at" [ngModel]="starts()" (ngModelChange)="starts.set($event)" />
          @if (fieldErrors()['starts_at']; as message) {
            <small class="field-error" role="alert">{{ message }}</small>
          }
        </label>
        <label
          >Fin (facultatif)
          <input type="datetime-local" name="ends_at" [ngModel]="ends()" (ngModelChange)="ends.set($event)" />
          @if (fieldErrors()['ends_at']; as message) {
            <small class="field-error" role="alert">{{ message }}</small>
          }
        </label>
      </div>
      <label
        >Lieu
        <input name="place" maxlength="200" placeholder="Ex. Bibliothèque de Pikine" [ngModel]="place()" (ngModelChange)="place.set($event)" />
        @if (fieldErrors()['place']; as message) {
          <small class="field-error" role="alert">{{ message }}</small>
        }
      </label>
      <label
        >Description
        <textarea
          name="description"
          rows="5"
          maxlength="2000"
          placeholder="Ce qui sera fait, ce qu’il faut prévoir…"
          [ngModel]="description()"
          (ngModelChange)="description.set($event)"
        ></textarea>
        @if (fieldErrors()['description']; as message) {
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
export class ActivityForm implements OnInit {
  private readonly programs = inject(ProgramsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly programId = this.route.snapshot.paramMap.get('programId');
  private readonly activityId = this.route.snapshot.paramMap.get('id');
  protected readonly editing = computed(() => this.activityId !== null);
  protected readonly program = signal<Pick<ProgramRecord, 'id' | 'name' | 'start_date' | 'end_date'> | null>(null);
  protected readonly backLink = computed(() =>
    this.activityId
      ? ['/bureau/activites', this.activityId]
      : ['/bureau/programmes', this.programId ?? ''],
  );

  protected readonly title = signal('');
  protected readonly starts = signal('');
  protected readonly ends = signal('');
  protected readonly place = signal('');
  protected readonly description = signal('');
  protected readonly fieldErrors = signal<Record<string, string>>({});
  protected readonly error = signal('');
  protected readonly busy = signal(false);

  async ngOnInit() {
    try {
      if (this.activityId) {
        const activity = await this.programs.activity(this.activityId);
        this.title.set(activity.title);
        this.starts.set(toLocalInput(activity.starts_at));
        this.ends.set(toLocalInput(activity.ends_at));
        this.place.set(activity.place);
        this.description.set(activity.description);
        this.program.set(await this.programs.get(activity.program.id));
      } else if (this.programId) {
        this.program.set(await this.programs.get(this.programId));
      }
    } catch (error) {
      this.error.set(problemText(error));
    }
  }

  protected async save(event: Event) {
    event.preventDefault();
    this.busy.set(true);
    this.error.set('');
    this.fieldErrors.set({});
    const input = {
      title: this.title().trim(),
      starts_at: this.starts() ? toIso(this.starts()) : '',
      ends_at: this.ends() ? toIso(this.ends()) : null,
      place: this.place().trim(),
      description: this.description().trim(),
    };
    try {
      const saved = this.activityId
        ? await this.programs.updateActivity(this.activityId, input)
        : await this.programs.createActivity(this.programId as string, input);
      await this.router.navigate(['/bureau/activites', saved.id]);
    } catch (error) {
      const problem = readProblem(error);
      this.fieldErrors.set(problem.fields);
      // « detail » (programme annulé…) ou erreur générale : message en haut du formulaire.
      this.error.set(problem.fields['detail'] ?? (Object.keys(problem.fields).length ? '' : problem.message));
    } finally {
      this.busy.set(false);
    }
  }
}

/** Fiche d'une activité : informations, compte rendu, inscrits ; accès au compte rendu et aux présences. */
@Component({
  selector: 'app-activity-detail',
  imports: [RouterLink, DatePipe, ExportButton],
  template: `
    @if (activity(); as item) {
      <section class="review-grid">
        <article class="panel review-main">
          <div class="identity-row">
            <div>
              <p class="eyebrow">{{ item.program.name }} · {{ item.program.territory }}</p>
              <h2>{{ item.title }}</h2>
              <p>
                {{ item.starts_at | date: 'EEEE d MMMM y' }} à {{ item.starts_at | date: 'HH:mm' }}
                @if (item.ends_at) {
                  – {{ item.ends_at | date: 'HH:mm' }}
                }
                · {{ item.place }}
              </p>
            </div>
            <span
              class="badge"
              [class.success]="badge().success"
              [class.warning]="badge().warning"
              [class.danger]="badge().danger"
              >{{ item.program.status_label }}</span
            >
          </div>
          <div class="motivation-box">
            <h3>Description</h3>
            <p>{{ item.description }}</p>
          </div>
          <dl class="detail-list">
            <div>
              <dt>Inscrits</dt>
              <dd>{{ item.registrations_count }}</dd>
            </div>
            <div>
              <dt>Participants</dt>
              <dd>
                @if (item.attendance_noted) {
                  {{ item.attendance_count }} présent(s)
                } @else {
                  Présences non notées
                }
              </dd>
            </div>
          </dl>
          <h3>Compte rendu</h3>
          @if (item.report) {
            <div class="motivation-box">
              <p>{{ item.report }}</p>
            </div>
            <p class="history-empty">
              Écrit par {{ item.report_author?.name }} le {{ item.reported_at | date: 'dd/MM/yyyy à HH:mm' }}.
            </p>
          } @else {
            <p class="history-empty">Aucun compte rendu pour le moment.</p>
          }
          <h3>Inscrits</h3>
          @if (registrants().length) {
            <div class="table-wrap responsive-table">
              <table>
                <thead>
                  <tr>
                    <th>Membre</th>
                    <th>N° d’adhérent</th>
                    <th>Courriel</th>
                    <th>Localité</th>
                  </tr>
                </thead>
                <tbody>
                  @for (person of registrants(); track person.member) {
                    <tr>
                      <td>
                        <strong>{{ person.first_name }} {{ person.last_name }}</strong>
                      </td>
                      <td data-label="N° d’adhérent">{{ person.number }}</td>
                      <td data-label="Courriel">{{ person.email }}</td>
                      <td data-label="Localité">{{ person.territory }}</td>
                    </tr>
                  }
                </tbody>
              </table>
              <footer class="table-footer">
                <span>{{ registrants().length }} inscrit(s)</span>
                <app-export-button [run]="exportRun" />
              </footer>
            </div>
          } @else {
            <p class="history-empty">Personne ne s’est encore inscrit.</p>
          }
        </article>
        <aside class="panel decision-panel">
          <h2>Suivre l’activité</h2>
          @if (item.has_started) {
            <a class="btn btn-green btn-wide" [routerLink]="['/bureau/activites', item.id, 'compte-rendu']">{{
              item.report ? 'Modifier le compte rendu' : 'Écrire le compte rendu'
            }}</a>
            <a class="btn btn-outline btn-wide" [routerLink]="['/bureau/activites', item.id, 'presences']">{{
              item.attendance_noted ? 'Modifier les présences' : 'Noter les présences'
            }}</a>
          } @else {
            <p>Le compte rendu et les présences se renseignent une fois l’activité commencée.</p>
          }
          <a class="btn btn-outline btn-wide" [routerLink]="['/bureau/activites', item.id, 'modifier']"
            >Modifier l’activité</a
          >
        </aside>
      </section>
    } @else if (error()) {
      <p class="form-error" role="alert">{{ error() }}</p>
    }
  `,
})
export class ActivityDetail implements OnInit {
  private readonly programs = inject(ProgramsService);
  private readonly route = inject(ActivatedRoute);
  private readonly id = this.route.snapshot.paramMap.get('id') ?? '';
  protected readonly activity = signal<ProgramActivity | null>(null);
  protected readonly registrants = signal<Registrant[]>([]);
  protected readonly error = signal('');
  protected readonly badge = computed(() => statusBadge(this.activity()?.program.status ?? 'prevu'));
  protected readonly exportRun = () => this.programs.exportRegistrants(this.id);

  async ngOnInit() {
    try {
      const [activity, registrants] = await Promise.all([
        this.programs.activity(this.id),
        this.programs.registrants(this.id),
      ]);
      this.activity.set(activity);
      this.registrants.set(registrants.results);
    } catch (error) {
      const problem = readProblem(error);
      this.error.set(
        problem.status === 404
          ? 'Cette activité est introuvable ou ne fait pas partie de votre territoire.'
          : problem.message,
      );
    }
  }
}

/** Compte rendu d'une activité, avec la mise à jour de l'état du programme. */
@Component({
  selector: 'app-activity-report',
  imports: [FormsModule, RouterLink, DatePipe],
  template: `
    @if (activity(); as item) {
      <form class="workspace-form panel admin-form" (submit)="save($event)" novalidate>
        <h2>{{ item.title }}</h2>
        <p>
          {{ item.program.name }} · {{ item.starts_at | date: 'EEEE d MMMM y' }} · {{ item.place }}
        </p>
        @if (!item.has_started) {
          <p class="inline-error" role="alert">
            Cette activité n’a pas encore eu lieu : le compte rendu s’écrit après.
          </p>
        }
        @if (error()) {
          <p class="inline-error" role="alert">{{ error() }}</p>
        }
        <label
          >Compte rendu
          <textarea
            name="report"
            rows="8"
            maxlength="5000"
            placeholder="Ce qui s’est passé, les résultats, les suites à donner…"
            [ngModel]="report()"
            (ngModelChange)="report.set($event)"
          ></textarea>
          @if (fieldErrors()['report']; as message) {
            <small class="field-error" role="alert">{{ message }}</small>
          }
        </label>
        <label
          >État du programme
          <select name="program_status" [ngModel]="status()" (ngModelChange)="status.set($event)">
            @for (option of statuses; track option.value) {
              <option [value]="option.value">{{ option.label }}</option>
            }
          </select>
          <small>Mettez-le à jour si l’activité change l’avancement du programme.</small>
          @if (fieldErrors()['program_status']; as message) {
            <small class="field-error" role="alert">{{ message }}</small>
          }
        </label>
        <div class="form-actions">
          <a class="btn btn-outline" [routerLink]="['/bureau/activites', item.id]">Annuler</a>
          <button class="btn btn-green" type="submit" [disabled]="busy() || !item.has_started">
            {{ busy() ? 'Enregistrement…' : 'Publier le compte rendu' }}
          </button>
        </div>
      </form>
    } @else if (error()) {
      <p class="form-error" role="alert">{{ error() }}</p>
    }
  `,
})
export class ActivityReport implements OnInit {
  private readonly programs = inject(ProgramsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly id = this.route.snapshot.paramMap.get('id') ?? '';
  protected readonly statuses = PROGRAM_STATUSES;
  protected readonly activity = signal<ProgramActivity | null>(null);
  protected readonly report = signal('');
  protected readonly status = signal<ProgramStatus>('en_cours');
  protected readonly fieldErrors = signal<Record<string, string>>({});
  protected readonly error = signal('');
  protected readonly busy = signal(false);

  async ngOnInit() {
    try {
      const item = await this.programs.activity(this.id);
      this.activity.set(item);
      this.report.set(item.report);
      this.status.set(item.program.status);
    } catch (error) {
      this.error.set(problemText(error));
    }
  }

  protected async save(event: Event) {
    event.preventDefault();
    this.busy.set(true);
    this.error.set('');
    this.fieldErrors.set({});
    try {
      await this.programs.saveReport(this.id, this.report().trim(), this.status());
      await this.router.navigate(['/bureau/activites', this.id]);
    } catch (error) {
      const problem = readProblem(error);
      this.fieldErrors.set(problem.fields);
      this.error.set(Object.keys(problem.fields).length ? '' : problem.message);
    } finally {
      this.busy.set(false);
    }
  }
}

/** Liste à cocher des membres présents à une activité, avec le total des présents. */
@Component({
  selector: 'app-activity-attendance',
  imports: [FormsModule, DatePipe],
  template: `
    @if (activity(); as item) {
      <section class="panel admin-form attendance-panel">
        <h2>{{ item.title }}</h2>
        <p>{{ item.program.name }} · {{ item.starts_at | date: 'EEEE d MMMM y' }} · {{ item.place }}</p>
        @if (!item.has_started) {
          <p class="inline-error" role="alert">
            Cette activité n’a pas encore eu lieu : les présences se notent après.
          </p>
        }
        @if (error()) {
          <p class="inline-error" role="alert">{{ error() }}</p>
        }
        @if (saved()) {
          <p class="inline-success" role="status">✓ Présences enregistrées : {{ presentCount() }} présent(s).</p>
        }
        <div class="filter-bar attendance-tools">
          <label
            ><input
              aria-label="Rechercher un membre"
              placeholder="Rechercher un membre…"
              [ngModel]="search()"
              (ngModelChange)="search.set($event)"
          /></label>
          <button type="button" (click)="checkRegistered()">Cocher les inscrits</button>
          <button type="button" (click)="clear()">Tout décocher</button>
        </div>
        <div class="table-wrap responsive-table">
          <table>
            <thead>
              <tr>
                <th>Présent</th>
                <th>Membre</th>
                <th>N° d’adhérent</th>
                <th>Localité</th>
                <th>Inscription</th>
              </tr>
            </thead>
            <tbody>
              @for (member of visibleMembers(); track member.id) {
                <tr>
                  <td>
                    <input
                      type="checkbox"
                      [checked]="present().has(member.id)"
                      (change)="toggle(member.id, $any($event.target).checked)"
                      [attr.aria-label]="'Présence de ' + member.first_name + ' ' + member.last_name"
                    />
                  </td>
                  <td>
                    <strong>{{ member.first_name }} {{ member.last_name }}</strong>
                  </td>
                  <td data-label="N° d’adhérent">{{ member.number }}</td>
                  <td data-label="Localité">{{ member.territory }}</td>
                  <td data-label="Inscription">{{ member.registered ? 'Inscrit' : '—' }}</td>
                </tr>
              }
            </tbody>
          </table>
          @if (!visibleMembers().length) {
            <p class="audit-empty">Aucun membre à afficher.</p>
          }
          <footer class="table-footer">
            <span><strong>{{ presentCount() }}</strong> présent(s) sur {{ members().length }} membre(s)</span>
            <button class="btn btn-green" type="button" [disabled]="busy() || !item.has_started" (click)="save()">
              {{ busy() ? 'Enregistrement…' : 'Enregistrer les présences' }}
            </button>
          </footer>
        </div>
      </section>
    } @else if (error()) {
      <p class="form-error" role="alert">{{ error() }}</p>
    }
  `,
})
export class ActivityAttendance implements OnInit {
  private readonly programs = inject(ProgramsService);
  private readonly route = inject(ActivatedRoute);
  private readonly id = this.route.snapshot.paramMap.get('id') ?? '';
  protected readonly activity = signal<ProgramActivity | null>(null);
  protected readonly members = signal<AttendanceMember[]>([]);
  protected readonly present = signal<Set<string>>(new Set());
  protected readonly search = signal('');
  protected readonly error = signal('');
  protected readonly saved = signal(false);
  protected readonly busy = signal(false);
  protected readonly presentCount = computed(() => this.present().size);
  protected readonly visibleMembers = computed(() => {
    const words = this.search().toLowerCase().split(/\s+/).filter(Boolean);
    return this.members().filter((member) => {
      const text = `${member.first_name} ${member.last_name} ${member.number}`.toLowerCase();
      return words.every((word) => text.includes(word));
    });
  });

  async ngOnInit() {
    try {
      this.activity.set(await this.programs.activity(this.id));
      this.show(await this.programs.attendance(this.id));
    } catch (error) {
      this.error.set(problemText(error));
    }
  }

  private show(sheet: AttendanceSheet) {
    this.members.set(sheet.members);
    this.present.set(new Set(sheet.members.filter((member) => member.present).map((member) => member.id)));
  }

  protected toggle(id: string, checked: boolean) {
    this.saved.set(false);
    const next = new Set(this.present());
    if (checked) next.add(id);
    else next.delete(id);
    this.present.set(next);
  }

  protected checkRegistered() {
    this.saved.set(false);
    const next = new Set(this.present());
    for (const member of this.members()) if (member.registered) next.add(member.id);
    this.present.set(next);
  }

  protected clear() {
    this.saved.set(false);
    this.present.set(new Set());
  }

  protected async save() {
    this.busy.set(true);
    this.error.set('');
    this.saved.set(false);
    try {
      this.show(await this.programs.saveAttendance(this.id, [...this.present()]));
      this.saved.set(true);
    } catch (error) {
      this.error.set(problemText(error));
    } finally {
      this.busy.set(false);
    }
  }
}
