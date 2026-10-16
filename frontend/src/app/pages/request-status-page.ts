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
        <app-public-header [minimal]="true" />
        <div class="confirmation-shell">
          <div class="confirmation-grid confirmation-grid-focused">
            <section class="confirmation-card">
              <span class="status-mark"><ui-icon name="mail" /></span>
              <p class="eyebrow">Demande envoyée</p>
              <h1>Merci, votre demande est entre de bonnes mains.</h1>
              <p class="confirmation-lead">
                Le bureau va l’examiner. La décision vous sera envoyée par courriel.
              </p>
              <div class="confirmation-reference">
                <span>Votre référence</span><strong>TAB-2026-00418</strong
                ><button type="button" aria-label="Copier la référence" (click)="copyReference()">
                  {{ copied() ? 'Copiée' : 'Copier' }}
                </button>
              </div>
              <a class="btn btn-green" routerLink="/">Retour à l’accueil</a>
            </section>
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
