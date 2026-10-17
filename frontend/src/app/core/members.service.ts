import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { TerritorySummary } from './auth.service';
import { Download, fetchFile } from './download';

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

/** Fiche d'un membre. L'historique des statuts n'est envoyé qu'à qui peut changer ce statut (`null` sinon). */
export interface MemberRecord extends ListedMember {
  phone: string;
  address: string;
  photo_url: string | null;
  status_history: StatusChange[] | null;
  /** Fondateur : tout compte ; coordonnateur : les membres simples de sa zone ; jamais son propre compte. */
  can_change_status: boolean;
}

export interface MemberPage {
  count: number;
  next: string | null;
  previous: string | null;
  results: ListedMember[];
}

export interface MemberFilters {
  /** Rôles recherchés, séparés par des virgules ; les membres simples si absent. */
  role?: string;
  status?: MemberStatus | '';
  /** Territoire et tous ceux qui en dépendent. */
  territory?: number | '';
  /** Date d'adhésion de, au format AAAA-MM-JJ (bornes comprises). */
  joined_from?: string;
  joined_to?: string;
  search?: string;
  ordering?: MemberOrdering;
  page?: number;
}

/** Base des membres du bureau exécutif et changement de statut par les fondateurs. */
@Injectable({ providedIn: 'root' })
export class MembersService {
  private readonly http = inject(HttpClient);

  list(filters: MemberFilters = {}): Promise<MemberPage> {
    let params = this.params(filters);
    if (filters.page && filters.page > 1) params = params.set('page', filters.page);
    return firstValueFrom(this.http.get<MemberPage>('/api/members/', { params }));
  }

  /** Fichier Excel de la liste affichée : les mêmes filtres, sans les pages. */
  exportList(filters: MemberFilters = {}): Promise<Download> {
    return fetchFile(this.http, '/api/members/export/', this.params(filters));
  }

  private params(filters: MemberFilters): HttpParams {
    let params = new HttpParams();
    if (filters.role) params = params.set('role', filters.role);
    if (filters.status) params = params.set('status', filters.status);
    if (filters.territory) params = params.set('territory', filters.territory);
    if (filters.joined_from) params = params.set('joined_from', filters.joined_from);
    if (filters.joined_to) params = params.set('joined_to', filters.joined_to);
    if (filters.search?.trim()) params = params.set('search', filters.search.trim());
    if (filters.ordering && filters.ordering !== '-date')
      params = params.set('ordering', filters.ordering);
    return params;
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
