import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

/** Fichier reçu du serveur, avec le nom qu'il propose. */
export interface Download {
  blob: Blob;
  filename: string;
}

const DEFAULT_NAME = 'export.xlsx';

/**
 * Télécharge un fichier de l'API. Quand le serveur refuse (filtre invalide, droits…), son message
 * JSON arrive dans un `Blob` : on le relit pour que l'erreur s'affiche comme les autres.
 */
export async function fetchFile(http: HttpClient, url: string, params: HttpParams): Promise<Download> {
  try {
    const response = await firstValueFrom(
      http.get(url, { params, responseType: 'blob', observe: 'response' }),
    );
    const name = /filename="([^"]+)"/.exec(response.headers.get('Content-Disposition') ?? '')?.[1];
    return { blob: response.body as Blob, filename: name ?? DEFAULT_NAME };
  } catch (error) {
    throw await readable(error);
  }
}

async function readable(error: unknown): Promise<unknown> {
  if (!(error instanceof HttpErrorResponse) || !(error.error instanceof Blob)) return error;
  try {
    const body = JSON.parse(await error.error.text());
    return new HttpErrorResponse({
      error: body,
      status: error.status,
      statusText: error.statusText,
      url: error.url ?? undefined,
    });
  } catch {
    return new HttpErrorResponse({ status: error.status, statusText: error.statusText, url: error.url ?? undefined });
  }
}

/** Enregistre le fichier sur l'appareil de la personne (le navigateur propose le dossier). */
export function saveFile(file: Download): void {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(file.blob);
  link.download = file.filename;
  link.click();
  URL.revokeObjectURL(link.href);
}
