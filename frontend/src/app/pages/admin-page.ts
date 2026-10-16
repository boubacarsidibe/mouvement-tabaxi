import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { UiIcon } from '../shared/ui-icon';
import { InviteForm } from './invite-form';
import { MemberDetail, MembersList } from './members-base';
import { RequestDetail, RequestsList } from './requests-review';

@Component({
  selector: 'app-admin-page',
  imports: [
    RouterLink,
    UiIcon,
    RequestsList,
    RequestDetail,
    InviteForm,
    MembersList,
    MemberDetail,
  ],
  template: `
    <main class="workspace-shell admin-shell">
      <aside class="side-nav">
        <a class="side-logo" routerLink="/"
          ><img src="logo-tabaxi-sidebar.png" alt="Mouvement TABAXI"
        /></a>
        <p class="side-label">Bureau exécutif</p>
        <nav aria-label="Bureau exécutif">
          @for (item of visibleNavItems(); track item.view) {
            <a [routerLink]="item.link" [class.active]="view === item.view"
              ><ui-icon [name]="item.icon" />{{ item.label }}</a
            >
          }
        </nav>
        <div class="side-profile">
          <a routerLink="/membre"><ui-icon name="users" />Mon espace membre</a>
          <div class="side-user">
            <span>{{ auth.initials() }}</span>
            <p>
              <strong>{{ auth.displayName() }}</strong
              ><small
                >{{ auth.user()?.role_label
                }}{{ auth.user()?.territory ? ' · ' + auth.user()?.territory?.name : '' }}</small
              >
            </p>
          </div>
          <button class="side-logout" type="button" (click)="logout()">
            <ui-icon name="logout" />Se déconnecter
          </button>
        </div>
      </aside>

      <section class="workspace-area">
        <header class="workspace-topbar">
          <label class="top-search"
            ><ui-icon name="search" /><input
              aria-label="Rechercher dans la plateforme"
              placeholder="Rechercher dans la plateforme…"
          /></label>
          <button class="icon-button" aria-label="Notifications">
            <ui-icon name="bell" /><i></i>
          </button>
          <button class="profile-chip" aria-label="Menu du profil">{{ auth.initials() }}</button
          ><span class="chevron" aria-hidden="true">⌄</span>
        </header>

        <div class="workspace-content admin-content">
          <header class="page-heading">
            <div>
              <h1>{{ pageTitle }}</h1>
              <p>{{ pageSubtitle }}</p>
            </div>
            @if (hasPrimaryAction) {
              <a class="btn btn-green" [routerLink]="actionLink"
                ><ui-icon name="plus" />{{ actionLabel }}</a
              >
            } @else if (view === 'dashboard') {
              <button class="date-button">
                <ui-icon name="calendar" />1 jan. 2026 – 31 déc. 2026
              </button>
            }
          </header>

          @if (view === 'dashboard') {
            <section class="stat-grid admin-stats">
              @for (stat of stats; track stat.label) {
                <article>
                  <span class="stat-icon"><ui-icon [name]="stat.icon" /></span>
                  <div>
                    <p>{{ stat.label }}</p>
                    <strong>{{ stat.value }}</strong
                    ><small>{{ stat.note }}</small>
                  </div>
                  <b>{{ stat.delta }}</b>
                </article>
              }
            </section>
            <section class="dashboard-grid">
              <article class="panel chart-panel">
                <div class="panel-title">
                  <h2>Évolution des adhésions</h2>
                  <span class="chart-period">12 derniers mois</span>
                </div>
                <figure class="chart-figure">
                  <figcaption>Nouveaux membres par mois</figcaption>
                  <div class="chart-body">
                    <div class="chart-y" aria-hidden="true">
                      @for (tick of chartTicks; track tick) {
                        <span>{{ tick }}</span>
                      }
                    </div>
                    <svg
                      class="line-chart"
                      viewBox="0 0 500 200"
                      preserveAspectRatio="none"
                      role="img"
                      [attr.aria-label]="chartSummary"
                    >
                      <defs>
                        <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0" stop-color="#168558" stop-opacity=".28" />
                          <stop offset="1" stop-color="#168558" stop-opacity="0" />
                        </linearGradient>
                      </defs>
                      @for (tick of chartTicks; track tick) {
                        <line
                          class="grid-line"
                          x1="0"
                          x2="500"
                          [attr.y1]="200 - tick"
                          [attr.y2]="200 - tick"
                        />
                      }
                      <path class="area" [attr.d]="chartArea" />
                      <path [attr.d]="chartLine" />
                      @for (dot of chartDots; track $index) {
                        <circle [attr.cx]="dot.x" [attr.cy]="dot.y" r="4" />
                      }
                    </svg>
                  </div>
                  <div class="chart-months" aria-hidden="true">
                    @for (month of chartMonths; track month) {
                      <span>{{ month }}</span>
                    }
                  </div>
                </figure>
              </article>
              <article class="panel recent-panel">
                <div class="panel-title">
                  <h2>Demandes récentes</h2>
                  <a routerLink="/bureau/demandes">Voir tout →</a>
                </div>
                @for (person of requests.slice(0, 4); track person.name) {
                  <div>
                    <span class="list-avatar"><ui-icon name="users" /></span>
                    <p>
                      <strong>{{ person.name }}</strong
                      ><small>{{ person.city }}</small>
                    </p>
                    <time>Il y a {{ $index + 2 }} h</time
                    ><span class="badge warning">À examiner</span>
                  </div>
                }
              </article>
              <article class="panel small-panel">
                <div class="panel-title">
                  <h2>Programmes à venir</h2>
                  <a routerLink="/bureau/programmes">Voir tout →</a>
                </div>
                <p>
                  <ui-icon name="calendar" /><span
                    ><strong>Éducation civique</strong><small>Thiès</small></span
                  ><time>22 nov. 2026</time><b class="badge success">À venir</b>
                </p>
              </article>
              <article class="panel small-panel">
                <div class="panel-title">
                  <h2>Dernières activités</h2>
                  <a routerLink="/bureau/journal">Voir tout →</a>
                </div>
                <p>
                  <ui-icon name="users" /><span
                    ><strong>Nouvelle demande d’adhésion</strong><small>Par Awa Ndiaye</small></span
                  ><time>Il y a 2 h</time>
                </p>
              </article>
            </section>
          }

          @if (view === 'requests') {
            <app-requests-list />
          }

          @if (view === 'request-detail') {
            <app-request-detail />
          }

          @if (view === 'members') {
            <app-members-list />
          }

          @if (view === 'member-detail') {
            <app-member-detail />
          }

          @if (view === 'coordinators') {
            <app-members-list role="coordonnateur" />
          }

          @if (view === 'accounts') {
            @if (view === 'accounts') {
              <div class="security-alert">
                <ui-icon name="key" />
                <p>
                  <strong>Sécurité</strong>Veillez à n’accorder des accès qu’aux personnes de
                  confiance. Les comptes inactifs doivent être désactivés.
                </p>
                <button type="button" aria-label="Fermer l’avertissement">×</button>
              </div>
            }
            <div class="filter-bar">
              <label
                ><ui-icon name="search" /><input
                  [attr.aria-label]="
                    'Rechercher un membre'
                  "
                  [placeholder]="
                    'Rechercher un membre…'
                  " /></label
              ><select aria-label="Filtrer par localité">
                <option>Localité · Toutes</option></select
              ><select aria-label="Filtrer par statut">
                <option>Statut · Tous</option>
              </select>
                <select aria-label="Filtrer par rôle">
                  <option>Rôle · Tous</option>
                </select>
              <button>Réinitialiser</button>
            </div>
            <div class="table-wrap responsive-table">
              <table>
                <thead>
                  <tr>
                    <th [attr.aria-sort]="ariaSort('name')">
                      <button class="th-sort" type="button" (click)="sortBy('name')">
                        Nom complet <span aria-hidden="true">{{ sortIndicator('name') }}</span>
                      </button>
                    </th>
                    <th [attr.aria-sort]="ariaSort('place')">
                      <button class="th-sort" type="button" (click)="sortBy('place')">
                        {{ view === 'accounts' ? 'Email' : 'Localité' }}
                        <span aria-hidden="true">{{ sortIndicator('place') }}</span>
                      </button>
                    </th>
                    <th>{{ 'Rôle' }}</th>
                    <th [attr.aria-sort]="ariaSort('date')">
                      <button class="th-sort" type="button" (click)="sortBy('date')">
                        {{ 'Date d’adhésion' }}
                        <span aria-hidden="true">{{ sortIndicator('date') }}</span>
                      </button>
                    </th>
                    <th>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  @for (person of sortedPeople; track person.name) {
                    <tr>
                      <td>
                        <strong>{{ person.name }}</strong>
                      </td>
                      <td [attr.data-label]="view === 'accounts' ? 'Email' : 'Localité'">
                        {{ view === 'accounts' ? person.email : person.city }}
                      </td>
                      <td [attr.data-label]="'Rôle'">
                        {{ person.role }}
                      </td>
                      <td [attr.data-label]="'Adhésion'">
                        {{ person.date }}
                      </td>
                      <td data-label="Statut">
                        <span
                          class="badge"
                          [class.success]="
                            person.status === 'Actif' ||
                            person.status === 'Acceptée' ||
                            person.status === 'Inscrite'
                          "
                          [class.warning]="
                            person.status === 'À examiner' || person.status === 'Suspendu'
                          "
                          [class.danger]="
                            person.status === 'Rejetée' || person.status === 'Inactif'
                          "
                          >{{ person.status }}</span
                        >
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
              <footer class="table-footer">
                <span>{{ visiblePeople.length }} résultats</span>
              </footer>
            </div>
          }

          @if (view === 'programs') {
            <nav class="tabs">
              <a class="active">Tous (18)</a><a>En cours (10)</a><a>À venir (5)</a
              ><a>Terminés (3)</a>
            </nav>
            <div class="filter-bar">
              <label
                ><ui-icon name="search" /><input
                  aria-label="Rechercher un programme"
                  placeholder="Rechercher un programme…" /></label
              ><select aria-label="Filtrer par statut">
                <option>Statut · Tous</option></select
              ><select aria-label="Filtrer par localité">
                <option>Localité · Toutes</option></select
              ><button>Réinitialiser</button>
            </div>
            <section class="admin-program-grid">
              @for (program of programs; track program.name) {
                <article class="panel" routerLink="/bureau/programmes/brigades-citoyennes">
                  <header>
                    <ui-icon [name]="program.icon" />
                    <div>
                      <h2>{{ program.name }}</h2>
                      <p>{{ program.description }}</p>
                    </div>
                    <button type="button" [attr.aria-label]="'Plus d’actions pour ' + program.name">
                      •••
                    </button>
                  </header>
                  <p class="program-city"><ui-icon name="location" />{{ program.city }}</p>
                  <div class="progress"><i [style.width.%]="program.progress"></i></div>
                  <footer>
                    <span><ui-icon name="calendar" />{{ program.date }}</span
                    ><b>{{ program.progress }}%</b
                    ><span
                      class="badge"
                      [class.success]="program.status !== 'À venir'"
                      [class.warning]="program.status === 'À venir'"
                      >{{ program.status }}</span
                    >
                  </footer>
                </article>
              }
            </section>
          }

          @if (view === 'territories') {
            <section class="territory-summary stat-grid">
              <article>
                <ui-icon name="location" /><strong>12</strong>
                <p>Localités couvertes</p>
              </article>
              <article>
                <ui-icon name="users" /><strong>86</strong>
                <p>Coordonnateurs</p>
              </article>
              <article>
                <ui-icon name="users" /><strong>1 248</strong>
                <p>Membres</p>
              </article>
            </section>
            <section class="territory-layout">
              <div class="territory-map-card">
                <img src="hero-tabaxi.jpg" alt="Carte illustrée du Sénégal" /><span
                  class="map-city city-one"
                ></span
                ><span class="map-city city-two"></span><span class="map-city city-three"></span>
                <div>
                  <strong>Dakar</strong><small>24 membres<br />3 coordonnateurs</small>
                </div>
              </div>
              <div class="table-wrap responsive-table">
                <table>
                  <thead>
                    <tr>
                      <th>Localité</th>
                      <th>Région</th>
                      <th>Coordonnateurs</th>
                      <th>Membres</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (territory of territories; track territory.city) {
                      <tr>
                        <td>
                          <strong>{{ territory.city }}</strong>
                        </td>
                        <td data-label="Région">{{ territory.region }}</td>
                        <td data-label="Coordonnateurs">{{ territory.coordinators }}</td>
                        <td data-label="Membres">{{ territory.members }}</td>
                        <td>
                          <button
                            class="row-action"
                            type="button"
                            [attr.aria-label]="'Voir ' + territory.city + ' sur la carte'"
                          >
                            ◉</button
                          ><button
                            class="row-action"
                            type="button"
                            [attr.aria-label]="'Plus d’actions pour ' + territory.city"
                          >
                            •••
                          </button>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </section>
          }

          @if (view === 'audit') {
            <div class="filter-bar audit-filters">
              <label
                ><ui-icon name="search" /><input
                  aria-label="Rechercher une action"
                  placeholder="Rechercher une action…" /></label
              ><select aria-label="Filtrer par action">
                <option>Action · Toutes</option></select
              ><select aria-label="Filtrer par auteur">
                <option>Auteur · Tous</option></select
              ><select aria-label="Filtrer par période">
                <option>Période · 30 jours</option></select
              ><button>Réinitialiser</button>
            </div>
            <section class="audit-list panel">
              @for (entry of auditEntries; track entry.when) {
                <article>
                  <span class="audit-icon"><ui-icon [name]="entry.icon" /></span>
                  <div>
                    <strong>{{ entry.action }}</strong>
                    <p>{{ entry.detail }}</p>
                    <small>{{ entry.author }} · {{ entry.when }}</small>
                  </div>
                  <span class="badge">{{ entry.scope }}</span>
                </article>
              }
            </section>
          }

          @if (view === 'invite') {
            <app-invite-form />
          }

          @if (view === 'program-new' || view === 'activity-new' || view === 'report') {
            <a
              class="back-link"
              routerLink="/bureau/programmes"
              >← Retour</a
            >
            <form class="workspace-form panel admin-form" (submit)="completeForm($event)">
              @if (view === 'program-new') {
                <p class="eyebrow">Programme</p>
                <h2>Créer un nouveau programme</h2>
                <p>
                  Cadrez l’objectif, le territoire et la période avant de planifier les activités.
                </p>
                <label
                  >Nom du programme <input placeholder="Ex. Lecture pour tous" required
                /></label>
                <label
                  >Objectif
                  <textarea
                    rows="4"
                    placeholder="Quel changement ce programme doit-il produire ?"
                    required
                  ></textarea>
                </label>
                <div class="field-grid">
                  <label
                    >Territoire
                    <select required>
                      <option value="">Sélectionner un territoire</option>
                      <option>Dakar</option>
                      <option>Thiès</option>
                      <option>Saint-Louis</option>
                    </select></label
                  ><label
                    >Responsable
                    <select required>
                      <option value="">Sélectionner un responsable</option>
                      <option>Mamadou Diop</option>
                      <option>Fatou Sarr</option>
                    </select></label
                  >
                </div>
                <div class="field-grid">
                  <label>Date de début <input type="date" required /></label
                  ><label>Date de fin <input type="date" required /></label>
                </div>
              } @else if (view === 'activity-new') {
                <p class="eyebrow">Activité</p>
                <h2>Planifier une activité</h2>
                <p>Ajoutez les informations pratiques visibles par les membres du territoire.</p>
                <label
                  >Programme
                  <select required>
                    <option value="">Sélectionner un programme</option>
                    <option>Brigades citoyennes</option>
                    <option>Éducation civique</option>
                  </select></label
                >
                <label
                  >Nom de l’activité
                  <input placeholder="Ex. Nettoyage citoyen de la plage" required
                /></label>
                <div class="field-grid">
                  <label>Date <input type="date" required /></label
                  ><label>Horaires <input placeholder="09 h 00 – 12 h 00" required /></label>
                </div>
                <label>Lieu précis <input placeholder="Point de rendez-vous" required /></label>
                <label
                  >Description
                  <textarea
                    rows="4"
                    placeholder="Déroulement, matériel et consignes…"
                    required
                  ></textarea>
                </label>
                <label>Nombre de places <input type="number" value="50" min="1" required /></label>
              } @else if (view === 'report') {
                <p class="eyebrow">Brigades citoyennes · 24 octobre 2026</p>
                <h2>Ajouter le compte rendu</h2>
                <p>Conservez une trace utile, concise et vérifiable de l’activité.</p>
                <label
                  >Résumé
                  <textarea rows="5" placeholder="Ce qui a été réalisé…" required></textarea>
                </label>
                <div class="field-grid">
                  <label
                    >Participants présents
                    <input type="number" value="42" min="0" required /></label
                  ><label>Sacs collectés <input type="number" value="68" min="0" /></label>
                </div>
                <label
                  >Résultats et suites
                  <textarea
                    rows="4"
                    placeholder="Résultats observés et prochaines étapes…"
                    required
                  ></textarea>
                </label>
                <label
                  >Photos ou document
                  <span class="upload-field"
                    ><ui-icon name="plus" /><span
                      ><strong>Ajouter des fichiers</strong
                      ><small>JPG, PNG ou PDF · 10 Mo maximum</small></span
                    ></span
                  ></label
                >
              }
              <div class="form-actions">
                <a
                  class="btn btn-outline"
                  routerLink="/bureau/programmes"
                  >Annuler</a
                ><button class="btn btn-green" type="submit">
                  {{ view === 'report' ? 'Publier le compte rendu' : 'Enregistrer' }}
                </button>
              </div>
              @if (formSaved()) {
                <p class="inline-success" role="status">✓ Les informations ont été enregistrées.</p>
              }
            </form>
          }

          @if (view === 'program-detail') {
            <a class="back-link" routerLink="/bureau/programmes">← Retour aux programmes</a>
            <section class="program-overview panel">
              <div>
                <p class="eyebrow">Programme · Dakar</p>
                <h2>Brigades citoyennes</h2>
                <p>
                  Mobiliser les jeunes autour d’actions concrètes de salubrité et de solidarité.
                </p>
              </div>
              <span class="badge success">En cours</span>
              <div class="progress"><i style="width: 70%"></i></div>
              <dl>
                <div>
                  <dt>Responsable</dt>
                  <dd>Mamadou Diop</dd>
                </div>
                <div>
                  <dt>Période</dt>
                  <dd>Janvier – décembre 2026</dd>
                </div>
                <div>
                  <dt>Progression</dt>
                  <dd>70 %</dd>
                </div>
              </dl>
            </section>
            <div class="section-heading">
              <div>
                <h2>Activités du programme</h2>
                <p>3 activités planifiées · 96 participations</p>
              </div>
              <a class="btn btn-green" routerLink="/bureau/activites/nouvelle"
                ><ui-icon name="plus" />Planifier une activité</a
              >
            </div>
            <section class="activity-admin-list">
              <article class="panel">
                <span class="date-tile"><b>24</b>OCT</span>
                <div>
                  <h3>Nettoyage citoyen de la plage de Yoff</h3>
                  <p>09 h 00 – 12 h 00 · Plage de Yoff · 42 inscrits</p>
                </div>
                <span class="badge success">Terminée</span
                ><a routerLink="/bureau/activites/brigade-dakar/presences">Présences</a
                ><a routerLink="/bureau/activites/brigade-dakar/compte-rendu">Compte rendu</a>
              </article>
              <article class="panel">
                <span class="date-tile"><b>12</b>NOV</span>
                <div>
                  <h3>Réhabilitation de l’aire de jeux</h3>
                  <p>08 h 30 – 13 h 00 · Parc Hann · 31 inscrits</p>
                </div>
                <span class="badge warning">À venir</span
                ><a routerLink="/bureau/activites/brigade-dakar/presences">Gérer</a>
              </article>
            </section>
          }

          @if (view === 'attendance') {
            <a class="back-link" routerLink="/bureau/programmes/brigades-citoyennes"
              >← Retour au programme</a
            >
            <section class="attendance-heading panel">
              <div>
                <p class="eyebrow">24 octobre 2026 · Plage de Yoff</p>
                <h2>Présences — Nettoyage citoyen</h2>
                <p>Cochez les membres présents. Les changements sont conservés avec leur auteur.</p>
              </div>
              <strong>8 / 10 présents</strong>
            </section>
            <div class="table-wrap attendance-table">
              <table>
                <thead>
                  <tr>
                    <th>Présent</th>
                    <th>Membre</th>
                    <th>N° d’adhérent</th>
                    <th>Territoire</th>
                    <th>Arrivée</th>
                  </tr>
                </thead>
                <tbody>
                  @for (person of attendees; track person.name) {
                    <tr>
                      <td>
                        <input
                          type="checkbox"
                          [checked]="person.present"
                          [attr.aria-label]="'Présence de ' + person.name"
                        />
                      </td>
                      <td>
                        <strong>{{ person.name }}</strong>
                      </td>
                      <td>{{ person.id }}</td>
                      <td>Dakar</td>
                      <td>{{ person.time }}</td>
                    </tr>
                  }
                </tbody>
              </table>
              <footer class="table-footer">
                <span>Liste enregistrée automatiquement</span
                ><button class="btn btn-green" type="button">Valider les présences</button>
              </footer>
            </div>
          }
        </div>
      </section>
    </main>
  `,
})
export class AdminPage {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly view = this.route.snapshot.data['view'] as string;

