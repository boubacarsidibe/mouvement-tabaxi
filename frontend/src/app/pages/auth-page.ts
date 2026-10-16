import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { readProblem } from '../core/api-problem';
import { AuthService } from '../core/auth.service';
import { PasswordService } from '../core/password.service';
import { PublicHeader } from '../shared/public-header';
import { UiIcon } from '../shared/ui-icon';

@Component({
  selector: 'app-auth-page',
  imports: [PublicHeader, RouterLink, UiIcon],
  template: `
    <main class="public-canvas auth-canvas">
      <section class="public-frame auth-frame">
        <app-public-header [minimal]="true" />
        <div class="auth-layout">
          <aside class="auth-story">
            <p class="overline"><span></span>Espace sécurisé</p>
            <h1>{{ isForgot ? 'Retrouver votre accès.' : 'Heureux de vous revoir.' }}</h1>
            <p>
              {{
                isForgot
                  ? 'Indiquez l’adresse courriel associée à votre compte. Nous vous enverrons un lien valable pendant une heure.'
                  : 'Une seule connexion pour les membres, les coordonnateurs et les fondateurs.'
              }}
            </p>
          </aside>

          <section class="auth-panel">
            @if (isForgot && submitted()) {
              <div class="submit-success" role="status">
                <span>✓</span>
                <h2>Vérifiez votre messagerie</h2>
                <p>Si un compte correspond à cette adresse, un courriel vient d’être envoyé.</p>
                <a class="btn btn-green" routerLink="/connexion">Retour à la connexion</a>
              </div>
            } @else {
              <form class="auth-form" (submit)="submit($event)">
                <p class="eyebrow">{{ isForgot ? 'Réinitialisation' : 'Connexion' }}</p>
                <h2>{{ isForgot ? 'Mot de passe oublié' : 'Accéder à mon espace' }}</h2>
                <p class="form-intro">
                  {{
                    isForgot
                      ? 'Saisissez votre courriel pour recevoir les instructions.'
                      : 'Utilisez les identifiants transmis lors de votre adhésion.'
                  }}
                </p>
                @if (notice) {
                  <p class="form-notice" role="status">{{ notice }}</p>
                }
                @if (error()) {
                  <p class="form-alert" role="alert">{{ error() }}</p>
                }
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
                        autocomplete="current-password"
                        placeholder="Votre mot de passe"
                        required
                    /></span>
                  </label>
                  <div class="form-inline">
                    <label class="check-row"
                      ><input type="checkbox" name="remember" /><span>Rester connecté</span></label
                    >
                    <a routerLink="/mot-de-passe-oublie">Mot de passe oublié ?</a>
                  </div>
                }
                <button class="btn btn-green btn-wide" type="submit" [disabled]="busy()">
                  {{ isForgot ? (busy() ? 'Envoi…' : 'Envoyer le lien') : busy() ? 'Connexion…' : 'Se connecter' }}
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
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly passwords = inject(PasswordService);
  protected readonly isForgot = this.route.snapshot.data['mode'] === 'forgot';
  protected readonly submitted = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly notice =
    this.route.snapshot.queryParamMap.get('motif') === 'inactivite'
      ? 'Votre session a été fermée après 30 minutes sans activité. Reconnectez-vous.'
      : '';

  protected async submit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    this.error.set('');
    this.busy.set(true);
    try {
      if (this.isForgot) {
        await this.passwords.forgot(String(data.get('email') ?? '').trim());
        this.submitted.set(true);
        return;
      }
      const user = await this.auth.login(
        String(data.get('email') ?? '').trim(),
        String(data.get('password') ?? ''),
        data.get('remember') === 'on',
      );
      await this.router.navigateByUrl(this.nextUrl() ?? this.auth.homeFor(user));
    } catch (error) {
      this.error.set(readProblem(error).message);
    } finally {
      this.busy.set(false);
    }
  }

  /** Page demandée avant la connexion, seulement si elle appartient au site. */
  private nextUrl(): string | null {
    const next = this.route.snapshot.queryParamMap.get('suivant');
    return next && next.startsWith('/') && !next.startsWith('//') && next !== '/connexion'
      ? next
      : null;
  }
}
