import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PublicHeader } from '../shared/public-header';
import { UiIcon } from '../shared/ui-icon';

@Component({
  selector: 'app-request-status-page',
  imports: [PublicHeader, RouterLink, UiIcon],
  template: `
    <main class="public-canvas status-canvas">
      <section class="public-frame status-frame">
        <app-public-header />
        <div class="status-layout">
          <div class="status-main">
            <span class="status-mark"><ui-icon name="mail" /></span>
            <p class="eyebrow">Demande TAB-2026-00418</p>
            <h1>Votre demande est bien arrivée.</h1>
            <p>
              Le bureau du Mouvement TABAXI va la relire. Vous recevrez la décision par courriel,
              généralement sous cinq jours ouvrés.
            </p>
            <div class="request-timeline" aria-label="Suivi de la demande">
              <article class="done">
                <b>✓</b
                ><span
                  ><strong>Demande envoyée</strong><small>15 octobre 2026 · 16 h 42</small></span
                >
              </article>
              <article class="active">
                <b>2</b><span><strong>Examen par le bureau</strong><small>En cours</small></span>
              </article>
              <article>
                <b>3</b><span><strong>Réponse par courriel</strong><small>À venir</small></span>
              </article>
            </div>
            <a class="btn btn-green" routerLink="/">Retour à l’accueil</a>
          </div>
          <aside class="status-aside">
            <h2>Et maintenant ?</h2>
            <ul>
              <li>
                <ui-icon name="mail" /><span
                  ><strong>Surveillez votre courriel</strong>Pensez aussi à vérifier les messages
                  indésirables.</span
                >
              </li>
              <li>
                <ui-icon name="key" /><span
                  ><strong>Le lien sera personnel</strong>En cas d’acceptation, il restera valable 7
                  jours.</span
                >
              </li>
              <li>
                <ui-icon name="users" /><span
                  ><strong>Besoin d’aide ?</strong>Écrivez à adhesion&#64;tabaxi.org.</span
                >
              </li>
            </ul>
            <p>Conservez la référence <strong>TAB-2026-00418</strong>.</p>
          </aside>
        </div>
      </section>
    </main>
  `,
})
export class RequestStatusPage {}
