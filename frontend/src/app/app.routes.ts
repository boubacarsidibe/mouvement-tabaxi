import { Routes } from '@angular/router';
import { authGuard, bureauGuard, founderGuard, guestGuard } from './core/auth.guards';
import { ResetPasswordPage } from './pages/reset-password-page';
import { AuthPage } from './pages/auth-page';
import { FinalizePage } from './pages/finalize-page';
import { InvitationPage } from './pages/invitation-page';
import { JoinPage } from './pages/join-page';
import { PrivacyPage } from './pages/privacy-page';
import { PublicPage } from './pages/public-page';
import { RequestStatusPage } from './pages/request-status-page';

/** Espace membre : toute personne connectée. */
function member(path: string, view: string, title: string) {
  // Chargé à la demande : l'espace membre n'alourdit pas la page d'accueil.
  return {
    path,
    loadComponent: () => import('./pages/member-page').then((module) => module.MemberPage),
    canActivate: [authGuard],
    data: { view },
    title,
  };
}

/** Interface du bureau exécutif : coordonnateurs et fondateurs (ou fondateurs seuls). */
function bureau(path: string, view: string, title: string, foundersOnly = false) {
  return {
    path,
    // Chargé à la demande : l'interface du bureau n'alourdit pas la page d'accueil.
    loadComponent: () => import('./pages/admin-page').then((module) => module.AdminPage),
    canActivate: [foundersOnly ? founderGuard : bureauGuard],
    data: { view },
    title,
  };
}

export const routes: Routes = [
  {
    path: '',
    component: PublicPage,
    title: 'Mouvement TABAXI — Mouvement citoyen au Sénégal',
    data: {
      seo: {
        index: true,
        description:
          'Le Mouvement TABAXI rassemble des citoyens engagés au Sénégal pour des communautés ' +
          'plus fortes et solidaires. Découvrez ses programmes et rejoignez-le.',
      },
    },
  },
  {
    path: 'adherer',
    component: JoinPage,
    data: {
      mode: 'request',
      seo: {
        index: true,
        description:
          'Rejoignez le Mouvement TABAXI : déposez votre demande d’adhésion en quelques minutes, ' +
          'le bureau vous répond par courriel.',
      },
    },
    title: 'Adhérer au Mouvement TABAXI — Demande d’adhésion',
  },
  { path: 'finaliser', component: FinalizePage, title: 'Finaliser mon adhésion — TABAXI' },
  { path: 'adherer/confirmation', component: RequestStatusPage, title: 'Demande reçue — TABAXI' },
  {
    path: 'connexion',
    component: AuthPage,
    canActivate: [guestGuard],
    data: { mode: 'login' },
    title: 'Connexion — TABAXI',
  },
  {
    path: 'mot-de-passe-oublie',
    component: AuthPage,
    data: { mode: 'forgot' },
    title: 'Mot de passe oublié — TABAXI',
  },
  {
    path: 'nouveau-mot-de-passe',
    component: ResetPasswordPage,
    title: 'Nouveau mot de passe — TABAXI',
  },
  { path: 'invitation', component: InvitationPage, title: 'Invitation au bureau — TABAXI' },
  {
    path: 'confidentialite',
    component: PrivacyPage,
    title: 'Confidentialité — Mouvement TABAXI',
    data: {
      seo: {
        index: true,
        description:
          'Comment le Mouvement TABAXI protège les données personnelles de ses membres et de ' +
          'celles et ceux qui demandent à adhérer.',
      },
    },
  },

  member('membre', 'home', 'Mon espace — TABAXI'),
  member('membre/programmes', 'programs', 'Programmes — TABAXI'),
  member('membre/carte', 'card', 'Ma carte — TABAXI'),
  member('membre/profil', 'profile', 'Mon profil — TABAXI'),
  member('membre/securite', 'security', 'Sécurité du compte — TABAXI'),
  member('membre/activites/:id', 'activity', 'Activité — TABAXI'),

  bureau('bureau', 'dashboard', 'Tableau de bord — TABAXI'),
  bureau('bureau/demandes', 'requests', 'Demandes d’adhésion — TABAXI', true),
  bureau('bureau/demandes/:id', 'request-detail', 'Examiner la demande — TABAXI', true),
  bureau('bureau/membres', 'members', 'Base des membres — TABAXI'),
  bureau('bureau/membres/:id', 'member-detail', 'Fiche membre — TABAXI'),
  bureau('bureau/programmes', 'programs', 'Programmes — TABAXI'),
  bureau('bureau/programmes/nouveau', 'program-new', 'Nouveau programme — TABAXI'),
  bureau('bureau/programmes/:id', 'program-detail', 'Fiche du programme — TABAXI'),
  bureau('bureau/programmes/:id/modifier', 'program-edit', 'Modifier le programme — TABAXI'),
  bureau(
    'bureau/programmes/:programId/activites/nouvelle',
    'activity-new',
    'Planifier une activité — TABAXI',
  ),
  bureau('bureau/activites/:id', 'activity-detail', 'Fiche de l’activité — TABAXI'),
  bureau('bureau/activites/:id/modifier', 'activity-edit', 'Modifier l’activité — TABAXI'),
  bureau('bureau/activites/:id/compte-rendu', 'report', 'Compte rendu — TABAXI'),
  bureau('bureau/activites/:id/presences', 'attendance', 'Présences — TABAXI'),
  bureau('bureau/territoires', 'territories', 'Localités — TABAXI'),
  bureau('bureau/comptes', 'accounts', 'Comptes d’accès — TABAXI', true),
  bureau('bureau/comptes/inviter', 'invite', 'Inviter un coordonnateur — TABAXI', true),
  bureau('bureau/coordonnateurs', 'coordinators', 'Coordonnateurs — TABAXI'),
  bureau('bureau/journal', 'audit', 'Journal des actions — TABAXI', true),
  { path: '**', redirectTo: '' },
];
