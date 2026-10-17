import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PublicHeader } from '../shared/public-header';

@Component({
  selector: 'app-public-page',
  imports: [PublicHeader, RouterLink],
  template: `
    <main class="public-canvas">
      <section class="public-frame home-frame">
        <app-public-header />

        <div class="public-hero">
          <img
            class="public-hero-art"
            src="hero-tabaxi.jpg"
            alt="Citoyens réunis face à Dakar et aux territoires du Sénégal"
          />
          <div class="public-hero-copy">
            <p class="overline"><span></span>Mouvement citoyen</p>
            <h1>La voix de nos<br />territoires.</h1>
            <p class="public-lead">
              Le Mouvement TABAXI rassemble des citoyens engagés pour des communautés plus fortes,
              plus solidaires et un avenir meilleur dans tous nos territoires.
            </p>
          </div>
        </div>
      </section>

      <section class="public-actions" id="actions">
        <p class="overline"><span></span>Le mouvement en action</p>
        <div>
          <h2>Des initiatives suivies,<br />territoire par territoire.</h2>
          <p>
            Les membres découvrent les activités proches de chez eux. Les coordonnateurs organisent
            les programmes et gardent une trace claire de ce qui a été accompli.
          </p>
          <a class="btn btn-green" routerLink="/" fragment="programmes"
            >Découvrir les programmes <span>→</span></a
          >
        </div>
      </section>

      <section class="public-story" id="apropos">
        <div class="story-copy">
          <p class="overline"><span></span>Pourquoi TABAXI</p>
          <h2>Les décisions prennent racine dans les territoires.</h2>
          <p>
            Le mouvement relie les citoyens, les coordonnateurs et le bureau exécutif sans effacer
            les réalités locales. Chaque territoire garde une voix claire, des responsables
            identifiés et un suivi concret.
          </p>
        </div>
      </section>

      <section class="public-programs" id="programmes">
        <header>
          <div>
            <p class="overline"><span></span>Programmes</p>
            <h2>Des actions proches, des résultats visibles.</h2>
          </div>
          <p>
            Chaque programme répond à un besoin exprimé localement et rassemble les membres autour
            d’activités simples à suivre. Une fois membre, vous retrouvez dans votre espace les
            programmes de votre territoire et vous vous inscrivez à leurs activités.
          </p>
        </header>
      </section>

      <section class="public-join-cta">
        <div>
          <p class="overline light"><span></span>Prendre part</p>
          <h2>Une place existe pour votre énergie.</h2>
          <p>Déposez votre demande en quelques minutes. Le bureau vous répondra par courriel.</p>
        </div>
        <a class="btn btn-gold" routerLink="/adherer">Commencer ma demande</a>
      </section>

      <footer class="public-footer">
        <img src="logo-tabaxi-transparent.png" alt="Mouvement TABAXI" />
        <p>
          Mouvement citoyen pour des communautés plus fortes, plus solidaires et mieux organisées.
        </p>
        <nav>
          <a routerLink="/confidentialite">Confidentialité</a
          ><a href="mailto:contact@tabaxi.org">contact&#64;tabaxi.org</a
          ><a routerLink="/connexion">Se connecter</a>
        </nav>
        <small>© 2026 Mouvement TABAXI</small>
      </footer>
    </main>
  `,
})
export class PublicPage {}
