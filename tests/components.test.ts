import { afterEach, describe, expect, it } from 'vitest';
import '../src/components/incident-workspace.js';
import { searchQuery } from '../src/components/incident-workspace.js';
import type { RecordForm } from '../src/components/record-form.js';
import type { RecordTable } from '../src/components/record-table.js';
import { StatusBadge, toneFor } from '../src/components/status-badge.js';
import { MockTableSource } from '../src/data/mock-table-source.js';

async function mount<T extends HTMLElement & { updateComplete: Promise<boolean> }>(el: T): Promise<T> {
  document.body.append(el);
  await el.updateComplete;
  return el;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('status-badge', () => {
  it('maps priorities and states to tones', () => {
    expect(toneFor('1 - Critical')).toBe('danger');
    expect(toneFor('2 - High')).toBe('warning');
    expect(toneFor('On Hold')).toBe('warning');
    expect(toneFor('Resolved')).toBe('success');
    expect(toneFor('In Progress')).toBe('info');
    expect(toneFor('3 - Moderate')).toBe('neutral');
  });

  it('renders the value with an explicit tone override', async () => {
    const badge = document.createElement('status-badge') as StatusBadge;
    badge.value = 'Resolved';
    badge.tone = 'danger';
    await mount(badge);
    const span = badge.shadowRoot!.querySelector('span')!;
    expect(span.textContent).toBe('Resolved');
    expect(span.dataset.tone).toBe('danger');
  });
});

describe('record-table', () => {
  const columns = [
    { field: 'number', label: 'Number', sortable: true },
    { field: 'state', label: 'State', badge: true },
  ];
  const records = [
    { sys_id: 'a', number: 'INC1', state: 'New' },
    { sys_id: 'b', number: 'INC2', state: 'Resolved' },
  ];

  async function table(props: Partial<RecordTable> = {}) {
    const el = document.createElement('record-table');
    Object.assign(el, { columns, records, total: 12, offset: 0, limit: 2 }, props);
    return mount(el);
  }

  it('renders rows and badges', async () => {
    const el = await table();
    const rows = el.shadowRoot!.querySelectorAll('tbody tr');
    expect(rows).toHaveLength(2);
    expect(rows[1].querySelector('status-badge')?.value).toBe('Resolved');
    expect(el.shadowRoot!.querySelector('.range')?.textContent).toBe('1-2 of 12');
  });

  it('emits sort-change, toggling direction on the active column', async () => {
    const el = await table({ sortField: 'number', sortDesc: false });
    let detail: unknown;
    el.addEventListener('sort-change', (e) => (detail = (e as CustomEvent).detail));
    el.shadowRoot!.querySelector<HTMLButtonElement>('th button')!.click();
    expect(detail).toEqual({ field: 'number', desc: true });
    expect(el.shadowRoot!.querySelector('th')?.getAttribute('aria-sort')).toBe('ascending');
  });

  it('emits row-select on click and on Enter', async () => {
    const el = await table();
    const selected: string[] = [];
    el.addEventListener('row-select', (e) => selected.push((e as CustomEvent).detail.record.number));
    const rows = el.shadowRoot!.querySelectorAll<HTMLTableRowElement>('tbody tr');
    rows[0].click();
    rows[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(selected).toEqual(['INC1', 'INC2']);
  });

  it('disables Previous on the first page and emits page-change for Next', async () => {
    const el = await table();
    const prev = el.shadowRoot!.querySelector<HTMLButtonElement>('.prev')!;
    const next = el.shadowRoot!.querySelector<HTMLButtonElement>('.next')!;
    expect(prev.disabled).toBe(true);
    let offset = -1;
    el.addEventListener('page-change', (e) => (offset = (e as CustomEvent).detail.offset));
    next.click();
    expect(offset).toBe(2);
  });

  it('explains when access rules hid rows on the page', async () => {
    const el = await table({ hiddenCount: 2 });
    expect(el.shadowRoot!.querySelector('.note')?.textContent?.replace(/\s+/g, ' ').trim()).toBe('2 records on this page are hidden by access rules.');
    const none = await table({ hiddenCount: 0 });
    expect(none.shadowRoot!.querySelector('.note')).toBeNull();
  });

  it('shows the empty state when there are no records', async () => {
    const el = await table({ records: [], total: 0 });
    expect(el.shadowRoot!.querySelector('.empty')?.textContent?.trim()).toBe('No records found');
  });
});

describe('record-form', () => {
  const fields = [
    { name: 'short_description', label: 'Short description', required: true, maxLength: 10 },
    { name: 'urgency', label: 'Urgency', type: 'choice' as const, required: true, options: [{ value: '1', label: 'High' }] },
  ];

  async function form() {
    const el = document.createElement('record-form') as RecordForm;
    el.fields = fields;
    return mount(el);
  }

  const submit = (el: RecordForm) => el.shadowRoot!.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));

  it('blocks submission and marks invalid fields', async () => {
    const el = await form();
    let submitted = false;
    el.addEventListener('record-submit', () => (submitted = true));
    submit(el);
    await el.updateComplete;
    expect(submitted).toBe(false);
    expect(el.shadowRoot!.querySelectorAll('.field-error')).toHaveLength(2);
    expect(el.shadowRoot!.querySelector('#field-short_description')?.getAttribute('aria-invalid')).toBe('true');
  });

  it('enforces maxLength and emits trimmed values when valid', async () => {
    const el = await form();
    const input = el.shadowRoot!.querySelector<HTMLInputElement>('#field-short_description')!;
    const select = el.shadowRoot!.querySelector<HTMLSelectElement>('#field-urgency')!;
    input.value = 'far too long text';
    input.dispatchEvent(new Event('input'));
    select.value = '1';
    select.dispatchEvent(new Event('change'));
    expect(el.validate()).toBe(false);

    input.value = '  Disk full ';
    input.dispatchEvent(new Event('input'));
    let data: unknown;
    el.addEventListener('record-submit', (e) => (data = (e as CustomEvent).detail.data));
    submit(el);
    expect(data).toEqual({ short_description: 'Disk full', urgency: '1' });
  });
});

describe('incident-workspace', () => {
  it('loads incidents from the injected source', async () => {
    const el = document.createElement('incident-workspace');
    el.source = new MockTableSource();
    await mount(el);
    await new Promise((r) => setTimeout(r, 0));
    await el.updateComplete;
    const tableEl = el.shadowRoot!.querySelector('record-table')!;
    await tableEl.updateComplete;
    expect(tableEl.records).toHaveLength(5);
    expect(tableEl.total).toBe(12);
    expect(tableEl.records[0].number).toBe('INC0010012');
  });

  it('sanitizes search text so it cannot inject extra query conditions', () => {
    expect(searchQuery('vpn')).toBe('short_descriptionLIKEvpn');
    expect(searchQuery('x^active=false')).toBe('short_descriptionLIKEx active false');
    expect(searchQuery('   ')).toBeUndefined();
  });
});
