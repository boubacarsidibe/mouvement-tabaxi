import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

/** Ces routes gèrent elles-mêmes l'absence de session. */
const SELF_HANDLED = ['/api/auth/me/', '/api/auth/login/'];

/**
 * Si le serveur ferme la session (30 minutes d'inactivité au bureau, compte désactivé),
 * la personne est renvoyée vers la connexion, avec une explication.
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return next(request).pipe(
    catchError((error: unknown) => {
      if (
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        request.url.startsWith('/api/') &&
        !SELF_HANDLED.some((url) => request.url.startsWith(url))
      ) {
        auth.forget();
        const expired = (error.error as { code?: string } | null)?.code === 'session_expired';
        void router.navigate(['/connexion'], {
          queryParams: { suivant: router.url, ...(expired ? { motif: 'inactivite' } : {}) },
        });
      }
      return throwError(() => error);
    }),
  );
};
