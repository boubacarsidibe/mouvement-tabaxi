import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-workspace-topbar',
  template: `
    <header class="workspace-topbar compact-topbar">
      <p class="workspace-context"><span aria-hidden="true"></span>{{ context }}</p>
      <div class="workspace-identity" aria-label="Utilisateur connecté">
        <span>{{ initials }}</span>
        <p>
          <strong>{{ name }}</strong
          ><small>{{ role }}</small>
        </p>
      </div>
    </header>
  `,
})
export class WorkspaceTopbar {
  @Input() context = '';
  @Input() initials = '';
  @Input() name = '';
  @Input() role = '';
}
