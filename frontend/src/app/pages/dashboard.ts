import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { readProblem } from '../core/api-problem';
import { DashboardData, DashboardService, TerritoryFigures } from '../core/dashboard.service';

const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

/** Tableau de bord du bureau : les vrais chiffres du périmètre de la personne connectée. */
@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, DatePipe],
  template: `
    @if (error()) {
      <p class="form-error" role="alert">{{ error() }}</p>
    }
    @if (data(); as d) {
      <p class="dashboard-scope">
        @if (d.scope.territory; as territory) {
          Chiffres de <strong>{{ territory.name }}</strong> et des localités qui en dépendent.
        } @else {
          Chiffres de tout le mouvement.
        }
      </p>
      <section class="dashboard-summary" aria-label="Chiffres clés">
        <div>
          <strong>{{ d.active_members }}</strong>
          <span>{{ plural(d.active_members, 'membre actif', 'membres actifs') }}</span>
          <small>dont {{ d.joined_this_month }} ce mois-ci</small>
        </div>
        <div>
          <strong>{{ d.coordinators }}</strong>
          <span>{{ plural(d.coordinators, 'coordonnateur', 'coordonnateurs') }}</span>
          <small>au bureau exécutif</small>
        </div>
        <div>
          <strong>{{ d.programs_in_progress }}</strong>
          <span>{{ plural(d.programs_in_progress, 'programme en cours', 'programmes en cours') }}</span>
          <small><a routerLink="/bureau/programmes">Voir les programmes</a></small>
        </div>
        <div [class.to-do]="d.pending_applications > 0">
          <strong>{{ d.pending_applications }}</strong>
          <span>{{ plural(d.pending_applications, 'demande à examiner', 'demandes à examiner') }}</span>
          <small>
            @if (d.recent_applications && d.pending_applications) {
              <a routerLink="/bureau/demandes">Examiner les demandes</a>
            } @else {
              dans votre périmètre
            }
          </small>
        </div>
      </section>
      <section class="dashboard-grid dashboard-balanced">
        <article class="panel chart-panel">
          <div class="panel-title">
            <h2>Nouveaux membres</h2>
            <span class="chart-period">12 derniers mois</span>
          </div>
          @if (chart().total) {
            <figure class="bar-chart" role="img" [attr.aria-label]="chart().summary">
              @for (bar of chart().bars; track $index) {
                <div class="bar" [class.current]="$last">
                  <span class="bar-value">{{ bar.count || '' }}</span>
                  <i [style.height.%]="bar.height"></i>
                  <span class="bar-month">{{ bar.label }}</span>
                </div>
              }
            </figure>
          } @else {
            <p class="audit-empty">Aucune nouvelle adhésion sur les douze derniers mois.</p>
          }
        </article>
        <article class="panel territory-panel">
          <div class="panel-title">
            <h2>Répartition par territoire</h2>
            <span class="chart-period">Membres actifs</span>
          </div>
          @if (d.territories.length) {
            <ul>
              @for (row of d.territories; track row.territory.id) {
                <li>
                  <span class="territory-name"
                    ><strong>{{ row.territory.name }}</strong
                    ><small>{{ row.territory.kind_label }}</small></span
                  >
                  <span class="territory-count">{{ territoryCount(row) }}</span>
                  <span class="territory-bar" aria-hidden="true"
                    ><i [style.width.%]="width(row)"></i
                  ></span>
                </li>
              }
            </ul>
          } @else {
            <p class="audit-empty">Aucun membre actif dans ce périmètre.</p>
          }
        </article>
        @if (d.recent_applications; as requests) {
          <article class="panel recent-panel">
            <div class="panel-title">
              <h2>Demandes à examiner</h2>
              <a routerLink="/bureau/demandes">Tout voir</a>
            </div>
            @for (request of requests; track request.id) {
              <div>
                                <p>
                  <strong>{{ request.first_name }} {{ request.last_name }}</strong
                  ><small>{{ request.territory }}</small>
                </p>
                <time>{{ request.created_at | date: 'dd/MM/yyyy' }}</time>
                <a class="row-action" [routerLink]="['/bureau/demandes', request.id]">Examiner</a>
              </div>
            } @empty {
              <p class="audit-empty">Aucune demande en attente.</p>
            }
          </article>
        }
        <article class="panel small-panel upcoming-programs">
          <div class="panel-title">
            <h2>Programmes à venir</h2>
            <a routerLink="/bureau/programmes">Tout voir</a>
          </div>
          @for (program of d.upcoming_programs; track program.id) {
            <p>
              <span
                ><strong
                  ><a [routerLink]="['/bureau/programmes', program.id]">{{ program.name }}</a></strong
                ><small>{{ program.territory }}</small></span
              ><time>{{ program.start_date | date: 'dd/MM/yyyy' }}</time
              ><b class="badge" [class.success]="program.status === 'en_cours'" [class.warning]="program.status === 'prevu'">{{
                program.status_label
              }}</b>
            </p>
          } @empty {
            <p class="audit-empty">Aucun programme prévu ou en cours.</p>
          }
        </article>
        @if (d.recent_actions; as actions) {
          <article class="panel small-panel wide-panel">
            <div class="panel-title">
              <h2>Dernières actions</h2>
              <a routerLink="/bureau/journal">Tout voir</a>
            </div>
            @for (action of actions; track action.id) {
              <p>
                <span
                  ><strong>{{ action.action_label }} : {{ action.subject }}</strong
                  ><small>{{ action.actor.name }}</small></span
                ><time>{{ action.created_at | date: 'dd/MM/yyyy HH:mm' }}</time>
              </p>
            } @empty {
              <p class="audit-empty">Aucune action enregistrée.</p>
            }
          </article>
        }
      </section>
    } @else if (!error()) {
      <p class="info-note">Chargement du tableau de bord…</p>
    }
  `,
})
export class Dashboard implements OnInit {
  private readonly dashboard = inject(DashboardService);
  protected readonly data = signal<DashboardData | null>(null);
  protected readonly error = signal('');

