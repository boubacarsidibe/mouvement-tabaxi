import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
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
                <p class="eyebrow">{{ isFinalize ? 'Adhésion finalisée' : 'Demande envoyée' }}</p>
                <h1>{{ isFinalize ? 'Bienvenue chez TABAXI.' : 'Merci pour votre confiance.' }}</h1>
                <p>
                  {{
                    isFinalize
                      ? 'Votre espace membre et votre carte numérique sont maintenant prêts.'
                      : 'Votre référence est TAB-2026-00418. Le bureau vous répondra par courriel.'
                  }}
                </p>
                <a
                  class="btn btn-green"
                  [routerLink]="isFinalize ? '/membre' : '/adherer/confirmation'"
                  >{{ isFinalize ? 'Ouvrir mon espace' : 'Suivre ma demande' }}</a
                >
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

                <div class="field-grid">
                  <label
                    >Prénom <em>*</em
                    ><input
                      name="firstName"
                      [value]="isFinalize ? 'Aminata' : ''"
                      placeholder="Votre prénom"
                      required
                  /></label>
                  <label
                    >Nom <em>*</em
                    ><input
                      name="lastName"
                      [value]="isFinalize ? 'Ndiaye' : ''"
                      placeholder="Votre nom"
                      required
                  /></label>
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
                    ><input type="email" name="email" placeholder="prenom.nom@exemple.com" required
                  /></label>
                  <div class="field-grid">
                    <label
                      >Localité souhaitée <em>*</em
                      ><select name="territory" required>
                        <option value="">Sélectionnez une localité</option>
                        <option>Dakar</option>
                        <option>Thiès</option>
                        <option>Saint-Louis</option>
                        <option>Ziguinchor</option>
                      </select></label
                    >
                    <label
                      >Profession <em>*</em
                      ><input name="profession" placeholder="Votre activité principale" required
                    /></label>
                  </div>
                  <label
                    >Pourquoi souhaitez-vous rejoindre TABAXI ? <em>*</em
                    ><textarea
                      name="motivation"
                      rows="4"
                      placeholder="En quelques phrases, dites-nous ce que vous souhaitez apporter…"
                      required
                    ></textarea>
                  </label>
                  <label class="enrollment-consent"
                    ><input type="checkbox" required /><span
                      >J’accepte que mes informations soient utilisées pour examiner ma demande,
                      conformément à la
                      <a routerLink="/confidentialite">politique de confidentialité</a>.</span
                    ></label
                  >
                }

                <footer class="enrollment-form-footer">
                  <p>
                    <ui-icon name="key" /><span
                      ><strong>Données protégées</strong>Accès limité aux responsables
                      habilités.</span
                    >
                  </p>
                  <button class="btn btn-green" type="submit">
                    {{ isFinalize ? 'Finaliser mon adhésion' : 'Envoyer ma demande' }}
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
  protected readonly isFinalize = this.route.snapshot.data['mode'] === 'finalize';
  protected readonly submitted = signal(false);

  protected submit(event: SubmitEvent): void {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    if (form.reportValidity()) this.submitted.set(true);
  }
}
