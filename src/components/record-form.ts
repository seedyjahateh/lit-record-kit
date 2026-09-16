import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import type { RecordRow } from '../data/types.js';

export interface FieldOption {
  value: string;
  label: string;
}

export interface FieldDef {
  name: string;
  label: string;
  type?: 'text' | 'textarea' | 'choice';
  required?: boolean;
  maxLength?: number;
  options?: FieldOption[];
}

export type RecordSubmitEvent = CustomEvent<{ data: RecordRow }>;

/**
 * Schema-driven form: pass `fields` and it renders inputs, validates them, and emits
 * `record-submit` with the cleaned values. Saving is left to the parent.
 */
@customElement('record-form')
export class RecordForm extends LitElement {
  static styles = css`
    :host {
      display: block;
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      margin-bottom: 0.75rem;
    }
    input,
    select,
    textarea {
      font: inherit;
      padding: 0.4rem;
      width: 100%;
      box-sizing: border-box;
    }
    [aria-invalid='true'] {
      border-color: #b91c1c;
    }
    .field-error {
      color: #b91c1c;
      margin: 0;
      font-size: 0.85em;
    }
  `;

  @property({ attribute: false }) fields: FieldDef[] = [];
  @property({ type: Boolean }) submitting = false;
  @property({ attribute: 'submit-label' }) submitLabel = 'Submit';

  @state() private values: RecordRow = {};
  @state() private errors: Record<string, string> = {};

  render() {
    return html`<form novalidate @submit=${this.onSubmit}>
      ${this.fields.map((f) => this.renderField(f))}
      <button type="submit" ?disabled=${this.submitting}>${this.submitting ? 'Saving...' : this.submitLabel}</button>
    </form>`;
  }

  /** Validates current values; returns true when there are no errors. */
  validate(): boolean {
    const errors: Record<string, string> = {};
    for (const f of this.fields) {
      const v = (this.values[f.name] ?? '').trim();
      if (f.required && !v) errors[f.name] = `${f.label} is required`;
      else if (f.maxLength && v.length > f.maxLength) errors[f.name] = `${f.label} must be at most ${f.maxLength} characters`;
      else if (f.type === 'choice' && v && !(f.options ?? []).some((o) => o.value === v)) errors[f.name] = `Choose a valid ${f.label}`;
    }
    this.errors = errors;
    return Object.keys(errors).length === 0;
  }

  reset(): void {
    this.values = {};
    this.errors = {};
  }

  private renderField(f: FieldDef) {
    const id = `field-${f.name}`;
    const error = this.errors[f.name];
    const errorId = error ? `${id}-error` : undefined;
    const value = this.values[f.name] ?? '';
    const onInput = (e: Event) => this.setValue(f.name, (e.target as HTMLInputElement).value);

    let control;
    if (f.type === 'choice') {
      control = html`<select id=${id} name=${f.name} .value=${value} aria-invalid=${error ? 'true' : 'false'} aria-describedby=${ifDefined(errorId)} @change=${onInput}>
        <option value="">Select...</option>
        ${(f.options ?? []).map((o) => html`<option value=${o.value} ?selected=${o.value === value}>${o.label}</option>`)}
      </select>`;
    } else if (f.type === 'textarea') {
      control = html`<textarea id=${id} name=${f.name} rows="3" .value=${value} aria-invalid=${error ? 'true' : 'false'} aria-describedby=${ifDefined(errorId)} @input=${onInput}></textarea>`;
    } else {
      control = html`<input id=${id} name=${f.name} type="text" maxlength=${ifDefined(f.maxLength)} .value=${value} aria-invalid=${error ? 'true' : 'false'} aria-describedby=${ifDefined(errorId)} @input=${onInput} />`;
    }

    return html`<div class="field">
      <label for=${id}>${f.label}${f.required ? html`<span aria-hidden="true"> *</span>` : nothing}</label>
      ${control} ${error ? html`<p id=${errorId!} class="field-error">${error}</p>` : nothing}
    </div>`;
  }

  private setValue(name: string, value: string) {
    this.values = { ...this.values, [name]: value };
    if (this.errors[name]) {
      const rest = { ...this.errors };
      delete rest[name];
      this.errors = rest;
    }
  }

  private onSubmit(e: Event) {
    e.preventDefault();
    if (this.submitting || !this.validate()) return;
    const data: RecordRow = {};
    for (const f of this.fields) {
      const v = (this.values[f.name] ?? '').trim();
      if (v) data[f.name] = v;
    }
    this.dispatchEvent(new CustomEvent('record-submit', { detail: { data }, bubbles: true, composed: true }));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'record-form': RecordForm;
  }
}
