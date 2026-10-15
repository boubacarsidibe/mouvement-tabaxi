import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MemberCard } from '../shared/member-card';
import { DEMO_MEMBER, drawMemberCard } from '../shared/member-card-image';
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
          <a routerLink="/membre/profil" [class.active]="view === 'profile'"
            ><ui-icon name="users" />Mon profil</a
          >
        </nav>
        <div class="side-profile">
          <img src="member-aminata.jpg" alt="" />
          <span><strong>Aminata Ndiaye</strong><small>Dakar</small></span>
          <a routerLink="/membre/securite" [class.active]="view === 'security'"
            ><ui-icon name="key" />Sécurité du compte</a
          >
          <a routerLink="/"><ui-icon name="logout" />Se déconnecter</a>
        </div>
      </aside>

      <section class="workspace-area">
        <header class="workspace-topbar">
          <label class="top-search"
            ><ui-icon name="search" /><input
              aria-label="Rechercher une activité ou un programme"
              placeholder="Rechercher une activité, un programme…"
          /></label>
          <button class="icon-button" aria-label="Notifications">
            <ui-icon name="bell" /><i></i>
          </button>
          <button class="profile-chip" aria-label="Menu du profil">AA</button
          ><span class="chevron" aria-hidden="true">⌄</span>
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
                  <a routerLink="/membre/profil"><ui-icon name="plus" />Modifier</a>
                </div>
                <img src="member-aminata.jpg" alt="Aminata Ndiaye" />
                <h3>Aminata Ndiaye</h3>
                <span class="badge success">Membre actif</span>
                <dl>
                  <dt>N° d’adhérent</dt>
                  <dd>TBX-2026-00125</dd>
                  <dt>Localité</dt>
                  <dd>Dakar</dd>
                  <dt>Rôle</dt>
                  <dd>Membre</dd>
                  <dt>Date d’adhésion</dt>
                  <dd>12 mars 2026</dd>
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
                  <a routerLink="/" fragment="actualites">Voir tout →</a>
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
                ><ui-icon name="search" /><input
                  aria-label="Rechercher une activité"
                  placeholder="Rechercher une activité…" /></label
              ><select aria-label="Filtrer par localité">
                <option>Localité · Toutes</option></select
              ><select aria-label="Filtrer par catégorie">
                <option>Catégorie · Toutes</option></select
              ><select aria-label="Filtrer par statut">
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
                  ><a class="btn btn-green" routerLink="/membre/activites/brigades-citoyennes"
                    >Voir l’activité</a
                  >
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
              <button class="btn btn-green" type="button" (click)="downloadCard()">
                <ui-icon name="download" />Télécharger en image</button
              ><button class="btn btn-outline" type="button" (click)="printCard()">
                <ui-icon name="card" />Enregistrer en PDF
              </button>
            </div>
            @if (cardError()) {
              <p class="inline-error" role="alert">{{ cardError() }}</p>
            }
            <p class="info-note">
              Cette carte est personnelle et confidentielle. Elle atteste de votre adhésion au
              Mouvement TABAXI.
            </p>
          </div>
        }

        @if (view === 'profile') {
          <div class="workspace-content narrow-workspace">
            <header class="page-heading">
              <div>
                <p class="eyebrow">Informations personnelles</p>
                <h1>Mon profil</h1>
                <p>Mettez à jour vos coordonnées et votre photo.</p>
              </div>
              <span class="badge success">Membre actif</span>
            </header>
            <form class="workspace-form panel" (submit)="saveProfile($event)">
              <section class="profile-identity">
                <img src="member-aminata.jpg" alt="Aminata Ndiaye" />
                <div>
                  <h2>Photo de profil</h2>
                  <p>JPG ou PNG, 5 Mo maximum.</p>
                  <button class="btn btn-outline" type="button">Choisir une photo</button>
                </div>
              </section>
              <div class="field-grid">
                <label
                  >Prénom <input value="Aminata" disabled /><small
                    >Modifiable uniquement par le bureau.</small
                  ></label
                >
                <label
                  >Nom <input value="Ndiaye" disabled /><small
                    >Modifiable uniquement par le bureau.</small
                  ></label
                >
              </div>
              <label
                >Adresse courriel <input type="email" value="aminata.ndiaye@gmail.com" required
              /></label>
              <label
                >Adresse complète <input value="18, rue de la Corniche, Dakar" required
              /></label>
              <div class="field-grid">
                <label>Téléphone <input type="tel" value="+221 77 456 78 90" /></label>
                <label
                  >Territoire <input value="Dakar" disabled /><small
                    >Rattaché par le bureau.</small
                  ></label
                >
              </div>
              <div class="form-actions">
                <a class="btn btn-outline" routerLink="/membre">Annuler</a>
                <button class="btn btn-green" type="submit">Enregistrer les modifications</button>
              </div>
              @if (profileSaved()) {
                <p class="inline-success" role="status">✓ Vos informations ont été enregistrées.</p>
              }
            </form>
          </div>
        }

        @if (view === 'activity') {
          <div class="workspace-content activity-detail-view">
            <a class="back-link" routerLink="/membre/programmes">← Retour aux activités</a>
            <section class="activity-hero panel">
              <div class="activity-kicker"><ui-icon name="leaf" />Brigades citoyennes · Dakar</div>
              <h1>Nettoyage citoyen de la plage de Yoff</h1>
              <p>
                Une matinée utile pour rendre la plage plus propre et sensibiliser les riverains à
                la gestion des déchets.
              </p>
              <div class="activity-meta">
                <span
                  ><ui-icon name="calendar" /><strong>Samedi 24 octobre</strong>09 h 00 – 12 h
                  00</span
                >
                <span
                  ><ui-icon name="location" /><strong>Plage de Yoff</strong>Rendez-vous près du
                  poste de secours</span
                >
                <span
                  ><ui-icon name="users" /><strong>42 participants</strong>8 places restantes</span
                >
              </div>
            </section>
            <div class="detail-columns">
              <article class="panel prose-panel">
                <h2>À propos de l’activité</h2>
                <p>
                  Les équipes seront réparties par zone. Le matériel de collecte, les gants et l’eau
                  seront fournis sur place.
                </p>
                <h3>À prévoir</h3>
                <ul>
                  <li>Une tenue confortable et des chaussures fermées</li>
                  <li>Une casquette et une protection solaire</li>
                  <li>Votre carte de membre numérique</li>
                </ul>
                <h3>Coordination</h3>
                <div class="contact-row">
                  <img src="coordinator-mamadou.jpg" alt="" /><span
                    ><strong>Mamadou Diop</strong><small>Coordonnateur · Dakar</small></span
                  ><button class="btn btn-outline">Contacter</button>
                </div>
              </article>
              <aside class="panel registration-panel">
                <p class="eyebrow">Votre participation</p>
                <h2>{{ joined() ? 'Inscription confirmée' : 'Participez avec nous' }}</h2>
                <p>
                  {{
                    joined()
                      ? 'Votre place est réservée. Vous recevrez un rappel la veille.'
                      : 'Inscrivez-vous avant le 22 octobre pour aider l’équipe à préparer le matériel.'
                  }}
                </p>
                <button
                  class="btn btn-green btn-wide"
                  type="button"
                  (click)="joined.set(!joined())"
                >
                  {{ joined() ? 'Se désinscrire' : 'Je participe' }}
                </button>
                <small>Inscription gratuite · réservée aux membres de Dakar</small>
              </aside>
            </div>
          </div>
        }

        @if (view === 'security') {
          <div class="workspace-content narrow-workspace">
            <header class="page-heading">
              <div>
                <p class="eyebrow">Compte</p>
                <h1>Sécurité du compte</h1>
                <p>Gérez votre mot de passe et vos connexions actives.</p>
              </div>
            </header>
            <section class="settings-stack">
              <form class="workspace-form panel" (submit)="savePassword($event)">
                <h2>Changer mon mot de passe</h2>
                <p>Utilisez au moins 10 caractères, avec une lettre et un chiffre.</p>
                <label>Mot de passe actuel <input type="password" required minlength="10" /></label>
                <div class="field-grid">
                  <label
                    >Nouveau mot de passe <input type="password" required minlength="10" /></label
                  ><label
                    >Confirmer le mot de passe <input type="password" required minlength="10"
                  /></label>
                </div>
                <div class="form-actions">
                  <button class="btn btn-green" type="submit">Mettre à jour</button>
                </div>
                @if (passwordSaved()) {
                  <p class="inline-success" role="status">✓ Mot de passe mis à jour.</p>
                }
              </form>
              <article class="panel session-panel">
                <div>
                  <h2>Session active</h2>
                  <p><strong>Windows · Codex</strong><small>Dakar · maintenant</small></p>
                </div>
                <span class="badge success">Cette session</span>
              </article>
            </section>
          </div>
        }
      </section>
    </main>
  `,
})
export class MemberPage {
  private readonly route = inject(ActivatedRoute);
  protected readonly view = this.route.snapshot.data['view'] as
    'home' | 'programs' | 'card' | 'profile' | 'activity' | 'security';
  protected readonly joined = signal(false);
  protected readonly profileSaved = signal(false);
  protected readonly passwordSaved = signal(false);
  protected readonly cardError = signal('');

  protected async downloadCard(): Promise<void> {
    this.cardError.set('');
    try {
      const blob = await drawMemberCard(DEMO_MEMBER);
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `carte-TABAXI-${DEMO_MEMBER.number}.png`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch {
      this.cardError.set('La carte n’a pas pu être téléchargée. Réessayez dans un instant.');
    }
  }

  /** La boîte d'impression du navigateur propose « Enregistrer au format PDF ». */
  protected printCard(): void {
    window.print();
  }

  protected saveProfile(event: SubmitEvent): void {
    event.preventDefault();
    if ((event.currentTarget as HTMLFormElement).reportValidity()) this.profileSaved.set(true);
  }

  protected savePassword(event: SubmitEvent): void {
    event.preventDefault();
    if ((event.currentTarget as HTMLFormElement).reportValidity()) this.passwordSaved.set(true);
  }

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
      date: '15 sept. 2026',
      city: 'Dakar',
      status: 'En cours',
      icon: 'leaf',
      color: 'green',
    },
    {
      name: 'Éducation civique',
      description: 'Sensibilisation dans les écoles et communautés.',
      date: '22 nov. 2026',
      city: 'Dakar',
      status: 'À venir',
      icon: 'users',
      color: 'yellow',
    },
    {
      name: 'Santé communautaire',
      description: 'Actions de prévention et de soutien sanitaire.',
      date: '10 août 2026',
      city: 'Saint-Louis',
      status: 'En cours',
      icon: 'heart',
      color: 'red',
    },
    {
      name: 'Environnement propre',
      description: 'Campagnes de reboisement et de salubrité.',
      date: '5 déc. 2026',
      city: 'Ziguinchor',
      status: 'À venir',
      icon: 'leaf',
      color: 'green',
    },
    {
      name: 'Autonomisation des femmes',
      description: 'Formations et appui aux activités génératrices de revenus.',
      date: '12 sept. 2026',
      city: 'Kaolack',
      status: 'En cours',
      icon: 'chart',
      color: 'yellow',
    },
    {
      name: 'Jeunesse et leadership',
      description: 'Renforcement des capacités des jeunes leaders.',
      date: '20 janv. 2026',
      city: 'Tambacounda',
      status: 'Terminée',
      icon: 'book',
      color: 'red',
    },
  ];
  protected readonly news = [
    { title: 'Lancement du programme de reboisement', date: '5 octobre 2026' },
    { title: 'Ateliers de citoyenneté dans les écoles', date: '26 septembre 2026' },
    { title: 'Le mouvement TABAXI grandit à Dakar', date: '15 septembre 2026' },
  ];
}
