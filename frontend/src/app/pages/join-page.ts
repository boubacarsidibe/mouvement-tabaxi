import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PublicHeader } from '../shared/public-header';
import { UiIcon } from '../shared/ui-icon';

@Component({
  selector: 'app-join-page',
  imports: [PublicHeader, RouterLink, UiIcon],
  template: `
    <main class="public-canvas join-canvas">
      <section class="public-frame join-frame">
        <app-public-header />

        <div class="join-layout">
          <aside class="join-story">
            <p class="overline light">
              <span></span
              >{{ isFinalize ? 'Finalisation de votre adhésion' : 'Demande d’adhésion' }}
            </p>
            <h1>
              {{
                isFinalize
                  ? 'Bienvenue bientôt chez TABAXI, Aminata.'
                  : 'Faisons avancer les choses, ensemble.'
              }}
            </h1>
            <p>
              {{
                isFinalize
                  ? 'Complétez les informations ci-dessous pour finaliser votre adhésion et accéder à votre espace membre.'
                  : 'Rejoignez le Mouvement TABAXI et contribuez à des actions concrètes pour des communautés plus fortes, plus solidaires et un avenir meilleur.'
              }}
            </p>

            @if (isFinalize) {
              <div class="secure-link">
                <ui-icon name="key" /><span
                  ><strong>Lien sécurisé</strong>Ce lien est personnel et valable pendant 7
                  jours.</span
                >
              </div>
            }

            <ul class="join-benefits">
              <li>
                <ui-icon [name]="isFinalize ? 'key' : 'users'" /><span
                  ><strong>{{
                    isFinalize ? 'Vos données sont protégées' : 'Des citoyens engagés'
                  }}</strong
                  >{{
                    isFinalize
                      ? 'Sécurisées et confidentielles.'
                      : 'Une communauté active dans toutes les localités.'
                  }}</span
                >
              </li>
              <li>
                <ui-icon [name]="isFinalize ? 'users' : 'leaf'" /><span
                  ><strong>{{
                    isFinalize ? 'Finalisez votre profil' : 'Des actions concrètes'
                  }}</strong
                  >{{
                    isFinalize
                      ? 'Accédez à tous les programmes et activités.'
                      : 'Éducation, santé, environnement et développement local.'
                  }}</span
                >
              </li>
              <li>
                <ui-icon [name]="isFinalize ? 'plus' : 'location'" /><span
                  ><strong>{{
                    isFinalize ? 'Rejoignez une communauté active' : 'Un impact durable'
                  }}</strong
                  >{{
                    isFinalize
                      ? 'Des citoyens engagés dans toutes les régions.'
                      : 'Des territoires plus forts pour les générations futures.'
                  }}</span
                >
              </li>
            </ul>
            <div class="join-line-art" aria-hidden="true"></div>
          </aside>

          <section class="join-form-panel">
            @if (isFinalize) {
              <div class="join-progress" aria-label="Étapes de l’adhésion">
                <span class="done"
                  ><b>✓</b><strong>Demande</strong><small>Votre demande est envoyée</small></span
                >
                <i></i>
                <span class="active"
                  ><b>2</b><strong>Validation</strong><small>Traitement en cours</small></span
                >
                <i></i>
                <span
                  ><b>3</b><strong>Adhésion</strong
                  ><small>Finalisation de votre profil</small></span
                >
              </div>
            }

            @if (submitted()) {
              <div class="submit-success" role="status">
                <span>✓</span>
                <h2>{{ isFinalize ? 'Votre profil est prêt.' : 'Votre demande est prête.' }}</h2>
                <p>Le parcours visuel est validé. Le raccordement à l’API activera l’envoi réel.</p>
                <a
                  class="btn btn-green"
                  [routerLink]="isFinalize ? '/membre' : '/adherer/confirmation'"
                  >{{ isFinalize ? 'Voir mon espace' : 'Suivre ma demande' }}</a
                >
              </div>
            } @else {
              <form class="join-form" (submit)="submit($event)">
                <div class="form-title">
                  <ui-icon name="users" /><span
                    ><h2>
                      {{ isFinalize ? 'Mes informations personnelles' : 'Demande d’adhésion' }}
                    </h2>
                    <p>
                      {{
                        isFinalize
                          ? 'Complétez votre profil membre.'
                          : 'Remplissez ce formulaire pour rejoindre le Mouvement TABAXI.'
                      }}
                    </p></span
                  >
                </div>
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
                    ><input name="address" placeholder="Numéro, rue, quartier, ville…" required
                  /></label>
                } @else {
                  <label
                    >Adresse courriel <em>*</em
                    ><input
                      type="email"
                      name="email"
                      placeholder="votre.email@exemple.com"
                      required
                  /></label>
                }
                <label
                  >Localité {{ isFinalize ? 'de coordination' : 'souhaitée' }} <em>*</em>
                  <select name="territory" required>
                    <option value="">Sélectionnez une localité</option>
                    <option>Dakar</option>
                    <option>Thiès</option>
                    <option>Saint-Louis</option>
                    <option>Ziguinchor</option>
                  </select>
                </label>
                @if (isFinalize) {
                  <label
                    >Photo de profil <em>*</em
                    ><span class="upload-field"
                      ><img src="member-aminata.jpg" alt="Aperçu de la photo" /><span
                        ><strong>Ajouter une photo</strong
                        ><small>Format JPG ou PNG. Taille max 5 Mo.</small></span
                      ></span
                    ></label
                  >
                  <label class="check-row"
                    ><input type="checkbox" required /><span
                      >J’accepte les <u>statuts</u> et le <u>règlement intérieur</u> du Mouvement
                      TABAXI.</span
                    ></label
                  >
                } @else {
                  <label
                    >Qu’est-ce qui vous motive à rejoindre TABAXI&nbsp;? <em>*</em
                    ><textarea
                      name="motivation"
                      rows="4"
                      placeholder="Partagez votre motivation…"
                      required
                    ></textarea>
                  </label>
                }
                <button class="btn btn-green btn-wide" type="submit">
                  <ui-icon [name]="isFinalize ? 'plus' : 'mail'" />{{
                    isFinalize ? 'Finaliser mon adhésion' : 'Envoyer ma demande'
                  }}
                </button>
                <div class="form-privacy">
                  <ui-icon name="key" /><span
                    >Vos informations sont confidentielles et sont utilisées uniquement dans le
                    cadre de votre adhésion.</span
                  >
                </div>
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
