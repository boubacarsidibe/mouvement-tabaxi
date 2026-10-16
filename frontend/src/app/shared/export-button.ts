import { Component, input, signal } from '@angular/core';
import { readProblem } from '../core/api-problem';
import { Download, saveFile } from '../core/download';
import { UiIcon } from './ui-icon';

/**
 * Bouton « Exporter en Excel » d'une liste. Il télécharge le fichier de la liste telle qu'elle
 * est affichée, puis rappelle que l'export est noté dans le journal des actions.
 */
@Component({
  selector: 'app-export-button',
  imports: [UiIcon],
  host: { class: 'export-control' },
  template: `
    <button class="export-button" type="button" [disabled]="busy()" (click)="start()">
      <ui-icon name="download" />{{ busy() ? 'Export en cours…' : 'Exporter en Excel' }}
    </button>
    @if (done(); as name) {
      <small class="export-done" role="status"
        >✓ « {{ name }} » téléchargé. Cet export est noté dans le journal des actions.</small
      >
    }
    @if (error()) {
      <small class="export-error" role="alert">{{ error() }}</small>
    }
  `,
})
export class ExportButton {
  /** Demande le fichier de la liste affichée au serveur. */
  readonly run = input.required<() => Promise<Download>>();
  protected readonly busy = signal(false);
  protected readonly done = signal('');
  protected readonly error = signal('');

  protected async start() {
    this.busy.set(true);
    this.done.set('');
    this.error.set('');
    try {
      const file = await this.run()();
      saveFile(file);
      this.done.set(file.filename);
    } catch (error) {
      const problem = readProblem(error);
      this.error.set(Object.values(problem.fields)[0] ?? problem.message);
    } finally {
      this.busy.set(false);
    }
  }
}
