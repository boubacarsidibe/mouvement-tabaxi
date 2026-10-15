import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { ApiService } from '../core/api.service';
import { PublicHeader } from '../shared/public-header';

@Component({
  selector: 'app-auth-page',
  imports: [PublicHeader, RouterLink],
  template: `
    <main class="public-canvas auth-canvas">
      <section class="public-frame auth-frame">
        <app-public-header [minimal]="true" />
        <div class="auth-layout">
          <aside class="auth-story">
            <p class="eyebrow">Espace sécurisé</p>
            <h1>{{ isForgot ? 'Retrouvez votre accès.' : 'Votre engagement continue ici.' }}</h1>
            <span class="auth-story-rule" aria-hidden="true"></span>
            <p>
              {{
                isForgot
                  ? 'Nous vous aidons à retrouver l’accès associé à votre adhésion.'
                  : 'Retrouvez votre espace membre ou le bureau exécutif depuis un accès unique.'
              }}
            </p>
          </aside>

          <section class="auth-panel">
            @if (isForgot) {
              <div class="auth-form auth-support" role="status">
                <p class="eyebrow">Accès au compte</p>
                <h2>Mot de passe oublié ?</h2>
                <p class="form-intro">
                  Pour protéger votre compte, contactez votre coordinateur depuis l’adresse liée à
                  votre adhésion.
                </p>
                <p class="auth-support-note">
                  Le bureau vérifiera votre identité avant de rétablir votre accès.
                </p>
                <a class="btn btn-green" routerLink="/connexion">Retour à la connexion</a>
              </div>
            } @else {
              <form class="auth-form" (submit)="submit($event)" novalidate>
                <p class="eyebrow">Connexion</p>
                <h2>Accéder à mon espace</h2>
                <p class="form-intro">Utilisez l’adresse associée à votre compte TABAXI.</p>

                @if (errorMessage()) {
                  <p class="form-error" role="alert">{{ errorMessage() }}</p>
                }

                <label>
                  Adresse courriel
                  <input
                    type="email"
                    name="email"
                    placeholder="exemple@domaine.com"
                    autocomplete="email"
                    required
                  />
                </label>
                <label>
                  Mot de passe
                  <span class="password-field">
                    <input
                      [type]="showPassword() ? 'text' : 'password'"
                      name="password"
                      placeholder="Votre mot de passe"
                      autocomplete="current-password"
                      required
                      minlength="10"
                    />
                    <button
                      type="button"
                      class="password-toggle"
                      (click)="showPassword.set(!showPassword())"
                      [attr.aria-label]="
                        showPassword() ? 'Masquer le mot de passe' : 'Afficher le mot de passe'
                      "
                    >
                      {{ showPassword() ? 'Masquer' : 'Afficher' }}
                    </button>
                  </span>
                </label>
                <div class="form-inline">
                  <label class="check-row"
                    ><input type="checkbox" name="remember" /><span>Rester connecté</span></label
                  >
                  <a routerLink="/mot-de-passe-oublie">Mot de passe oublié ?</a>
                </div>
                <button class="btn btn-green btn-wide" type="submit" [disabled]="submitting()">
                  {{ submitting() ? 'Connexion en cours…' : 'Se connecter' }}
                </button>
                <p class="auth-help">
                  Un problème d’accès ?
                  <a routerLink="/mot-de-passe-oublie">Contactez votre coordinateur</a>
                </p>
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
  private readonly api = inject(ApiService);

  protected readonly isForgot = this.route.snapshot.data['mode'] === 'forgot';
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly showPassword = signal(false);

  protected submit(event: SubmitEvent): void {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    if (!form.reportValidity() || this.submitting()) return;

    const data = new FormData(form);
    this.submitting.set(true);
    this.errorMessage.set('');
    this.api
      .login(
        String(data.get('email') ?? ''),
        String(data.get('password') ?? ''),
        data.get('remember') === 'on',
      )
      .subscribe({
        next: (user) => {
          const requested = this.route.snapshot.queryParamMap.get('retour');
          const destination = requested?.startsWith('/')
            ? requested
            : user.is_bureau
              ? '/bureau'
              : '/membre';
          void this.router
            .navigateByUrl(destination)
            .then((navigated) => {
              if (!navigated) {
                this.errorMessage.set(
                  'La connexion a réussi, mais votre espace n’a pas pu être ouvert. Réessayez.',
                );
                this.submitting.set(false);
              }
            })
            .catch(() => {
              this.errorMessage.set(
                'La connexion a réussi, mais votre espace n’a pas pu être ouvert. Réessayez.',
              );
              this.submitting.set(false);
            });
        },
        error: (error: HttpErrorResponse) => {
          this.errorMessage.set(
            typeof error.error?.detail === 'string'
              ? error.error.detail
              : error.status === 0
                ? 'Le service est momentanément inaccessible. Réessayez dans quelques instants.'
                : 'Connexion impossible. Vérifiez vos informations.',
          );
          this.submitting.set(false);
        },
      });
  }
}
