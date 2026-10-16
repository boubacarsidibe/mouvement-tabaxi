import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';

import { ApiService, CurrentUser } from './api.service';
import { Capability, hasCapability } from './access-control';

function checkRole(predicate: (user: CurrentUser) => boolean): CanActivateFn {
  return (_route, state) => {
    const api = inject(ApiService);
    const router = inject(Router);
    const knownUser = api.currentUser();
    if (knownUser) {
      return predicate(knownUser)
        ? true
        : router.createUrlTree([knownUser.is_bureau ? '/bureau' : '/membre']);
    }
    return api.me().pipe(
      map((user) =>
        predicate(user) ? true : router.createUrlTree([user.is_bureau ? '/bureau' : '/membre']),
      ),
      catchError(() =>
        of(router.createUrlTree(['/connexion'], { queryParams: { retour: state.url } })),
      ),
    );
  };
}

function capabilityGuard(capability: Capability): CanActivateFn {
  return checkRole((user) => hasCapability(user, capability));
}

export const memberGuard = capabilityGuard('memberSpace');
export const bureauGuard = capabilityGuard('bureauSpace');
export const founderGuard = capabilityGuard('reviewApplications');
export const auditGuard = capabilityGuard('viewAudit');
