import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MemberCard } from '../shared/member-card';
import { UiIcon } from '../shared/ui-icon';

@Component({
  selector: 'app-member-page',
  imports: [RouterLink, UiIcon, MemberCard],
  template: `
    <main class="workspace-shell">
      <aside class="side-nav">
        <a class="side-logo" routerLink="/"
          ><img src="logo-tabaxi-sidebar.png" alt="Mouvement TABAXI"
        /></a>
        <p class="side-label">Espace membre</p>
        <nav aria-label="Espace membre">
          <a routerLink="/membre" [class.active]="view === 'home'"
            ><ui-icon name="home" />Mon espace</a
          >
          <a routerLink="/membre/programmes" [class.active]="view === 'programs'"
            ><ui-icon name="calendar" />Programmes & activités</a
          >
          <a routerLink="/membre/carte" [class.active]="view === 'card'"
            ><ui-icon name="card" />Ma carte numérique</a
          >
        </nav>
        <div class="side-profile">
          <img src="member-aminata.jpg" alt="" />
          <span><strong>Aminata Ndiaye</strong><small>Dakar</small></span>
          <a routerLink="/"><ui-icon name="users" />Changer de profil</a>
          <a routerLink="/"><ui-icon name="logout" />Se déconnecter</a>
        </div>
      </aside>

      <section class="workspace-area">
        <header class="workspace-topbar">
          <label class="top-search"
            ><ui-icon name="search" /><input placeholder="Rechercher une activité, un programme…"
          /></label>
          <button class="icon-button" aria-label="Notifications">
            <ui-icon name="bell" /><i></i>
          </button>
          <button class="profile-chip" aria-label="Menu du profil">AA</button
          ><span class="chevron">⌄</span>
        </header>

        @if (view === 'home') {
          <div class="workspace-content member-home">
            <header class="page-heading">
              <div>
                <h1>Mon espace</h1>
                <p>Bienvenue dans votre espace membre du Mouvement TABAXI</p>
              </div>
            </header>
            <section class="welcome-banner">
              <img src="hero-tabaxi.jpg" alt="" />
              <div>
                <h2>Bienvenue, Aminata</h2>
                <p>Ensemble pour une citoyenneté active<br />et un avenir meilleur.</p>
                <strong
                  ><ui-icon name="location" /> Dakar <span>12 activités ce mois-ci</span></strong
                >
              </div>
              <em>Notre engagement<br />pour des communautés<br />plus fortes</em>
            </section>
            <section class="stat-grid">
              @for (stat of stats; track stat.label) {
                <article>
                  <span class="stat-icon"><ui-icon [name]="stat.icon" /></span>
                  <div>
                    <strong>{{ stat.value }}</strong>
                    <p>
                      {{ stat.label }}<small>{{ stat.note }}</small>
                    </p>
                  </div>
                  <b>{{ stat.delta }}</b>
                </article>
              }
            </section>
            <section class="member-grid">
              <article class="panel member-card-panel">
                <h2>Votre carte de membre</h2>
                <app-member-card /><a routerLink="/membre/carte"
                  >Voir ma carte numérique <span>→</span></a
                >
              </article>
              <article class="panel profile-panel">
                <div class="panel-title">
                  <h2>Mon profil</h2>
                  <a href="#"><ui-icon name="plus" />Modifier</a>
                </div>
                <img src="member-aminata.jpg" alt="Aminata Ndiaye" />
                <h3>Aminata Ndiaye</h3>
                <span class="badge success">Membre actif</span>
                <dl>
                  <dt>N° d’adhérent</dt>
                  <dd>TABAXI-2024-0125</dd>
                  <dt>Localité</dt>
                  <dd>Dakar</dd>
                  <dt>Rôle</dt>
                  <dd>Membre</dd>
                  <dt>Date d’adhésion</dt>
                  <dd>12 mars 2024</dd>
                </dl>
              </article>
              <article class="panel coordinator-panel">
                <h2>Mon coordonnateur</h2>
                <img src="coordinator-mamadou.jpg" alt="Mamadou Diop" />
                <h3>Mamadou Diop</h3>
                <p>Coordonnateur · Dakar</p>
                <ul>
                  <li><ui-icon name="phone" />+221 77 123 45 67</li>
                  <li><ui-icon name="mail" />m.diop&#64;tabaxi.org</li>
                  <li><ui-icon name="location" />Dakar</li>
                </ul>
                <button class="btn btn-green"><ui-icon name="mail" />Contacter</button>
              </article>
            </section>
            <section class="activity-grid">
              <article class="panel upcoming-panel">
                <div class="panel-title">
                  <h2>Mes prochaines activités</h2>
                  <a routerLink="/membre/programmes">Voir tout →</a>
                </div>
                <div class="mini-programs">
                  @for (program of programs.slice(0, 2); track program.name) {
                    <div>
                      <ui-icon [name]="program.icon" /><strong>{{ program.name }}</strong>
                      <p>
                        <ui-icon name="calendar" />{{ program.date }} <ui-icon name="location" />{{
                          program.city
                        }}
                      </p>
                      <span class="badge warning">{{ program.status }}</span
                      ><a class="btn btn-green" routerLink="/membre/programmes">Voir les détails</a>
                    </div>
                  }
                </div>
              </article>
              <article class="panel news-panel">
                <div class="panel-title">
                  <h2>Actualités du mouvement</h2>
                  <a href="#">Voir tout →</a>
                </div>
                @for (item of news; track item.title) {
                  <div class="news-row">
                    <span></span>
                    <div>
                      <strong>{{ item.title }}</strong
                      ><small>{{ item.date }}</small>
                    </div>
                  </div>
                }
              </article>
            </section>
          </div>
        }

        @if (view === 'programs') {
          <div class="workspace-content">
            <header class="page-heading">
              <div>
                <h1>Programmes & activités</h1>
                <p>Découvrez et participez aux initiatives du Mouvement TABAXI</p>
              </div>
              <button class="btn btn-green"><ui-icon name="plus" />Nouvelle recherche</button>
            </header>
            <nav class="tabs">
              <a class="active">Toutes (18)</a><a>En cours (10)</a><a>À venir (5)</a
              ><a>Terminées (3)</a>
            </nav>
            <div class="filter-bar">
              <label
                ><ui-icon name="search" /><input placeholder="Rechercher une activité…" /></label
              ><select>
                <option>Localité · Toutes</option></select
              ><select>
                <option>Catégorie · Toutes</option></select
              ><select>
                <option>Statut · Tous</option></select
              ><button>Réinitialiser</button>
            </div>
            <section class="program-list">
              @for (program of programs; track program.name) {
                <article>
                  <span
                    class="program-icon"
                    [class.yellow]="program.color === 'yellow'"
                    [class.red]="program.color === 'red'"
                    ><ui-icon [name]="program.icon"
                  /></span>
                  <div class="program-copy">
                    <h2>{{ program.name }}</h2>
                    <p>{{ program.description }}</p>
                  </div>
                  <p><ui-icon name="calendar" />{{ program.date }}<small>09h00 – 12h00</small></p>
                  <p><ui-icon name="location" />{{ program.city }}</p>
                  <span
                    class="badge"
                    [class.warning]="program.status === 'À venir'"
                    [class.success]="program.status === 'En cours'"
                    >{{ program.status }}</span
                  ><button class="btn btn-green">Participer</button>
                </article>
              }
            </section>
          </div>
        }

        @if (view === 'card') {
          <div class="workspace-content card-view">
            <header class="page-heading">
              <div>
                <h1>Ma carte numérique</h1>
                <p>Votre carte de membre officielle du Mouvement TABAXI</p>
              </div>
            </header>
            <app-member-card [large]="true" />
            <div class="card-actions">
              <button class="btn btn-green"><ui-icon name="download" />Télécharger en image</button
              ><button class="btn btn-outline"><ui-icon name="card" />Enregistrer en PDF</button>
            </div>
            <p class="info-note">
              Cette carte est personnelle et confidentielle. Elle atteste de votre adhésion au
              Mouvement TABAXI.
            </p>
          </div>
        }
      </section>
    </main>
  `,
})
export class MemberPage {
  private readonly route = inject(ActivatedRoute);
  protected readonly view = this.route.snapshot.data['view'] as 'home' | 'programs' | 'card';

