import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

/** Mot de passe oublié : demande du lien, vérification du lien, nouveau mot de passe. */
@Injectable({ providedIn: 'root' })
export class PasswordService {
  private readonly http = inject(HttpClient);

  forgot(email: string): Promise<{ detail: string }> {
    return firstValueFrom(this.http.post<{ detail: string }>('/api/auth/password/forgot/', { email }));
  }

  /** Le jeton voyage dans le corps de la requête, jamais dans l'adresse. */
  check(token: string): Promise<{ valid: boolean; expires_at: string }> {
    return firstValueFrom(
      this.http.post<{ valid: boolean; expires_at: string }>('/api/auth/password/reset/check/', { token }),
    );
  }

  reset(token: string, password: string, passwordConfirm: string): Promise<{ detail: string }> {
    return firstValueFrom(
      this.http.post<{ detail: string }>('/api/auth/password/reset/', {
        token,
        password,
        password_confirm: passwordConfirm,
      }),
    );
  }
}
