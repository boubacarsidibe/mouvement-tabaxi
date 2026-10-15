import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export type Role = 'membre' | 'coordonnateur' | 'fondateur';

export interface TerritorySummary {
  id: number;
  name: string;
  kind: 'pays' | 'region' | 'commune';
  kind_label: string;
  /** Exemple : « Sénégal › Saint-Louis › Podor ». */
  path: string;
}

export interface CurrentUser {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: Role;
  role_label: string;
  is_bureau: boolean;
  territory: TerritorySummary | null;
}

/**
 * Session de la personne connectée. Le serveur garde la session dans un cookie que le
 * JavaScript ne peut pas lire ; ce service ne retient que ce que renvoie l'API.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  /** `undefined` tant que le serveur n'a pas été interrogé, `null` si personne n'est connecté. */
  private readonly state = signal<CurrentUser | null | undefined>(undefined);
  private pending?: Promise<CurrentUser | null>;

  readonly user = this.state.asReadonly();
  readonly isFounder = computed(() => this.state()?.role === 'fondateur');
  readonly displayName = computed(() => {
    const user = this.state();
    if (!user) return '';
    return `${user.first_name} ${user.last_name}`.trim() || user.email;
  });
  readonly initials = computed(() => {
    const user = this.state();
    if (!user) return '';
    const letters = `${user.first_name.charAt(0)}${user.last_name.charAt(0)}`;
    return (letters || user.email.charAt(0)).toUpperCase();
  });

  /** Utilisateur connecté, demandé une seule fois au serveur (qui dépose aussi le cookie anti-CSRF). */
  ensureLoaded(): Promise<CurrentUser | null> {
    const known = this.state();
    if (known !== undefined) return Promise.resolve(known);
    this.pending ??= firstValueFrom(this.http.get<CurrentUser>('/api/auth/me/'))
      .then(
        (user) => user,
        () => null,
      )
      .then((user) => {
        this.state.set(user);
        this.pending = undefined;
        return user;
      });
    return this.pending;
  }

  async login(email: string, password: string, remember: boolean): Promise<CurrentUser> {
    const user = await firstValueFrom(
      this.http.post<CurrentUser>('/api/auth/login/', { email, password, remember }),
    );
    this.state.set(user);
    return user;
  }

  /** Enregistre l'utilisateur dont le serveur vient d'ouvrir la session (inscription, invitation). */
  signedIn(user: CurrentUser): void {
    this.state.set(user);
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.http.post('/api/auth/logout/', {}));
    } finally {
      this.state.set(null);
    }
  }

  /** La session a été fermée par le serveur (inactivité, compte désactivé). */
  forget(): void {
    this.state.set(null);
  }

  /** Interface à ouvrir après la connexion, selon le rôle. */
  homeFor(user: CurrentUser): string {
    return user.is_bureau ? '/bureau' : '/membre';
  }
}
