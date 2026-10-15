import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PublicHeader } from '../shared/public-header';
import { UiIcon } from '../shared/ui-icon';

@Component({
  selector: 'app-public-page',
  imports: [PublicHeader, RouterLink, UiIcon],
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

          <div class="commitment-note">
            Notre engagement<br />pour des communautés<br />plus fortes <i></i>
          </div>

          <div class="role-row">
            <a class="role-card role-founder" routerLink="/bureau">
              <ui-icon name="users" />
              <strong>Membre fondateur</strong>
              <span>Contribuez dès aujourd’hui à bâtir le mouvement.</span>
              <b aria-hidden="true">→</b>
            </a>
            <a class="role-card role-member" routerLink="/membre">
              <ui-icon name="users" />
              <strong>Membre simple</strong>
              <span>Rejoignez une communauté citoyenne active.</span>
              <b aria-hidden="true">→</b>
            </a>
            <a class="role-card role-join" routerLink="/adherer">
              <ui-icon name="plus" />
              <strong>Je souhaite<br />devenir membre</strong>
              <span>Commencez votre demande d’adhésion en quelques minutes.</span>
              <b aria-hidden="true">→</b>
            </a>
          </div>

          <aside class="member-strip" aria-label="Exemples de membres du mouvement">
            <h2>Découvrez des membres du mouvement</h2>
            <div class="member-faces">
              @for (person of members; track person.name) {
                <div>
                  <img [src]="person.image" alt="" />
                  <strong>{{ person.name }}</strong>
                  <span>{{ person.city }}</span>
                </div>
              }
            </div>
          </aside>
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
          <a class="btn btn-green" routerLink="/membre/programmes"
            >Découvrir les programmes <span>→</span></a
          >
        </div>
      </section>

      <section class="public-story" id="apropos">
        <div class="story-number" aria-hidden="true">01</div>
        <div class="story-copy">
          <p class="overline"><span></span>Pourquoi TABAXI</p>
          <h2>Les décisions prennent racine dans les territoires.</h2>
          <p>
            Le mouvement relie les citoyens, les coordonnateurs et le bureau exécutif sans effacer
            les réalités locales. Chaque territoire garde une voix claire, des responsables
            identifiés et un suivi concret.
          </p>
        </div>
        <dl>
          <div>
            <dt>12</dt>
            <dd>localités déjà structurées</dd>
          </div>
          <div>
            <dt>1 248</dt>
            <dd>membres engagés</dd>
          </div>
          <div>
            <dt>86</dt>
            <dd>coordonnateurs de terrain</dd>
          </div>
        </dl>
      </section>

      <section class="public-programs" id="programmes">
        <header>
          <div>
            <p class="overline"><span></span>Programmes</p>
            <h2>Des actions proches, des résultats visibles.</h2>
          </div>
          <p>
            Chaque programme répond à un besoin exprimé localement et rassemble les membres autour
            d’activités simples à suivre.
          </p>
        </header>
        <div class="editorial-programs">
          @for (program of programs; track program.name) {
            <article>
              <span class="program-index">0{{ $index + 1 }}</span>
              <ui-icon [name]="program.icon" />
              <h3>{{ program.name }}</h3>
              <p>{{ program.description }}</p>
              <small>{{ program.territory }}</small>
            </article>
          }
        </div>
      </section>

      <section class="public-news" id="actualites">
        <div class="news-intro">
          <p class="overline"><span></span>Actualités</p>
          <h2>Le mouvement, sur le terrain.</h2>
          <a routerLink="/adherer">Rejoindre le mouvement →</a>
        </div>
        <div class="news-feature">
          <span>Vie du mouvement</span>
          <h3>Saint-Louis accueille sa première rencontre citoyenne régionale.</h3>
          <p>
            Des membres venus de six communes ont partagé leurs priorités pour l’éducation, la
            salubrité et l’engagement des jeunes.
          </p>
          <time>10 octobre 2026</time>
        </div>
        <div class="news-briefs">
          <article>
            <time>02 OCT.</time>
            <h3>120 arbres plantés à Ziguinchor</h3>
            <p>Une action menée avec les associations de quartier.</p>
          </article>
          <article>
            <time>24 SEPT.</time>
            <h3>Nouvel atelier d’éducation civique</h3>
            <p>Trois écoles de Thiès ont participé à la première session.</p>
          </article>
        </div>
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
export class PublicPage {
  protected readonly members = [
    { name: 'Aminata', city: 'Dakar', image: 'member-aminata.jpg' },
    { name: 'Mamadou', city: 'Thiès', image: 'coordinator-mamadou.jpg' },
    { name: 'Fatou', city: 'Ziguinchor', image: 'member-aminata.jpg' },
    { name: 'Ibrahim', city: 'Tambacounda', image: 'coordinator-mamadou.jpg' },
    { name: 'Marième', city: 'Kolda', image: 'member-aminata.jpg' },
    { name: 'Cheikh', city: 'Louga', image: 'coordinator-mamadou.jpg' },
  ];
  protected readonly programs = [
    {
      name: 'Brigades citoyennes',
      description: 'Des journées collectives pour prendre soin des espaces communs.',
      territory: 'Dakar · Ziguinchor',
      icon: 'leaf',
    },
    {
      name: 'Éducation civique',
      description: 'Des ateliers clairs pour mieux comprendre ses droits et responsabilités.',
      territory: 'Thiès · Saint-Louis',
      icon: 'book',
    },
    {
      name: 'Autonomie des femmes',
      description: 'Des formations pratiques et un accompagnement vers l’activité.',
      territory: 'Kaolack · Kolda',
      icon: 'chart',
    },
  ];
}
