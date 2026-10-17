import { DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { readProblem } from '../core/api-problem';
import {
  MemberActivity,
  MemberProgram,
  MemberProgramPage,
  ProgramsService,
  statusBadge,
} from '../core/programs.service';
import { UiIcon } from '../shared/ui-icon';

type Tab = '' | 'en_cours' | 'prevu' | 'termine';

const TABS: { value: Tab; label: string }[] = [
  { value: '', label: 'En cours et à venir' },
  { value: 'en_cours', label: 'En cours' },
  { value: 'prevu', label: 'À venir' },
  { value: 'termine', label: 'Terminés' },
];

function messageOf(error: unknown): string {
  const problem = readProblem(error);
  return Object.values(problem.fields)[0] ?? problem.message;
}

/** Bouton d'inscription et de désinscription d'une activité, avec l'erreur du serveur le cas échéant. */
@Component({
  selector: 'app-registration-button',
  host: { class: 'registration-control' },
  template: `
    @if (activity().registered && activity().registration_open) {
      <button class="btn btn-outline" type="button" [disabled]="busy()" (click)="toggle()">
        {{ busy() ? 'Un instant…' : 'Se désinscrire' }}
      </button>
    } @else if (activity().registered) {
      <span class="badge success">Inscrit(e)</span>
    } @else if (activity().registration_open) {
      <button class="btn btn-green" type="button" [disabled]="busy()" (click)="toggle()">
        {{ busy() ? 'Un instant…' : 'S’inscrire' }}
      </button>
    } @else {
      <span class="badge">Inscriptions closes</span>
    }
    @if (error()) {
      <small class="field-error" role="alert">{{ error() }}</small>
    }
  `,
})
export class RegistrationButton {
  private readonly programs = inject(ProgramsService);
  readonly activity = input.required<MemberActivity>();
  /** L'activité à jour (nouvelle inscription, nouveau nombre d'inscrits), pour que la page l'affiche. */
  readonly changed = output<MemberActivity>();
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  protected async toggle() {
    const current = this.activity();
    this.busy.set(true);
    this.error.set('');
    try {
      this.changed.emit(
        current.registered ? await this.programs.unregister(current.id) : await this.programs.register(current.id),
      );
    } catch (error) {
      this.error.set(messageOf(error));
    } finally {
      this.busy.set(false);
    }
  }
}

/** Programmes du territoire du membre, avec leurs activités par ordre de date et le bouton d'inscription. */
@Component({
  selector: 'app-member-programs',
  imports: [FormsModule, RouterLink, DatePipe, UiIcon, RegistrationButton],
  template: `
    <nav class="tabs" aria-label="État des programmes">
      @for (item of tabs; track item.value) {
        <button type="button" [class.active]="tab() === item.value" (click)="choose(item.value)">
          {{ item.label }}
        </button>
      }
    </nav>
    <div class="filter-bar member-filter">
      <label
        ><ui-icon name="search" /><input
          aria-label="Rechercher un programme"
          placeholder="Rechercher un programme…"
          [ngModel]="search()"
          (ngModelChange)="search.set($event)"
          (keydown.enter)="reload()"
      /></label>
      <button type="button" (click)="reload()" aria-label="Rechercher"><ui-icon name="search" /><span>Rechercher</span></button>
      <button type="button" (click)="reset()" aria-label="Réinitialiser"><ui-icon name="close" /><span>Réinitialiser</span></button>
    </div>
    @if (error()) {
      <p class="inline-error" role="alert">{{ error() }}</p>
    }
    <section class="member-program-list">
      @for (program of page()?.results ?? []; track program.id) {
        <article class="panel member-program">
          <header>
            <h2>{{ program.name }}</h2>
            <span
              class="badge"
              [class.success]="badge(program).success"
              [class.warning]="badge(program).warning"
              [class.danger]="badge(program).danger"
              >{{ program.status_label }}</span
            >
          </header>
          <p class="program-meta">
            <ui-icon name="calendar" />Du {{ program.start_date | date: 'd MMMM y' }} au
            {{ program.end_date | date: 'd MMMM y' }}
            <ui-icon name="location" />{{ program.territory.name }}
            @if (program.manager) {
              <ui-icon name="users" />Responsable : {{ program.manager.name }}
            }
          </p>
          <p>{{ program.objective }}</p>
          <ul class="member-activities">
            @for (activity of program.activities; track activity.id) {
              <li>
                <div>
                  <strong
                    ><a [routerLink]="['/membre/activites', activity.id]">{{ activity.title }}</a></strong
                  >
                  <small
                    >{{ activity.starts_at | date: 'EEEE d MMMM y' }} à {{ activity.starts_at | date: 'HH:mm' }} ·
                    {{ activity.place }}</small
                  >
                  <small>{{ activity.registrations_count }} inscrit(s)</small>
                </div>
                <app-registration-button [activity]="activity" (changed)="update($event)" />
              </li>
            } @empty {
              <li class="history-empty">Aucune activité planifiée pour le moment.</li>
            }
          </ul>
        </article>
      } @empty {
        @if (!loading()) {
          <p class="audit-empty panel">Aucun programme à afficher pour votre territoire.</p>
        }
      }
    </section>
    @if (loading()) {
      <p class="info-note">Chargement des programmes…</p>
    }
    @if (page()?.previous || page()?.next) {
      <div class="pager">
        <button type="button" [disabled]="!page()?.previous" (click)="go(-1)">Précédent</button>
        <button type="button" [disabled]="!page()?.next" (click)="go(1)">Suivant</button>
      </div>
    }
  `,
})
export class MemberPrograms implements OnInit {
  private readonly programs = inject(ProgramsService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly tabs = TABS;
  protected readonly tab = signal<Tab>('');
  protected readonly search = signal('');
  protected readonly page = signal<MemberProgramPage | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  private current = 1;

  ngOnInit() {
    // La recherche du haut de l'écran arrive ici par l'adresse « /membre/programmes?q=… » ; on la relit à chaque changement.
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.search.set(params.get('q') ?? '');
      this.reload();
    });
  }

  protected badge(program: MemberProgram) {
    return statusBadge(program.status);
  }

  protected choose(tab: Tab) {
    this.tab.set(tab);
    this.reload();
  }

  protected reload() {
    this.current = 1;
    void this.load();
  }

  protected reset() {
    this.search.set('');
    this.tab.set('');
    this.reload();
  }

  protected go(step: number) {
    this.current += step;
    void this.load();
  }

  /** Remplace l'activité par sa version à jour (inscription changée) dans la liste affichée. */
  protected update(activity: MemberActivity) {
    this.page.update((page) =>
      page
        ? {
            ...page,
            results: page.results.map((program) =>
              program.id === activity.program.id
                ? { ...program, activities: program.activities.map((a) => (a.id === activity.id ? activity : a)) }
                : program,
            ),
          }
        : page,
    );
  }

  private async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      this.page.set(
        await this.programs.memberPrograms({ status: this.tab(), search: this.search(), page: this.current }),
      );
    } catch (error) {
      this.error.set(messageOf(error));
    } finally {
      this.loading.set(false);
    }
  }
}

