import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { MemberCard } from '../shared/member-card';
import { readProblem } from '../core/api-problem';
import { MemberProfile, ProfileService, cardData, formatDate } from '../core/profile.service';
import { MemberActivity, ProgramsService } from '../core/programs.service';
import { drawMemberCard } from '../shared/member-card-image';
import { UiIcon } from '../shared/ui-icon';
import { MemberActivityPage, MemberPrograms } from './member-programs';

@Component({
  selector: 'app-member-page',
  imports: [RouterLink, UiIcon, MemberCard, DatePipe, MemberPrograms, MemberActivityPage],
  template: `
    <main class="workspace-shell">
      <aside class="side-nav">
        <a class="side-logo" routerLink="/"
          ><img src="logo-tabaxi-sidebar.png" alt="Mouvement TABAXI"
        /></a>
        <p class="side-label">Espace membre</p>
        <nav aria-label="Espace membre">
          <a routerLink="/membre" [class.active]="view === 'home'"
            ><ui-icon name="home" />Mon espace</a
          >
          <a routerLink="/membre/programmes" [class.active]="view === 'programs'"
            ><ui-icon name="calendar" />Programmes & activités</a
          >
          <a routerLink="/membre/carte" [class.active]="view === 'card'"
            ><ui-icon name="card" />Ma carte numérique</a
          >
          <a routerLink="/membre/profil" [class.active]="view === 'profile'"
            ><ui-icon name="users" />Mon profil</a
          >
        </nav>
        <div class="side-profile">
          <div class="side-user">
            <span>{{ auth.initials() }}</span>
            <p>
              <strong>{{ auth.displayName() }}</strong
              ><small>{{ auth.user()?.territory?.name ?? auth.user()?.role_label }}</small>
            </p>
          </div>
          <a routerLink="/membre/securite" [class.active]="view === 'security'"
            ><ui-icon name="key" />Sécurité du compte</a
          >
          @if (auth.user()?.is_bureau) {
            <a routerLink="/bureau"><ui-icon name="users" />Interface du bureau</a>
          }
          <button class="side-logout" type="button" (click)="logout()">
            <ui-icon name="logout" />Se déconnecter
          </button>
        </div>
      </aside>

      <section class="workspace-area">
        <header class="workspace-topbar">
          <label class="top-search"
            ><ui-icon name="search" /><input
              aria-label="Rechercher un programme"
              placeholder="Rechercher un programme…"
              (keydown.enter)="searchPrograms($event)"
          /></label>
          <button class="icon-button" aria-label="Notifications">
            <ui-icon name="bell" /><i></i>
          </button>
          <button class="profile-chip" aria-label="Menu du profil">{{ auth.initials() }}</button
          ><span class="chevron" aria-hidden="true">⌄</span>
        </header>

        @if (view === 'home') {
          <div class="workspace-content member-home">
            <header class="page-heading">
              <div>
                <h1>Mon espace</h1>
                <p>Bienvenue dans votre espace membre du Mouvement TABAXI</p>
              </div>
            </header>
            <section class="welcome-banner">
              <img src="hero-tabaxi.jpg" alt="" />
              <div>
                <h2>Bienvenue, {{ auth.user()?.first_name }}</h2>
                <p>Ensemble pour une citoyenneté active<br />et un avenir meilleur.</p>
                @if (auth.user()?.territory; as territory) {
                  <strong><ui-icon name="location" /> {{ territory.name }}</strong>
                }
              </div>
              <em>Notre engagement<br />pour des communautés<br />plus fortes</em>
            </section>
            <section class="stat-grid member-stats" aria-label="Mes chiffres">
              <article>
                <span class="stat-icon"><ui-icon name="calendar" /></span>
                <div>
                  <strong>{{ homeStats().programs }}</strong>
                  <p>Programmes<small>en cours et à venir dans mon territoire</small></p>
                </div>
              </article>
              <article>
                <span class="stat-icon"><ui-icon name="leaf" /></span>
                <div>
                  <strong>{{ homeStats().activities }}</strong>
                  <p>Activités à venir<small>ouvertes aux inscriptions</small></p>
                </div>
              </article>
              <article>
                <span class="stat-icon"><ui-icon name="users" /></span>
                <div>
                  <strong>{{ homeStats().registered }}</strong>
                  <p>Mes inscriptions<small>à des activités à venir</small></p>
                </div>
              </article>
            </section>
            <section class="member-grid">
              <article class="panel member-card-panel">
                <h2>Votre carte de membre</h2>
                @if (card(); as data) {
                  <app-member-card
                    [name]="data.name"
                    [number]="data.number"
                    [locality]="data.locality"
                    [date]="data.date"
                    [photo]="data.photo"
                  /><a routerLink="/membre/carte">Voir ma carte numérique <span>→</span></a>
                } @else {
                  <p class="info-note" [class.inline-error]="profileError()" [attr.role]="profileError() ? 'alert' : null">
                    {{ profileError() || 'Chargement de votre dossier…' }}
                  </p>
                }
              </article>
              <article class="panel profile-panel">
                <div class="panel-title">
                  <h2>Mon profil</h2>
                  <a routerLink="/membre/profil"><ui-icon name="plus" />Modifier</a>
                </div>
                @if (profile(); as me) {
                  @if (me.photo_url) {
                    <img [src]="photoSrc()" [alt]="'Photo de ' + auth.displayName()" />
                  }
                  <h3>{{ auth.displayName() }}</h3>
                  <dl>
                    <dt>N° d’adhérent</dt>
                    <dd>{{ me.number }}</dd>
                    <dt>Localité</dt>
                    <dd>{{ me.territory?.name }}</dd>
                    <dt>Rôle</dt>
                    <dd>{{ me.role_label }}</dd>
                    <dt>Date d’adhésion</dt>
                    <dd>{{ joinedOn() }}</dd>
                  </dl>
                } @else {
                  <p class="info-note" [class.inline-error]="profileError()" [attr.role]="profileError() ? 'alert' : null">
                    {{ profileError() || 'Chargement de votre dossier…' }}
                  </p>
                }
              </article>
              <article class="panel coordinator-panel">
                <h2>Mon coordonnateur</h2>
                @if (profile(); as me) {
                  @if (me.coordinator; as coordinator) {
                    <h3>{{ coordinator.first_name }} {{ coordinator.last_name }}</h3>
                    <p>Coordonnateur · {{ coordinator.territory }}</p>
                    <ul>
                      <li><ui-icon name="mail" />{{ coordinator.email }}</li>
                      <li><ui-icon name="location" />{{ coordinator.territory }}</li>
                    </ul>
                    <a class="btn btn-green" [href]="'mailto:' + coordinator.email"
                      ><ui-icon name="mail" />Contacter</a
                    >
                  } @else {
                    <p class="info-note">Aucun coordonnateur n’est encore rattaché à votre territoire.</p>
                  }
                } @else {
                  <p class="info-note">Chargement…</p>
                }
              </article>
            </section>
            <section class="activity-grid member-upcoming">
              <article class="panel upcoming-panel">
                <div class="panel-title">
                  <h2>Mes prochaines activités</h2>
                  <a routerLink="/membre/programmes">Voir tout →</a>
                </div>
                <div class="mini-programs">
                  @for (activity of upcoming(); track activity.id) {
                    <div>
                      <ui-icon name="calendar" /><strong>{{ activity.title }}</strong>
                      <p>
                        <ui-icon name="calendar" />{{ activity.starts_at | date: 'd MMMM y à HH:mm' }}
                        <ui-icon name="location" />{{ activity.place }}
                      </p>
                      <span class="badge success">Inscrit(e)</span
                      ><a class="btn btn-green" [routerLink]="['/membre/activites', activity.id]">Voir les détails</a>
                    </div>
                  } @empty {
                    <p class="info-note">
                      @if (homeError()) {
                        {{ homeError() }}
                      } @else {
                        Vous n’êtes inscrit(e) à aucune activité à venir.
                        <a routerLink="/membre/programmes">Découvrir les programmes de mon territoire</a>
                      }
                    </p>
                  }
                </div>
              </article>
            </section>
          </div>
        }

        @if (view === 'programs') {
          <div class="workspace-content">
            <header class="page-heading">
              <div>
                <h1>Programmes & activités</h1>
                <p>Les programmes de votre territoire et leurs activités : inscrivez-vous à celles qui vous intéressent.</p>
              </div>
            </header>
            <app-member-programs />
          </div>
        }

        @if (view === 'card') {
          <div class="workspace-content card-view">
            <header class="page-heading">
              <div>
                <h1>Ma carte numérique</h1>
                <p>Votre carte de membre officielle du Mouvement TABAXI</p>
              </div>
            </header>
            @if (card(); as data) {
              <app-member-card
                [large]="true"
                [name]="data.name"
                [number]="data.number"
                [locality]="data.locality"
                [date]="data.date"
                [photo]="data.photo"
              />
            } @else {
              <p class="info-note" [class.inline-error]="profileError()" [attr.role]="profileError() ? 'alert' : null">
                    {{ profileError() || 'Chargement de votre dossier…' }}
                  </p>
            }
            <div class="card-actions">
              <button class="btn btn-green" type="button" [disabled]="!card()" (click)="downloadCard()">
                <ui-icon name="download" />Télécharger en image</button
              ><button class="btn btn-outline" type="button" [disabled]="!card()" (click)="printCard()">
                <ui-icon name="card" />Enregistrer en PDF
              </button>
            </div>
            @if (cardError()) {
              <p class="inline-error" role="alert">{{ cardError() }}</p>
            }
            <p class="info-note">
              Cette carte est personnelle et confidentielle. Elle atteste de votre adhésion au
              Mouvement TABAXI.
            </p>
          </div>
        }

        @if (view === 'profile') {
          <div class="workspace-content narrow-workspace">
            <header class="page-heading">
              <div>
                <p class="eyebrow">Informations personnelles</p>
                <h1>Mon profil</h1>
                <p>Mettez à jour vos coordonnées et votre photo.</p>
              </div>
            </header>
            @if (profile(); as me) {
              <form class="workspace-form panel" (submit)="saveProfile($event)">
                <section class="profile-identity">
                  @if (me.photo_url) {
                    <img [src]="photoSrc()" [alt]="'Photo de ' + auth.displayName()" />
                  }
                  <div>
                    <h2>Photo de profil</h2>
                    <p>JPG ou PNG, 5 Mo maximum.</p>
                    <input
                      type="file"
                      name="photo"
                      accept="image/jpeg,image/png"
                      aria-label="Choisir une photo"
                      (change)="photoChosen($event)"
                    />
                    @if (fieldErrors()['photo']; as message) {
                      <small class="field-error" role="alert">{{ message }}</small>
                    }
                  </div>
                </section>
                <div class="field-grid">
                  <label
                    >Prénom <input [value]="me.first_name" disabled /><small
                      >Modifiable uniquement par le bureau.</small
                    ></label
                  >
                  <label
                    >Nom <input [value]="me.last_name" disabled /><small
                      >Modifiable uniquement par le bureau.</small
                    ></label
                  >
                </div>
                <label
                  >Adresse courriel <input type="email" [value]="me.email" disabled /><small
                    >Modifiable uniquement par le bureau.</small
                  ></label
                >
                <label
                  >Adresse complète
                  <input name="address" [value]="me.address" required maxlength="255" />
                  @if (fieldErrors()['address']; as message) {
                    <small class="field-error" role="alert">{{ message }}</small>
                  }
                </label>
                <div class="field-grid">
                  <label
                    >Téléphone <input type="tel" name="phone" [value]="me.phone" maxlength="30" />
                    @if (fieldErrors()['phone']; as message) {
                      <small class="field-error" role="alert">{{ message }}</small>
                    }
                  </label>
                  <label
                    >Territoire <input [value]="me.territory?.name ?? ''" disabled /><small
                      >Rattaché par le bureau.</small
                    ></label
                  >
                </div>
                <div class="form-actions">
                  <a class="btn btn-outline" routerLink="/membre">Annuler</a>
                  <button class="btn btn-green" type="submit" [disabled]="saving()">
                    Enregistrer les modifications
                  </button>
                </div>
                @if (profileSaved()) {
                  <p class="inline-success" role="status">✓ Vos informations ont été enregistrées.</p>
                }
                @if (formError()) {
                  <p class="inline-error" role="alert">{{ formError() }}</p>
                }
              </form>
            } @else {
              <p class="info-note" [class.inline-error]="profileError()" [attr.role]="profileError() ? 'alert' : null">
                {{ profileError() || 'Chargement de votre dossier…' }}
              </p>
            }
          </div>
        }

        @if (view === 'activity') {
          <div class="workspace-content activity-detail-view">
            <app-member-activity />
          </div>
        }

        @if (view === 'security') {
          <div class="workspace-content narrow-workspace">
            <header class="page-heading">
              <div>
                <p class="eyebrow">Compte</p>
                <h1>Sécurité du compte</h1>
                <p>Gérez votre mot de passe et vos connexions actives.</p>
              </div>
            </header>
            <section class="settings-stack">
              <form class="workspace-form panel" (submit)="savePassword($event)">
                <h2>Changer mon mot de passe</h2>
                <p>Utilisez au moins 10 caractères, avec une lettre et un chiffre.</p>
                <label
                  >Mot de passe actuel
                  <input
                    type="password"
                    name="current_password"
                    autocomplete="current-password"
                    required
                  />
                  @if (fieldErrors()['current_password']; as message) {
                    <small class="field-error" role="alert">{{ message }}</small>
                  }
                </label>
                <div class="field-grid">
                  <label
                    >Nouveau mot de passe
                    <input
                      type="password"
                      name="new_password"
                      autocomplete="new-password"
                      required
                      minlength="10"
                    />
                    @if (fieldErrors()['new_password']; as message) {
                      <small class="field-error" role="alert">{{ message }}</small>
                    }
                  </label>
                  <label
                    >Confirmer le mot de passe
                    <input
                      type="password"
                      name="new_password_confirm"
                      autocomplete="new-password"
                      required
                      minlength="10"
                    />
                    @if (fieldErrors()['new_password_confirm']; as message) {
                      <small class="field-error" role="alert">{{ message }}</small>
                    }
                  </label>
                </div>
                <div class="form-actions">
                  <button class="btn btn-green" type="submit" [disabled]="saving()">
                    Mettre à jour
                  </button>
                </div>
                @if (passwordSaved()) {
                  <p class="inline-success" role="status">✓ Mot de passe mis à jour.</p>
                }
                @if (formError()) {
                  <p class="inline-error" role="alert">{{ formError() }}</p>
                }
              </form>
              <article class="panel session-panel">
                <div>
                  <h2>Session active</h2>
                  <p><strong>Windows · Codex</strong><small>Dakar · maintenant</small></p>
                </div>
                <span class="badge success">Cette session</span>
              </article>
            </section>
          </div>
        }
      </section>
    </main>
  `,
})
export class MemberPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);
  protected readonly view = this.route.snapshot.data['view'] as
    'home' | 'programs' | 'card' | 'profile' | 'activity' | 'security';
  private readonly profiles = inject(ProfileService);
  private readonly programs = inject(ProgramsService);
  protected readonly homeActivities = signal<MemberActivity[]>([]);
  protected readonly homeProgramCount = signal(0);
  protected readonly homeError = signal('');
  protected readonly profileSaved = signal(false);
  protected readonly passwordSaved = signal(false);
  protected readonly cardError = signal('');
  protected readonly profile = signal<MemberProfile | null>(null);
  protected readonly profileError = signal('');
  protected readonly fieldErrors = signal<Record<string, string>>({});
  protected readonly formError = signal('');
  protected readonly saving = signal(false);
  /** Change à chaque nouvelle photo, pour que le navigateur recharge l'image. */
  private readonly photoVersion = signal(0);
  private newPhoto: File | null = null;

  protected readonly card = computed(() => {
    const me = this.profile();
    return me ? cardData({ ...me, photo_url: me.photo_url && this.photoUrl(me) }) : null;
  });
  protected readonly joinedOn = computed(() => {
    const me = this.profile();
    return me ? formatDate(me.joined_on) : '';
  });

  /** Activités à venir auxquelles la personne est inscrite, les plus proches d'abord. */
  protected readonly upcoming = computed(() =>
    this.homeActivities()
      .filter((activity) => activity.registered && new Date(activity.starts_at) > new Date())
      .slice(0, 2),
  );
  protected readonly homeStats = computed(() => {
    const future = this.homeActivities().filter((activity) => new Date(activity.starts_at) > new Date());
    return {
      programs: this.homeProgramCount(),
      activities: future.filter((activity) => activity.registration_open).length,
      registered: future.filter((activity) => activity.registered).length,
    };
  });

  constructor() {
    if (this.view === 'home' || this.view === 'card' || this.view === 'profile') void this.loadProfile();
    if (this.view === 'home') void this.loadHome();
  }

  /** Programmes de mon territoire : de quoi compter les activités à venir et mes inscriptions. */
  private async loadHome(): Promise<void> {
    try {
      const page = await this.programs.memberPrograms();
      this.homeProgramCount.set(page.count);
      this.homeActivities.set(
        page.results
          .flatMap((program) => program.activities)
          .sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
      );
    } catch (error) {
      const problem = readProblem(error);
      this.homeError.set(Object.values(problem.fields)[0] ?? problem.message);
    }
  }

  /** La recherche du haut de l'écran ouvre la page des programmes avec ce texte. */
  protected searchPrograms(event: Event): void {
    const value = (event.target as HTMLInputElement).value.trim();
    void this.router.navigate(['/membre/programmes'], { queryParams: value ? { q: value } : {} });
  }

  private photoUrl(me: MemberProfile): string {
    return `${me.photo_url}?v=${this.photoVersion()}`;
  }

  protected photoSrc(): string {
    const me = this.profile();
    return me?.photo_url ? this.photoUrl(me) : '';
  }

  private async loadProfile(): Promise<void> {
    try {
      this.profile.set(await this.profiles.load());
    } catch (error) {
      const problem = readProblem(error);
      this.profileError.set(
        problem.status === 404
          ? 'Aucun dossier de membre n’est rattaché à ce compte.'
          : problem.message,
      );
    }
  }

  protected async downloadCard(): Promise<void> {
    this.cardError.set('');
    const data = this.card();
    if (!data) return;
    try {
      const blob = await drawMemberCard(data);
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `carte-TABAXI-${data.number}.png`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch {
      this.cardError.set('La carte n’a pas pu être téléchargée. Réessayez dans un instant.');
    }
  }

  protected photoChosen(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    this.fieldErrors.update(({ photo: _removed, ...rest }) => rest);
    if (file && file.size > 5 * 1024 * 1024) {
      this.newPhoto = null;
      this.fieldErrors.update((errors) => ({
        ...errors,
        photo: 'La photo dépasse 5 Mo. Choisissez une image plus légère.',
      }));
      return;
    }
    this.newPhoto = file;
  }

  protected async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigateByUrl('/connexion');
  }

  /** La boîte d'impression du navigateur propose « Enregistrer au format PDF ». */
  protected printCard(): void {
    window.print();
  }

  protected async saveProfile(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    if (!form.reportValidity() || this.fieldErrors()['photo']) return;
    const data = new FormData();
    data.set('address', (form.elements.namedItem('address') as HTMLInputElement).value.trim());
    data.set('phone', (form.elements.namedItem('phone') as HTMLInputElement).value.trim());
    if (this.newPhoto) data.set('photo', this.newPhoto);
    this.begin();
    try {
      this.profile.set(await this.profiles.save(data));
      this.newPhoto = null;
      this.photoVersion.update((v) => v + 1);
      this.profileSaved.set(true);
    } catch (error) {
      this.fail(error);
    } finally {
      this.saving.set(false);
    }
  }

  protected async savePassword(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    if (!form.reportValidity()) return;
    const value = (name: string) => (form.elements.namedItem(name) as HTMLInputElement).value;
    this.begin();
    try {
      await this.profiles.changePassword({
        current_password: value('current_password'),
        new_password: value('new_password'),
        new_password_confirm: value('new_password_confirm'),
      });
      form.reset();
      this.passwordSaved.set(true);
    } catch (error) {
      this.fail(error);
    } finally {
      this.saving.set(false);
    }
  }

  private begin(): void {
    this.saving.set(true);
    this.profileSaved.set(false);
    this.passwordSaved.set(false);
    this.formError.set('');
    this.fieldErrors.update((errors): Record<string, string> => {
      const photo = errors['photo'];
      return photo ? { photo } : {};
    });
  }

  private fail(error: unknown): void {
    const problem = readProblem(error);
    this.fieldErrors.update((errors) => ({ ...errors, ...problem.fields }));
    this.formError.set(problem.message);
  }
}
