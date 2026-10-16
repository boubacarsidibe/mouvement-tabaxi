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
  @Input() name = '';
  @Input() number = '';
  @Input() locality = '';
  @Input() date = '';
  @Input() photo: string | null = null;
}
