import { CurrentUser } from './auth.service';

/** Comptes d'essai pour les tests (aucune donnée réelle). */
export const TEST_MEMBER: CurrentUser = {
  id: 1,
  email: 'membre@example.org',
  first_name: 'Awa',
  last_name: 'Ndiaye',
  role: 'membre',
  role_label: 'Membre simple',
  is_bureau: false,
  territory: {
    id: 10,
    name: 'Podor',
    kind: 'commune',
    kind_label: 'Commune',
    path: 'Sénégal › Saint-Louis › Podor',
  },
};

export const TEST_COORDINATOR: CurrentUser = {
  ...TEST_MEMBER,
  id: 2,
  email: 'coord@example.org',
  role: 'coordonnateur',
  role_label: 'Coordonnateur',
  is_bureau: true,
};

export const TEST_FOUNDER: CurrentUser = {
  ...TEST_MEMBER,
  id: 3,
  email: 'fondateur@example.org',
  first_name: 'Moussa',
  last_name: 'Diop',
  role: 'fondateur',
  role_label: 'Membre fondateur',
  is_bureau: true,
  territory: null,
};

export const UNAUTHORIZED = { status: 401, statusText: 'Unauthorized' };
