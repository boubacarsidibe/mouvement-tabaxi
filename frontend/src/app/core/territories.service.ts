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

/** Territoire du périmètre d'un membre du bureau (route réservée au bureau). */
export interface ManagedTerritory {
  id: number;
  name: string;
  kind: 'pays' | 'region' | 'commune';
  kind_label: string;
  /** Exemple : « Sénégal › Saint-Louis › Podor ». */
  path: string;
  parent: number | null;
  is_active: boolean;
}

@Injectable({ providedIn: 'root' })
export class TerritoryService {
  private readonly http = inject(HttpClient);

  /** Territoires actifs, en arbre pays > région > commune (route publique). */
  tree(): Promise<TerritoryNode[]> {
    return firstValueFrom(this.http.get<TerritoryNode[]>('/api/territories/'));
  }

  /** Territoires que la personne connectée peut gérer, en ordre d'arbre (un coordonnateur : le sien et ceux qui en dépendent). */
  managed(): Promise<ManagedTerritory[]> {
    return firstValueFrom(this.http.get<ManagedTerritory[]>('/api/territories/managed/'));
  }
}

/** Régions de l'arbre, chacune avec ses communes : de quoi remplir une liste déroulante groupée. */
export function regionsOf(tree: TerritoryNode[]): TerritoryNode[] {
  return tree.flatMap((country) => (country.kind === 'pays' ? country.children : [country]));
}

/** Territoire proposé dans une liste déroulante : les communes sont décalées sous leur région. */
export interface TerritoryChoice {
  id: number;
  label: string;
}

/** Territoires du périmètre en liste déroulante, présentés en arbre par un retrait (inactifs signalés). */
export function territoryChoices(list: ManagedTerritory[]): TerritoryChoice[] {
  const depth = (path: string) => path.split(' › ').length;
  const top = Math.min(...list.map((item) => depth(item.path)));
  return list.map((item) => ({
    id: item.id,
    label: `${'\u00a0\u00a0'.repeat(depth(item.path) - top)}${item.name}${item.is_active ? '' : ' (inactif)'}`,
  }));
}
