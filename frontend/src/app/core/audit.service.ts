import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Download, fetchFile } from './download';

export type AuditAction =
  | 'demande_acceptee'
  | 'demande_refusee'
  | 'lien_renvoye'
  | 'statut_modifie'
  | 'invitation_envoyee'
  | 'liste_exportee';

export type AuditCategory = 'adhesion' | 'membres' | 'acces' | 'export';

/** Une ligne du journal des actions : qui a fait quoi, à propos de qui, et quand. */
export interface AuditEntry {
  id: number;
  action: AuditAction;
  action_label: string;
  category: AuditCategory;
  category_label: string;
  subject: string;
  /** Phrase qui complète l'action (référence, motif, filtres de l'export…). */
  detail: string;
  actor: { id: number | null; name: string };
  created_at: string;
}

export interface AuditPage {
  count: number;
  next: string | null;
  previous: string | null;
  results: AuditEntry[];
}

export interface AuditFilters {
  action?: AuditAction | '';
  actor?: number | '';
  search?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
}

/** Journal des actions, en lecture seule, réservé aux fondateurs. */
@Injectable({ providedIn: 'root' })
export class AuditService {
  private readonly http = inject(HttpClient);

  list(filters: AuditFilters = {}): Promise<AuditPage> {
    let params = this.params(filters);
    if (filters.page && filters.page > 1) params = params.set('page', filters.page);
    return firstValueFrom(this.http.get<AuditPage>('/api/audit/', { params }));
  }

  /** Fichier Excel du journal affiché : les mêmes filtres, sans les pages. */
  exportList(filters: AuditFilters = {}): Promise<Download> {
    return fetchFile(this.http, '/api/audit/export/', this.params(filters));
  }

  private params(filters: AuditFilters): HttpParams {
    let params = new HttpParams();
    if (filters.action) params = params.set('action', filters.action);
    if (filters.actor) params = params.set('actor', filters.actor);
    if (filters.search?.trim()) params = params.set('search', filters.search.trim());
    if (filters.date_from) params = params.set('date_from', filters.date_from);
    if (filters.date_to) params = params.set('date_to', filters.date_to);
    return params;
  }

  /** Personnes qui ont agi, pour le filtre par auteur. */
  actors(): Promise<{ id: number; name: string }[]> {
    return firstValueFrom(this.http.get<{ id: number; name: string }[]>('/api/audit/actors/'));
  }
}
