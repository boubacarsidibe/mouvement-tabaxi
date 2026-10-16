import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService, MembershipApplication } from '../core/api.service';
import { Capability, hasCapability } from '../core/access-control';
import { UiIcon } from '../shared/ui-icon';
import { WorkspaceTopbar } from '../shared/workspace-topbar';

@Component({
  selector: 'app-admin-page',
  imports: [RouterLink, UiIcon, WorkspaceTopbar],
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
          <a routerLink="/membre"><ui-icon name="users" />Espace membre</a>
          <div class="side-user">
            <span>{{ userInitials }}</span>
            <p>
              <strong>{{ currentUser()?.email }}</strong
              ><small>{{ currentUser()?.role_label }}</small>
            </p>
          </div>
          <a routerLink="/" (click)="logout($event)"><ui-icon name="logout" />Se déconnecter</a>
        </div>
      </aside>

      <section class="workspace-area">
        <app-workspace-topbar
          context="Bureau exécutif"
          [initials]="userInitials"
          [name]="userName"
          [role]="currentUser()?.role_label ?? ''"
        />

        <div class="workspace-content admin-content">
          <header class="page-heading">
            <div>
              <h1>{{ pageTitle }}</h1>
              <p>{{ pageSubtitle }}</p>
            </div>
            @if (showPrimaryAction) {
              <a class="btn btn-green" [routerLink]="actionLink"
                ><ui-icon name="plus" />{{ actionLabel }}</a
              >
            } @else if (view === 'dashboard') {
              <span class="date-button">
                <ui-icon name="calendar" />1 jan. 2026 – 31 déc. 2026
              </span>
            }
          </header>

          @if (view === 'dashboard') {
            <section class="stat-grid admin-stats">
              @for (stat of dashboardStats; track stat.label) {
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
              @if (has('reviewApplications')) {
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
              }
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
                  <h2>{{ has('viewAudit') ? 'Dernières actions' : 'Activité à suivre' }}</h2>
                  <a
                    [routerLink]="
                      has('viewAudit')
                        ? '/bureau/journal'
                        : '/bureau/programmes/brigades-citoyennes'
                    "
                    >Ouvrir →</a
                  >
                </div>
                <p>
                  <ui-icon [name]="has('viewAudit') ? 'users' : 'leaf'" /><span
                    ><strong>{{
                      has('viewAudit')
                        ? 'Nouvelle demande d’adhésion'
                        : 'Nettoyage citoyen de la plage de Yoff'
                    }}</strong
                    ><small>{{ has('viewAudit') ? 'Par Awa Ndiaye' : 'Dakar' }}</small></span
                  ><time>{{ has('viewAudit') ? 'Il y a 2 h' : '24 oct. 2026' }}</time>
                </p>
              </article>
            </section>
          }

          @if (
            view === 'requests' ||
            view === 'members' ||
            view === 'accounts' ||
            view === 'coordinators'
          ) {
            @if (view === 'accounts' && has('manageAccounts')) {
              <div class="security-alert">
                <ui-icon name="key" />
                <p>
                  <strong>Sécurité</strong>Veillez à n’accorder des accès qu’aux personnes de
                  confiance. Les comptes inactifs doivent être désactivés.
                </p>
              </div>
            }
            <div class="filter-bar">
              <label
                ><ui-icon name="search" /><input
                  [attr.aria-label]="
                    view === 'requests'
                      ? 'Rechercher une demande'
                      : view === 'accounts'
                        ? 'Rechercher un compte'
                        : 'Rechercher un membre'
                  "
                  [value]="peopleQuery()"
                  (input)="updatePeopleQuery($any($event.target).value)"
                  [placeholder]="
                    view === 'requests'
                      ? 'Rechercher un nom, un email, une localité…'
                      : view === 'accounts'
                        ? 'Rechercher un compte…'
                        : 'Rechercher un membre…'
                  "
              /></label>
              @if (view === 'members' || view === 'coordinators') {
                <select
                  aria-label="Filtrer par localité"
                  [value]="peoplePlace()"
                  (change)="peoplePlace.set($any($event.target).value)"
                >
                  <option value="">Localité · Toutes</option>
                  @for (territory of territories; track territory.city) {
                    <option [value]="territory.city">{{ territory.city }}</option>
                  }
                </select>
              }
              <select
                aria-label="Filtrer par statut"
                [value]="peopleStatus()"
                (change)="updatePeopleStatus($any($event.target).value)"
              >
                <option value="">Statut · Tous</option>
                @if (view === 'requests') {
                  <option value="a_examiner">À examiner</option>
                  <option value="acceptee">Acceptée</option>
                  <option value="rejetee">Rejetée</option>
                  <option value="inscrite">Inscrite</option>
                } @else if (view === 'accounts') {
                  <option value="Actif">Actif</option>
                  <option value="Inactif">Inactif</option>
                } @else {
                  <option value="Actif">Actif</option>
                  <option value="Suspendu">Suspendu</option>
                }
              </select>
              @if (view === 'accounts') {
                <select
                  aria-label="Filtrer par rôle"
                  [value]="peopleRole()"
                  (change)="peopleRole.set($any($event.target).value)"
                >
                  <option value="">Rôle · Tous</option>
                  <option value="Membre">Membre</option>
                  <option value="Coordonnateur">Coordonnateur</option>
                </select>
              }
              <button type="button" (click)="resetPeopleFilters()">Réinitialiser</button>
            </div>
            @if (view === 'requests' && requestsLoading()) {
              <p class="inline-notice" role="status">Chargement des demandes…</p>
            }
            @if (view === 'requests' && requestError()) {
              <p class="inline-error" role="alert">{{ requestError() }}</p>
            }
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
                    @if (view !== 'members') {
                      <th>{{ view === 'requests' ? 'Profession' : 'Rôle' }}</th>
                    }
                    <th [attr.aria-sort]="ariaSort('date')">
                      <button class="th-sort" type="button" (click)="sortBy('date')">
                        {{ view === 'requests' ? 'Date de demande' : 'Date d’adhésion' }}
                        <span aria-hidden="true">{{ sortIndicator('date') }}</span>
                      </button>
                    </th>
                    <th>Statut</th>
                    <th>Actions</th>
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
                      @if (view !== 'members') {
                        <td [attr.data-label]="view === 'requests' ? 'Profession' : 'Rôle'">
                          {{ view === 'requests' ? person.job : person.role }}
                        </td>
                      }
                      <td [attr.data-label]="view === 'requests' ? 'Demande' : 'Adhésion'">
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
                      <td>
                        <a
                          class="row-action"
                          [routerLink]="personLink(person)"
                          [attr.aria-label]="'Voir la fiche de ' + person.name"
                          >Ouvrir</a
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
            <div class="filter-bar">
              <label
                ><ui-icon name="search" /><input
                  aria-label="Rechercher un programme"
                  placeholder="Rechercher un programme…"
                  [value]="programQuery()"
                  (input)="programQuery.set($any($event.target).value)" /></label
              ><select
                aria-label="Filtrer par statut"
                [value]="programStatus()"
                (change)="programStatus.set($any($event.target).value)"
              >
                <option value="">Statut · Tous</option>
                <option value="En cours">En cours</option>
                <option value="À venir">À venir</option>
                <option value="Terminé">Terminé</option></select
              ><select
                aria-label="Filtrer par localité"
                [value]="programPlace()"
                (change)="programPlace.set($any($event.target).value)"
              >
                <option value="">Localité · Toutes</option>
                @for (territory of territories; track territory.city) {
                  <option [value]="territory.city">{{ territory.city }}</option>
                }</select
              ><button type="button" (click)="resetProgramFilters()">Réinitialiser</button>
            </div>
            <section class="admin-program-grid">
              @for (program of visiblePrograms; track program.name) {
                <article class="panel">
                  <header>
                    <ui-icon [name]="program.icon" />
                    <div>
                      <h2>{{ program.name }}</h2>
                      <p>{{ program.description }}</p>
                    </div>
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
                    ><a class="row-action" routerLink="/bureau/programmes/brigades-citoyennes"
                      >Ouvrir</a
                    >
                  </footer>
                </article>
              } @empty {
                <p class="empty-state">Aucun programme ne correspond à ces filtres.</p>
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
            <section class="territory-layout territory-list-only">
              <div class="table-wrap responsive-table">
                <table>
                  <thead>
                    <tr>
                      <th>Localité</th>
                      <th>Région</th>
                      <th>Coordonnateurs</th>
                      <th>Membres</th>
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
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </section>
          }

          @if (view === 'request-detail') {
            <a class="back-link" routerLink="/bureau/demandes">← Retour aux demandes</a>
            @if (requestsLoading()) {
              <p class="inline-notice" role="status">Chargement de la demande…</p>
            }
            @if (requestError()) {
              <p class="inline-error" role="alert">{{ requestError() }}</p>
            }
            @if (selectedApplication(); as application) {
              <section class="review-grid">
                <article class="panel review-main">
                  <div class="identity-row">
                    <span class="identity-avatar">{{ initials(application) }}</span>
                    <div>
                      <p class="eyebrow">Demande {{ application.reference }}</p>
                      <h2>{{ application.first_name }} {{ application.last_name }}</h2>
                      <p>Déposée le {{ formatDate(application.created_at) }}</p>
                    </div>
                    <span
                      class="badge"
                      [class.warning]="application.status === 'a_examiner'"
                      [class.success]="
                        application.status === 'acceptee' || application.status === 'inscrite'
                      "
                      [class.danger]="application.status === 'rejetee'"
                      >{{ application.status_label }}</span
                    >
                  </div>
                  <dl class="detail-list">
                    <div>
                      <dt>Adresse courriel</dt>
                      <dd>{{ application.email }}</dd>
                    </div>
                    <div>
                      <dt>Profession</dt>
                      <dd>{{ application.profession }}</dd>
                    </div>
                    <div>
                      <dt>Localité souhaitée</dt>
                      <dd>{{ application.territory.path }}</dd>
                    </div>
                    <div>
                      <dt>Consentement</dt>
                      <dd>Donné le {{ formatDate(application.consent_at) }}</dd>
                    </div>
                  </dl>
                  <div class="motivation-box">
                    <h3>Motivation</h3>
                    <p>{{ application.motivation }}</p>
                  </div>
                </article>
                <aside class="panel decision-panel">
                  <p class="eyebrow">Décision du fondateur</p>
                  <h2>Examiner la demande</h2>
                  <p>La personne reçoit la décision par courriel. Chaque action est datée.</p>

                  @if (application.status === 'a_examiner') {
                    <label
                      >Note interne<textarea
                        #internalNote
                        rows="4"
                        placeholder="Ajouter une note utile au bureau…"
                      ></textarea>
                    </label>
                    @if (rejectMode()) {
                      <label
                        >Motif communiqué à la personne <em>*</em
                        ><textarea
                          #rejectionReason
                          rows="4"
                          required
                          placeholder="Expliquez clairement le refus…"
                        ></textarea>
                      </label>
                      <button
                        class="btn btn-danger-outline btn-wide"
                        type="button"
                        [disabled]="decisionLoading()"
                        (click)="
                          decide(application, 'reject', internalNote.value, rejectionReason.value)
                        "
                      >
                        {{ decisionLoading() ? 'Envoi en cours…' : 'Confirmer le refus' }}
                      </button>
                      <button
                        class="btn btn-outline btn-wide"
                        type="button"
                        (click)="rejectMode.set(false)"
                      >
                        Annuler
                      </button>
                    } @else {
                      <button
                        class="btn btn-green btn-wide"
                        type="button"
                        [disabled]="decisionLoading()"
                        (click)="decide(application, 'accept', internalNote.value)"
                      >
                        {{ decisionLoading() ? 'Envoi en cours…' : 'Accepter et envoyer le lien' }}
                      </button>
                      <button
                        class="btn btn-danger-outline btn-wide"
                        type="button"
                        (click)="rejectMode.set(true)"
                      >
                        Refuser avec un motif
                      </button>
                    }
                  } @else {
                    <p class="inline-success" role="status">
                      Cette demande a déjà été traitée : {{ application.status_label }}.
                    </p>
                    @if (application.rejection_reason) {
                      <p><strong>Motif envoyé :</strong> {{ application.rejection_reason }}</p>
                    }
                  }

                  @if (requestDecision() !== 'pending') {
                    <p class="inline-success" role="status">
                      ✓ Décision enregistrée et courriel envoyé.
                    </p>
                  }
                </aside>
              </section>
            }
          }

          @if (view === 'member-detail') {
            <a class="back-link" routerLink="/bureau/membres">← Retour à la base des membres</a>
            <section
              class="review-grid member-detail-grid"
              [class.single-column]="!has('manageMemberStatus')"
            >
              <article class="panel member-record">
                <div class="identity-row">
                  <img src="member-aminata.jpg" alt="Aminata Ndiaye" />
                  <div>
                    <p class="eyebrow">TBX-2026-00125</p>
                    <h2>Aminata Ndiaye</h2>
                    <p>Membre simple · Dakar</p>
                  </div>
                  <span
                    class="badge"
                    [class.success]="memberStatus() === 'Actif'"
                    [class.warning]="memberStatus() === 'Suspendu'"
                    [class.danger]="memberStatus() === 'Radié'"
                    >{{ memberStatus() }}</span
                  >
                </div>
                <dl class="detail-list">
                  <div>
                    <dt>Courriel</dt>
                    <dd>aminata.ndiaye&#64;gmail.com</dd>
                  </div>
                  <div>
                    <dt>Téléphone</dt>
                    <dd>+221 77 456 78 90</dd>
                  </div>
                  <div>
                    <dt>Adresse</dt>
                    <dd>18, rue de la Corniche, Dakar</dd>
                  </div>
                  <div>
                    <dt>Date d’adhésion</dt>
                    <dd>12 mars 2026</dd>
                  </div>
                </dl>
                <h3>Participation récente</h3>
                <div class="history-row">
                  <ui-icon name="leaf" /><span
                    ><strong>Nettoyage citoyen de Yoff</strong
                    ><small>Inscrite · 24 octobre 2026</small></span
                  >
                </div>
                <div class="history-row">
                  <ui-icon name="users" /><span
                    ><strong>Atelier d’éducation civique</strong
                    ><small>Présente · 8 octobre 2026</small></span
                  >
                </div>
              </article>
              @if (has('manageMemberStatus')) {
                <aside class="panel decision-panel">
                  <p class="eyebrow">Statut du compte</p>
                  <h2>Gérer l’accès</h2>
                  <p>
                    Une suspension ou une radiation bloque immédiatement la connexion sans effacer
                    l’historique.
                  </p>
                  <button
                    class="btn btn-outline btn-wide"
                    type="button"
                    (click)="memberStatus.set('Actif')"
                  >
                    Rendre actif
                  </button>
                  <button
                    class="btn btn-gold-outline btn-wide"
                    type="button"
                    (click)="memberStatus.set('Suspendu')"
                  >
                    Suspendre
                  </button>
                  <button
                    class="btn btn-danger-outline btn-wide"
                    type="button"
                    (click)="memberStatus.set('Radié')"
                  >
                    Radier
                  </button>
                </aside>
              }
            </section>
          }

          @if (view === 'audit') {
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

          @if (
            view === 'program-new' ||
            view === 'activity-new' ||
            view === 'report' ||
            view === 'invite'
          ) {
            <a
              class="back-link"
              [routerLink]="view === 'invite' ? '/bureau/comptes' : '/bureau/programmes'"
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
                <label
                  >État
                  <select required>
                    <option value="">Sélectionner un état</option>
                    <option>Prévu</option>
                    <option>En cours</option>
                    <option>Terminé</option>
                    <option>Annulé</option>
                  </select></label
                >
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
              } @else {
                <p class="eyebrow">Compte d’accès</p>
                <h2>Inviter un coordonnateur</h2>
                <p>La personne recevra un lien personnel pour créer son mot de passe.</p>
                <div class="field-grid">
                  <label>Prénom <input placeholder="Prénom" required /></label
                  ><label>Nom <input placeholder="Nom" required /></label>
                </div>
                <label
                  >Adresse courriel
                  <input type="email" placeholder="prenom.nom@exemple.com" required
                /></label>
                <div class="field-grid">
                  <label
                    >Rôle
                    <select required>
                      <option>Coordonnateur</option>
                      <option>Membre fondateur</option>
                    </select></label
                  ><label
                    >Territoire
                    <select required>
                      <option value="">Sélectionner un territoire</option>
                      <option>Dakar</option>
                      <option>Thiès</option>
                      <option>Saint-Louis</option>
                    </select></label
                  >
                </div>
              }
              <div class="form-actions">
                <a
                  class="btn btn-outline"
                  [routerLink]="view === 'invite' ? '/bureau/comptes' : '/bureau/programmes'"
                  >Annuler</a
                ><button class="btn btn-green" type="submit">
                  {{
                    view === 'report'
                      ? 'Publier le compte rendu'
                      : view === 'invite'
                        ? 'Envoyer l’invitation'
                        : 'Enregistrer'
                  }}
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
                <span>Chaque présence est enregistrée dès sa modification.</span>
              </footer>
            </div>
          }
        </div>
      </section>
    </main>
  `,
})
export class AdminPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);
  protected readonly currentUser = this.api.currentUser;
  protected readonly view = this.route.snapshot.data['view'] as string;

  private readonly allNavItems: Array<{
    view: string;
    label: string;
    icon: string;
    link: string;
    capability: Capability;
  }> = [
    {
      view: 'dashboard',
      label: 'Tableau de bord',
      icon: 'home',
      link: '/bureau',
      capability: 'bureauSpace',
    },
    {
      view: 'requests',
      label: 'Demandes d’adhésion',
      icon: 'users',
      link: '/bureau/demandes',
      capability: 'reviewApplications',
    },
    {
      view: 'members',
      label: 'Membres',
      icon: 'grid',
      link: '/bureau/membres',
      capability: 'viewMembers',
    },
    {
      view: 'coordinators',
      label: 'Coordonnateurs',
      icon: 'users',
      link: '/bureau/coordonnateurs',
      capability: 'viewMembers',
    },
    {
      view: 'programs',
      label: 'Programmes',
      icon: 'calendar',
      link: '/bureau/programmes',
      capability: 'viewPrograms',
    },
    {
      view: 'territories',
      label: 'Territoires',
      icon: 'location',
      link: '/bureau/territoires',
      capability: 'viewTerritories',
    },
    {
      view: 'accounts',
      label: 'Comptes d’accès',
      icon: 'key',
      link: '/bureau/comptes',
      capability: 'viewAccounts',
    },
    {
      view: 'audit',
      label: 'Journal des actions',
      icon: 'clipboard',
      link: '/bureau/journal',
      capability: 'viewAudit',
    },
  ];
  protected readonly requestDecision = signal<'pending' | 'accepted' | 'rejected'>('pending');
  protected readonly realRequests = signal<MembershipApplication[]>([]);
  protected readonly selectedApplication = signal<MembershipApplication | null>(null);
  protected readonly requestsLoading = signal(false);
  protected readonly requestError = signal('');
  protected readonly rejectMode = signal(false);
  protected readonly decisionLoading = signal(false);
  protected readonly memberStatus = signal<'Actif' | 'Suspendu' | 'Radié'>('Actif');
  protected readonly formSaved = signal(false);
  protected readonly sortKey = signal<'name' | 'place' | 'date'>('date');
  protected readonly sortAsc = signal(false);
  protected readonly peopleQuery = signal('');
  protected readonly peopleStatus = signal('');
  protected readonly peoplePlace = signal('');
  protected readonly peopleRole = signal('');
  protected readonly programQuery = signal('');
  protected readonly programStatus = signal('');
  protected readonly programPlace = signal('');

  protected get navItems() {
    return this.allNavItems.filter((item) => this.has(item.capability));
  }

  protected has(capability: Capability): boolean {
    return hasCapability(this.currentUser(), capability);
  }

  protected get userName(): string {
    const user = this.currentUser();
    return user ? `${user.first_name} ${user.last_name}`.trim() || user.email : '';
  }

  protected get userInitials(): string {
    const user = this.currentUser();
    if (!user) return 'BE';
    return `${user.first_name.charAt(0)}${user.last_name.charAt(0)}`.toUpperCase() || 'BE';
  }

  ngOnInit(): void {
    if (this.view === 'requests') this.loadRequests();
    if (this.view === 'request-detail') {
      const id = Number(this.route.snapshot.paramMap.get('id'));
      if (Number.isInteger(id) && id > 0) this.loadApplication(id);
      else this.requestError.set('Cette demande est introuvable.');
    }
  }

  protected loadRequests(status = '', search = ''): void {
    this.requestsLoading.set(true);
    this.requestError.set('');
    this.api.applications({ status, search }).subscribe({
      next: (page) => {
        this.realRequests.set(page.results);
        this.requestsLoading.set(false);
      },
      error: (error) => {
        this.requestError.set(
          error.error?.detail ?? 'Les demandes ne peuvent pas être chargées pour le moment.',
        );
        this.requestsLoading.set(false);
      },
    });
  }

  protected loadApplication(id: number): void {
    this.requestsLoading.set(true);
    this.requestError.set('');
    this.api.application(id).subscribe({
      next: (application) => {
        this.selectedApplication.set(application);
        this.requestsLoading.set(false);
      },
      error: (error) => {
        this.requestError.set(error.error?.detail ?? 'Cette demande ne peut pas être chargée.');
        this.requestsLoading.set(false);
      },
    });
  }

  protected formatDate(value: string): string {
    return new Intl.DateTimeFormat('fr-SN', { dateStyle: 'medium' }).format(new Date(value));
  }

  protected initials(application: MembershipApplication): string {
    return `${application.first_name.charAt(0)}${application.last_name.charAt(0)}`.toUpperCase();
  }

  protected decide(
    application: MembershipApplication,
    action: 'accept' | 'reject',
    internalNote: string,
    reason = '',
  ): void {
    if (action === 'reject' && !reason.trim()) {
      this.requestError.set('Le motif du refus est obligatoire.');
      return;
    }
    this.decisionLoading.set(true);
    this.requestError.set('');
    const request =
      action === 'accept'
        ? this.api.acceptApplication(application.id, internalNote.trim())
        : this.api.rejectApplication(application.id, reason.trim(), internalNote.trim());
    request.subscribe({
      next: (updated) => {
        this.selectedApplication.set(updated);
        this.requestDecision.set(action === 'accept' ? 'accepted' : 'rejected');
        this.rejectMode.set(false);
        this.decisionLoading.set(false);
      },
      error: (error) => {
        this.requestError.set(error.error?.detail ?? 'La décision n’a pas pu être enregistrée.');
        this.decisionLoading.set(false);
      },
    });
  }

  protected personLink(person: object): string | (string | number)[] {
    const id = 'id' in person && typeof person.id === 'number' ? person.id : 0;
    return this.view === 'requests' && id
      ? ['/bureau/demandes', id]
      : '/bureau/membres/aminata-ndiaye';
  }
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

  protected get dashboardStats() {
    return this.has('reviewApplications')
      ? this.stats
      : this.stats.filter((stat) => stat.label !== 'Demandes à examiner');
  }
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
        members: 'Membres',
        programs: 'Programmes',
        territories: 'Territoires',
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
        members: 'Rechercher et consulter les membres autorisés.',
        programs: 'Suivi des initiatives du Mouvement TABAXI',
        territories: this.has('manageTerritories')
          ? 'Organiser les pays, régions et communes.'
          : 'Consulter les territoires de votre périmètre.',
        accounts: this.has('manageAccounts')
          ? 'Gérer les utilisateurs autorisés à accéder à la plateforme.'
          : 'Consulter les comptes de votre périmètre.',
        coordinators: 'Membres du bureau exécutif et territoires rattachés',
        audit: 'Historique des décisions et opérations sensibles',
        'request-detail': 'Décider avec les informations utiles et garder une trace',
        'member-detail': 'Informations, participation et statut du compte',
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
          members: 'Ajouter un membre',
          programs: 'Nouveau programme',
          accounts: 'Inviter un membre du bureau',
          coordinators: 'Inviter un coordonnateur',
        } as Record<string, string>
      )[this.view] || 'Ajouter'
    );
  }
  protected get actionLink(): string {
    return (
      (
        {
          members: '/bureau/membres/aminata-ndiaye',
          coordinators: '/bureau/comptes/inviter',
          programs: '/bureau/programmes/nouveau',
          accounts: '/bureau/comptes/inviter',
        } as Record<string, string>
      )[this.view] || '/bureau'
    );
  }
  protected get showPrimaryAction(): boolean {
    if (this.view === 'programs') return this.has('managePrograms');
    if (this.view === 'accounts' || this.view === 'coordinators') return this.has('manageAccounts');
    return false;
  }
  protected completeForm(event: SubmitEvent): void {
    event.preventDefault();
    if ((event.currentTarget as HTMLFormElement).reportValidity()) this.formSaved.set(true);
  }
  protected logout(event: Event): void {
    event.preventDefault();
    this.api.logout().subscribe({
      next: () => void this.router.navigateByUrl('/connexion'),
      error: () => void this.router.navigateByUrl('/connexion'),
    });
  }
  protected updatePeopleQuery(value: string): void {
    this.peopleQuery.set(value);
    if (this.view === 'requests') this.loadRequests(this.peopleStatus(), value);
  }
  protected updatePeopleStatus(value: string): void {
    this.peopleStatus.set(value);
    if (this.view === 'requests') this.loadRequests(value, this.peopleQuery());
  }
  protected resetPeopleFilters(): void {
    this.peopleQuery.set('');
    this.peopleStatus.set('');
    this.peoplePlace.set('');
    this.peopleRole.set('');
    if (this.view === 'requests') this.loadRequests();
  }
  protected resetProgramFilters(): void {
    this.programQuery.set('');
    this.programStatus.set('');
    this.programPlace.set('');
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
    if (this.view === 'requests')
      return this.realRequests().map((application) => ({
        id: application.id,
        name: `${application.first_name} ${application.last_name}`,
        city: application.territory.path,
        email: application.email,
        job: application.profession,
        role: 'Membre',
        date: this.formatDate(application.created_at),
        status: application.status_label,
      }));
    const people =
      this.view === 'accounts' || this.view === 'coordinators'
        ? this.requests.slice(0, 6).map((person, index) => ({
            ...person,
            role: this.view === 'coordinators' ? 'Coordonnateur' : person.role,
            status: index === 5 ? 'Inactif' : 'Actif',
          }))
        : this.requests.map((person, index) => ({
            ...person,
            status: index === 6 ? 'Suspendu' : 'Actif',
          }));
    const query = this.peopleQuery().trim().toLocaleLowerCase('fr');
    const status = this.peopleStatus();
    const place = this.peoplePlace();
    const role = this.peopleRole();
    return people.filter(
      (person) =>
        (!query || `${person.name} ${person.email}`.toLocaleLowerCase('fr').includes(query)) &&
        (!status || person.status === status) &&
        (!place || person.city === place) &&
        (!role || person.role === role),
    );
  }

  protected get visiblePrograms() {
    const query = this.programQuery().trim().toLocaleLowerCase('fr');
    const status = this.programStatus();
    const place = this.programPlace();
    return this.programs.filter(
      (program) =>
        (!query ||
          `${program.name} ${program.description}`.toLocaleLowerCase('fr').includes(query)) &&
        (!status || program.status === status) &&
        (!place || program.city === place),
    );
  }
}
