import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

/** Ce que le visiteur remplit dans le formulaire de demande d'adhésion. */
export interface ApplicationDraft {
  first_name: string;
  last_name: string;
  email: string;
  territory: number;
  profession: string;
  motivation: string;
  consent: boolean;
}

/** Réponse du serveur : une confirmation, sans les informations personnelles. */
export interface SubmittedApplication {
  reference: string;
  status: string;
  status_label: string;
  created_at: string;
}

@Injectable({ providedIn: 'root' })
export class ApplicationService {
  private readonly http = inject(HttpClient);

  submit(draft: ApplicationDraft): Promise<SubmittedApplication> {
    return firstValueFrom(this.http.post<SubmittedApplication>('/api/applications/', draft));
  }
}
