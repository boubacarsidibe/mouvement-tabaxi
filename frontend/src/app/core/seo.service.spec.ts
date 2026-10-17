import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DOCUMENT } from '@angular/common';
import { provideRouter, Router } from '@angular/router';
import { routes } from '../app.routes';
import { SeoService, SITE_URL } from './seo.service';

@Component({ template: '' })
class Vide {}

describe('SeoService', () => {
  let router: Router;
  let document: Document;

  const meta = (selector: string) =>
    document.head.querySelector<HTMLMetaElement>(`meta[${selector}]`)?.content;
  const canonical = () =>
    document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: '',
            component: Vide,
            title: 'Accueil',
            data: { seo: { index: true, description: 'Page publique' } },
          },
          { path: 'membre', component: Vide, title: 'Mon espace' },
        ]),
      ],
    });
    router = TestBed.inject(Router);
    document = TestBed.inject(DOCUMENT);
    TestBed.inject(SeoService).start();
  });

  it('propose une page publique aux moteurs avec sa description et son lien canonique', async () => {
    await router.navigateByUrl('/?source=affiche#programmes');
    expect(meta('name="robots"')).toBe('index, follow');
    expect(meta('name="description"')).toBe('Page publique');
    expect(meta('property="og:title"')).toBe('Accueil');
    expect(meta('property="og:url"')).toBe(`${SITE_URL}/`);
    expect(canonical()).toBe(`${SITE_URL}/`);
  });

  it('garde hors des moteurs une page sans réglage de référencement', async () => {
    await router.navigateByUrl('/membre');
    expect(meta('name="robots"')).toBe('noindex, nofollow');
    expect(meta('name="description"')).toContain('Mouvement TABAXI');
    expect(canonical()).toBe(`${SITE_URL}/membre`);
  });
});

describe('Routes et référencement', () => {
  const indexables = routes
    .filter((route) => route.data?.['seo']?.index)
    .map((route) => route.path);

  it('seules les pages publiques sont indexables', () => {
    expect(indexables.sort()).toEqual(['', 'adherer', 'confidentialite']);
  });

  it('chaque page indexable a un titre avec « TABAXI » et une description', () => {
    for (const route of routes.filter((r) => r.data?.['seo']?.index)) {
      expect(String(route.title)).toContain('TABAXI');
      expect(route.data?.['seo'].description.length).toBeGreaterThan(50);
      expect(route.data?.['seo'].description.length).toBeLessThanOrEqual(160);
    }
  });
});