  protected readonly stats = [
    { icon: 'users', value: '1 248', label: 'Membres', note: 'dans le mouvement', delta: '+12%' },
    {
      icon: 'location',
      value: '86',
      label: 'Coordonnateurs',
      note: 'à votre service',
      delta: '+3%',
    },
    { icon: 'calendar', value: '24', label: 'Activités', note: 'ce mois-ci', delta: '+5%' },
    { icon: 'users', value: '18', label: 'Programmes', note: 'en cours', delta: '+5%' },
  ];
  protected readonly programs = [
    {
      name: 'Brigades citoyennes',
      description: 'Mobilisation des jeunes pour des actions citoyennes dans les localités.',
      date: '15 mars 2024',
      city: 'Dakar',
      status: 'En cours',
      icon: 'leaf',
      color: 'green',
    },
    {
      name: 'Éducation civique',
      description: 'Sensibilisation dans les écoles et communautés.',
      date: '22 avril 2024',
      city: 'Dakar',
      status: 'À venir',
      icon: 'users',
      color: 'yellow',
    },
    {
      name: 'Santé communautaire',
      description: 'Actions de prévention et de soutien sanitaire.',
      date: '10 févr. 2024',
      city: 'Saint-Louis',
      status: 'En cours',
      icon: 'heart',
      color: 'red',
    },
    {
      name: 'Environnement propre',
      description: 'Campagnes de reboisement et de salubrité.',
      date: '5 mai 2024',
      city: 'Ziguinchor',
      status: 'À venir',
      icon: 'leaf',
      color: 'green',
    },
    {
      name: 'Autonomisation des femmes',
      description: 'Formations et appui aux activités génératrices de revenus.',
      date: '12 mars 2024',
      city: 'Kaolack',
      status: 'En cours',
      icon: 'chart',
      color: 'yellow',
    },
    {
      name: 'Jeunesse et leadership',
      description: 'Renforcement des capacités des jeunes leaders.',
      date: '20 janv. 2024',
      city: 'Tambacounda',
      status: 'Terminée',
      icon: 'book',
      color: 'red',
    },
  ];
  protected readonly news = [
    { title: 'Lancement du programme de reboisement', date: '5 mars 2024' },
    { title: 'Ateliers de citoyenneté dans les écoles', date: '26 février 2024' },
    { title: 'Le mouvement TABAXI grandit à Dakar', date: '15 février 2024' },
  ];
}
