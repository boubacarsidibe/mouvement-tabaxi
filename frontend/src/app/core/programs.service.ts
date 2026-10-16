import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { TerritorySummary } from './auth.service';
import { Download, fetchFile } from './download';

export type ProgramStatus = 'prevu' | 'en_cours' | 'termine' | 'annule';

export const PROGRAM_STATUSES: { value: ProgramStatus; label: string }[] = [
  { value: 'prevu', label: 'Prévu' },
  { value: 'en_cours', label: 'En cours' },
  { value: 'termine', label: 'Terminé' },
  { value: 'annule', label: 'Annulé' },
];

/** Classes du badge d'un état : vert en cours, jaune prévu, rouge annulé, neutre terminé. */
export function statusBadge(status: ProgramStatus) {
  return { success: status === 'en_cours', warning: status === 'prevu', danger: status === 'annule' };
}

export interface PersonRef {
  id: number;
  name: string;
}

/** Un programme dans une liste du bureau. */
export interface ProgramRow {
  id: number;
  name: string;
  objective: string;
  territory: TerritorySummary;
  manager: PersonRef | null;
  /** Dates au format AAAA-MM-JJ. */
  start_date: string;
  end_date: string;
  status: ProgramStatus;
  status_label: string;
  activities_count: number;
}

export interface ProgramSummary {
  id: number;
  name: string;
  status: ProgramStatus;
  status_label: string;
  territory: string;
}

/** Activité telle que le bureau la voit : avec son compte rendu, ses inscrits et ses présences. */
export interface ProgramActivity {
  id: number;
  program: ProgramSummary;
  title: string;
  starts_at: string;
  ends_at: string | null;
  place: string;
  description: string;
  report: string;
  report_author: PersonRef | null;
  reported_at: string | null;
  has_started: boolean;
  is_over: boolean;
  registrations_count: number;
  attendance_noted: boolean;
  /** `null` tant que la liste des présences n'est pas notée. */
  attendance_count: number | null;
}

export interface ProgramRecord extends ProgramRow {
  activities: ProgramActivity[];
}

export interface ProgramPage {
  count: number;
  next: string | null;
  previous: string | null;
  results: ProgramRow[];
}

export interface ProgramFilters {
  status?: ProgramStatus | '';
  territory?: number | '';
  search?: string;
  page?: number;
}

export interface ProgramInput {
  name: string;
  objective: string;
  territory: number;
  manager: number | null;
  start_date: string;
  end_date: string;
  status: ProgramStatus;
}

export interface ActivityInput {
  title: string;
  starts_at: string;
  ends_at: string | null;
  place: string;
  description: string;
}

export interface Manager {
  id: number;
  name: string;
  role_label: string;
}

export interface AttendanceMember {
  id: number;
  number: string;
  first_name: string;
  last_name: string;
  territory: string | null;
  registered: boolean;
  present: boolean;
}

export interface AttendanceSheet {
  noted: boolean;
  noted_at: string | null;
  noted_by: PersonRef | null;
  present_count: number;
  members: AttendanceMember[];
}

export interface Registrant {
  member: number;
  number: string;
  first_name: string;
  last_name: string;
  email: string;
  territory: string | null;
  registered_at: string;
}

/** Activité telle que le membre la voit : sans compte rendu, avec sa propre inscription. */
export interface MemberActivity {
  id: number;
  program: ProgramSummary & { manager: PersonRef | null };
  title: string;
  starts_at: string;
  ends_at: string | null;
  place: string;
  description: string;
  registered: boolean;
  registrations_count: number;
  /** Faux quand le programme est terminé ou que l'activité a commencé. */
  registration_open: boolean;
}

export interface MemberProgram {
  id: number;
  name: string;
  objective: string;
  territory: TerritorySummary;
  manager: PersonRef | null;
  start_date: string;
  end_date: string;
  status: ProgramStatus;
  status_label: string;
  activities: MemberActivity[];
}

export interface MemberProgramPage {
  count: number;
  next: string | null;
  previous: string | null;
  results: MemberProgram[];
}

export interface MemberProgramFilters {
  /** Sans valeur : les programmes prévus et en cours. */
  status?: 'prevu' | 'en_cours' | 'termine' | '';
  search?: string;
  page?: number;
}

/** Date et heure d'un `<input type="datetime-local">` (heure locale) vers une date ISO que le serveur comprend. */
export function toIso(local: string): string {
  return new Date(local).toISOString();
}

