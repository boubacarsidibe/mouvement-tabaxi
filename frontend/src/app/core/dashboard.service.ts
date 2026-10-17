import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { TerritorySummary } from './auth.service';
import { AuditEntry } from './audit.service';

export interface TerritoryFigures {
  territory: TerritorySummary;
  /** Membres simples actifs de ce territoire. */
  members: number;
  /** Coordonnateurs et fondateurs actifs rattachés à ce territoire. */
  coordinators: number;
}

/** Programme prévu ou en cours, pour la liste « Programmes à venir ». */
export interface UpcomingProgram {
  /** Identifiant public (aléatoire) : c'est lui qui figure dans les adresses. */
  id: string;
  name: string;
  territory: string;
  start_date: string;
  end_date: string;
  status: 'prevu' | 'en_cours' | 'termine' | 'annule';
  status_label: string;
}

export interface RecentApplication {
  /** Identifiant public (aléatoire) : c'est lui qui figure dans les adresses. */
  id: string;
  reference: string;
  first_name: string;
  last_name: string;
  territory: string;
  created_at: string;
}

/** Chiffres du tableau de bord, calculés par le serveur dans le périmètre de la personne connectée. */
export interface DashboardData {
  scope: { all: boolean; territory: TerritorySummary | null };
  active_members: number;
  joined_this_month: number;
  coordinators: number;
  pending_applications: number;
  programs_in_progress: number;
  upcoming_programs: UpcomingProgram[];
  territories: TerritoryFigures[];
  /** Nouveaux membres par mois sur douze mois : `month` au format AAAA-MM. */
  monthly_joined: { month: string; count: number }[];
  /** Réservé aux fondateurs : `null` pour les coordonnateurs. */
  recent_applications: RecentApplication[] | null;
  recent_actions: AuditEntry[] | null;
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);

  load(): Promise<DashboardData> {
    return firstValueFrom(this.http.get<DashboardData>('/api/dashboard/'));
  }
}
