import { Routes } from '@angular/router';
import { AdminPage } from './pages/admin-page';
import { AuthPage } from './pages/auth-page';
import { JoinPage } from './pages/join-page';
import { MemberPage } from './pages/member-page';
import { PrivacyPage } from './pages/privacy-page';
import { PublicPage } from './pages/public-page';
import { RequestStatusPage } from './pages/request-status-page';
import { auditGuard, bureauGuard, founderGuard, memberGuard } from './core/auth.guards';

export const routes: Routes = [
  { path: '', component: PublicPage, title: 'TABAXI — La voix de nos territoires' },
  {
    path: 'adherer',
    component: JoinPage,
    data: { mode: 'request' },
    title: 'Demande d’adhésion — TABAXI',
  },
  {
    path: 'finaliser',
    component: JoinPage,
    data: { mode: 'finalize' },
    title: 'Finaliser mon adhésion — TABAXI',
  },
  { path: 'adherer/confirmation', component: RequestStatusPage, title: 'Demande reçue — TABAXI' },
  { path: 'connexion', component: AuthPage, data: { mode: 'login' }, title: 'Connexion — TABAXI' },
  {
    path: 'mot-de-passe-oublie',
    component: AuthPage,
    data: { mode: 'forgot' },
    title: 'Mot de passe oublié — TABAXI',
  },
  { path: 'confidentialite', component: PrivacyPage, title: 'Confidentialité — TABAXI' },
  {
    path: 'membre',
    component: MemberPage,
    canActivate: [memberGuard],
    data: { view: 'home' },
    title: 'Mon espace — TABAXI',
  },
  {
    path: 'membre/programmes',
    component: MemberPage,
    canActivate: [memberGuard],
    data: { view: 'programs' },
    title: 'Programmes — TABAXI',
  },
  {
    path: 'membre/carte',
    component: MemberPage,
    canActivate: [memberGuard],
    data: { view: 'card' },
    title: 'Ma carte — TABAXI',
  },
  {
    path: 'membre/profil',
    component: MemberPage,
    canActivate: [memberGuard],
    data: { view: 'profile' },
    title: 'Mon profil — TABAXI',
  },
  {
    path: 'membre/securite',
    component: MemberPage,
    canActivate: [memberGuard],
    data: { view: 'security' },
    title: 'Sécurité du compte — TABAXI',
  },
  {
    path: 'membre/activites/brigades-citoyennes',
    component: MemberPage,
    canActivate: [memberGuard],
    data: { view: 'activity' },
    title: 'Brigades citoyennes — TABAXI',
  },
  {
    path: 'bureau',
    component: AdminPage,
    canActivate: [bureauGuard],
    data: { view: 'dashboard' },
    title: 'Tableau de bord — TABAXI',
  },
  {
    path: 'bureau/demandes',
    component: AdminPage,
    canActivate: [founderGuard],
    data: { view: 'requests' },
    title: 'Demandes d’adhésion — TABAXI',
  },
  {
    path: 'bureau/membres',
    component: AdminPage,
    canActivate: [bureauGuard],
    data: { view: 'members' },
    title: 'Base des membres — TABAXI',
  },
  {
    path: 'bureau/programmes',
    component: AdminPage,
    canActivate: [bureauGuard],
    data: { view: 'programs' },
    title: 'Programmes — TABAXI',
  },
  {
    path: 'bureau/territoires',
    component: AdminPage,
    canActivate: [bureauGuard],
    data: { view: 'territories' },
    title: 'Localités — TABAXI',
  },
  {
    path: 'bureau/comptes',
    component: AdminPage,
    canActivate: [bureauGuard],
    data: { view: 'accounts' },
    title: 'Comptes d’accès — TABAXI',
  },
  {
    path: 'bureau/comptes/inviter',
    component: AdminPage,
    canActivate: [founderGuard],
    data: { view: 'invite' },
    title: 'Inviter un coordonnateur — TABAXI',
  },
  {
    path: 'bureau/coordonnateurs',
    component: AdminPage,
    canActivate: [bureauGuard],
    data: { view: 'coordinators' },
    title: 'Coordonnateurs — TABAXI',
  },
  {
    path: 'bureau/journal',
    component: AdminPage,
    canActivate: [auditGuard],
    data: { view: 'audit' },
    title: 'Journal des actions — TABAXI',
  },
  {
    path: 'bureau/demandes/:id',
    component: AdminPage,
    canActivate: [founderGuard],
    data: { view: 'request-detail' },
    title: 'Examiner la demande — TABAXI',
  },
  {
    path: 'bureau/membres/aminata-ndiaye',
    component: AdminPage,
    canActivate: [bureauGuard],
    data: { view: 'member-detail' },
    title: 'Fiche membre — TABAXI',
  },
  {
    path: 'bureau/programmes/nouveau',
    component: AdminPage,
    canActivate: [bureauGuard],
    data: { view: 'program-new' },
    title: 'Nouveau programme — TABAXI',
  },
  {
    path: 'bureau/programmes/brigades-citoyennes',
    component: AdminPage,
    canActivate: [bureauGuard],
    data: { view: 'program-detail' },
    title: 'Brigades citoyennes — TABAXI',
  },
  {
    path: 'bureau/activites/nouvelle',
    component: AdminPage,
    canActivate: [bureauGuard],
    data: { view: 'activity-new' },
    title: 'Planifier une activité — TABAXI',
  },
  {
    path: 'bureau/activites/brigade-dakar/compte-rendu',
    component: AdminPage,
    canActivate: [bureauGuard],
    data: { view: 'report' },
    title: 'Compte rendu — TABAXI',
  },
  {
    path: 'bureau/activites/brigade-dakar/presences',
    component: AdminPage,
    canActivate: [bureauGuard],
    data: { view: 'attendance' },
    title: 'Présences — TABAXI',
  },
  { path: '**', redirectTo: '' },
];
