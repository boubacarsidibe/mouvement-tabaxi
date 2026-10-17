import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { readProblem } from '../core/api-problem';
import { DashboardData, DashboardService } from '../core/dashboard.service';

/** Localités du périmètre, avec leurs vrais effectifs (membres actifs et coordonnateurs). */
@Component({
  selector: 'app-territories-overview',
  template: `
    @if (error()) {
      <p class="form-error" role="alert">{{ error() }}</p>
    }
    @if (data(); as d) {
      <p class="dashboard-scope">
        @if (d.scope.territory; as territory) {
          Localités de <strong>{{ territory.name }}</strong> et de ce qui en dépend.
        } @else {
          Toutes les localités où le mouvement compte des membres ou des coordonnateurs.
        }
      </p>
      <section class="dashboard-summary territories-summary" aria-label="Totaux">
        <div>
          <strong>{{ d.territories.length }}</strong>
          <span>{{ d.territories.length > 1 ? 'localités' : 'localité' }}</span>
        </div>
        <div>
          <strong>{{ totals().coordinators }}</strong>
          <span>{{ totals().coordinators > 1 ? 'coordonnateurs' : 'coordonnateur' }}</span>
        </div>
        <div>
          <strong>{{ totals().members }}</strong>
          <span>{{ totals().members > 1 ? 'membres actifs' : 'membre actif' }}</span>
        </div>
      </section>
      @if (d.territories.length) {
        <div class="table-wrap responsive-table">
          <table>
            <thead>
              <tr>
                <th>Localité</th>
                <th>Type</th>
                <th>Rattachement</th>
                <th>Coordonnateurs</th>
                <th>Membres actifs</th>
              </tr>
            </thead>
            <tbody>
              @for (row of d.territories; track row.territory.id) {
                <tr>
                  <td><strong>{{ row.territory.name }}</strong></td>
                  <td data-label="Type">{{ row.territory.kind_label }}</td>
                  <td data-label="Rattachement">{{ row.territory.path }}</td>
                  <td data-label="Coordonnateurs">{{ row.coordinators }}</td>
                  <td data-label="Membres actifs">{{ row.members }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else {
        <p class="audit-empty">Aucun membre ni coordonnateur dans ce périmètre pour l’instant.</p>
      }
    } @else if (!error()) {
      <p class="info-note">Chargement des localités…</p>
    }
  `,
})
export class TerritoriesOverview implements OnInit {
  private readonly dashboard = inject(DashboardService);
  protected readonly data = signal<DashboardData | null>(null);
  protected readonly error = signal('');

  protected readonly totals = computed(() => {
    const rows = this.data()?.territories ?? [];
    return {
      members: rows.reduce((sum, row) => sum + row.members, 0),
      coordinators: rows.reduce((sum, row) => sum + row.coordinators, 0),
    };
  });

  async ngOnInit() {
    try {
      this.data.set(await this.dashboard.load());
    } catch (error) {
      this.error.set(readProblem(error).message);
    }
  }
}
