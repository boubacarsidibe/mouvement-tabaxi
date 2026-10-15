import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, switchMap, tap } from 'rxjs';

export interface TerritoryNode {
  id: number;
  name: string;
  kind: 'pays' | 'region' | 'commune';
  kind_label: string;
  children: TerritoryNode[];
}

export interface TerritorySummary {
  id: number;
  name: string;
  kind: string;
  kind_label: string;
  path: string;
}

export interface CurrentUser {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: 'membre' | 'coordonnateur' | 'fondateur';
  role_label: string;
  is_bureau: boolean;
}

export interface MembershipApplication {
  id: number;
  reference: string;
  first_name: string;
  last_name: string;
  email: string;
  territory: TerritorySummary;
  profession: string;
  motivation: string;
  status: 'a_examiner' | 'acceptee' | 'rejetee' | 'inscrite';
  status_label: string;
  created_at: string;
  consent_at: string;
  rejection_reason: string;
  internal_note: string;
}

export interface PaginatedApplications {
  count: number;
  next: string | null;
  previous: string | null;
  results: MembershipApplication[];
}

export interface RegistrationPreview {
  first_name: string;
  last_name: string;
  email: string;
  territory: TerritorySummary;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  readonly currentUser = signal<CurrentUser | null>(null);

  territories(): Observable<TerritoryNode[]> {
    return this.http.get<TerritoryNode[]>('/api/territories/');
  }

  submitApplication(payload: Record<string, unknown>): Observable<{ reference: string; created_at: string }> {
    return this.http.post<{ reference: string; created_at: string }>('/api/applications/', payload);
  }

  registrationPreview(token: string): Observable<RegistrationPreview> {
    return this.http.get<RegistrationPreview>('/api/applications/finalize/', { params: { token } });
  }

  finalizeRegistration(payload: FormData): Observable<{ membership_number: string; email: string }> {
    return this.http.post<{ membership_number: string; email: string }>('/api/applications/finalize/', payload);
  }

  login(email: string, password: string, remember: boolean): Observable<CurrentUser> {
    return this.http
      .post<CurrentUser>('/api/auth/login/', { email, password, remember })
      .pipe(switchMap(() => this.me()));
  }

  me(): Observable<CurrentUser> {
    return this.http.get<CurrentUser>('/api/auth/me/').pipe(tap((user) => this.currentUser.set(user)));
  }

  logout(): Observable<void> {
    return this.http.post<void>('/api/auth/logout/', {}).pipe(tap(() => this.currentUser.set(null)));
  }

  applications(filters: { status?: string; search?: string } = {}): Observable<PaginatedApplications> {
    let params = new HttpParams();
    if (filters.status) params = params.set('status', filters.status);
    if (filters.search) params = params.set('search', filters.search);
    return this.http.get<PaginatedApplications>('/api/applications/', { params });
  }

  application(id: number): Observable<MembershipApplication> {
    return this.http.get<MembershipApplication>(`/api/applications/${id}/`);
  }

  acceptApplication(id: number, internalNote = ''): Observable<MembershipApplication> {
    return this.http.post<MembershipApplication>(`/api/applications/${id}/accept/`, { internal_note: internalNote });
  }

  rejectApplication(id: number, reason: string, internalNote = ''): Observable<MembershipApplication> {
    return this.http.post<MembershipApplication>(`/api/applications/${id}/reject/`, {
      reason,
      internal_note: internalNote,
    });
  }
}

export function flattenTerritories(
  nodes: TerritoryNode[],
  parents: string[] = [],
): Array<{ id: number; label: string }> {
  return nodes.flatMap((node) => {
    const path = [...parents, node.name];
    const current = node.kind === 'commune' ? [{ id: node.id, label: path.join(' › ') }] : [];
    return [...current, ...flattenTerritories(node.children, path)];
  });
}