/** Une activité du territoire du membre : le détail, et l'inscription ou la désinscription. */
@Component({
  selector: 'app-member-activity',
  imports: [DatePipe, UiIcon, RegistrationButton],
  template: `
    @if (error()) {
      <p class="inline-error" role="alert">{{ error() }}</p>
    }
    @if (activity(); as item) {
      <section class="activity-hero panel">
        <div class="activity-kicker"><ui-icon name="leaf" />{{ item.program.name }} · {{ item.program.territory }}</div>
        <h1>{{ item.title }}</h1>
        <p>{{ item.description }}</p>
        <div class="activity-meta">
          <span
            ><ui-icon name="calendar" /><strong>{{ item.starts_at | date: 'EEEE d MMMM y' }}</strong
            >{{ item.starts_at | date: 'HH:mm' }}@if (item.ends_at) {
              – {{ item.ends_at | date: 'HH:mm' }}
            }</span
          >
          <span
            ><ui-icon name="location" /><strong>{{ item.place }}</strong
            >{{ item.program.territory }}</span
          >
          <span
            ><ui-icon name="users" /><strong>{{ item.registrations_count }} inscrit(s)</strong
            >{{ item.program.status_label }}</span
          >
        </div>
      </section>
      <div class="detail-columns">
        <article class="panel prose-panel">
          <h2>Programme</h2>
          <p>
            Cette activité fait partie du programme <strong>{{ item.program.name }}</strong
            >.
          </p>
          @if (item.program.manager; as manager) {
            <h3>Responsable</h3>
            <p>{{ manager.name }}</p>
          }
        </article>
        <aside class="panel registration-panel">
          <h2>{{ item.registered ? 'Inscription confirmée' : 'Participez avec nous' }}</h2>
          <p>
            @if (item.registered && item.registration_open) {
              Votre place est réservée. Vous pouvez vous désinscrire tant que l’activité n’a pas commencé.
            } @else if (item.registered) {
              Vous étiez inscrit(e) à cette activité.
            } @else if (item.registration_open) {
              Inscrivez-vous pour participer à cette activité.
            } @else {
              Les inscriptions à cette activité sont closes.
            }
          </p>
          <app-registration-button [activity]="item" (changed)="activity.set($event)" />
        </aside>
      </div>
    }
  `,
})
export class MemberActivityPage implements OnInit {
  private readonly programs = inject(ProgramsService);
  private readonly route = inject(ActivatedRoute);
  protected readonly activity = signal<MemberActivity | null>(null);
  protected readonly error = signal('');

  async ngOnInit() {
    try {
      this.activity.set(await this.programs.memberActivity(this.route.snapshot.paramMap.get('id') ?? ''));
    } catch (error) {
      const problem = readProblem(error);
      this.error.set(
        problem.status === 404
          ? 'Cette activité est introuvable ou ne concerne pas votre territoire.'
          : problem.message,
      );
    }
  }
}
