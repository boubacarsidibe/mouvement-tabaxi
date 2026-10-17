import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { readProblem } from '../core/api-problem';
import { PasswordService } from '../core/password.service';
import { PublicHeader } from '../shared/public-header';
import { UiIcon } from '../shared/ui-icon';

type Step = 'checking' | 'form' | 'done' | 'refused';

@Component({
  selector: 'app-reset-password-page',
  imports: [PublicHeader, RouterLink, UiIcon],
  template: `
    <main class="public-canvas auth-canvas">
      <section class="public-frame auth-frame">
        <app-public-header [minimal]="true" />
        <div class="auth-layout">
          <aside class="auth-story">
            <p class="overline"><span></span>Espace sécurisé</p>
            <h1>Choisir un nouveau mot de passe.</h1>
            <p>Le lien reçu par courriel est valable une heure et ne sert qu’une fois.</p>
          </aside>

          <section class="auth-panel">
            @switch (step()) {
              @case ('checking') {
                <p class="form-notice" role="status">Vérification de votre lien…</p>
              }
              @case ('refused') {
                <div class="submit-success" role="alert">
                  <h2>Lien inutilisable</h2>
                  <p>{{ error() }}</p>
                  <a class="btn btn-green" routerLink="/mot-de-passe-oublie">Demander un nouveau lien</a>
                </div>
              }
              @case ('done') {
                <div class="submit-success" role="status">
                  <span>✓</span>
                  <h2>Mot de passe modifié</h2>
                  <p>Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.</p>
                  <a class="btn btn-green" routerLink="/connexion">Se connecter</a>
                </div>
              }
              @default {
                <form class="auth-form" (submit)="submit($event)">
                  <p class="eyebrow">Réinitialisation</p>
                  <h2>Nouveau mot de passe</h2>
                  @if (error()) {
                    <p class="form-alert" role="alert">{{ error() }}</p>
                  }
                  <label>
                    Nouveau mot de passe
                    <span class="input-with-icon"
                      ><ui-icon name="key" /><input
                        type="password"
                        name="password"
                        autocomplete="new-password"
                        placeholder="10 caractères minimum"
                        minlength="10"
                        required
                    /></span>
                    @if (fieldErrors()['password']; as message) {
                      <span class="field-error" role="alert">{{ message }}</span>
                    }
                  </label>
                  <label>
                    Confirmer le mot de passe
                    <span class="input-with-icon"
                      ><ui-icon name="key" /><input
                        type="password"
                        name="passwordConfirm"
                        autocomplete="new-password"
                        placeholder="Répétez le mot de passe"
                        minlength="10"
                        required
                    /></span>
                    @if (fieldErrors()['password_confirm']; as message) {
                      <span class="field-error" role="alert">{{ message }}</span>
                    }
                  </label>
                  <button class="btn btn-green btn-wide" type="submit" [disabled]="busy()">
                    {{ busy() ? 'Enregistrement…' : 'Enregistrer le mot de passe' }}
                  </button>
                </form>
              }
            }
          </section>
        </div>
      </section>
    </main>
  `,
})
export class ResetPasswordPage {
  private readonly passwords = inject(PasswordService);
  private readonly token = inject(ActivatedRoute).snapshot.queryParamMap.get('jeton') ?? '';
  protected readonly step = signal<Step>('checking');
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly fieldErrors = signal<Record<string, string>>({});

  constructor() {
    void this.check();
  }

  private async check(): Promise<void> {
    if (!this.token) {
      this.error.set('Ce lien n’est pas valide. Vérifiez qu’il est complet.');
      this.step.set('refused');
      return;
    }
    try {
      await this.passwords.check(this.token);
      this.step.set('form');
    } catch (error) {
      this.error.set(readProblem(error).message);
      this.step.set('refused');
    }
  }

  protected async submit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    this.error.set('');
    this.fieldErrors.set({});
    this.busy.set(true);
    try {
      await this.passwords.reset(
        this.token,
        String(data.get('password') ?? ''),
        String(data.get('passwordConfirm') ?? ''),
      );
      this.step.set('done');
    } catch (error) {
      const problem = readProblem(error);
      if (problem.status === 404 || problem.status === 410) {
        this.error.set(problem.message);
        this.step.set('refused');
      } else {
        this.error.set(problem.message);
        this.fieldErrors.set(problem.fields);
      }
    } finally {
      this.busy.set(false);
    }
  }
}
