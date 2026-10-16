import { registerLocaleData } from '@angular/common';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import localeFr from '@angular/common/locales/fr';
import { ApplicationConfig, LOCALE_ID, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { routes } from './app.routes';
import { authInterceptor } from './core/auth.interceptor';

// Dates et nombres en français (« samedi 24 octobre 2026 »).
registerLocaleData(localeFr);

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: LOCALE_ID, useValue: 'fr' },
    provideBrowserGlobalErrorListeners(),
    // Sans ce réglage, les liens du menu (#apropos, #actions…) changent l'adresse mais ne font pas défiler la page.
    provideRouter(
      routes,
      withInMemoryScrolling({ anchorScrolling: 'enabled', scrollPositionRestoration: 'enabled' }),
    ),
    // Le client HTTP renvoie seul le jeton anti-CSRF : cookie XSRF-TOKEN, en-tête X-XSRF-TOKEN,
    // les noms que le serveur Django attend.
    provideHttpClient(withInterceptors([authInterceptor])),
  ],
};
