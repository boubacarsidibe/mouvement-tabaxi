import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { readProblem } from '../core/api-problem';
import { InvitationService } from '../core/invitation.service';
import { TerritoryNode, TerritoryService, regionsOf } from '../core/territories.service';
import { UiIcon } from '../shared/ui-icon';

/** Formulaire d'invitation d'un coordonnateur (ou d'un fondateur), réservé aux fondateurs. */
@Component({
  selector: 'app-invite-form',
  imports: [RouterLink, UiIcon],
  template: `
    <a class="back-link" routerLink="/bureau/comptes">← Retour</a>
    <form class="workspace-form panel admin-form" (submit)="submit($event)">
      <p class="eyebrow">Compte d’accès</p>
      <h2>Inviter un coordonnateur</h2>
      <p>La personne recevra un lien personnel, valable 7 jours, pour créer son mot de passe.</p>
      @if (error()) {
        <p class="form-alert" role="alert">{{ error() }}</p>
      }
      <div class="field-grid">
        <label
          >Prénom <input name="first_name" required />
          @if (fieldErrors()['first_name']; as message) {
            <span class="field-error" role="alert">{{ message }}</span>
          }
        </label>
        <label
          >Nom <input name="last_name" required />
          @if (fieldErrors()['last_name']; as message) {
            <span class="field-error" role="alert">{{ message }}</span>
          }
        </label>
      </div>
      <label
        >Adresse courriel <input type="email" name="email" required />
        @if (fieldErrors()['email']; as message) {
          <span class="field-error" role="alert">{{ message }}</span>
        }
      </label>
      <div class="field-grid">
        <label
          >Fonction
          <select name="role" required>
            <option value="coordonnateur">Coordonnateur</option>
            <option value="fondateur">Membre fondateur</option>
          </select>
        </label>
        <label
          >Territoire (obligatoire pour un coordonnateur)
          <select name="territory">
            <option value="">Aucun territoire</option>
            @for (region of regions(); track region.id) {
              <optgroup [label]="region.name">
                <option [value]="region.id">{{ region.name }}</option>
                @for (commune of region.children; track commune.id) {
                  <option [value]="commune.id">{{ commune.name }}</option>
                }
              </optgroup>
            }
          </select>
          @if (fieldErrors()['territory']; as message) {
            <span class="field-error" role="alert">{{ message }}</span>
          }
        </label>
      </div>
      <div class="security-alert compact">
        <ui-icon name="key" />
        <p><strong>Accès contrôlé</strong>Seul un fondateur peut envoyer cette invitation.</p>
      </div>
      <div class="form-actions">
        <a class="btn btn-outline" routerLink="/bureau/comptes">Annuler</a>
        <button class="btn btn-green" type="submit" [disabled]="busy()">
          {{ busy() ? 'Envoi…' : 'Envoyer l’invitation' }}
        </button>
      </div>
      @if (sentTo()) {
        <p class="inline-success" role="status">✓ Invitation envoyée à {{ sentTo() }}.</p>
      }
    </form>
  `,
})
export class InviteForm implements OnInit {
  private readonly invitations = inject(InvitationService);
  private readonly territories = inject(TerritoryService);
  protected readonly regions = signal<TerritoryNode[]>([]);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly fieldErrors = signal<Record<string, string>>({});
  protected readonly sentTo = signal('');

  async ngOnInit(): Promise<void> {
    try {
      this.regions.set(regionsOf(await this.territories.tree()));
    } catch (error) {
      this.error.set(readProblem(error).message);
    }
  }

  protected async submit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const territory = String(data.get('territory') ?? '');
    this.error.set('');
    this.fieldErrors.set({});
    this.sentTo.set('');
    this.busy.set(true);
    try {
      const invited = await this.invitations.send({
        email: String(data.get('email') ?? '').trim(),
        first_name: String(data.get('first_name') ?? '').trim(),
        last_name: String(data.get('last_name') ?? '').trim(),
        role: String(data.get('role')) === 'fondateur' ? 'fondateur' : 'coordonnateur',
        territory: territory ? Number(territory) : null,
      });
      this.sentTo.set(invited.email);
      form.reset();
    } catch (error) {
      const problem = readProblem(error);
      this.error.set(problem.message);
      this.fieldErrors.set(problem.fields);
    } finally {
      this.busy.set(false);
    }
  }
}
