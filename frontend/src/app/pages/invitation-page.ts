import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { readProblem } from '../core/api-problem';
import { AuthService } from '../core/auth.service';
import { InvitationInfo, InvitationService } from '../core/invitation.service';
import { PublicHeader } from '../shared/public-header';
import { UiIcon } from '../shared/ui-icon';

type Step = 'checking' | 'form' | 'refused';

@Component({
  selector: 'app-invitation-page',
  imports: [PublicHeader, RouterLink, UiIcon],
  template: `
    <main class="public-canvas auth-canvas">
      <section class="public-frame auth-frame">
        <app-public-header [minimal]="true" />
        <div class="auth-layout">
          <aside class="auth-story">
            <p class="overline"><span></span>Espace sécurisé</p>
            <h1>Rejoindre le bureau exécutif.</h1>
            <p>L’invitation reçue par courriel est valable 7 jours et ne sert qu’une fois.</p>
          </aside>

          <section class="auth-panel">
            @switch (step()) {
              @case ('checking') {
                <p class="form-notice" role="status">Vérification de votre lien…</p>
              }
              @case ('refused') {
                <div class="submit-success" role="alert">
                  <h2>Invitation inutilisable</h2>
                  <p>{{ error() }}</p>
                  <a class="btn btn-outline" routerLink="/connexion">Se connecter</a>
                </div>
              }
              @default {
                <form class="auth-form" (submit)="submit($event)">
                  <p class="eyebrow">Invitation</p>
                  <h2>Choisir mon mot de passe</h2>
                  @if (info(); as person) {
                    <p>
                      {{ person.first_name }} {{ person.last_name }} · {{ person.role_label }}
                      @if (person.territory_name) { · {{ person.territory_name }} }
                    </p>
                  }
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
                    {{ busy() ? 'Enregistrement…' : 'Accepter l’invitation' }}
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
export class InvitationPage {
  private readonly invitations = inject(InvitationService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly info = signal<InvitationInfo | null>(null);
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
      this.error.set('Cette invitation n’est pas valide. Vérifiez que le lien est complet.');
      this.step.set('refused');
      return;
    }
    try {
      this.info.set(await this.invitations.check(this.token));
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
      const user = await this.invitations.accept(
        this.token,
        String(data.get('password') ?? ''),
        String(data.get('passwordConfirm') ?? ''),
      );
      this.auth.signedIn(user);
      await this.router.navigateByUrl(this.auth.homeFor(user));
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
