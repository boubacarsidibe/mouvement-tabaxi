import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

/** Territoire de la liste publique : pays, région ou commune, avec ce qui en dépend. */
export interface TerritoryNode {
  id: number;
  name: string;
  kind: 'pays' | 'region' | 'commune';
  kind_label: string;
  children: TerritoryNode[];
}

@Injectable({ providedIn: 'root' })
export class TerritoryService {
  private readonly http = inject(HttpClient);

  /** Territoires du périmètre de la personne connectée (bureau), du plus large au plus précis. */
  managed(): Promise<{ id: number; name: string; kind_label: string; path: string }[]> {
    return firstValueFrom(
      this.http.get<{ id: number; name: string; kind_label: string; path: string }[]>(
        '/api/territories/managed/',
      ),
    );
  }

  /** Territoires actifs, en arbre pays > région > commune (route publique). */
  tree(): Promise<TerritoryNode[]> {
    return firstValueFrom(this.http.get<TerritoryNode[]>('/api/territories/'));
  }
}

/** Régions de l'arbre, chacune avec ses communes : de quoi remplir une liste déroulante groupée. */
export function regionsOf(tree: TerritoryNode[]): TerritoryNode[] {
  return tree.flatMap((country) => (country.kind === 'pays' ? country.children : [country]));
}
