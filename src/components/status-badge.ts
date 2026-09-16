import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';

export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

const TONE_RULES: Array<[RegExp, BadgeTone]> = [
  [/^1\b|critical/i, 'danger'],
  [/^2\b|high|on hold|pending/i, 'warning'],
  [/resolved|closed|complete/i, 'success'],
  [/in progress|^new$|active/i, 'info'],
];

/** Maps a priority or state display value to a visual tone. */
export function toneFor(value: string): BadgeTone {
  for (const [pattern, tone] of TONE_RULES) if (pattern.test(value)) return tone;
  return 'neutral';
}

/**
 * <status-badge value="2 - High"></status-badge>
 * Theme with CSS custom properties, e.g. --badge-danger-bg, or override the tone explicitly.
 */
@customElement('status-badge')
export class StatusBadge extends LitElement {
  static styles = css`
    :host {
      display: inline-block;
    }
    span {
      display: inline-block;
      padding: 0.1em 0.6em;
      border-radius: 999px;
      font-size: 0.8em;
      font-weight: 600;
      white-space: nowrap;
      background: var(--badge-neutral-bg, #e5e7eb);
      color: var(--badge-neutral-fg, #1f2937);
    }
    span[data-tone='info'] {
      background: var(--badge-info-bg, #dbeafe);
      color: var(--badge-info-fg, #1e3a8a);
    }
    span[data-tone='success'] {
      background: var(--badge-success-bg, #dcfce7);
      color: var(--badge-success-fg, #14532d);
    }
    span[data-tone='warning'] {
      background: var(--badge-warning-bg, #fef3c7);
      color: var(--badge-warning-fg, #78350f);
    }
    span[data-tone='danger'] {
      background: var(--badge-danger-bg, #fee2e2);
      color: var(--badge-danger-fg, #7f1d1d);
    }
  `;

  @property() value = '';
  @property() tone?: BadgeTone;

  render() {
    const tone = this.tone ?? toneFor(this.value);
    return html`<span part="badge" data-tone=${tone}>${this.value || '-'}</span>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'status-badge': StatusBadge;
  }
}
