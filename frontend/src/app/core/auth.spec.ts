import {
  HttpClient,
  HttpErrorResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { readProblem } from './api-problem';
import { authGuard, bureauGuard, founderGuard, guestGuard } from './auth.guards';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';
import { TEST_COORDINATOR, TEST_FOUNDER, TEST_MEMBER, UNAUTHORIZED } from './testing';

describe('Session', () => {
  let auth: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('AuthService', () => {
    it('ne demande l’utilisateur connecté qu’une seule fois', async () => {
      const first = auth.ensureLoaded();
      const second = auth.ensureLoaded();
      http.expectOne('/api/auth/me/').flush(TEST_MEMBER);
      expect(await first).toEqual(TEST_MEMBER);
      expect(await second).toEqual(TEST_MEMBER);
      expect(await auth.ensureLoaded()).toEqual(TEST_MEMBER);
      expect(auth.displayName()).toBe('Awa Ndiaye');
      expect(auth.initials()).toBe('AN');
    });

    it('sans session, personne n’est connecté', async () => {
      const pending = auth.ensureLoaded();
      http.expectOne('/api/auth/me/').flush({ detail: 'Non connecté.' }, UNAUTHORIZED);
      expect(await pending).toBeNull();
      expect(auth.user()).toBeNull();
    });

    it('connexion : envoie courriel, mot de passe et « rester connecté »', async () => {
      const pending = auth.login('fondateur@example.org', 'mot-de-passe-long', true);
      const request = http.expectOne('/api/auth/login/');
      expect(request.request.method).toBe('POST');
      expect(request.request.body).toEqual({
        email: 'fondateur@example.org',
        password: 'mot-de-passe-long',
        remember: true,
      });
      request.flush(TEST_FOUNDER);
      expect(await pending).toEqual(TEST_FOUNDER);
      expect(auth.isFounder()).toBe(true);
    });

    it('ouvre l’interface selon le rôle', () => {
      expect(auth.homeFor(TEST_MEMBER)).toBe('/membre');
      expect(auth.homeFor(TEST_COORDINATOR)).toBe('/bureau');
      expect(auth.homeFor(TEST_FOUNDER)).toBe('/bureau');
    });

    it('déconnexion', async () => {
      auth.signedIn(TEST_MEMBER);
      const pending = auth.logout();
      http.expectOne('/api/auth/logout/').flush(null, { status: 204, statusText: 'No Content' });
      await pending;
      expect(auth.user()).toBeNull();
    });
  });

  describe('Gardes de route', () => {
    async function run(guard: typeof authGuard, url: string, user: unknown) {
      const result = TestBed.runInInjectionContext(() =>
        guard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot),
      ) as Promise<boolean | UrlTree>;
      const me = http.expectOne('/api/auth/me/');
      if (user) me.flush(user);
      else me.flush({ detail: 'Non connecté.' }, UNAUTHORIZED);
      const outcome = await result;
      return outcome instanceof UrlTree ? TestBed.inject(Router).serializeUrl(outcome) : outcome;
    }

    it('une personne non connectée va à la connexion, avec la page demandée', async () => {
      expect(await run(bureauGuard, '/bureau/membres', null)).toBe(
        '/connexion?suivant=%2Fbureau%2Fmembres',
      );
    });

    it('un membre simple ne peut pas ouvrir l’interface du bureau', async () => {
      expect(await run(bureauGuard, '/bureau', TEST_MEMBER)).toBe('/membre');
    });

    it('un coordonnateur ouvre le bureau', async () => {
      expect(await run(bureauGuard, '/bureau', TEST_COORDINATOR)).toBe(true);
    });

    it('un coordonnateur n’ouvre pas l’examen des demandes', async () => {
      expect(await run(founderGuard, '/bureau/demandes', TEST_COORDINATOR)).toBe('/bureau');
    });

    it('un fondateur ouvre l’examen des demandes', async () => {
      expect(await run(founderGuard, '/bureau/demandes', TEST_FOUNDER)).toBe(true);
    });

    it('l’espace membre demande seulement une connexion', async () => {
      expect(await run(authGuard, '/membre', TEST_COORDINATOR)).toBe(true);
    });

    it('une personne connectée qui ouvre la connexion va dans son espace', async () => {
      expect(await run(guestGuard, '/connexion', TEST_FOUNDER)).toBe('/bureau');
    });
  });

  describe('Session fermée par le serveur', () => {
    it('renvoie vers la connexion en expliquant l’inactivité', async () => {
      const router = TestBed.inject(Router);
      const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
      auth.signedIn(TEST_FOUNDER);
      const request = firstValueFrom(TestBed.inject(HttpClient).get('/api/applications/'));
      http
        .expectOne('/api/applications/')
        .flush({ detail: 'Session fermée.', code: 'session_expired' }, UNAUTHORIZED);
      await expect(request).rejects.toBeInstanceOf(HttpErrorResponse);
      expect(auth.user()).toBeNull();
      expect(navigate).toHaveBeenCalledWith(['/connexion'], {
        queryParams: { suivant: '/', motif: 'inactivite' },
      });
    });

    it('laisse la connexion gérer elle-même un refus', async () => {
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');
      const pending = auth.login('a@example.org', 'mauvais', false).catch(() => null);
      http
        .expectOne('/api/auth/login/')
        .flush({ detail: 'Courriel ou mot de passe incorrect.' }, UNAUTHORIZED);
      await pending;
      expect(navigate).not.toHaveBeenCalled();
    });
  });
});

describe('readProblem', () => {
  const error = (status: number, body: unknown) =>
    new HttpErrorResponse({ status, error: body, url: '/api/x/' });

  it('reprend le message et le code du serveur', () => {
    expect(
      readProblem(
        error(400, { detail: 'Courriel ou mot de passe incorrect.', code: 'invalid_credentials' }),
      ),
    ).toEqual({
      message: 'Courriel ou mot de passe incorrect.',
      code: 'invalid_credentials',
      fields: {},
      status: 400,
    });
  });

  it('garde le premier message de chaque champ', () => {
    const problem = readProblem(
      error(400, { email: ['Ce champ est obligatoire.'], motivation: ['Trop long.', 'Autre'] }),
    );
    expect(problem.message).toBe('Certains champs sont à corriger.');
    expect(problem.fields).toEqual({
      email: 'Ce champ est obligatoire.',
      motivation: 'Trop long.',
    });
  });

  it('explique une coupure réseau', () => {
    expect(readProblem(error(0, null)).message).toContain('Le serveur ne répond pas');
  });

  it('explique une panne du serveur', () => {
    expect(readProblem(error(500, '<html>')).message).toContain(
      'Le serveur a rencontré un problème',
    );
  });
});
