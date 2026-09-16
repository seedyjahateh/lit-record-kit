import { LitElement, css, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import type { RecordRow } from '../data/types.js';
import './status-badge.js';

export interface ColumnDef {
  field: string;
  label: string;
  sortable?: boolean;
  /** Render the value as a <status-badge>. */
  badge?: boolean;
}

export type SortChangeEvent = CustomEvent<{ field: string; desc: boolean }>;
export type PageChangeEvent = CustomEvent<{ offset: number }>;
export type RowSelectEvent = CustomEvent<{ record: RecordRow }>;

/**
 * Presentational table: it renders whatever records and paging state it is given and reports
 * user intent through events (sort-change, page-change, row-select). It never fetches data.
 */
@customElement('record-table')
export class RecordTable extends LitElement {
  static styles = css`
    :host {
      display: block;
      font: inherit;
    }
    .scroll {
      overflow-x: auto;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th,
    td {
      text-align: left;
      padding: 0.45rem 0.6rem;
      border-bottom: 1px solid var(--record-table-border, #e5e7eb);
    }
    th button {
      font: inherit;
      font-weight: 600;
      background: none;
      border: 0;
      padding: 0;
      cursor: pointer;
    }
    tbody tr {
      cursor: pointer;
    }
    tbody tr:hover,
    tbody tr:focus-visible {
      background: var(--record-table-hover, #f3f4f6);
      outline: none;
    }
    .empty {
      text-align: center;
      color: #6b7280;
    }
    .error {
      color: #b91c1c;
    }
    .pager {
      display: flex;
      gap: 0.5rem;
      align-items: center;
      justify-content: flex-end;
      margin-top: 0.5rem;
    }
    [aria-busy='true'] tbody {
      opacity: 0.5;
    }
  `;

  @property({ attribute: false }) columns: ColumnDef[] = [];
  @property({ attribute: false }) records: RecordRow[] = [];
  @property({ type: Number }) total = 0;
  @property({ type: Number }) offset = 0;
  @property({ type: Number }) limit = 10;
  @property({ attribute: 'sort-field' }) sortField = '';
  @property({ type: Boolean, attribute: 'sort-desc' }) sortDesc = false;
  @property({ type: Boolean }) loading = false;
  @property() error = '';
  @property({ attribute: 'key-field' }) keyField = 'sys_id';

  render() {
    return html`
      <div aria-busy=${this.loading ? 'true' : 'false'}>
        ${this.error ? html`<p class="error" role="alert">${this.error}</p>` : nothing}
        <div class="scroll">
        <table>
          <thead>
            <tr>
              ${this.columns.map((c) => this.renderHeader(c))}
            </tr>
          </thead>
          <tbody>
            ${this.records.length === 0 && !this.loading
              ? html`<tr>
                  <td class="empty" colspan=${this.columns.length || 1}><slot name="empty">No records found</slot></td>
                </tr>`
              : repeat(
                  this.records,
                  (r, i) => r[this.keyField] ?? String(i),
                  (r) => this.renderRow(r),
                )}
          </tbody>
        </table>
        </div>
        ${this.renderPager()}
      </div>
    `;
  }

  private renderHeader(c: ColumnDef) {
    if (!c.sortable) return html`<th scope="col">${c.label}</th>`;
    const active = c.field === this.sortField;
    const ariaSort = active ? (this.sortDesc ? 'descending' : 'ascending') : 'none';
    return html`<th scope="col" aria-sort=${ariaSort}>
      <button type="button" data-field=${c.field} @click=${() => this.emitSort(c.field)}>
        ${c.label}${active ? (this.sortDesc ? ' ▼' : ' ▲') : ''}
      </button>
    </th>`;
  }

  private renderRow(record: RecordRow) {
    return html`<tr
      tabindex="0"
      @click=${() => this.select(record)}
      @keydown=${(e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.select(record);
        }
      }}
    >
      ${this.columns.map(
        (c) => html`<td>${c.badge ? html`<status-badge .value=${record[c.field] ?? ''}></status-badge>` : (record[c.field] ?? '')}</td>`,
      )}
    </tr>`;
  }

  private renderPager() {
    const start = this.total === 0 ? 0 : this.offset + 1;
    const end = Math.min(this.offset + this.limit, this.total);
    return html`<div class="pager">
      <span class="range">${start}-${end} of ${this.total}</span>
      <button type="button" class="prev" ?disabled=${this.offset <= 0 || this.loading} @click=${() => this.emitPage(this.offset - this.limit)}>
        Previous
      </button>
      <button type="button" class="next" ?disabled=${this.offset + this.limit >= this.total || this.loading} @click=${() => this.emitPage(this.offset + this.limit)}>
        Next
      </button>
    </div>`;
  }

  private emitSort(field: string) {
    const desc = field === this.sortField ? !this.sortDesc : false;
    this.dispatchEvent(new CustomEvent('sort-change', { detail: { field, desc }, bubbles: true, composed: true }));
  }

  private emitPage(offset: number) {
    this.dispatchEvent(new CustomEvent('page-change', { detail: { offset: Math.max(0, offset) }, bubbles: true, composed: true }));
  }

  private select(record: RecordRow) {
    this.dispatchEvent(new CustomEvent('row-select', { detail: { record }, bubbles: true, composed: true }));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'record-table': RecordTable;
  }
}
