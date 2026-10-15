import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { UiIcon } from '../shared/ui-icon';

@Component({
  selector: 'app-admin-page',
  imports: [RouterLink, UiIcon],
  template: `
    <main class="workspace-shell admin-shell">
      <aside class="side-nav">
        <a class="side-logo" routerLink="/"
          ><img src="logo-tabaxi-sidebar.png" alt="Mouvement TABAXI"
        /></a>
        <p class="side-label">Bureau exécutif</p>
        <nav aria-label="Bureau exécutif">
          @for (item of navItems; track item.view) {
            <a [routerLink]="item.link" [class.active]="view === item.view"
              ><ui-icon [name]="item.icon" />{{ item.label }}</a
            >
          }
        </nav>
        <div class="side-profile">
          <a routerLink="/membre"><ui-icon name="users" />Changer de profil</a>
          <div class="side-user">
            <span>BE</span>
            <p><strong>mouvement.tabaxi&#64;gmail.com</strong><small>Membre fondateur</small></p>
          </div>
        </div>
      </aside>

      <section class="workspace-area">
        <header class="workspace-topbar">
          <label class="top-search"
            ><ui-icon name="search" /><input placeholder="Rechercher dans la plateforme…"
          /></label>
          <button class="icon-button" aria-label="Notifications">
            <ui-icon name="bell" /><i></i>
          </button>
          <button class="profile-chip" aria-label="Menu du profil">BE</button
          ><span class="chevron">⌄</span>
        </header>

        <div class="workspace-content admin-content">
          <header class="page-heading">
            <div>
              <h1>{{ pageTitle }}</h1>
              <p>{{ pageSubtitle }}</p>
            </div>
            @if (view !== 'dashboard') {
              <button class="btn btn-green"><ui-icon name="plus" />{{ actionLabel }}</button>
            } @else {
              <button class="date-button">
                <ui-icon name="calendar" />1 jan. 2024 – 31 déc. 2024
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
                  <button>12 derniers mois</button>
                </div>
                <div class="chart-y">
                  <span>200</span><span>150</span><span>100</span><span>0</span>
                </div>
                <svg
                  class="line-chart"
                  viewBox="0 0 520 190"
                  preserveAspectRatio="none"
                  aria-label="Progression des adhésions"
                >
                  <defs>
                    <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stop-color="#168558" stop-opacity=".28" />
                      <stop offset="1" stop-color="#168558" stop-opacity="0" />
                    </linearGradient>
                  </defs>
                  <path
                    class="area"
                    d="M5 155 L60 145 L115 125 L170 132 L225 112 L280 103 L335 78 L390 83 L445 63 L500 28 L500 185 L5 185Z"
                  />
                  <path
                    d="M5 155 L60 145 L115 125 L170 132 L225 112 L280 103 L335 78 L390 83 L445 63 L500 28"
                  />
                  @for (dot of chartDots; track $index) {
                    <circle [attr.cx]="dot.x" [attr.cy]="dot.y" r="4" />
                  }
                </svg>
                <div class="chart-months">
                  <span>Jan</span><span>Mar</span><span>Mai</span><span>Juil</span><span>Sept</span
                  ><span>Nov</span><span>Déc</span>
                </div>
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
                    ><span class="badge warning">En attente</span>
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
                    ><strong>Brigades citoyennes</strong><small>Dakar</small></span
                  ><time>15 mars 2024</time><b class="badge success">À venir</b>
                </p>
              </article>
              <article class="panel small-panel">
                <div class="panel-title">
                  <h2>Dernières activités</h2>
                  <a href="#">Voir tout →</a>
                </div>
                <p>
                  <ui-icon name="users" /><span
                    ><strong>Nouvelle demande d’adhésion</strong><small>Par Awa Ndiaye</small></span
                  ><time>Il y a 2 h</time>
                </p>
              </article>
            </section>
          }

          @if (view === 'requests' || view === 'members' || view === 'accounts') {
            @if (view === 'members') {
              <nav class="tabs">
                <a class="active">Tous les membres (1 248)</a><a>Membres fondateurs (12)</a
                ><a>Coordonnateurs (86)</a><a>Par localité</a>
              </nav>
            }
            @if (view === 'accounts') {
              <div class="security-alert">
                <ui-icon name="key" />
                <p>
                  <strong>Sécurité</strong>Veillez à n’accorder des accès qu’aux personnes de
                  confiance. Les comptes inactifs doivent être désactivés.
                </p>
                <button>×</button>
              </div>
            }
            <div class="filter-bar">
              <label
                ><ui-icon name="search" /><input
                  [placeholder]="
                    view === 'requests'
                      ? 'Rechercher un nom, un email, une localité…'
                      : 'Rechercher un membre…'
                  " /></label
              ><select>
                <option>Localité · Toutes</option></select
              ><select>
                <option>Statut · Tous</option></select
              ><select>
                <option>Rôle · Tous</option></select
              ><button>Réinitialiser</button>
            </div>
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th><input type="checkbox" aria-label="Tout sélectionner" /></th>
                    <th>Nom complet</th>
                    <th>{{ view === 'accounts' ? 'Email' : 'Localité' }}</th>
                    <th>{{ view === 'requests' ? 'Profession' : 'Rôle' }}</th>
                    <th>{{ view === 'requests' ? 'Date de demande' : 'Date d’adhésion' }}</th>
                    <th>Statut</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  @for (person of visiblePeople; track person.name) {
                    <tr>
                      <td>
                        <input type="checkbox" [attr.aria-label]="'Sélectionner ' + person.name" />
                      </td>
                      <td>
                        <strong>{{ person.name }}</strong>
                      </td>
                      <td>{{ view === 'accounts' ? person.email : person.city }}</td>
                      <td>{{ view === 'requests' ? person.job : person.role }}</td>
                      <td>{{ person.date }}</td>
                      <td>
                        <span
                          class="badge"
                          [class.success]="
                            person.status === 'Actif' || person.status === 'Approuvée'
                          "
                          [class.warning]="person.status === 'En attente'"
                          [class.danger]="
                            person.status === 'Rejetée' || person.status === 'Inactif'
                          "
                          >{{ person.status }}</span
                        >
                      </td>
                      <td>
                        <button class="row-action" aria-label="Voir">◉</button
                        ><button class="row-action" aria-label="Plus d’actions">•••</button>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
              <footer class="table-footer">
                <span>Affichage de 1 à {{ visiblePeople.length }} résultats</span>
                <nav>
                  <button>‹</button><button class="active">1</button><button>2</button
                  ><button>3</button><button>›</button>
                </nav>
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
                ><ui-icon name="search" /><input placeholder="Rechercher un programme…" /></label
              ><select>
                <option>Statut · Tous</option></select
              ><select>
                <option>Localité · Toutes</option></select
              ><button>Réinitialiser</button>
            </div>
            <section class="admin-program-grid">
              @for (program of programs; track program.name) {
                <article class="panel">
                  <header>
                    <ui-icon [name]="program.icon" />
                    <div>
                      <h2>{{ program.name }}</h2>
                      <p>{{ program.description }}</p>
                    </div>
                    <button>•••</button>
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
              <div class="table-wrap">
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
                        <td>{{ territory.region }}</td>
                        <td>{{ territory.coordinators }}</td>
                        <td>{{ territory.members }}</td>
                        <td>
                          <button class="row-action">◉</button
                          ><button class="row-action">•••</button>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </section>
          }
        </div>
      </section>
    </main>
  `,
})
export class AdminPage {
  private readonly route = inject(ActivatedRoute);
  protected readonly view = this.route.snapshot.data['view'] as string;

