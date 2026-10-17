import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CurrentUser } from './auth.service';

export interface InvitationDraft {
  email: string;
  first_name: string;
  last_name: string;
  role: 'coordonnateur' | 'fondateur';
  territory: number | null;
}

/** Ce que le serveur renvoie sur la personne invitée. */
export interface InvitationInfo {
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  role_label: string;
  territory: number | null;
  territory_name: string | null;
}

/** Invitation au bureau : envoi par un fondateur, puis acceptation par la personne invitée. */
@Injectable({ providedIn: 'root' })
export class InvitationService {
  private readonly http = inject(HttpClient);

  send(draft: InvitationDraft): Promise<InvitationInfo> {
    return firstValueFrom(this.http.post<InvitationInfo>('/api/auth/invitations/', draft));
  }

  /** Le jeton voyage dans le corps de la requête, jamais dans l'adresse. */
  check(token: string): Promise<InvitationInfo & { expires_at: string }> {
    return firstValueFrom(
      this.http.post<InvitationInfo & { expires_at: string }>('/api/auth/invitation/check/', { token }),
    );
  }

  accept(token: string, password: string, passwordConfirm: string): Promise<CurrentUser> {
    return firstValueFrom(
      this.http.post<CurrentUser>('/api/auth/invitation/accept/', {
        token,
        password,
        password_confirm: passwordConfirm,
      }),
    );
  }
}
