import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { TerritorySummary } from './auth.service';

export type MemberStatus = 'actif' | 'suspendu' | 'radie';
export type MemberOrdering = 'name' | '-name' | 'place' | '-place' | 'date' | '-date';

/** Une ligne de la base des membres. */
export interface ListedMember {
  id: number;
  number: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  role_label: string;
  territory: TerritorySummary | null;
  /** Date d'adhésion au format AAAA-MM-JJ. */
  joined_on: string;
  status: MemberStatus;
  status_label: string;
}

export interface StatusChange {
  id: number;
  from_status: MemberStatus;
  from_status_label: string;
  to_status: MemberStatus;
  to_status_label: string;
  reason: string;
  changed_by: { id: number; first_name: string; last_name: string } | null;
  changed_at: string;
}

/** Fiche d'un membre. L'historique des statuts n'est envoyé qu'aux fondateurs (`null` sinon). */
export interface MemberRecord extends ListedMember {
  phone: string;
  address: string;
  photo_url: string | null;
  status_history: StatusChange[] | null;
}

export interface MemberPage {
  count: number;
  next: string | null;
  previous: string | null;
  results: ListedMember[];
}

export interface MemberFilters {
  status?: MemberStatus | '';
  search?: string;
  ordering?: MemberOrdering;
  page?: number;
}

/** Base des membres du bureau exécutif et changement de statut par les fondateurs. */
@Injectable({ providedIn: 'root' })
export class MembersService {
  private readonly http = inject(HttpClient);

  list(filters: MemberFilters = {}): Promise<MemberPage> {
    let params = new HttpParams();
    if (filters.status) params = params.set('status', filters.status);
    if (filters.search?.trim()) params = params.set('search', filters.search.trim());
    if (filters.ordering && filters.ordering !== '-date')
      params = params.set('ordering', filters.ordering);
    if (filters.page && filters.page > 1) params = params.set('page', filters.page);
    return firstValueFrom(this.http.get<MemberPage>('/api/members/', { params }));
  }

  get(id: number): Promise<MemberRecord> {
    return firstValueFrom(this.http.get<MemberRecord>(`/api/members/${id}/`));
  }

  changeStatus(id: number, status: MemberStatus, reason: string): Promise<MemberRecord> {
    return firstValueFrom(
      this.http.post<MemberRecord>(`/api/members/${id}/status/`, { status, reason }),
    );
  }
}
