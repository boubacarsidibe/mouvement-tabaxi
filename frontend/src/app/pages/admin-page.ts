import { Component, computed, inject, signal } from '@angular/core';
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
import { TerritoriesManager } from './territories-bureau';

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
    TerritoriesManager,
  ],
  template: `
    <main class="workspace-shell admin-shell">
      <aside class="side-nav" [class.menu-open]="menuOpen()" (click)="closeMenuOnLink($event)">
        <a class="side-logo" routerLink="/"
          ><img src="logo-tabaxi-sidebar.png" alt="Mouvement TABAXI"
        /></a>
        <button
          class="menu-toggle"
          type="button"
          [attr.aria-expanded]="menuOpen()"
          (click)="menuOpen.set(!menuOpen()); $event.stopPropagation()"
        >
          {{ menuOpen() ? 'Fermer' : 'Menu' }}
        </button>
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

        <div class="workspace-content admin-content">
          <header class="page-heading" [class.sr-only]="titleInCard">
            <h1>{{ pageTitle }}</h1>
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
            <app-territories-manager />
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
  /** Téléphone et tablette : liste des pages ouverte ou fermée. */
  protected readonly menuOpen = signal(false);

  /** Un lien du menu a été choisi : on referme la liste. */
  protected closeMenuOnLink(event: Event): void {
    if ((event.target as HTMLElement).closest('a')) this.menuOpen.set(false);
  }
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
  /** Formulaires : leur carte affiche déjà le même titre (le titre de page reste pour les lecteurs d'écran). */
  protected get titleInCard(): boolean {
    return ['invite', 'program-new', 'program-edit', 'activity-new', 'activity-edit'].includes(this.view);
  }
  protected get actionLabel(): string {
    return (
      (
        {
          programs: 'Nouveau programme',
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
          accounts: '/bureau/comptes/inviter',
        } as Record<string, string>
      )[this.view] || '/bureau'
    );
  }
  protected get hasPrimaryAction(): boolean {
    // Inviter au bureau est réservé aux fondateurs ; le reste de la page reste lisible par les coordonnateurs.
    // Les territoires s'ajoutent depuis l'écran lui-même, réservé aux fondateurs.
    if (this.view === 'coordinators' || this.view === 'accounts') return this.auth.isFounder();
    return this.view === 'programs';
  }
}
