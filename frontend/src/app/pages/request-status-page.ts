import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PublicHeader } from '../shared/public-header';
import { UiIcon } from '../shared/ui-icon';

@Component({
  selector: 'app-request-status-page',
  imports: [PublicHeader, RouterLink, UiIcon],
  template: `
    <main class="public-canvas status-canvas status-v2">
      <section class="public-frame status-frame">
        <app-public-header />
        <div class="confirmation-shell">
          <nav class="enrollment-steps confirmation-steps" aria-label="Étapes de l’adhésion">
            <span class="done"><b>✓</b><small>Demande</small></span
            ><i></i> <span class="active"><b>2</b><small>Examen</small></span
            ><i></i>
            <span><b>3</b><small>Adhésion</small></span>
          </nav>

          <div class="confirmation-grid">
            <section class="confirmation-card">
              <span class="status-mark"><ui-icon name="mail" /></span>
              <p class="eyebrow">Demande envoyée</p>
              <h1>Merci, votre demande est entre de bonnes mains.</h1>
              <p class="confirmation-lead">
                Le bureau de TABAXI va maintenant l’examiner. La réponse arrivera par courriel sous
                cinq jours ouvrés.
              </p>
              <div class="confirmation-reference">
                <span>Votre référence</span><strong>TAB-2026-00418</strong
                ><button type="button" aria-label="Copier la référence" (click)="copyReference()">
                  {{ copied() ? 'Copiée' : 'Copier' }}
                </button>
              </div>
              <div class="request-timeline" aria-label="Suivi de la demande">
                <article class="done">
                  <b>✓</b
                  ><span><strong>Demande reçue</strong><small>15 octobre · 16 h 42</small></span>
                </article>
                <article class="active">
                  <b>2</b
                  ><span><strong>Examen par le bureau</strong><small>Étape en cours</small></span>
                </article>
                <article>
                  <b>3</b
                  ><span
                    ><strong>Décision et invitation</strong
                    ><small>Vous serez informé par courriel</small></span
                  >
                </article>
              </div>
              <a class="btn btn-green" routerLink="/">Retour à l’accueil</a>
            </section>

            <aside class="confirmation-aside">
              <img src="hero-tabaxi.jpg" alt="Communauté du Mouvement TABAXI" />
              <div>
                <p class="eyebrow">Pendant ce temps</p>
                <h2>Découvrez ce qui se passe près de chez vous.</h2>
                <ul>
                  <li>
                    <ui-icon name="mail" /><span
                      ><strong>Surveillez votre courriel</strong>Vérifiez aussi les messages
                      indésirables.</span
                    >
                  </li>
                  <li>
                    <ui-icon name="key" /><span
                      ><strong>Gardez votre lien personnel</strong>En cas d’acceptation, il restera
                      valable 7 jours.</span
                    >
                  </li>
                  <li>
                    <ui-icon name="users" /><span
                      ><strong>Une question ?</strong>adhesion&#64;tabaxi.org</span
                    >
                  </li>
                </ul>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </main>
  `,
})
export class RequestStatusPage {
  protected readonly copied = signal(false);

  protected async copyReference(): Promise<void> {
    await navigator.clipboard.writeText('TAB-2026-00418');
    this.copied.set(true);
  }
}
