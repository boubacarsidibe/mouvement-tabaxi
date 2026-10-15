import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';

import { ApiService, CurrentUser } from './api.service';

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
      catchError(() => of(router.createUrlTree(['/connexion'], { queryParams: { retour: state.url } }))),
    );
  };
}

export const memberGuard = checkRole((user) => user.role === 'membre');
export const bureauGuard = checkRole((user) => user.is_bureau);
export const founderGuard = checkRole((user) => user.role === 'fondateur');
