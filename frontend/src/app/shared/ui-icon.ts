import { Component, Input } from '@angular/core';

@Component({
  selector: 'ui-icon',
  template: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      @switch (name) {
        @case ('home') {
          <path d="m3 11 9-7 9 7v9h-6v-6H9v6H3z" />
        }
        @case ('users') {
          <path
            d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"
          />
        }
        @case ('clipboard') {
          <rect x="5" y="4" width="14" height="17" rx="2" />
          <path d="M9 4V2h6v2M9 10h6m-6 4h6" />
        }
        @case ('grid') {
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
        }
        @case ('map') {
          <path d="m3 6 5-3 8 3 5-3v15l-5 3-8-3-5 3zM8 3v15m8-12v15" />
        }
        @case ('key') {
          <circle cx="8" cy="15" r="4" />
          <path d="m11 12 9-9m-3 3 3 3m-6 0 3 3" />
        }
        @case ('calendar') {
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M16 3v4M8 3v4M3 10h18" />
        }
        @case ('card') {
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M3 10h18M7 15h3" />
        }
        @case ('search') {
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-4-4" />
        }
        @case ('bell') {
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
        }
        @case ('plus') {
          <path d="M12 5v14M5 12h14" />
        }
        @case ('location') {
          <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
          <circle cx="12" cy="10" r="2.5" />
        }
        @case ('leaf') {
          <path d="M20 4C12 4 5 8 5 15c0 3 2 5 5 5 7 0 10-8 10-16ZM4 21c2-6 7-9 13-12" />
        }
        @case ('heart') {
          <path
            d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"
          />
        }
        @case ('book') {
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z" />
          <path d="M4 19.5v-14M8 7h8" />
        }
        @case ('chart') {
          <path d="M4 20V10m6 10V4m6 16v-7m5 7H2" />
        }
        @case ('mail') {
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m3 7 9 6 9-6" />
        }
        @case ('phone') {
          <path
            d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.7 2Z"
          />
        }
        @case ('logout') {
          <path d="M10 17l5-5-5-5m5 5H3m11-9h7v18h-7" />
        }
        @case ('download') {
          <path d="M12 3v12m-5-5 5 5 5-5M4 21h16" />
        }
        @default {
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v8m-4-4h8" />
        }
      }
    </svg>
  `,
})
export class UiIcon {
  @Input({ required: true }) name = '';
}
