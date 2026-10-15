import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService, CurrentUser } from './auth.service';

/**
 * Gardes de route. Elles évitent d'afficher un écran interdit, mais la sécurité réelle
 * est côté serveur : chaque route de l'API vérifie elle-même le rôle et le territoire.
 */
function guard(
  allow: (user: CurrentUser) => boolean,
  fallback: (user: CurrentUser) => string,
): CanActivateFn {
  return async (_route, state) => {
    const auth = inject(AuthService);
    const router = inject(Router);
    const user = await auth.ensureLoaded();
    if (!user) return router.createUrlTree(['/connexion'], { queryParams: { suivant: state.url } });
    return allow(user) ? true : router.createUrlTree([fallback(user)]);
  };
}

/** Espace membre : toute personne connectée. */
export const authGuard = guard(
  () => true,
  () => '/',
);

/** Interface du bureau exécutif : coordonnateurs et fondateurs. */
export const bureauGuard = guard(
  (user) => user.is_bureau,
  () => '/membre',
);

/** Fonctions réservées aux fondateurs : examen des demandes, comptes d'accès. */
export const founderGuard = guard(
  (user) => user.role === 'fondateur',
  (user) => (user.is_bureau ? '/bureau' : '/membre'),
);

/** Page de connexion : une personne déjà connectée va directement dans son espace. */
export const guestGuard: CanActivateFn = async () => {
  // inject() doit être appelé avant le premier await.
  const auth = inject(AuthService);
  const router = inject(Router);
  const user = await auth.ensureLoaded();
  return user ? router.createUrlTree([auth.homeFor(user)]) : true;
};
