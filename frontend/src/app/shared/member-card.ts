import { Component, Input } from '@angular/core';
import { UiIcon } from './ui-icon';

@Component({
  selector: 'app-member-card',
  imports: [UiIcon],
  template: `
    <article class="membership-card" [class.large]="large">
      <div class="card-ribbon"></div>
      <div class="card-brand">
        <img src="logo-tabaxi-transparent.png" alt="Mouvement TABAXI" /><span
          >Engagement<br />Solidarité<br />Développement<br />Participation</span
        >
      </div>
      <h3>Carte de membre</h3>
      <p class="card-type">Membre adhérent</p>
      <div class="card-body">
        <img class="card-portrait" src="member-aminata.jpg" alt="Portrait d’Aminata Ndiaye" />
        <dl>
          <div>
            <ui-icon name="users" /><span
              ><dt>Nom complet</dt>
              <dd>Aminata Ndiaye</dd></span
            >
          </div>
          <div>
            <ui-icon name="card" /><span
              ><dt>N° d’adhérent</dt>
              <dd>TABAXI-2024-0125</dd></span
            >
          </div>
          <div>
            <ui-icon name="location" /><span
              ><dt>Région / pays</dt>
              <dd>Dakar, Sénégal</dd></span
            >
          </div>
          <div>
            <ui-icon name="calendar" /><span
              ><dt>Date d’adhésion</dt>
              <dd>12/03/2024</dd></span
            >
          </div>
        </dl>
      </div>
    </article>
  `,
})
export class MemberCard {
  @Input() large = false;
}
