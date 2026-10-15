import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PublicHeader } from '../shared/public-header';
import { UiIcon } from '../shared/ui-icon';

@Component({
  selector: 'app-public-page',
  imports: [PublicHeader, RouterLink, UiIcon],
  template: `
    <main class="public-canvas">
      <section class="public-frame">
        <app-public-header />

        <div class="public-hero">
          <img
            class="public-hero-art"
            src="hero-tabaxi.jpg"
            alt="Citoyens réunis face à Dakar et aux territoires du Sénégal"
          />
          <div class="public-hero-copy">
            <p class="overline"><span></span>Mouvement citoyen</p>
            <h1>La voix de nos<br />territoires.</h1>
            <p class="public-lead">
              Le Mouvement TABAXI rassemble des citoyens engagés pour des communautés plus fortes,
              plus solidaires et un avenir meilleur dans tous nos territoires.
            </p>
          </div>

          <div class="commitment-note">
            Notre engagement<br />pour des communautés<br />plus fortes <i></i>
          </div>

          <div class="role-row" id="apropos">
            <a class="role-card role-founder" routerLink="/bureau">
              <ui-icon name="users" />
              <strong>Membre fondateur</strong>
              <span>Contribuez dès aujourd’hui à bâtir le mouvement.</span>
              <b aria-hidden="true">→</b>
            </a>
            <a class="role-card role-member" routerLink="/membre">
              <ui-icon name="users" />
              <strong>Membre simple</strong>
              <span>Rejoignez une communauté citoyenne active.</span>
              <b aria-hidden="true">→</b>
            </a>
            <a class="role-card role-join" routerLink="/adherer">
              <ui-icon name="plus" />
              <strong>Je souhaite<br />devenir membre</strong>
              <span>Commencez votre demande d’adhésion en quelques minutes.</span>
              <b aria-hidden="true">→</b>
            </a>
          </div>

          <aside class="member-strip" aria-label="Exemples de membres du mouvement">
            <h2>Découvrez des membres du mouvement</h2>
            <div class="member-faces">
              @for (person of members; track person.name) {
                <div>
                  <img [src]="person.image" alt="" />
                  <strong>{{ person.name }}</strong>
                  <span>{{ person.city }}</span>
                </div>
              }
            </div>
          </aside>
        </div>
      </section>

      <section class="public-actions" id="actions">
        <p class="overline"><span></span>Le mouvement en action</p>
        <div>
          <h2>Des initiatives suivies,<br />territoire par territoire.</h2>
          <p>
            Les membres découvrent les activités proches de chez eux. Les coordonnateurs organisent
            les programmes et gardent une trace claire de ce qui a été accompli.
          </p>
          <a class="btn btn-green" routerLink="/membre/programmes"
            >Découvrir les programmes <span>→</span></a
          >
        </div>
      </section>
    </main>
  `,
})
export class PublicPage {
  protected readonly members = [
    { name: 'Aminata', city: 'Dakar', image: 'member-aminata.jpg' },
    { name: 'Mamadou', city: 'Thiès', image: 'coordinator-mamadou.jpg' },
    { name: 'Fatou', city: 'Ziguinchor', image: 'member-aminata.jpg' },
    { name: 'Ibrahim', city: 'Tambacounda', image: 'coordinator-mamadou.jpg' },
    { name: 'Marième', city: 'Kolda', image: 'member-aminata.jpg' },
    { name: 'Cheikh', city: 'Louga', image: 'coordinator-mamadou.jpg' },
  ];
}
