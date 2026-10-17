import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiProblem, readProblem } from '../core/api-problem';
import { AuthService } from '../core/auth.service';
import { PHOTO_TOO_LARGE, PhotoService } from '../core/photo.service';
import { RegistrationLinkInfo, RegistrationService } from '../core/registration.service';
import { UiIcon } from '../shared/ui-icon';

@Component({
  selector: 'app-finalize-page',
  imports: [RouterLink, UiIcon],
  template: `
    <main class="public-canvas join-canvas join-v2">
      <section class="public-frame join-frame">
        <div class="enrollment-shell">
          <section class="enrollment-main">
            <header class="enrollment-topbar">
              <a class="enrollment-logo" routerLink="/"
                ><img src="logo-tabaxi-transparent.png" alt="Mouvement TABAXI, retour à l’accueil"
              /></a>
              <a class="back-link" routerLink="/">← Retour à l’accueil</a>
            </header>

            @if (loading()) {
              <p class="form-notice" role="status">Vérification de votre lien…</p>
            } @else if (link(); as info) {
              <form class="enrollment-form" (submit)="submit($event)">
                <header class="enrollment-form-header">
                  <span><ui-icon name="key" /></span>
                  <div>
                    <p class="eyebrow">Profil membre</p>
                    <h1>Finalisez votre adhésion, {{ info.first_name }}</h1>
                    <p>
                      Votre demande est acceptée. {{ info.last_name }} {{ info.first_name }} ·
                      {{ info.email }} · {{ info.territory.path }}.
                    </p>
                  </div>
                </header>

                @if (error()) {
                  <p class="form-alert" role="alert">{{ error() }}</p>
                }

                <label
                  >Adresse complète <em>*</em
                  ><input
                    name="address"
                    autocomplete="street-address"
                    maxlength="255"
                    placeholder="Numéro, rue, quartier, ville"
                    required
                    [attr.aria-invalid]="fieldErrors()['address'] ? 'true' : null"
                  />
                  @if (fieldErrors()['address']; as message) {
                    <span class="field-error" role="alert">{{ message }}</span>
                  }
                </label>
                <label
                  >Téléphone (facultatif)
                  <input
                    type="tel"
                    name="phone"
                    autocomplete="tel"
                    placeholder="+221 77 000 00 00"
                    [attr.aria-invalid]="fieldErrors()['phone'] ? 'true' : null"
                  />
                  @if (fieldErrors()['phone']; as message) {
                    <span class="field-error" role="alert">{{ message }}</span>
                  }
                </label>
                <label
                  >Photo de profil <em>*</em>
                  <input
                    type="file"
                    name="photo"
                    accept="image/jpeg,image/png"
                    required
                    (change)="photoChosen($event)"
                    [attr.aria-invalid]="fieldErrors()['photo'] ? 'true' : null"
                  />
                  <small>JPG ou PNG · les photos lourdes sont réduites avant l’envoi</small>
                  @if (preparingPhoto()) {
                    <small role="status">Préparation de la photo…</small>
                  }
                  @if (fieldErrors()['photo']; as message) {
                    <span class="field-error" role="alert">{{ message }}</span>
                  }
                </label>
                <div class="field-grid">
                  <label
                    >Créer un mot de passe <em>*</em
                    ><input
                      type="password"
                      name="password"
                      autocomplete="new-password"
                      placeholder="10 caractères minimum"
                      minlength="10"
                      required
                      [attr.aria-invalid]="fieldErrors()['password'] ? 'true' : null"
                    />
                    @if (fieldErrors()['password']; as message) {
                      <span class="field-error" role="alert">{{ message }}</span>
                    }
                  </label>
                  <label
                    >Confirmer le mot de passe <em>*</em
                    ><input
                      type="password"
                      name="passwordConfirm"
                      autocomplete="new-password"
                      placeholder="Répétez le mot de passe"
                      minlength="10"
                      required
                      [attr.aria-invalid]="fieldErrors()['password_confirm'] ? 'true' : null"
                    />
                    @if (fieldErrors()['password_confirm']; as message) {
                      <span class="field-error" role="alert">{{ message }}</span>
                    }
                  </label>
                </div>
                <label class="enrollment-consent"
                  ><input type="checkbox" name="rules" required /><span
                    >J’accepte les statuts et le règlement intérieur du Mouvement TABAXI.</span
                  >
                  @if (fieldErrors()['accept_rules']; as message) {
                    <span class="field-error" role="alert">{{ message }}</span>
                  }
                </label>

                <footer class="enrollment-form-footer">
                  <p>
                    <ui-icon name="key" /><span
                      ><strong>Lien à usage unique</strong>Il expire le
                      {{ expiry(info.expires_at) }}.</span
                    >
                  </p>
                  <button class="btn btn-green" type="submit" [disabled]="busy()">
                    {{ busy() ? 'Création du compte…' : 'Finaliser mon adhésion' }}
                    <span>→</span>
                  </button>
                </footer>
              </form>
            } @else {
              <div class="submit-success enrollment-success" role="alert">
                <span>!</span>
                <p class="eyebrow">Lien inutilisable</p>
                <h1>{{ problem()?.message }}</h1>
                @if (problem()?.code === 'link_used') {
                  <a class="btn btn-green" routerLink="/connexion">Me connecter</a>
                } @else {
                  <a class="btn btn-outline" routerLink="/">Retour à l’accueil</a>
                }
              </div>
            }
          </section>
        </div>
      </section>
    </main>
  `,
})
export class FinalizePage {
  private readonly registration = inject(RegistrationService);
  private readonly photos = inject(PhotoService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly token = inject(ActivatedRoute).snapshot.queryParamMap.get('jeton') ?? '';

  protected readonly loading = signal(true);
  protected readonly link = signal<RegistrationLinkInfo | null>(null);
  protected readonly problem = signal<ApiProblem | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly fieldErrors = signal<Record<string, string>>({});
  protected readonly preparingPhoto = signal(false);
  /** Photo choisie, réduite pendant que la personne remplit le reste du formulaire. */
  private photo: Promise<File | null> | null = null;

  constructor() {
    void this.check();
  }

  private async check(): Promise<void> {
    try {
      this.link.set(await this.registration.check(this.token));
    } catch (error) {
      const problem = readProblem(error);
      this.problem.set(
        this.token
          ? problem
          : { ...problem, message: 'Ce lien est incomplet. Ouvrez le lien reçu par courriel.' },
      );
    } finally {
      this.loading.set(false);
    }
  }

  protected expiry(iso: string): string {
    return new Intl.DateTimeFormat('fr-FR', {
      timeZone: 'Africa/Dakar',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(iso));
  }

  protected photoChosen(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    this.fieldErrors.update(({ photo: _removed, ...rest }) => rest);
    if (!file) {
      this.photo = null;
      return;
    }
    this.preparingPhoto.set(true);
    const photo = this.photos.prepare(file).then(
      (reduced) => reduced,
      () => {
        input.value = '';
        this.fieldErrors.update((errors) => ({ ...errors, photo: PHOTO_TOO_LARGE }));
        return null;
      },
    );
    this.photo = photo;
    void photo.then(() => {
      if (this.photo === photo) this.preparingPhoto.set(false);
    });
  }

  protected async submit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    let photo = data.get('photo') as File;
    if (this.photo) {
      this.busy.set(true);
      const reduced = await this.photo;
      if (!reduced) {
        // Une photo trop lourde a déjà son message sous le champ.
        this.busy.set(false);
        return;
      }
      photo = reduced;
    }
    const body = new FormData();
    body.set('token', this.token);
    body.set('address', String(data.get('address') ?? '').trim());
    body.set('phone', String(data.get('phone') ?? '').trim());
    body.set('photo', photo);
    body.set('password', String(data.get('password') ?? ''));
    body.set('password_confirm', String(data.get('passwordConfirm') ?? ''));
    body.set('accept_rules', data.get('rules') === 'on' ? 'true' : 'false');

    this.error.set('');
    this.fieldErrors.set({});
    this.busy.set(true);
    try {
      const result = await this.registration.complete(body);
      this.auth.signedIn(result.user);
      await this.router.navigateByUrl('/membre');
    } catch (error) {
      const problem = readProblem(error);
      if (
        problem.code === 'link_used' ||
        problem.code === 'link_expired' ||
        problem.code === 'invalid_link'
      ) {
        this.link.set(null);
        this.problem.set(problem);
      } else {
        this.error.set(problem.message);
        this.fieldErrors.set(problem.fields);
      }
    } finally {
      this.busy.set(false);
    }
  }
}
