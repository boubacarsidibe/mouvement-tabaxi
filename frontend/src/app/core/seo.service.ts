import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { ActivatedRouteSnapshot, NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

/** Adresse publique du site, reprise dans les liens canoniques, le plan du site et robots.txt. */
export const SITE_URL = 'https://mouvement-tabaxi-app.vercel.app';

const DESCRIPTION_PAR_DEFAUT =
  'Mouvement TABAXI, mouvement citoyen au Sénégal : rejoignez les initiatives citoyennes ' +
  'de votre territoire, région et commune.';

/** Réglages de référencement d'une page, donnés dans `data.seo` de sa route. */
export interface SeoData {
  description?: string;
  /** Seules les pages publiques sont proposées aux moteurs de recherche. */
  index?: boolean;
}

/**
 * Met à jour, à chaque changement de page, la description, l'indexation (robots),
 * le lien canonique et les balises de partage (Open Graph).
 * Les espaces membre et bureau, et les pages à lien personnel, restent hors des moteurs.
 */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly router = inject(Router);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);

  start(): void {
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => this.apply(this.router.routerState.snapshot.root));
  }

  apply(root: ActivatedRouteSnapshot): void {
    let route = root;
    while (route.firstChild) route = route.firstChild;

    const seo: SeoData = route.data['seo'] ?? {};
    const path = this.router.url.split(/[?#]/)[0];
    const url = SITE_URL + (path === '/' ? '/' : path);
    const description = seo.description ?? DESCRIPTION_PAR_DEFAUT;
    const title = route.title ?? this.document.title;

    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({
      name: 'robots',
      content: seo.index ? 'index, follow' : 'noindex, nofollow',
    });
    this.meta.updateTag({ property: 'og:title', content: title });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:url', content: url });
    this.meta.updateTag({ name: 'twitter:title', content: title });
    this.meta.updateTag({ name: 'twitter:description', content: description });

    let canonical = this.document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = this.document.createElement('link');
      canonical.rel = 'canonical';
      this.document.head.appendChild(canonical);
    }
    canonical.href = url;
  }
}
