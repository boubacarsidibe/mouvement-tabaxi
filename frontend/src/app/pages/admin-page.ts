import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { UiIcon } from '../shared/ui-icon';
import { AuditJournal } from './audit-journal';
import { ActivityAttendance, ActivityDetail, ActivityForm, ActivityReport } from './activities-bureau';
import { Dashboard } from './dashboard';
import { InviteForm } from './invite-form';
import { MemberDetail, MembersList } from './members-base';
import { ProgramDetail, ProgramForm, ProgramsList } from './programs-bureau';
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
    AuditJournal,
    Dashboard,
    ProgramsList,
    ProgramForm,
    ProgramDetail,
    ActivityForm,
    ActivityDetail,
    ActivityReport,
    ActivityAttendance,
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
            }
          </header>

          @if (view === 'dashboard') {
            <app-dashboard />
          }

          @if (view === 'requests') {
            <app-requests-list />
          }

          @if (view === 'request-detail') {
            <app-request-detail />
          }

          @if (view === 'members') {
            <app-members-list kind="members" />
          }

          @if (view === 'member-detail') {
            <app-member-detail />
          }

          @if (view === 'coordinators') {
            <app-members-list kind="bureau" />
          }

          @if (view === 'accounts') {
            <div class="security-alert">
              <ui-icon name="key" />
              <p>
                <strong>Sécurité</strong>Veillez à n’accorder des accès qu’aux personnes de
                confiance. Suspendez ou radiez les comptes qui ne servent plus : leur connexion est
                aussitôt bloquée.
              </p>
            </div>
            <app-members-list kind="accounts" />
          }


          @if (view === 'programs') {
            <app-programs-list />
          }

          @if (view === 'program-new' || view === 'program-edit') {
            <app-program-form />
          }

          @if (view === 'program-detail') {
            <app-program-detail />
          }

          @if (view === 'activity-new' || view === 'activity-edit') {
            <app-activity-form />
          }

          @if (view === 'activity-detail') {
            <app-activity-detail />
          }

          @if (view === 'report') {
            <app-activity-report />
          }

          @if (view === 'attendance') {
            <app-activity-attendance />
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
            <app-audit-journal />
          }

          @if (view === 'invite') {
            <app-invite-form />
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
  /** L'examen des demandes, les comptes d'accès et le journal des actions sont réservés aux fondateurs. */
  private readonly founderViews = new Set(['requests', 'accounts', 'audit']);
  protected readonly visibleNavItems = computed(() =>
    this.navItems.filter((item) => this.auth.isFounder() || !this.founderViews.has(item.view)),
  );

  protected async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigateByUrl('/connexion');
  }
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
        'program-edit': 'Modifier le programme',
        'program-detail': 'Fiche du programme',
        'activity-new': 'Planifier une activité',
        'activity-edit': 'Modifier l’activité',
        'activity-detail': 'Fiche de l’activité',
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
        'program-new': 'Définir un objectif, une localité et une période',
        'program-edit': 'Mettre à jour le programme, son responsable et son état',
        'program-detail': 'Suivre les activités, la participation et l’avancement',
        'activity-new': 'Préparer une activité visible par les membres du territoire',
        'activity-edit': 'Corriger la date, le lieu ou la description',
        'activity-detail': 'Informations, compte rendu et inscrits',
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
          accounts: 'Inviter au bureau',
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
    // Inviter au bureau est réservé aux fondateurs ; le reste de la page reste lisible par les coordonnateurs.
    if (this.view === 'coordinators' || this.view === 'accounts') return this.auth.isFounder();
    return ['programs', 'territories'].includes(this.view);
  }
}
