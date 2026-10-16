import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { TerritorySummary } from './auth.service';
import { MemberCardData } from '../shared/member-card-image';

/** Profil et données de carte du membre connecté, tels que les renvoie `/api/members/me/`. */
export interface MemberProfile {
  number: string;
  /** Date d'adhésion au format AAAA-MM-JJ. */
  joined_on: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  role_label: string;
  territory: TerritorySummary | null;
  address: string;
  phone: string;
  /** Adresse de la photo (réservée à son propriétaire), ou `null` s'il n'y en a pas. */
  photo_url: string | null;
  /** Coordonnateur le plus proche : celui du territoire du membre, sinon d'un territoire dont il dépend. */
  coordinator: { first_name: string; last_name: string; email: string; territory: string } | null;
}

export interface PasswordChange {
  current_password: string;
  new_password: string;
  new_password_confirm: string;
}

/** Date au format jj/mm/aaaa, sans passer par le fuseau horaire du navigateur. */
export function formatDate(iso: string): string {
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

/** Ce que la carte numérique affiche, tiré du profil réel. */
export function cardData(profile: MemberProfile): MemberCardData {
  return {
    name: `${profile.first_name} ${profile.last_name}`.trim(),
    number: profile.number,
    locality: profile.territory?.name ?? '',
    date: formatDate(profile.joined_on),
    photo: profile.photo_url,
  };
}

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly http = inject(HttpClient);

  load(): Promise<MemberProfile> {
    return firstValueFrom(this.http.get<MemberProfile>('/api/members/me/'));
  }

  /** Adresse, téléphone et, si choisie, nouvelle photo. */
  save(form: FormData): Promise<MemberProfile> {
    return firstValueFrom(this.http.patch<MemberProfile>('/api/members/me/', form));
  }

  changePassword(change: PasswordChange): Promise<{ detail: string }> {
    return firstValueFrom(this.http.post<{ detail: string }>('/api/auth/password/change/', change));
  }
}
