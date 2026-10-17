import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { TerritorySummary } from './auth.service';
import { Download, fetchFile } from './download';

export type ApplicationStatus = 'a_examiner' | 'acceptee' | 'rejetee' | 'inscrite';

/** Demande d'adhésion telle que les fondateurs l'examinent. */
export interface ReviewedApplication {
  id: number;
  reference: string | null;
  first_name: string;
  last_name: string;
  email: string;
  territory: TerritorySummary;
  profession: string;
  motivation: string;
  status: ApplicationStatus;
  status_label: string;
  created_at: string;
  consent_at: string;
  decided_by: { id: number; first_name: string; last_name: string; email: string } | null;
  decided_at: string | null;
  rejection_reason: string;
  internal_note: string;
  /** Fin de validité du dernier lien d'inscription envoyé (demande « Acceptée » seulement). */
  link_expires_at: string | null;
}

export interface ApplicationPage {
  count: number;
  next: string | null;
  previous: string | null;
  results: ReviewedApplication[];
}

export interface ApplicationFilters {
  status?: ApplicationStatus | '';
  search?: string;
  page?: number;
}

/** Examen des demandes d'adhésion par les membres fondateurs. */
@Injectable({ providedIn: 'root' })
export class ReviewService {
  private readonly http = inject(HttpClient);

  list(filters: ApplicationFilters = {}): Promise<ApplicationPage> {
    let params = this.params(filters);
    if (filters.page && filters.page > 1) params = params.set('page', filters.page);
    return firstValueFrom(this.http.get<ApplicationPage>('/api/applications/', { params }));
  }

  /** Fichier Excel de la liste affichée : les mêmes filtres, sans les pages. */
  exportList(filters: ApplicationFilters = {}): Promise<Download> {
    return fetchFile(this.http, '/api/applications/export/', this.params(filters));
  }

  private params(filters: ApplicationFilters): HttpParams {
    let params = new HttpParams();
    if (filters.status) params = params.set('status', filters.status);
    if (filters.search?.trim()) params = params.set('search', filters.search.trim());
    return params;
  }

  get(id: number): Promise<ReviewedApplication> {
    return firstValueFrom(this.http.get<ReviewedApplication>(`/api/applications/${id}/`));
  }

  accept(id: number, internalNote: string): Promise<ReviewedApplication> {
    return firstValueFrom(
      this.http.post<ReviewedApplication>(`/api/applications/${id}/accept/`, {
        internal_note: internalNote,
      }),
    );
  }

  /** Nouveau lien d'inscription pour une personne acceptée : les liens précédents cessent de fonctionner. */
  resendLink(id: number): Promise<ReviewedApplication> {
    return firstValueFrom(
      this.http.post<ReviewedApplication>(`/api/applications/${id}/resend-link/`, {}),
    );
  }

  reject(id: number, reason: string, internalNote: string): Promise<ReviewedApplication> {
    return firstValueFrom(
      this.http.post<ReviewedApplication>(`/api/applications/${id}/reject/`, {
        reason,
        internal_note: internalNote,
      }),
    );
  }
}
