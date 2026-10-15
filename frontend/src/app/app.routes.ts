import { Routes } from '@angular/router';
import { AdminPage } from './pages/admin-page';
import { JoinPage } from './pages/join-page';
import { MemberPage } from './pages/member-page';
import { PublicPage } from './pages/public-page';

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
  { path: 'membre', component: MemberPage, data: { view: 'home' }, title: 'Mon espace — TABAXI' },
  {
    path: 'membre/programmes',
    component: MemberPage,
    data: { view: 'programs' },
    title: 'Programmes — TABAXI',
  },
  {
    path: 'membre/carte',
    component: MemberPage,
    data: { view: 'card' },
    title: 'Ma carte — TABAXI',
  },
  {
    path: 'bureau',
    component: AdminPage,
    data: { view: 'dashboard' },
    title: 'Tableau de bord — TABAXI',
  },
  {
    path: 'bureau/demandes',
    component: AdminPage,
    data: { view: 'requests' },
    title: 'Demandes d’adhésion — TABAXI',
  },
  {
    path: 'bureau/membres',
    component: AdminPage,
    data: { view: 'members' },
    title: 'Base des membres — TABAXI',
  },
  {
    path: 'bureau/programmes',
    component: AdminPage,
    data: { view: 'programs' },
    title: 'Programmes — TABAXI',
  },
  {
    path: 'bureau/territoires',
    component: AdminPage,
    data: { view: 'territories' },
    title: 'Localités — TABAXI',
  },
  {
    path: 'bureau/comptes',
    component: AdminPage,
    data: { view: 'accounts' },
    title: 'Comptes d’accès — TABAXI',
  },
  { path: '**', redirectTo: '' },
];
