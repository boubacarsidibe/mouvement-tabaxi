import { Component, Input } from '@angular/core';

/**
 * Carte de membre : le modèle officiel du mouvement sert de fond,
 * la photo et les informations du membre sont placées dans ses cadres.
 */
@Component({
  selector: 'app-member-card',
  template: `
    <article class="membership-card" [class.large]="large" aria-label="Carte de membre TABAXI de {{ name }}">
      <img class="card-template" src="modele-carte.webp" alt="" />
      @if (photo) {
        <img class="card-portrait" [src]="photo" [alt]="'Portrait de ' + name" />
      }
      <div class="card-value card-name">{{ name }}</div>
      <div class="card-value card-number">{{ number }}</div>
      <div class="card-value card-locality">{{ locality }}</div>
      <div class="card-value card-date">{{ date }}</div>
    </article>
  `,
})
export class MemberCard {
  @Input() large = false;
  @Input() name = 'Aminata Ndiaye';
  @Input() number = 'TBX-2026-00125';
  @Input() locality = 'Dakar, Sénégal';
  @Input() date = '12/03/2026';
  @Input() photo: string | null = 'member-aminata.jpg';
}