  protected readonly navItems = [
    { view: 'dashboard', label: 'Tableau de bord', icon: 'home', link: '/bureau' },
    { view: 'requests', label: 'Demandes d’adhésion', icon: 'users', link: '/bureau/demandes' },
    { view: 'members', label: 'Bases de membres', icon: 'grid', link: '/bureau/membres' },
    {
      view: 'coordinators',
      label: 'Coordonnateurs',
      icon: 'users',
      link: '/bureau/coordonnateurs',
    },
    { view: 'programs', label: 'Programmes', icon: 'calendar', link: '/bureau/programmes' },
    {
      view: 'territories',
      label: 'Localités de coordination',
      icon: 'location',
      link: '/bureau/territoires',
    },
    { view: 'accounts', label: 'Comptes d’accès', icon: 'key', link: '/bureau/comptes' },
    { view: 'audit', label: 'Journal des actions', icon: 'clipboard', link: '/bureau/journal' },
  ];
  /** L'examen des demandes et les comptes d'accès sont réservés aux fondateurs. */
  private readonly founderViews = new Set(['requests', 'accounts']);
  protected readonly visibleNavItems = computed(() =>
    this.navItems.filter((item) => this.auth.isFounder() || !this.founderViews.has(item.view)),
  );

  protected async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigateByUrl('/connexion');
  }
  protected readonly formSaved = signal(false);
  protected readonly sortKey = signal<'name' | 'place' | 'date'>('date');
  protected readonly sortAsc = signal(false);
  protected readonly stats = [
    {
      icon: 'users',
      value: '1 248',
      label: 'Membres enregistrés',
      note: 'Membres répartis dans 12 localités',
      delta: '+12%',
    },
    {
      icon: 'location',
      value: '86',
      label: 'Coordonnateurs',
      note: 'Dans 12 localités',
      delta: '+3%',
    },
    {
      icon: 'clipboard',
      value: '24',
      label: 'Demandes à examiner',
      note: 'À examiner par les membres fondateurs',
      delta: '+8%',
    },
    {
      icon: 'users',
      value: '18',
      label: 'Programmes',
      note: 'Initiatives enregistrées',
      delta: '+5%',
    },
  ];
  protected readonly requests = [
    {
      name: 'Awa Ndiaye',
      city: 'Saint-Louis',
      email: 'awa.ndiaye@gmail.com',
      job: 'Enseignante',
      role: 'Membre',
      date: '12 oct. 2026',
      status: 'À examiner',
    },
    {
      name: 'Mamadou Diop',
      city: 'Dakar',
      email: 'm.diop@gmail.com',
      job: 'Commerçant',
      role: 'Coordonnateur',
      date: '12 oct. 2026',
      status: 'À examiner',
    },
    {
      name: 'Khady Fall',
      city: 'Thiès',
      email: 'khady.fall@gmail.com',
      job: 'Étudiante',
      role: 'Membre',
      date: '11 oct. 2026',
      status: 'À examiner',
    },
    {
      name: 'El Hadj Ba',
      city: 'Kaolack',
      email: 'elh.ba@gmail.com',
      job: 'Agriculteur',
      role: 'Membre',
      date: '11 oct. 2026',
      status: 'À examiner',
    },
    {
      name: 'Fatou Sarr',
      city: 'Ziguinchor',
      email: 'fatou.sarr@gmail.com',
      job: 'Infirmière',
      role: 'Membre',
      date: '10 oct. 2026',
      status: 'Acceptée',
    },
    {
      name: 'Ibrahima Cissé',
      city: 'Tambacounda',
      email: 'i.cisse@gmail.com',
      job: 'Enseignant',
      role: 'Coordonnateur',
      date: '10 oct. 2026',
      status: 'Rejetée',
    },
    {
      name: 'Marième Diallo',
      city: 'Kolda',
      email: 'm.diallo@gmail.com',
      job: 'Commerçante',
      role: 'Membre',
      date: '9 oct. 2026',
      status: 'Inscrite',
    },
    {
      name: 'Cheikh Fall',
      city: 'Louga',
      email: 'c.fall@gmail.com',
      job: 'Technicien',
      role: 'Membre',
      date: '8 oct. 2026',
      status: 'Inscrite',
    },
  ];
  protected readonly programs = [
    {
      name: 'Brigades citoyennes',
      description: 'Mobilisation des jeunes pour des actions citoyennes.',
      city: 'Dakar',
      date: '15 sept. 2026',
      progress: 70,
      status: 'En cours',
      icon: 'leaf',
    },
    {
      name: 'Éducation civique',
      description: 'Sensibilisation dans les écoles et communautés.',
      city: 'Thiès',
      date: '22 nov. 2026',
      progress: 45,
      status: 'À venir',
      icon: 'users',
    },
    {
      name: 'Santé communautaire',
      description: 'Actions de prévention et de soutien sanitaire.',
      city: 'Saint-Louis',
      date: '10 août 2026',
      progress: 80,
      status: 'En cours',
      icon: 'heart',
    },
    {
      name: 'Environnement propre',
      description: 'Campagnes de reboisement et de salubrité.',
      city: 'Ziguinchor',
      date: '5 déc. 2026',
      progress: 30,
      status: 'À venir',
      icon: 'leaf',
    },
    {
      name: 'Autonomisation des femmes',
      description: 'Formations et appui aux activités génératrices de revenus.',
      city: 'Kaolack',
      date: '12 sept. 2026',
      progress: 60,
      status: 'En cours',
      icon: 'chart',
    },
    {
      name: 'Jeunesse et leadership',
      description: 'Renforcement des capacités des jeunes leaders.',
      city: 'Tambacounda',
      date: '20 janv. 2026',
      progress: 100,
      status: 'Terminé',
      icon: 'book',
    },
  ];
  protected readonly territories = [
    { city: 'Dakar', region: 'Dakar', coordinators: 3, members: 320 },
    { city: 'Thiès', region: 'Thiès', coordinators: 8, members: 210 },
    { city: 'Saint-Louis', region: 'Saint-Louis', coordinators: 6, members: 180 },
    { city: 'Kaolack', region: 'Kaolack', coordinators: 7, members: 160 },
    { city: 'Ziguinchor', region: 'Ziguinchor', coordinators: 5, members: 98 },
    { city: 'Tambacounda', region: 'Tambacounda', coordinators: 4, members: 96 },
    { city: 'Kolda', region: 'Kolda', coordinators: 3, members: 84 },
    { city: 'Louga', region: 'Louga', coordinators: 5, members: 100 },
  ];
  protected readonly auditEntries = [
    {
      icon: 'users',
      action: 'Demande acceptée',
      detail: 'Awa Ndiaye · Saint-Louis',
      author: 'Bureau national',
      when: 'Aujourd’hui, 10 h 42',
      scope: 'Adhésion',
    },
    {
      icon: 'download',
      action: 'Liste exportée',
      detail: 'Membres actifs de Dakar · 320 lignes',
      author: 'Mamadou Diop',
      when: 'Hier, 16 h 18',
      scope: 'Export',
    },
    {
      icon: 'key',
      action: 'Coordonnatrice invitée',
      detail: 'Fatou Sarr · Ziguinchor',
      author: 'Bureau national',
      when: '13 octobre, 09 h 05',
      scope: 'Accès',
    },
    {
      icon: 'calendar',
      action: 'Activité modifiée',
      detail: 'Nettoyage citoyen de la plage de Yoff',
      author: 'Mamadou Diop',
      when: '12 octobre, 14 h 33',
      scope: 'Programme',
    },
    {
      icon: 'users',
      action: 'Membre suspendu',
      detail: 'Compte de Cheikh Fall',
      author: 'Bureau national',
      when: '10 octobre, 11 h 20',
      scope: 'Statut',
    },
  ];
  protected readonly attendees = [
    { name: 'Aminata Ndiaye', id: 'TBX-2026-00125', time: '08 h 52', present: true },
    { name: 'Moussa Faye', id: 'TBX-2026-00133', time: '08 h 57', present: true },
    { name: 'Adama Sow', id: 'TBX-2026-00141', time: '09 h 03', present: true },
    { name: 'Marième Diallo', id: 'TBX-2026-00154', time: '—', present: false },
    { name: 'Cheikh Fall', id: 'TBX-2026-00161', time: '09 h 08', present: true },
  ];
  /** Nouveaux membres par mois, de novembre 2025 à octobre 2026 (données de démonstration). */
  protected readonly chartValues = [32, 41, 48, 58, 54, 70, 78, 92, 108, 104, 126, 172];
  protected readonly chartMonths = [
    'Nov.',
    'Déc.',
    'Janv.',
    'Févr.',
    'Mars',
    'Avr.',
    'Mai',
    'Juin',
    'Juil.',
    'Août',
    'Sept.',
    'Oct.',
  ];
  /** Échelle régulière : une unité du graphique vaut un membre (hauteur 200). */
  protected readonly chartTicks = [200, 150, 100, 50, 0];
  protected readonly chartDots = this.chartValues.map((value, index) => ({
    x: ((index + 0.5) * 500) / this.chartValues.length,
    y: 200 - value,
  }));
  protected readonly chartLine = 'M' + this.chartDots.map((dot) => `${dot.x} ${dot.y}`).join(' L');
  protected readonly chartArea =
    this.chartLine +
    ` L${this.chartDots[this.chartDots.length - 1].x} 200 L${this.chartDots[0].x} 200Z`;
  protected readonly chartSummary = `Nouveaux membres par mois sur 12 mois : de ${this.chartValues[0]} en novembre 2025 à ${this.chartValues[this.chartValues.length - 1]} en octobre 2026.`;

  protected get pageTitle(): string {
    return (
      {
        dashboard: 'Tableau de bord',
        requests: 'Demandes d’adhésion',
        members: 'Bases de membres',
        programs: 'Programmes',
        territories: 'Localités de coordination',
        accounts: 'Comptes d’accès',
        coordinators: 'Coordonnateurs',
        audit: 'Journal des actions',
        'request-detail': 'Examiner la demande',
        'member-detail': 'Fiche membre',
        'program-new': 'Nouveau programme',
        'program-detail': 'Détail du programme',
        'activity-new': 'Planifier une activité',
        report: 'Compte rendu',
        attendance: 'Présences',
        invite: 'Inviter un coordonnateur',
      } as Record<string, string>
    )[this.view];
  }
  protected get pageSubtitle(): string {
    return (
      {
        dashboard: 'Vue d’ensemble des activités du Mouvement TABAXI',
        requests: 'Liste des personnes qui souhaitent rejoindre le Mouvement TABAXI',
        members: 'Gestion des membres du Mouvement TABAXI',
        programs: 'Suivi des initiatives du Mouvement TABAXI',
        territories: 'Gestion des localités et de leurs coordonnateurs',
        accounts: 'Gestion des utilisateurs et des accès à la plateforme',
        coordinators: 'Membres du bureau exécutif et territoires rattachés',
        audit: 'Historique des décisions et opérations sensibles',
        'request-detail': 'Décider avec les informations utiles et garder une trace',
        'member-detail': 'Coordonnées, statut du compte et historique',
        'program-new': 'Définir un objectif, un territoire et une période',
        'program-detail': 'Suivre les activités, la participation et l’avancement',
        'activity-new': 'Préparer une activité visible par les membres du territoire',
        report: 'Documenter les résultats d’une activité terminée',
        attendance: 'Enregistrer les membres effectivement présents',
        invite: 'Donner un accès au bureau exécutif',
      } as Record<string, string>
    )[this.view];
  }
  protected get actionLabel(): string {
    return (
      (
        {
          programs: 'Nouveau programme',
          territories: 'Ajouter une localité',
          accounts: 'Créer un compte',
          coordinators: 'Inviter un coordonnateur',
        } as Record<string, string>
      )[this.view] || 'Ajouter'
    );
  }
  protected get actionLink(): string {
    return (
      (
        {
          coordinators: '/bureau/comptes/inviter',
          programs: '/bureau/programmes/nouveau',
          territories: '/bureau/territoires',
          accounts: '/bureau/comptes/inviter',
        } as Record<string, string>
      )[this.view] || '/bureau'
    );
  }
  protected get hasPrimaryAction(): boolean {
    return ['coordinators', 'programs', 'territories', 'accounts'].includes(this.view);
  }
  protected completeForm(event: SubmitEvent): void {
    event.preventDefault();
    if ((event.currentTarget as HTMLFormElement).reportValidity()) this.formSaved.set(true);
  }
  protected sortBy(key: 'name' | 'place' | 'date'): void {
    if (this.sortKey() === key) this.sortAsc.set(!this.sortAsc());
    else {
      this.sortKey.set(key);
      this.sortAsc.set(key !== 'date');
    }
  }
  protected sortIndicator(key: 'name' | 'place' | 'date'): string {
    if (this.sortKey() !== key) return '↕';
    return this.sortAsc() ? '↑' : '↓';
  }
  protected ariaSort(key: 'name' | 'place' | 'date'): string | null {
    if (this.sortKey() !== key) return null;
    return this.sortAsc() ? 'ascending' : 'descending';
  }
  /** Les données de démonstration sont rangées de la plus récente à la plus ancienne. */
  protected get sortedPeople() {
    const direction = this.sortAsc() ? 1 : -1;
    const key = this.sortKey();
    const place = (person: { city: string; email: string }) =>
      this.view === 'accounts' ? person.email : person.city;
    return this.visiblePeople
      .map((person, order) => ({ ...person, order }))
      .sort((a, b) => {
        if (key === 'date') return (b.order - a.order) * direction;
        const left = key === 'name' ? a.name : place(a);
        const right = key === 'name' ? b.name : place(b);
        return left.localeCompare(right, 'fr') * direction;
      });
  }
  protected get visiblePeople() {
    return this.requests.slice(0, 6).map((person, index) => ({
      ...person,
      role: this.view === 'coordinators' ? 'Coordonnateur' : person.role,
      status: index === 5 ? 'Inactif' : 'Actif',
    }));
  }
}
