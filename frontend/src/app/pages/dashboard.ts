import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { readProblem } from '../core/api-problem';
import { DashboardData, DashboardService, TerritoryFigures } from '../core/dashboard.service';
import { UiIcon } from '../shared/ui-icon';

const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const HEIGHT = 200;
const WIDTH = 500;

/** Plus petit maximum « rond » (4, 8, 20, 40, 80, 200…) qui contient la valeur : l'axe se divise en quatre nombres entiers. */
export function niceTop(max: number): number {
  for (let power = 1; ; power *= 10) {
    for (const step of [4, 8, 20]) {
      if (max <= step * power) return step * power;
    }
  }
}

/** Tableau de bord du bureau : les vrais chiffres du périmètre de la personne connectée. */
@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, DatePipe, UiIcon],
  template: `
    @if (error()) {
      <p class="form-error" role="alert">{{ error() }}</p>
    }
    @if (data(); as d) {
      <p class="dashboard-scope">
        <ui-icon name="location" />
        @if (d.scope.territory; as territory) {
          Périmètre : <strong>{{ territory.name }}</strong> et les territoires qui en dépendent
        } @else {
          Périmètre : <strong>tous les territoires</strong>
        }
      </p>
      <section class="stat-grid admin-stats" aria-label="Chiffres clés">
        <article>
          <span class="stat-icon"><ui-icon name="users" /></span>
          <div>
            <p>Membres actifs</p>
            <strong>{{ d.active_members }}</strong>
            <small>dont {{ d.joined_this_month }} adhésion(s) ce mois-ci</small>
          </div>
        </article>
        <article>
          <span class="stat-icon"><ui-icon name="location" /></span>
          <div>
            <p>Coordonnateurs actifs</p>
            <strong>{{ d.coordinators }}</strong>
            <small>membres du bureau exécutif</small>
          </div>
        </article>
        <article>
          <span class="stat-icon"><ui-icon name="clipboard" /></span>
          <div>
            <p>Demandes à examiner</p>
            <strong>{{ d.pending_applications }}</strong>
            <small>
              @if (d.recent_applications) {
                <a routerLink="/bureau/demandes">Voir les demandes →</a>
              } @else {
                dans votre périmètre
              }
            </small>
          </div>
        </article>
      </section>
      <section class="dashboard-grid dashboard-balanced">
        <article class="panel chart-panel">
          <div class="panel-title">
            <h2>Évolution des adhésions</h2>
            <span class="chart-period">12 derniers mois</span>
          </div>
          <figure class="chart-figure">
            <figcaption>Nouveaux membres par mois</figcaption>
            <div class="chart-body">
              <div class="chart-y" aria-hidden="true">
                @for (tick of chart().ticks; track tick) {
                  <span>{{ tick }}</span>
                }
              </div>
              <svg
                class="line-chart"
                viewBox="0 0 500 200"
                preserveAspectRatio="none"
                role="img"
                [attr.aria-label]="chart().summary"
              >
                <defs>
                  <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stop-color="#168558" stop-opacity=".28" />
                    <stop offset="1" stop-color="#168558" stop-opacity="0" />
                  </linearGradient>
                </defs>
                @for (line of chart().gridLines; track line) {
                  <line class="grid-line" x1="0" x2="500" [attr.y1]="line" [attr.y2]="line" />
                }
                <path class="area" [attr.d]="chart().area" />
                <path [attr.d]="chart().line" />
                @for (dot of chart().dots; track $index) {
                  <circle [attr.cx]="dot.x" [attr.cy]="dot.y" r="4" />
                }
              </svg>
            </div>
            <div class="chart-months" aria-hidden="true">
              @for (label of chart().labels; track $index) {
                <span>{{ label }}</span>
              }
            </div>
          </figure>
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
                  <span class="territory-count"
                    >{{ row.members }} membre(s)
                    @if (row.coordinators) {
                      · {{ row.coordinators }} coordonnateur(s)
                    }</span
                  >
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
              <a routerLink="/bureau/demandes">Voir tout →</a>
            </div>
            @for (request of requests; track request.id) {
              <div>
                <span class="list-avatar"><ui-icon name="users" /></span>
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
        @if (d.recent_actions; as actions) {
          <article class="panel small-panel">
            <div class="panel-title">
              <h2>Dernières actions</h2>
              <a routerLink="/bureau/journal">Voir tout →</a>
            </div>
            @for (action of actions; track action.id) {
              <p>
                <ui-icon name="clipboard" /><span
                  ><strong>{{ action.action_label }} · {{ action.subject }}</strong
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

  /** Tracé de la courbe : l'échelle s'adapte au plus grand mois, l'axe a cinq repères entiers. */
  protected readonly chart = computed(() => {
    const months = this.data()?.monthly_joined ?? [];
    const top = niceTop(Math.max(0, ...months.map((month) => month.count)));
    const ticks = [top, (top * 3) / 4, top / 2, top / 4, 0];
    const dots = months.map((month, index) => ({
      x: ((index + 0.5) * WIDTH) / months.length,
      y: HEIGHT - (month.count / top) * HEIGHT,
    }));
    const line = dots.length ? 'M' + dots.map((dot) => `${dot.x} ${dot.y}`).join(' L') : '';
    const area = dots.length
      ? `${line} L${dots[dots.length - 1].x} ${HEIGHT} L${dots[0].x} ${HEIGHT}Z`
      : '';
    const label = (month: string) => `${MONTHS[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;
    const first = months[0];
    const last = months[months.length - 1];
    return {
      ticks,
      gridLines: ticks.map((tick) => HEIGHT - (tick / top) * HEIGHT),
      dots,
      line,
      area,
      labels: months.map((month) => MONTHS[Number(month.month.slice(5, 7)) - 1]),
      summary: first
        ? `Nouveaux membres par mois sur 12 mois : ${first.count} en ${label(first.month)}, ${last.count} en ${label(last.month)}.`
        : '',
    };
  });

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
