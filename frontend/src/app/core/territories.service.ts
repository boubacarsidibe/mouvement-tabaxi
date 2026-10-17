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

/** Territoire du bureau avec ce qui y est rattaché directement : un territoire non vide ne se supprime pas. */
export interface TerritoryUsage extends ManagedTerritory {
  members_count: number;
  coordinators_count: number;
  programs_count: number;
  applications_count: number;
  children_count: number;
  /** Rien ni personne ne s'y rattache : le serveur accepte de le supprimer. */
  deletable: boolean;
}

/** Ce qu'un fondateur envoie pour ajouter, renommer, rattacher ou désactiver un territoire. */
export interface TerritoryInput {
  name: string;
  kind: ManagedTerritory['kind'];
  parent: number | null;
  is_active: boolean;
}

const MANAGED = '/api/territories/managed/';

@Injectable({ providedIn: 'root' })
export class TerritoryService {
  private readonly http = inject(HttpClient);

  /** Territoires actifs, en arbre pays > région > commune (route publique). */
  tree(): Promise<TerritoryNode[]> {
    return firstValueFrom(this.http.get<TerritoryNode[]>('/api/territories/'));
  }

  /** Territoires que la personne connectée peut gérer, en ordre d'arbre (un coordonnateur : le sien et ceux qui en dépendent). */
  managed(): Promise<ManagedTerritory[]> {
    return firstValueFrom(this.http.get<ManagedTerritory[]>(MANAGED));
  }

  /** Même liste, avec le nombre de membres, de programmes et de territoires rattachés à chacun. */
  usage(): Promise<TerritoryUsage[]> {
    return firstValueFrom(this.http.get<TerritoryUsage[]>(MANAGED));
  }

  /** Ajoute un territoire (fondateurs). */
  create(input: TerritoryInput): Promise<TerritoryUsage> {
    return firstValueFrom(this.http.post<TerritoryUsage>(MANAGED, input));
  }

  /** Renomme, rattache ailleurs ou désactive un territoire (fondateurs). */
  update(id: number, input: Partial<TerritoryInput>): Promise<TerritoryUsage> {
    return firstValueFrom(this.http.patch<TerritoryUsage>(`${MANAGED}${id}/`, input));
  }

  /** Supprime un territoire vide (fondateurs) ; le serveur refuse s'il contient des membres ou des programmes. */
  remove(id: number): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${MANAGED}${id}/`));
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
