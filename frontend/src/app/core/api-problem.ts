import { HttpErrorResponse } from '@angular/common/http';

/** Erreur renvoyée par l'API, ramenée à ce que l'écran affiche. */
export interface ApiProblem {
  /** Message principal, en français, à afficher en haut du formulaire. */
  message: string;
  /** Code stable renvoyé par le serveur (`invalid_credentials`, `session_expired`…). */
  code?: string;
  /** Premier message d'erreur de chaque champ du formulaire. */
  fields: Record<string, string>;
  status: number;
}

const OFFLINE = 'Le serveur ne répond pas. Vérifiez votre connexion internet, puis réessayez.';
const SERVER = 'Le serveur a rencontré un problème. Réessayez dans un instant.';
const FIELDS = 'Certains champs sont à corriger.';
const UNKNOWN = 'Une erreur est survenue. Réessayez dans un instant.';

/** Lit une erreur HTTP de l'API Django (`{"detail", "code"}` ou un message par champ). */
export function readProblem(error: unknown): ApiProblem {
  if (!(error instanceof HttpErrorResponse)) return { message: UNKNOWN, fields: {}, status: -1 };
  if (error.status === 0) return { message: OFFLINE, fields: {}, status: 0 };

  const fields: Record<string, string> = {};
  let message = '';
  let code: string | undefined;
  const body: unknown = error.error;
  if (body && typeof body === 'object') {
    for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
      if (key === 'detail' && typeof value === 'string') message = value;
      else if (key === 'code' && typeof value === 'string') code = value;
      else if (Array.isArray(value) && value.length) fields[key] = String(value[0]);
      else if (typeof value === 'string') fields[key] = value;
    }
  }
  if (fields['non_field_errors']) message ||= fields['non_field_errors'];
  if (!message)
    message = Object.keys(fields).length ? FIELDS : error.status >= 500 ? SERVER : UNKNOWN;
  return { message, code, fields, status: error.status };
}
