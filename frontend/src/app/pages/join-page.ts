import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { readProblem } from '../core/api-problem';
import { ApplicationService } from '../core/applications.service';
import { TerritoryNode, TerritoryService, regionsOf } from '../core/territories.service';
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
              <a class="back-link" routerLink="/">← Retour à l’accueil</a>
            </header>
            @if (submitted()) {
              <div class="submit-success enrollment-success" role="status">
                <span>✓</span>
                <p class="eyebrow">Adhésion finalisée</p>
                <h1>Bienvenue chez TABAXI.</h1>
                <p>Votre espace membre et votre carte numérique sont maintenant prêts.</p>
                <a class="btn btn-green" routerLink="/membre">Ouvrir mon espace</a>
              </div>
            } @else {
              <form class="enrollment-form" (submit)="submit($event)">
                <header class="enrollment-form-header">
                  <span><ui-icon [name]="isFinalize ? 'key' : 'users'" /></span>
                  <div>
                    <p class="eyebrow">
                      {{ isFinalize ? 'Profil membre' : 'Demande d’adhésion' }}
                    </p>
                    <h1>
                      {{
                        isFinalize ? 'Finalisez vos informations' : 'Présentez-vous au mouvement'
                      }}
                    </h1>
                    <p>
                      {{
                        isFinalize
                          ? 'Les champs marqués d’un astérisque sont nécessaires pour créer votre compte.'
                          : 'Comptez environ trois minutes. Tous les champs sont obligatoires.'
                      }}
                    </p>
                  </div>
                </header>

                @if (error()) {
                  <p class="form-alert" role="alert">{{ error() }}</p>
                }

                <div class="field-grid">
                  <label
                    >Prénom <em>*</em
                    ><input
                      name="firstName"
                      autocomplete="given-name"
                      [value]="isFinalize ? 'Aminata' : ''"
                      placeholder="Votre prénom"
                      required
                      [attr.aria-invalid]="fieldErrors()['first_name'] ? 'true' : null"
                    />
                    @if (fieldErrors()['first_name']; as message) {
                      <span class="field-error" role="alert">{{ message }}</span>
                    }
                  </label>
                  <label
                    >Nom <em>*</em
                    ><input
                      name="lastName"
                      autocomplete="family-name"
                      [value]="isFinalize ? 'Ndiaye' : ''"
                      placeholder="Votre nom"
                      required
                      [attr.aria-invalid]="fieldErrors()['last_name'] ? 'true' : null"
                    />
                    @if (fieldErrors()['last_name']; as message) {
                      <span class="field-error" role="alert">{{ message }}</span>
                    }
                  </label>
                </div>

                @if (isFinalize) {
                  <label
                    >Adresse complète <em>*</em
                    ><input name="address" placeholder="Numéro, rue, quartier, ville" required
                  /></label>
                  <div class="field-grid">
                    <label
                      >Localité <em>*</em
                      ><select name="territory" required>
                        <option value="">Sélectionnez une localité</option>
                        <option>Dakar</option>
                        <option>Thiès</option>
                        <option>Saint-Louis</option>
                        <option>Ziguinchor</option>
                      </select></label
                    >
                    <label
                      >Téléphone <em>*</em
                      ><input type="tel" name="phone" placeholder="+221 77 000 00 00" required
                    /></label>
                  </div>
                  <label
                    >Photo de profil <em>*</em
                    ><span class="enrollment-upload"
                      ><img src="member-aminata.jpg" alt="Aperçu de la photo" /><span
                        ><strong>Choisir une photo</strong
                        ><small>JPG ou PNG · 5 Mo maximum</small></span
                      ><ui-icon name="plus" /></span
                  ></label>
                  <div class="field-grid">
                    <label
                      >Créer un mot de passe <em>*</em
                      ><input
                        type="password"
                        name="password"
                        placeholder="10 caractères minimum"
                        minlength="10"
                        required
                    /></label>
                    <label
                      >Confirmer le mot de passe <em>*</em
                      ><input
                        type="password"
                        name="passwordConfirm"
                        placeholder="Répétez le mot de passe"
                        minlength="10"
                        required
                    /></label>
                  </div>
                  <label class="enrollment-consent"
                    ><input type="checkbox" required /><span
                      >J’accepte les <u>statuts</u> et le <u>règlement intérieur</u> du Mouvement
                      TABAXI.</span
                    ></label
                  >
                } @else {
                  <label
                    >Adresse courriel <em>*</em
                    ><input
                      type="email"
                      name="email"
                      autocomplete="email"
                      placeholder="prenom.nom@exemple.com"
                      required
                      [attr.aria-invalid]="fieldErrors()['email'] ? 'true' : null"
                    />
                    @if (fieldErrors()['email']; as message) {
                      <span class="field-error" role="alert">{{ message }}</span>
                    }
                  </label>
                  <div class="field-grid">
                    <label
                      >Localité souhaitée <em>*</em
                      ><select
                        name="territory"
                        required
                        [disabled]="regions().length === 0"
                        [attr.aria-invalid]="fieldErrors()['territory'] ? 'true' : null"
                      >
                        <option value="">
                          {{
                            territoryError()
                              ? 'Liste indisponible'
                              : regions().length
                                ? 'Sélectionnez une localité'
                                : 'Chargement…'
                          }}
                        </option>
                        @for (region of regions(); track region.id) {
                          <optgroup [label]="region.name">
                            @for (commune of region.children; track commune.id) {
                              <option [value]="commune.id">{{ commune.name }}</option>
                            }
                          </optgroup>
                        }
                      </select>
                      @if (territoryError(); as message) {
                        <span class="field-error" role="alert"
                          >{{ message }}
                          <button type="button" class="link-button" (click)="loadTerritories()">
                            Réessayer
                          </button></span
                        >
                      } @else if (fieldErrors()['territory']; as message) {
                        <span class="field-error" role="alert">{{ message }}</span>
                      }
                    </label>
                    <label
                      >Profession <em>*</em
                      ><input
                        name="profession"
                        maxlength="120"
                        placeholder="Votre activité principale"
                        required
                        [attr.aria-invalid]="fieldErrors()['profession'] ? 'true' : null"
                      />
                      @if (fieldErrors()['profession']; as message) {
                        <span class="field-error" role="alert">{{ message }}</span>
                      }
                    </label>
                  </div>
                  <label
                    >Pourquoi souhaitez-vous rejoindre TABAXI ? <em>*</em
                    ><textarea
                      name="motivation"
                      rows="4"
                      maxlength="2000"
                      placeholder="En quelques phrases, dites-nous ce que vous souhaitez apporter…"
                      required
                      [attr.aria-invalid]="fieldErrors()['motivation'] ? 'true' : null"
                    ></textarea>
                    @if (fieldErrors()['motivation']; as message) {
                      <span class="field-error" role="alert">{{ message }}</span>
                    }
                  </label>
                  <label class="enrollment-consent"
                    ><input type="checkbox" name="consent" required /><span
                      >J’accepte que mes informations soient utilisées pour examiner ma demande,
                      conformément à la
                      <a routerLink="/confidentialite">politique de confidentialité</a>.</span
                    >
                    @if (fieldErrors()['consent']; as message) {
                      <span class="field-error" role="alert">{{ message }}</span>
                    }
                  </label>
                }

                <footer class="enrollment-form-footer">
                  <p>
                    <ui-icon name="key" /><span
                      ><strong>Données protégées</strong>Accès limité aux responsables
                      habilités.</span
                    >
                  </p>
                  <button class="btn btn-green" type="submit" [disabled]="busy()">
                    {{
                      isFinalize
                        ? 'Finaliser mon adhésion'
                        : busy()
                          ? 'Envoi en cours…'
                          : 'Envoyer ma demande'
                    }}
                    <span>→</span>
                  </button>
                </footer>
              </form>
            }
          </section>
        </div>
      </section>
    </main>
  `,
})
export class JoinPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly territoryService = inject(TerritoryService);
  private readonly applications = inject(ApplicationService);
  protected readonly isFinalize = this.route.snapshot.data['mode'] === 'finalize';
  protected readonly submitted = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly fieldErrors = signal<Record<string, string>>({});
  protected readonly regions = signal<TerritoryNode[]>([]);
  protected readonly territoryError = signal('');

  constructor() {
    if (!this.isFinalize) void this.loadTerritories();
  }

  /** Localités de la liste publique : régions, chacune avec ses communes. */
  protected async loadTerritories(): Promise<void> {
    this.territoryError.set('');
    try {
      this.regions.set(regionsOf(await this.territoryService.tree()));
    } catch {
      this.territoryError.set('La liste des localités n’a pas pu être chargée.');
    }
  }

  protected async submit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    if (!form.reportValidity()) return;
    if (this.isFinalize) {
      this.submitted.set(true);
      return;
    }

    const data = new FormData(form);
    const text = (name: string) => String(data.get(name) ?? '').trim();
    this.error.set('');
    this.fieldErrors.set({});
    this.busy.set(true);
    try {
      const sent = await this.applications.submit({
        first_name: text('firstName'),
        last_name: text('lastName'),
        email: text('email'),
        territory: Number(data.get('territory')),
        profession: text('profession'),
        motivation: text('motivation'),
        consent: data.get('consent') === 'on',
      });
      await this.router.navigate(['/adherer/confirmation'], {
        state: { reference: sent.reference, createdAt: sent.created_at },
      });
    } catch (error) {
      const problem = readProblem(error);
      this.error.set(problem.message);
      this.fieldErrors.set(problem.fields);
    } finally {
      this.busy.set(false);
    }
  }
}
