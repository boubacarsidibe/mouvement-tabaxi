import { Routes } from '@angular/router';
import { authGuard, bureauGuard, founderGuard, guestGuard } from './core/auth.guards';
import { AdminPage } from './pages/admin-page';
import { ResetPasswordPage } from './pages/reset-password-page';
import { AuthPage } from './pages/auth-page';
import { FinalizePage } from './pages/finalize-page';
import { InvitationPage } from './pages/invitation-page';
import { JoinPage } from './pages/join-page';
import { MemberPage } from './pages/member-page';
import { PrivacyPage } from './pages/privacy-page';
import { PublicPage } from './pages/public-page';
import { RequestStatusPage } from './pages/request-status-page';

/** Espace membre : toute personne connectée. */
function member(path: string, view: string, title: string) {
  return { path, component: MemberPage, canActivate: [authGuard], data: { view }, title };
}

/** Interface du bureau exécutif : coordonnateurs et fondateurs (ou fondateurs seuls). */
function bureau(path: string, view: string, title: string, foundersOnly = false) {
  return {
    path,
    component: AdminPage,
    canActivate: [foundersOnly ? founderGuard : bureauGuard],
    data: { view },
    title,
  };
}

export const routes: Routes = [
  { path: '', component: PublicPage, title: 'TABAXI — La voix de nos territoires' },
  {
    path: 'adherer',
    component: JoinPage,
    data: { mode: 'request' },
    title: 'Demande d’adhésion — TABAXI',
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
  { path: 'nouveau-mot-de-passe', component: ResetPasswordPage, title: 'Nouveau mot de passe — TABAXI' },
  { path: 'invitation', component: InvitationPage, title: 'Invitation au bureau — TABAXI' },
  { path: 'confidentialite', component: PrivacyPage, title: 'Confidentialité — TABAXI' },

  member('membre', 'home', 'Mon espace — TABAXI'),
  member('membre/programmes', 'programs', 'Programmes — TABAXI'),
  member('membre/carte', 'card', 'Ma carte — TABAXI'),
  member('membre/profil', 'profile', 'Mon profil — TABAXI'),
  member('membre/securite', 'security', 'Sécurité du compte — TABAXI'),
  member('membre/activites/brigades-citoyennes', 'activity', 'Brigades citoyennes — TABAXI'),

  bureau('bureau', 'dashboard', 'Tableau de bord — TABAXI'),
  bureau('bureau/demandes', 'requests', 'Demandes d’adhésion — TABAXI', true),
  bureau('bureau/demandes/:id', 'request-detail', 'Examiner la demande — TABAXI', true),
  bureau('bureau/membres', 'members', 'Base des membres — TABAXI'),
  bureau('bureau/membres/aminata-ndiaye', 'member-detail', 'Fiche membre — TABAXI'),
  bureau('bureau/programmes', 'programs', 'Programmes — TABAXI'),
  bureau('bureau/programmes/nouveau', 'program-new', 'Nouveau programme — TABAXI'),
  bureau('bureau/programmes/brigades-citoyennes', 'program-detail', 'Brigades citoyennes — TABAXI'),
  bureau('bureau/territoires', 'territories', 'Localités — TABAXI'),
  bureau('bureau/comptes', 'accounts', 'Comptes d’accès — TABAXI', true),
  bureau('bureau/comptes/inviter', 'invite', 'Inviter un coordonnateur — TABAXI', true),
  bureau('bureau/coordonnateurs', 'coordinators', 'Coordonnateurs — TABAXI'),
  bureau('bureau/journal', 'audit', 'Journal des actions — TABAXI'),
  bureau('bureau/activites/nouvelle', 'activity-new', 'Planifier une activité — TABAXI'),
  bureau('bureau/activites/brigade-dakar/compte-rendu', 'report', 'Compte rendu — TABAXI'),
  bureau('bureau/activites/brigade-dakar/presences', 'attendance', 'Présences — TABAXI'),
  { path: '**', redirectTo: '' },
];