/** Date ISO du serveur vers la valeur d'un `<input type="datetime-local">`, à l'heure locale. */
export function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Programmes et activités : écrans du bureau (création, comptes rendus, présences) et du membre (inscription). */
@Injectable({ providedIn: 'root' })
export class ProgramsService {
  private readonly http = inject(HttpClient);

  // --- Bureau ---------------------------------------------------------------------------------------------

  list(filters: ProgramFilters = {}): Promise<ProgramPage> {
    let params = this.params(filters);
    if (filters.page && filters.page > 1) params = params.set('page', filters.page);
    return firstValueFrom(this.http.get<ProgramPage>('/api/programs/', { params }));
  }

  /** Fichier Excel de la liste affichée : les mêmes filtres, sans les pages. */
  exportList(filters: ProgramFilters = {}): Promise<Download> {
    return fetchFile(this.http, '/api/programs/export/', this.params(filters));
  }

  private params(filters: ProgramFilters): HttpParams {
    let params = new HttpParams();
    if (filters.status) params = params.set('status', filters.status);
    if (filters.territory) params = params.set('territory', filters.territory);
    if (filters.search?.trim()) params = params.set('search', filters.search.trim());
    return params;
  }

  get(id: number): Promise<ProgramRecord> {
    return firstValueFrom(this.http.get<ProgramRecord>(`/api/programs/${id}/`));
  }

  create(input: ProgramInput): Promise<ProgramRecord> {
    return firstValueFrom(this.http.post<ProgramRecord>('/api/programs/', input));
  }

  update(id: number, input: Partial<ProgramInput>): Promise<ProgramRecord> {
    return firstValueFrom(this.http.patch<ProgramRecord>(`/api/programs/${id}/`, input));
  }

  managers(territory: number): Promise<Manager[]> {
    const params = new HttpParams().set('territory', territory);
    return firstValueFrom(this.http.get<Manager[]>('/api/programs/managers/', { params }));
  }

  createActivity(program: number, input: ActivityInput): Promise<ProgramActivity> {
    return firstValueFrom(this.http.post<ProgramActivity>(`/api/programs/${program}/activities/`, input));
  }

  activity(id: number): Promise<ProgramActivity> {
    return firstValueFrom(this.http.get<ProgramActivity>(`/api/activities/${id}/`));
  }

  updateActivity(id: number, input: Partial<ActivityInput>): Promise<ProgramActivity> {
    return firstValueFrom(this.http.patch<ProgramActivity>(`/api/activities/${id}/`, input));
  }

  saveReport(id: number, report: string, programStatus?: ProgramStatus): Promise<ProgramActivity> {
    const body: { report: string; program_status?: ProgramStatus } = { report };
    if (programStatus) body.program_status = programStatus;
    return firstValueFrom(this.http.put<ProgramActivity>(`/api/activities/${id}/report/`, body));
  }

  attendance(id: number): Promise<AttendanceSheet> {
    return firstValueFrom(this.http.get<AttendanceSheet>(`/api/activities/${id}/attendance/`));
  }

  saveAttendance(id: number, members: number[]): Promise<AttendanceSheet> {
    return firstValueFrom(this.http.put<AttendanceSheet>(`/api/activities/${id}/attendance/`, { members }));
  }

  registrants(id: number): Promise<{ count: number; results: Registrant[] }> {
    return firstValueFrom(
      this.http.get<{ count: number; results: Registrant[] }>(`/api/activities/${id}/registrations/`),
    );
  }

  exportRegistrants(id: number): Promise<Download> {
    return fetchFile(this.http, `/api/activities/${id}/registrations/export/`, new HttpParams());
  }

  // --- Membre ---------------------------------------------------------------------------------------------

  memberPrograms(filters: MemberProgramFilters = {}): Promise<MemberProgramPage> {
    let params = new HttpParams();
    if (filters.status) params = params.set('status', filters.status);
    if (filters.search?.trim()) params = params.set('search', filters.search.trim());
    if (filters.page && filters.page > 1) params = params.set('page', filters.page);
    return firstValueFrom(this.http.get<MemberProgramPage>('/api/member/programs/', { params }));
  }

  memberActivity(id: number): Promise<MemberActivity> {
    return firstValueFrom(this.http.get<MemberActivity>(`/api/member/activities/${id}/`));
  }

  register(id: number): Promise<MemberActivity> {
    return firstValueFrom(this.http.post<MemberActivity>(`/api/member/activities/${id}/registration/`, {}));
  }

  unregister(id: number): Promise<MemberActivity> {
    return firstValueFrom(this.http.delete<MemberActivity>(`/api/member/activities/${id}/registration/`));
  }
}
