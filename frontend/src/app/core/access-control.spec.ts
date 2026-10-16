import { describe, expect, it } from 'vitest';

import { CurrentUser } from './api.service';
import { hasCapability } from './access-control';

function user(role: CurrentUser['role']): CurrentUser {
  return {
    id: 1,
    email: `${role}@example.org`,
    first_name: 'Test',
    last_name: 'TABAXI',
    role,
    role_label: role,
    is_bureau: role !== 'membre',
  };
}

describe('permissions par rôle', () => {
  it('donne un espace membre à chaque adhérent', () => {
    expect(hasCapability(user('membre'), 'memberSpace')).toBe(true);
    expect(hasCapability(user('coordonnateur'), 'memberSpace')).toBe(true);
    expect(hasCapability(user('fondateur'), 'memberSpace')).toBe(true);
  });

  it('réserve les décisions, statuts et journaux aux fondateurs', () => {
    for (const capability of ['reviewApplications', 'manageMemberStatus', 'viewAudit'] as const) {
      expect(hasCapability(user('coordonnateur'), capability)).toBe(false);
      expect(hasCapability(user('fondateur'), capability)).toBe(true);
    }
  });

  it('laisse les comptes et territoires en lecture seule au coordonnateur', () => {
    expect(hasCapability(user('coordonnateur'), 'viewAccounts')).toBe(true);
    expect(hasCapability(user('coordonnateur'), 'manageAccounts')).toBe(false);
    expect(hasCapability(user('coordonnateur'), 'viewTerritories')).toBe(true);
    expect(hasCapability(user('coordonnateur'), 'manageTerritories')).toBe(false);
  });
});