  /** Barres des douze derniers mois, rapportées au mois le plus fort. */
  protected readonly chart = computed(() => {
    const months = this.data()?.monthly_joined ?? [];
    const top = Math.max(1, ...months.map((month) => month.count));
    const total = months.reduce((sum, month) => sum + month.count, 0);
    const label = (month: string) => `${MONTHS[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;
    const first = months[0];
    const last = months[months.length - 1];
    return {
      total,
      bars: months.map((month) => ({
        count: month.count,
        height: month.count ? Math.max(4, (month.count / top) * 100) : 0,
        label: MONTHS[Number(month.month.slice(5, 7)) - 1],
      })),
      summary: first
        ? `${total} nouveaux membres sur douze mois, de ${label(first.month)} à ${label(last.month)}.`
        : '',
    };
  });

  /** « 80 membres, 2 coordonnateurs » ; les coordonnateurs ne sont cités que s'il y en a. */
  protected territoryCount(row: TerritoryFigures): string {
    const members = `${row.members} ${this.plural(row.members, 'membre', 'membres')}`;
    if (!row.coordinators) return members;
    return `${members}, ${row.coordinators} ${this.plural(row.coordinators, 'coordonnateur', 'coordonnateurs')}`;
  }

  /** Accord simple : « 1 membre actif », « 0 membre actif », « 3 membres actifs ». */
  protected plural(count: number, one: string, many: string): string {
    return count > 1 ? many : one;
  }

  async ngOnInit() {
    try {
      this.data.set(await this.dashboard.load());
    } catch (error) {
      this.error.set(readProblem(error).message);
    }
  }

  /** Largeur de la barre d'un territoire, par rapport au plus peuplé. */
  protected width(row: TerritoryFigures): number {
    const biggest = Math.max(1, ...(this.data()?.territories ?? []).map((item) => item.members));
    return row.members ? Math.max(3, (row.members / biggest) * 100) : 0;
  }
}
