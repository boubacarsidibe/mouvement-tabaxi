import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PublicHeader } from '../shared/public-header';
import { UiIcon } from '../shared/ui-icon';

@Component({
  selector: 'app-auth-page',
  imports: [PublicHeader, RouterLink, UiIcon],
  template: `
    <main class="public-canvas auth-canvas">
      <section class="public-frame auth-frame">
        <app-public-header />
        <div class="auth-layout">
          <aside class="auth-story">
            <p class="overline"><span></span>Espace sécurisé</p>
            <h1>{{ isForgot ? 'Retrouver votre accès.' : 'Heureux de vous revoir.' }}</h1>
            <p>
              {{
                isForgot
                  ? 'Indiquez l’adresse courriel associée à votre compte. Nous vous enverrons un lien valable pendant 30 minutes.'
                  : 'Une seule connexion pour les membres, les coordonnateurs et les fondateurs.'
              }}
            </p>
            <div class="auth-assurance">
              <ui-icon name="key" />
              <span
                ><strong>Vos accès restent privés</strong>Les droits sont vérifiés selon votre rôle
                et votre territoire.</span
              >
            </div>
            <blockquote>« Agir près de chez soi, avancer ensemble. »</blockquote>
          </aside>

          <section class="auth-panel">
            @if (submitted()) {
              <div class="submit-success" role="status">
                <span>✓</span>
                <h2>{{ isForgot ? 'Vérifiez votre messagerie' : 'Connexion vérifiée' }}</h2>
                <p>
                  {{
                    isForgot
                      ? 'Si un compte correspond à cette adresse, un courriel vient d’être envoyé.'
                      : 'Choisissez l’espace de démonstration à ouvrir.'
                  }}
                </p>
                @if (isForgot) {
                  <a class="btn btn-green" routerLink="/connexion">Retour à la connexion</a>
                } @else {
                  <div class="auth-destinations">
                    <a class="btn btn-green" routerLink="/membre">Espace membre</a>
                    <a class="btn btn-outline" routerLink="/bureau">Bureau exécutif</a>
                  </div>
                }
              </div>
            } @else {
              <form class="auth-form" (submit)="submit($event)">
                <a class="back-link" routerLink="/">← Retour à l’accueil</a>
                <p class="eyebrow">{{ isForgot ? 'Réinitialisation' : 'Connexion' }}</p>
                <h2>{{ isForgot ? 'Mot de passe oublié' : 'Accéder à mon espace' }}</h2>
                <p class="form-intro">
                  {{
                    isForgot
                      ? 'Saisissez votre courriel pour recevoir les instructions.'
                      : 'Utilisez les identifiants transmis lors de votre adhésion.'
                  }}
                </p>
                <label>
                  Adresse courriel
                  <span class="input-with-icon"
                    ><ui-icon name="mail" /><input
                      type="email"
                      name="email"
                      placeholder="prenom.nom@exemple.com"
                      required
                  /></span>
                </label>
                @if (!isForgot) {
                  <label>
                    Mot de passe
                    <span class="input-with-icon"
                      ><ui-icon name="key" /><input
                        type="password"
                        name="password"
                        placeholder="Votre mot de passe"
                        required
                        minlength="8"
                    /></span>
                  </label>
                  <div class="form-inline">
                    <label class="check-row"
                      ><input type="checkbox" /><span>Rester connecté</span></label
                    >
                    <a routerLink="/mot-de-passe-oublie">Mot de passe oublié ?</a>
                  </div>
                }
                <button class="btn btn-green btn-wide" type="submit">
                  {{ isForgot ? 'Envoyer le lien' : 'Se connecter' }}
                </button>
                @if (!isForgot) {
                  <p class="auth-help">
                    Pas encore membre ? <a routerLink="/adherer">Déposer une demande</a>
                  </p>
                }
              </form>
            }
          </section>
        </div>
      </section>
    </main>
  `,
})
export class AuthPage {
  private readonly route = inject(ActivatedRoute);
  protected readonly isForgot = this.route.snapshot.data['mode'] === 'forgot';
  protected readonly submitted = signal(false);

  protected submit(event: SubmitEvent): void {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    if (form.reportValidity()) this.submitted.set(true);
  }
}
