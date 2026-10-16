import { CurrentUser } from './api.service';

export type Capability =
  | 'memberSpace'
  | 'bureauSpace'
  | 'reviewApplications'
  | 'viewMembers'
  | 'manageMemberStatus'
  | 'viewPrograms'
  | 'managePrograms'
  | 'viewTerritories'
  | 'manageTerritories'
  | 'viewAccounts'
  | 'manageAccounts'
  | 'viewAudit';

const capabilities: Record<CurrentUser['role'], ReadonlySet<Capability>> = {
  membre: new Set<Capability>(['memberSpace']),
  coordonnateur: new Set<Capability>([
    'memberSpace',
    'bureauSpace',
    'viewMembers',
    'viewPrograms',
    'managePrograms',
    'viewTerritories',
    'viewAccounts',
  ]),
  fondateur: new Set<Capability>([
    'memberSpace',
    'bureauSpace',
    'reviewApplications',
    'viewMembers',
    'manageMemberStatus',
    'viewPrograms',
    'managePrograms',
    'viewTerritories',
    'manageTerritories',
    'viewAccounts',
    'manageAccounts',
    'viewAudit',
  ]),
};

export function hasCapability(
  user: CurrentUser | null | undefined,
  capability: Capability,
): boolean {
  return !!user && capabilities[user.role].has(capability);
}
