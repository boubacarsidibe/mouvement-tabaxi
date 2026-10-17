import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { MemberCard } from '../shared/member-card';
import { readProblem } from '../core/api-problem';
import { PHOTO_TOO_LARGE, PhotoService } from '../core/photo.service';
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
      <aside class="side-nav" [class.menu-open]="menuOpen()" (click)="closeMenuOnLink($event)">
        <a class="side-logo" routerLink="/"
          ><img src="logo-tabaxi-sidebar.png" alt="Mouvement TABAXI"
        /></a>
        <button
          class="menu-toggle"
          type="button"
          [attr.aria-expanded]="menuOpen()"
          (click)="menuOpen.set(!menuOpen()); $event.stopPropagation()"
        >
          {{ menuOpen() ? 'Fermer' : 'Menu' }}
        </button>
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

        @if (view === 'home') {
          <div class="workspace-content member-home">
            <header class="page-heading">
              <h1>Mon espace</h1>
            </header>
            <section class="dashboard-summary member-stats" aria-label="Mes chiffres">
              <div>
                <strong>{{ homeStats().programs }}</strong>
                <span>Programmes</span>
                <small>en cours et à venir dans mon territoire</small>
              </div>
              <div>
                <strong>{{ homeStats().activities }}</strong>
                <span>Activités à venir</span>
                <small>ouvertes aux inscriptions</small>
              </div>
              <div>
                <strong>{{ homeStats().registered }}</strong>
                <span>Mes inscriptions</span>
                <small>à des activités à venir</small>
              </div>
            </section>
            <section class="member-grid" [class.no-coordinator]="auth.user()?.is_bureau">
              <article class="panel member-card-panel">
                <h2>Votre carte de membre</h2>
                @if (card(); as data) {
                  <app-member-card
                    [name]="data.name"
                    [number]="data.number"
                    [locality]="data.locality"
                    [date]="data.date"
                    [photo]="data.photo"
                    [role]="data.role ?? ''"
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
                    <dd>{{ me.locality || me.territory?.name }}</dd>
                    <dt>Courriel</dt>
                    <dd>{{ me.email }}</dd>
                    @if (me.phone) {
                      <dt>Téléphone</dt>
                      <dd>{{ me.phone }}</dd>
                    }
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
              <!-- Coordonnateurs et fondateurs n'ont pas de coordonnateur au-dessus d'eux. -->
              @if (!auth.user()?.is_bureau) {
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
              }
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
              <h1>Programmes & activités</h1>
            </header>
            <app-member-programs />
          </div>
        }

        @if (view === 'card') {
          <div class="workspace-content card-view">
            <header class="page-heading">
              <h1>Ma carte numérique</h1>
            </header>
            @if (card(); as data) {
              <app-member-card
                [large]="true"
                [name]="data.name"
                [number]="data.number"
                [locality]="data.locality"
                [date]="data.date"
                [photo]="data.photo"
                [role]="data.role ?? ''"
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
                <ui-icon name="card" />Imprimer la carte
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
              <h1>Mon profil</h1>
            </header>
            @if (profile(); as me) {
              <form class="workspace-form panel" (submit)="saveProfile($event)">
                <section class="profile-identity">
                  @if (me.photo_url) {
                    <img [src]="photoSrc()" [alt]="'Photo de ' + auth.displayName()" />
                  }
                  <div>
                    <h2>Photo de profil</h2>
                    <p>JPG ou PNG. Les photos lourdes sont réduites avant l’envoi.</p>
                    <input
                      type="file"
                      name="photo"
                      accept="image/jpeg,image/png"
                      aria-label="Choisir une photo"
                      (change)="photoChosen($event)"
                    />
                    @if (preparingPhoto()) {
                      <small role="status">Préparation de la photo…</small>
                    }
                    @if (fieldErrors()['photo']; as message) {
                      <small class="field-error" role="alert">{{ message }}</small>
                    }
                  </div>
                </section>
                <div class="field-grid">
                  @if (me.first_name) {
                    <label
                      >Prénom <input [value]="me.first_name" disabled /><small
                        >Modifiable uniquement par le bureau.</small
                      ></label
                    >
                  } @else {
                    <label
                      >Prénom <input name="first_name" required maxlength="150" autocomplete="given-name" /><small
                        >À renseigner une fois ; ensuite, seul le bureau peut le changer.</small
                      >
                      @if (fieldErrors()['first_name']; as message) {
                        <small class="field-error" role="alert">{{ message }}</small>
                      }
                    </label>
                  }
                  @if (me.last_name) {
                    <label
                      >Nom <input [value]="me.last_name" disabled /><small
                        >Modifiable uniquement par le bureau.</small
                      ></label
                    >
                  } @else {
                    <label
                      >Nom <input name="last_name" required maxlength="150" autocomplete="family-name" /><small
                        >À renseigner une fois ; ensuite, seul le bureau peut le changer.</small
                      >
                      @if (fieldErrors()['last_name']; as message) {
                        <small class="field-error" role="alert">{{ message }}</small>
                      }
                    </label>
                  }
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
                    >Territoire <input [value]="me.locality || me.territory?.name || ''" disabled /><small
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
              <h1>Sécurité du compte</h1>
            </header>
            <section class="settings-stack">
              <form class="workspace-form panel" (submit)="savePassword($event)">
                <h2>Changer mon mot de passe</h2>
                <p>Utilisez au moins 10 caractères, pas uniquement des chiffres, et évitez votre nom ou votre courriel.</p>
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
  /** Téléphone et tablette : liste des pages ouverte ou fermée. */
  protected readonly menuOpen = signal(false);

  /** Un lien du menu a été choisi : on referme la liste. */
  protected closeMenuOnLink(event: Event): void {
    if ((event.target as HTMLElement).closest('a')) this.menuOpen.set(false);
  }
  protected readonly view = this.route.snapshot.data['view'] as
    'home' | 'programs' | 'card' | 'profile' | 'activity' | 'security';
  private readonly profiles = inject(ProfileService);
  private readonly photos = inject(PhotoService);
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
  /** Nouvelle photo choisie, réduite avant l'envoi ; null si elle est trop lourde. */
  private newPhoto: Promise<File | null> | null = null;
  protected readonly preparingPhoto = signal(false);

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
    if (!file) {
      this.newPhoto = null;
      return;
    }
    this.preparingPhoto.set(true);
    const photo = this.photos.prepare(file).then(
      (reduced) => reduced,
      () => {
        this.fieldErrors.update((errors) => ({ ...errors, photo: PHOTO_TOO_LARGE }));
        return null;
      },
    );
    this.newPhoto = photo;
    void photo.then(() => {
      if (this.newPhoto === photo) this.preparingPhoto.set(false);
    });
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
    // Prénom et nom ne sont proposés que s'ils manquent encore.
    for (const name of ['first_name', 'last_name']) {
      const input = form.elements.namedItem(name) as HTMLInputElement | null;
      if (input) data.set(name, input.value.trim());
    }
    this.begin();
    if (this.newPhoto) {
      const photo = await this.newPhoto;
      if (!photo) {
        // Une photo trop lourde a déjà son message sous le champ.
        this.saving.set(false);
        return;
      }
      data.set('photo', photo);
    }
    try {
      const saved = await this.profiles.save(data);
      this.profile.set(saved);
      const user = this.auth.user();
      if (user && (user.first_name !== saved.first_name || user.last_name !== saved.last_name)) {
        this.auth.signedIn({ ...user, first_name: saved.first_name, last_name: saved.last_name });
      }
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
