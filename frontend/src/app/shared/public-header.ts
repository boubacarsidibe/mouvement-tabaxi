import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UiIcon } from './ui-icon';

@Component({
  selector: 'app-public-header',
  imports: [RouterLink, UiIcon],
  template: `
    <header class="public-header" [class.minimal]="minimal">
      <a class="public-logo" routerLink="/" aria-label="Accueil TABAXI">
        <img src="logo-tabaxi-transparent.png" alt="Mouvement TABAXI" />
      </a>
      @if (minimal) {
        <a class="back-link header-back" routerLink="/">← Retour à l’accueil</a>
      } @else {
      <nav aria-label="Navigation principale">
        <a routerLink="/" fragment="apropos">À propos</a>
        <a routerLink="/" fragment="actions">Nos actions</a>
        <a routerLink="/" fragment="programmes">Nos programmes</a>
        <a routerLink="/adherer">Nous rejoindre</a>
      </nav>
      <div class="header-actions">
        <a class="btn btn-gold header-join" routerLink="/adherer">Adhérer</a>
        <a class="btn btn-green header-login" routerLink="/connexion"
          ><ui-icon name="users" /> Se connecter</a
        >
      </div>
      }
    </header>
  `,
})
export class PublicHeader {
  /** Pages où l'on accomplit une tâche : logo et retour seulement, sans le menu. */
  @Input() minimal = false;
}
