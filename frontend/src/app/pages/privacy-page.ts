import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PublicHeader } from '../shared/public-header';

@Component({
  selector: 'app-privacy-page',
  imports: [PublicHeader, RouterLink],
  template: `
    <main class="public-canvas policy-canvas">
      <section class="public-frame policy-frame">
        <app-public-header />
        <article class="policy-layout">
          <aside>
            <p class="overline"><span></span>Vos données</p>
            <h1>Une confiance qui se mérite.</h1>
            <p>
              Cette page résume clairement les informations conservées par TABAXI et vos droits.
            </p>
            <a class="btn btn-outline" routerLink="/adherer">Retour à l’adhésion</a>
          </aside>
          <div class="policy-copy">
            <p class="eyebrow">Politique de confidentialité</p>
            <h2>Ce que nous collectons</h2>
            <p>
              Nom, prénom, courriel, adresse, territoire, photo de profil et informations liées à
              votre adhésion. Nous ne demandons ni pièce d’identité ni carte d’électeur.
            </p>
            <h2>Pourquoi</h2>
            <p>
              Pour examiner votre demande, gérer votre compte, produire votre carte de membre et
              vous présenter les activités de votre territoire.
            </p>
            <h2>Qui peut y accéder</h2>
            <p>
              Les fondateurs et les coordonnateurs habilités, dans la limite de leur territoire. Les
              exports et décisions importantes sont inscrits dans le journal d’actions.
            </p>
            <h2>Vos droits</h2>
            <p>
              Vous pouvez demander l’accès, la correction ou la suppression de vos données en
              écrivant à donnees&#64;tabaxi.org.
            </p>
            <div class="policy-note">
              Avant l’ouverture publique, le mouvement réalisera les formalités requises auprès de
              la Commission de protection des données personnelles du Sénégal.
            </div>
          </div>
        </article>
      </section>
    </main>
  `,
})
export class PrivacyPage {}
