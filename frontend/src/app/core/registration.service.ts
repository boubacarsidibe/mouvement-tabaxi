import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CurrentUser, TerritorySummary } from './auth.service';

/** Ce que le serveur sait de la personne acceptée, d'après son lien personnel. */
export interface RegistrationLinkInfo {
  first_name: string;
  last_name: string;
  email: string;
  territory: TerritorySummary;
  expires_at: string;
}

export interface RegistrationResult {
  user: CurrentUser;
  member_number: string;
}

@Injectable({ providedIn: 'root' })
export class RegistrationService {
  private readonly http = inject(HttpClient);

  /** Vérifie le lien. Le jeton voyage dans le corps de la requête, jamais dans l'adresse. */
  check(token: string): Promise<RegistrationLinkInfo> {
    return firstValueFrom(
      this.http.post<RegistrationLinkInfo>('/api/registration/check/', { token }),
    );
  }

  complete(form: FormData): Promise<RegistrationResult> {
    return firstValueFrom(this.http.post<RegistrationResult>('/api/registration/', form));
  }
}