  protected readonly navItems = [
    { view: 'dashboard', label: 'Tableau de bord', icon: 'home', link: '/bureau' },
    { view: 'requests', label: 'Demandes d’adhésion', icon: 'users', link: '/bureau/demandes' },
    { view: 'members', label: 'Bases de membres', icon: 'grid', link: '/bureau/membres' },
    { view: 'programs', label: 'Programmes', icon: 'calendar', link: '/bureau/programmes' },
    {
      view: 'territories',
      label: 'Localités de coordination',
      icon: 'location',
      link: '/bureau/territoires',
    },
    { view: 'accounts', label: 'Comptes d’accès', icon: 'key', link: '/bureau/comptes' },
  ];
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
      label: 'Demandes en attente',
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
      date: '12 mars 2024',
      status: 'En attente',
    },
    {
      name: 'Mamadou Diop',
      city: 'Dakar',
      email: 'm.diop@gmail.com',
      job: 'Commerçant',
      role: 'Coordonnateur',
      date: '12 mars 2024',
      status: 'En attente',
    },
    {
      name: 'Khady Fall',
      city: 'Thiès',
      email: 'khady.fall@gmail.com',
      job: 'Étudiante',
      role: 'Membre',
      date: '11 mars 2024',
      status: 'En attente',
    },
    {
      name: 'El Hadj Ba',
      city: 'Kaolack',
      email: 'elh.ba@gmail.com',
      job: 'Agriculteur',
      role: 'Membre',
      date: '11 mars 2024',
      status: 'En attente',
    },
    {
      name: 'Fatou Sarr',
      city: 'Ziguinchor',
      email: 'fatou.sarr@gmail.com',
      job: 'Infirmière',
      role: 'Membre',
      date: '10 mars 2024',
      status: 'Approuvée',
    },
    {
      name: 'Ibrahima Cissé',
      city: 'Tambacounda',
      email: 'i.cisse@gmail.com',
      job: 'Enseignant',
      role: 'Coordonnateur',
      date: '10 mars 2024',
      status: 'Rejetée',
    },
    {
      name: 'Marième Diallo',
      city: 'Kolda',
      email: 'm.diallo@gmail.com',
      job: 'Commerçante',
      role: 'Membre',
      date: '9 mars 2024',
      status: 'Actif',
    },
    {
      name: 'Cheikh Fall',
      city: 'Louga',
      email: 'c.fall@gmail.com',
      job: 'Technicien',
      role: 'Membre',
      date: '8 mars 2024',
      status: 'Actif',
    },
  ];
  protected readonly programs = [
    {
      name: 'Brigades citoyennes',
      description: 'Mobilisation des jeunes pour des actions citoyennes.',
      city: 'Dakar',
      date: '15 mars 2024',
      progress: 70,
      status: 'En cours',
      icon: 'leaf',
    },
    {
      name: 'Éducation civique',
      description: 'Sensibilisation dans les écoles et communautés.',
      city: 'Thiès',
      date: '22 avril 2024',
      progress: 45,
      status: 'À venir',
      icon: 'users',
    },
    {
      name: 'Santé communautaire',
      description: 'Actions de prévention et de soutien sanitaire.',
      city: 'Saint-Louis',
      date: '10 févr. 2024',
      progress: 80,
      status: 'En cours',
      icon: 'heart',
    },
    {
      name: 'Environnement propre',
      description: 'Campagnes de reboisement et de salubrité.',
      city: 'Ziguinchor',
      date: '5 mai 2024',
      progress: 30,
      status: 'À venir',
      icon: 'leaf',
    },
    {
      name: 'Autonomisation des femmes',
      description: 'Formations et appui aux activités génératrices de revenus.',
      city: 'Kaolack',
      date: '12 mars 2024',
      progress: 60,
      status: 'En cours',
      icon: 'chart',
    },
    {
      name: 'Jeunesse et leadership',
      description: 'Renforcement des capacités des jeunes leaders.',
      city: 'Tambacounda',
      date: '20 janv. 2024',
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
  protected readonly chartDots = [
    { x: 5, y: 155 },
    { x: 60, y: 145 },
    { x: 115, y: 125 },
    { x: 170, y: 132 },
    { x: 225, y: 112 },
    { x: 280, y: 103 },
    { x: 335, y: 78 },
    { x: 390, y: 83 },
    { x: 445, y: 63 },
    { x: 500, y: 28 },
  ];

  protected get pageTitle(): string {
    return (
      {
        dashboard: 'Tableau de bord',
        requests: 'Demandes d’adhésion',
        members: 'Bases de membres',
        programs: 'Programmes',
        territories: 'Localités de coordination',
        accounts: 'Comptes d’accès',
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
      } as Record<string, string>
    )[this.view];
  }
  protected get actionLabel(): string {
    return (
      (
        {
          requests: 'Nouvelle demande',
          members: 'Ajouter un membre',
          programs: 'Nouveau programme',
          territories: 'Ajouter une localité',
          accounts: 'Créer un compte',
        } as Record<string, string>
      )[this.view] || 'Ajouter'
    );
  }
  protected get visiblePeople() {
    if (this.view === 'requests') return this.requests;
    if (this.view === 'accounts')
      return this.requests
        .slice(0, 6)
        .map((person, index) => ({ ...person, status: index === 5 ? 'Inactif' : 'Actif' }));
    return this.requests.map((person, index) => ({
      ...person,
      status: index === 6 ? 'Inactif' : 'Actif',
    }));
  }
}
