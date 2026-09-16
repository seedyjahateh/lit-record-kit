import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { RecordListController } from '../controllers/record-list-controller.js';
import { MockTableSource } from '../data/mock-table-source.js';
import type { RecordRow, TableSource } from '../data/types.js';
import type { FieldDef, RecordForm, RecordSubmitEvent } from './record-form.js';
import type { ColumnDef, PageChangeEvent, RowSelectEvent, SortChangeEvent } from './record-table.js';
import './record-form.js';
import './record-table.js';

export const INCIDENT_COLUMNS: ColumnDef[] = [
  { field: 'number', label: 'Number', sortable: true },
  { field: 'short_description', label: 'Short description', sortable: true },
  { field: 'priority', label: 'Priority', sortable: true, badge: true },
  { field: 'state', label: 'State', sortable: true, badge: true },
  { field: 'assignment_group', label: 'Assignment group' },
  { field: 'sys_updated_on', label: 'Updated', sortable: true },
];

const LEVELS = [
  { value: '1', label: '1 - High' },
  { value: '2', label: '2 - Medium' },
  { value: '3', label: '3 - Low' },
];

export const INCIDENT_FIELDS: FieldDef[] = [
  { name: 'short_description', label: 'Short description', required: true, maxLength: 160 },
  { name: 'description', label: 'Description', type: 'textarea' },
  { name: 'impact', label: 'Impact', type: 'choice', required: true, options: LEVELS },
  { name: 'urgency', label: 'Urgency', type: 'choice', required: true, options: LEVELS },
];

/** Removes characters that would let search text inject extra encoded-query conditions. */
export function searchQuery(text: string): string | undefined {
  const clean = text.replace(/[\^=]/g, ' ').trim();
  return clean ? `short_descriptionLIKE${clean}` : undefined;
}

/**
 * Container component: wires a TableSource to the presentational table and form through
 * RecordListController. Swap `source` to switch between mock data and a live instance.
 */
@customElement('incident-workspace')
export class IncidentWorkspace extends LitElement {
  static styles = css`
    :host {
      display: grid;
      gap: 1.5rem;
      grid-template-columns: minmax(0, 2fr) minmax(16rem, 1fr);
      font-family: system-ui, sans-serif;
    }
    section {
      min-width: 0; /* let grid columns shrink instead of being stretched by table content */
    }
    @media (max-width: 800px) {
      :host {
        grid-template-columns: 1fr;
      }
    }
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
    }
    .detail {
      margin-top: 1rem;
      padding: 0.75rem;
      border: 1px solid #e5e7eb;
      border-radius: 0.5rem;
    }
    dl {
      display: grid;
      grid-template-columns: max-content 1fr;
      gap: 0.25rem 1rem;
      margin: 0;
    }
    dt {
      font-weight: 600;
    }
  `;

  @property({ attribute: false }) source: TableSource = new MockTableSource();
  @state() private selected?: RecordRow;
  @state() private saving = false;
  @state() private notice = '';

  private readonly list = new RecordListController(this, this.source, {
    table: 'incident',
    limit: 5,
    offset: 0,
    orderBy: 'number',
    desc: true,
    fields: ['sys_id', ...INCIDENT_COLUMNS.map((c) => c.field)],
  });

  protected willUpdate(changed: PropertyValues<this>): void {
    // Includes the first render, so the initial load uses whichever source was set before connecting.
    if (changed.has('source')) void this.list.setSource(this.source);
  }

  render() {
    const c = this.list;
    return html`
      <section>
        <header>
          <h2>Incidents</h2>
          <input type="search" placeholder="Search short description" aria-label="Search incidents" @change=${this.onSearch} />
        </header>
        <record-table
          .columns=${INCIDENT_COLUMNS}
          .records=${c.records}
          .total=${c.total}
          .offset=${c.query.offset}
          .limit=${c.query.limit}
          .sortField=${c.query.orderBy ?? ''}
          .sortDesc=${!!c.query.desc}
          .loading=${c.status === 'loading'}
          .error=${c.error}
          .hiddenCount=${c.hiddenOnPage}
          @sort-change=${(e: SortChangeEvent) => c.sortBy(e.detail.field, e.detail.desc)}
          @page-change=${(e: PageChangeEvent) => c.setOffset(e.detail.offset)}
          @row-select=${(e: RowSelectEvent) => (this.selected = e.detail.record)}
        ></record-table>
        ${this.selected
          ? html`<div class="detail" aria-live="polite">
              <h3>${this.selected.number}</h3>
              <dl>
                ${INCIDENT_COLUMNS.map((col) => html`<dt>${col.label}</dt><dd>${this.selected?.[col.field] ?? ''}</dd>`)}
              </dl>
            </div>`
          : nothing}
      </section>
      <section>
        <h2>New incident</h2>
        <record-form .fields=${INCIDENT_FIELDS} .submitting=${this.saving} submit-label="Create incident" @record-submit=${this.onCreate}></record-form>
        ${this.notice ? html`<p role="status">${this.notice}</p>` : nothing}
      </section>
    `;
  }

  private onSearch(e: Event) {
    void this.list.setFilter(searchQuery((e.target as HTMLInputElement).value));
  }

  private async onCreate(e: RecordSubmitEvent) {
    const form = e.target as RecordForm;
    this.saving = true;
    this.notice = '';
    try {
      const created = await this.source.create('incident', e.detail.data);
      this.notice = `Created ${created.number ?? 'incident'}`;
      form.reset();
      await this.list.setOffset(0);
    } catch (err) {
      this.notice = `Could not create incident: ${err instanceof Error ? err.message : String(err)}`;
    } finally {
      this.saving = false;
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'incident-workspace': IncidentWorkspace;
  }
}
