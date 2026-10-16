import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { ApiService, RegistrationPreview, flattenTerritories } from '../core/api.service';
import { UiIcon } from '../shared/ui-icon';

@Component({
  selector: 'app-join-page',
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
              <a class="back-link" [routerLink]="isFinalize ? '/connexion' : '/'">
                {{ isFinalize ? 'Besoin d’aide ?' : '← Retour à l’accueil' }}
              </a>
            </header>

            @if (checkingLink()) {
              <div class="submit-success enrollment-success" role="status">
                <span>…</span>
                <h1>Vérification de votre lien</h1>
                <p>Un instant, nous préparons votre inscription.</p>
              </div>
            } @else if (isFinalize && linkError()) {
              <div class="submit-success enrollment-success" role="alert">
                <span>!</span>
                <h1>Ce lien ne peut plus être utilisé</h1>
                <p>{{ linkError() }}</p>
                <a class="btn btn-green" routerLink="/connexion">Aller à la connexion</a>
              </div>
            } @else if (submitted()) {
              <div class="submit-success enrollment-success" role="status">
                <span>✓</span>
                <p class="eyebrow">{{ isFinalize ? 'Adhésion finalisée' : 'Demande envoyée' }}</p>
                <h1>{{ isFinalize ? 'Bienvenue chez TABAXI.' : 'Merci pour votre confiance.' }}</h1>
                <p>
                  @if (isFinalize) {
                    Votre numéro de membre est <strong>{{ resultReference() }}</strong
                    >. Vous pouvez maintenant vous connecter.
                  } @else {
                    Votre référence est <strong>{{ resultReference() }}</strong
                    >. Le bureau vous répondra par courriel.
                  }
                </p>
                <a class="btn btn-green" [routerLink]="isFinalize ? '/connexion' : '/'">
                  {{ isFinalize ? 'Se connecter' : 'Retour à l’accueil' }}
                </a>
              </div>
            } @else {
              <header class="enrollment-intro" [class.finalize-intro]="isFinalize">
                <p class="eyebrow">
                  {{ isFinalize ? 'Finalisation de l’adhésion' : 'Demande d’adhésion' }}
                </p>
                <h1>
                  {{ isFinalize ? finalizeTitle() : 'Rejoindre le Mouvement TABAXI' }}
                </h1>
                @if (isFinalize) {
                  <p class="acceptance-note">
                    <span aria-hidden="true">✓</span>Votre demande a été acceptée.
                  </p>
                }
                <p>
                  {{
                    isFinalize
                      ? 'Créez votre accès membre pour terminer votre inscription.'
                      : 'Quelques informations suffisent pour transmettre votre demande au bureau exécutif.'
                  }}
                </p>
              </header>

              <form class="enrollment-form" (submit)="submit($event)" novalidate>
                @if (errorMessage()) {
                  <p class="form-error" role="alert">{{ errorMessage() }}</p>
                }

                @if (isFinalize) {
                  @if (preview(); as person) {
                    <section class="confirmed-details" aria-labelledby="confirmed-title">
                      <h2 id="confirmed-title">Vos informations confirmées</h2>
                      <dl class="enrollment-summary">
                        <div>
                          <ui-icon name="users" />
                          <span
                            ><dt>Nom complet</dt>
                            <dd>{{ person.first_name }} {{ person.last_name }}</dd></span
                          >
                        </div>
                        <div>
                          <ui-icon name="mail" />
                          <span
                            ><dt>Adresse courriel</dt>
                            <dd>{{ person.email }}</dd></span
                          >
                        </div>
                        <div>
                          <ui-icon name="location" />
                          <span
                            ><dt>Localité</dt>
                            <dd>{{ person.territory.path }}</dd></span
                          >
                        </div>
                      </dl>
                    </section>
                  }

                  <label>
                    Adresse complète <em>*</em>
                    <input
                      name="address"
                      placeholder="Ex. : Rue 12, quartier, ville"
                      autocomplete="street-address"
                      required
                    />
                    @if (fieldError('address')) {
                      <small class="field-error">{{ fieldError('address') }}</small>
                    }
                  </label>
                  <label class="photo-field">
                    Photo de profil <em>*</em>
                    <span class="enrollment-upload">
                      <span class="upload-icon"><ui-icon name="plus" /></span>
                      <span
                        ><strong>Cliquez pour ajouter une photo</strong
                        ><small>JPG, PNG ou WebP · 5 Mo maximum</small></span
                      >
                      <input
                        type="file"
                        name="photo"
                        accept="image/jpeg,image/png,image/webp"
                        required
                      />
                    </span>
                    @if (fieldError('photo')) {
                      <small class="field-error">{{ fieldError('photo') }}</small>
                    }
                  </label>
                  <label>
                    Mot de passe <em>*</em>
                    <span class="password-field">
                      <input
                        [type]="showPassword() ? 'text' : 'password'"
                        name="password"
                        placeholder="Choisissez un mot de passe"
                        autocomplete="new-password"
                        minlength="10"
                        required
                      />
                      <button
                        type="button"
                        class="password-toggle"
                        (click)="showPassword.set(!showPassword())"
                      >
                        {{ showPassword() ? 'Masquer' : 'Afficher' }}
                      </button>
                    </span>
                    <small>10 caractères minimum.</small>
                    @if (fieldError('password')) {
                      <small class="field-error">{{ fieldError('password') }}</small>
                    }
                  </label>
                  <label>
                    Confirmer le mot de passe <em>*</em>
                    <span class="password-field">
                      <input
                        [type]="showPasswordConfirm() ? 'text' : 'password'"
                        name="password_confirm"
                        placeholder="Répétez le mot de passe"
                        autocomplete="new-password"
                        minlength="10"
                        required
                      />
                      <button
                        type="button"
                        class="password-toggle"
                        (click)="showPasswordConfirm.set(!showPasswordConfirm())"
                      >
                        {{ showPasswordConfirm() ? 'Masquer' : 'Afficher' }}
                      </button>
                    </span>
                    @if (fieldError('password_confirm')) {
                      <small class="field-error">{{ fieldError('password_confirm') }}</small>
                    }
                  </label>
                  <label class="enrollment-consent">
                    <input type="checkbox" name="terms" required />
                    <span
                      >J’accepte la
                      <a routerLink="/confidentialite">politique de confidentialité</a>.</span
                    >
                  </label>
                } @else {
                  <div class="field-grid">
                    <label>
                      Prénom <em>*</em>
                      <input name="first_name" placeholder="Votre prénom" required />
                      @if (fieldError('first_name')) {
                        <small class="field-error">{{ fieldError('first_name') }}</small>
                      }
                    </label>
                    <label>
                      Nom <em>*</em>
                      <input name="last_name" placeholder="Votre nom" required />
                      @if (fieldError('last_name')) {
                        <small class="field-error">{{ fieldError('last_name') }}</small>
                      }
                    </label>
                  </div>
                  <label>
                    Adresse courriel <em>*</em>
                    <input
                      type="email"
                      name="email"
                      placeholder="exemple@adresse.fr"
                      autocomplete="email"
                      required
                    />
                    @if (fieldError('email')) {
                      <small class="field-error">{{ fieldError('email') }}</small>
                    }
                  </label>
                  <label>
                    Localité souhaitée <em>*</em>
                    <select name="territory" required [disabled]="territoriesLoading()">
                      <option value="">
                        {{
                          territoriesLoading()
                            ? 'Chargement des localités…'
                            : 'Sélectionner une localité'
                        }}
                      </option>
                      @for (territory of territories(); track territory.id) {
                        <option [value]="territory.id">{{ territory.label }}</option>
                      }
                    </select>
                    @if (fieldError('territory')) {
                      <small class="field-error">{{ fieldError('territory') }}</small>
                    }
                  </label>
                  <label>
                    Profession <em>*</em>
                    <input
                      name="profession"
                      placeholder="Votre profession"
                      autocomplete="organization-title"
                      required
                    />
                    @if (fieldError('profession')) {
                      <small class="field-error">{{ fieldError('profession') }}</small>
                    }
                  </label>
                  <label>
                    Pourquoi souhaitez-vous rejoindre TABAXI ? <em>*</em>
                    <textarea
                      name="motivation"
                      rows="4"
                      placeholder="Partagez votre motivation…"
                      required
                    ></textarea>
                    @if (fieldError('motivation')) {
                      <small class="field-error">{{ fieldError('motivation') }}</small>
                    }
                  </label>
                  <label class="enrollment-consent">
                    <input type="checkbox" name="consent" required />
                    <span
                      >J’accepte que mes informations soient utilisées pour traiter ma demande
                      d’adhésion, conformément à la
                      <a routerLink="/confidentialite">politique de confidentialité</a>.</span
                    >
                  </label>
                  @if (fieldError('consent')) {
                    <small class="field-error">{{ fieldError('consent') }}</small>
                  }
                }

                <footer class="enrollment-form-footer">
                  <button
                    class="btn btn-green btn-wide"
                    type="submit"
                    [disabled]="submitting() || territoriesLoading()"
                  >
                    {{
                      submitting()
                        ? 'Envoi en cours…'
                        : isFinalize
                          ? 'Finaliser mon adhésion'
                          : 'Envoyer ma demande'
                    }}
                  </button>
                  <p>
                    <ui-icon name="key" />
                    <span>{{
                      isFinalize
                        ? 'Ce lien personnel ne peut être utilisé qu’une seule fois.'
                        : 'Vos informations restent confidentielles.'
                    }}</span>
                  </p>
                </footer>
              </form>
            }
          </section>
        </div>
      </section>
    </main>
  `,
})
export class JoinPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(ApiService);

  protected readonly isFinalize = this.route.snapshot.data['mode'] === 'finalize';
  protected readonly submitted = signal(false);
  protected readonly submitting = signal(false);
  protected readonly checkingLink = signal(false);
  protected readonly territoriesLoading = signal(false);
  protected readonly territories = signal<Array<{ id: number; label: string }>>([]);
  protected readonly preview = signal<RegistrationPreview | null>(null);
  protected readonly errorMessage = signal('');
  protected readonly linkError = signal('');
  protected readonly fieldErrors = signal<Record<string, string>>({});
  protected readonly resultReference = signal('');
  protected readonly showPassword = signal(false);
  protected readonly showPasswordConfirm = signal(false);
  private token = '';

  protected finalizeTitle(): string {
    const person = this.preview();
    return person ? `Bienvenue chez TABAXI, ${person.first_name}.` : 'Bienvenue chez TABAXI.';
  }

  ngOnInit(): void {
    if (this.isFinalize) {
      this.token = this.route.snapshot.queryParamMap.get('jeton')?.trim() ?? '';
      if (!this.token) {
        this.linkError.set('Le lien est incomplet. Ouvrez directement le lien reçu par courriel.');
        return;
      }
      this.checkingLink.set(true);
      this.api.registrationPreview(this.token).subscribe({
        next: (preview) => {
          this.preview.set(preview);
          this.checkingLink.set(false);
        },
        error: (error: HttpErrorResponse) => {
          this.linkError.set(this.messageFrom(error));
          this.checkingLink.set(false);
        },
      });
      return;
    }

    this.territoriesLoading.set(true);
    this.api.territories().subscribe({
      next: (tree) => {
        this.territories.set(flattenTerritories(tree));
        this.territoriesLoading.set(false);
      },
      error: () => {
        this.errorMessage.set(
          'Les localités ne sont pas disponibles pour le moment. Réessayez dans quelques instants.',
        );
        this.territoriesLoading.set(false);
      },
    });
  }

  protected fieldError(name: string): string {
    return this.fieldErrors()[name] ?? '';
  }

  protected submit(event: SubmitEvent): void {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    if (!form.reportValidity() || this.submitting()) return;

    this.submitting.set(true);
    this.errorMessage.set('');
    this.fieldErrors.set({});
    const data = new FormData(form);

    if (this.isFinalize) {
      data.set('token', this.token);
      this.api.finalizeRegistration(data).subscribe({
        next: (result) => {
          this.resultReference.set(result.membership_number);
          this.submitted.set(true);
          this.submitting.set(false);
        },
        error: (error: HttpErrorResponse) => this.handleError(error),
      });
      return;
    }

    this.api
      .submitApplication({
        first_name: String(data.get('first_name') ?? ''),
        last_name: String(data.get('last_name') ?? ''),
        email: String(data.get('email') ?? ''),
        territory: Number(data.get('territory')),
        profession: String(data.get('profession') ?? ''),
        motivation: String(data.get('motivation') ?? ''),
        consent: data.get('consent') === 'on',
      })
      .subscribe({
        next: (result) => {
          this.resultReference.set(result.reference);
          this.submitted.set(true);
          this.submitting.set(false);
        },
        error: (error: HttpErrorResponse) => this.handleError(error),
      });
  }

  private handleError(error: HttpErrorResponse): void {
    const body = error.error;
    if (body && typeof body === 'object') {
      const fields: Record<string, string> = {};
      for (const [key, value] of Object.entries(body)) {
        if (key === 'detail' || key === 'code') continue;
        fields[key] = Array.isArray(value) ? String(value[0]) : String(value);
      }
      this.fieldErrors.set(fields);
    }
    this.errorMessage.set(this.messageFrom(error));
    this.submitting.set(false);
  }

  private messageFrom(error: HttpErrorResponse): string {
    const detail = error.error?.detail;
    if (typeof detail === 'string') return detail;
    if (error.status === 0)
      return 'Le service est momentanément inaccessible. Vérifiez votre connexion puis réessayez.';
    return 'Certaines informations sont à corriger avant de continuer.';
  }
}
