import type { RecordRow, TablePage, TableQuery, TableSource } from './types.js';

const PRIORITY_LABELS = ['1 - Critical', '2 - High', '3 - Moderate', '4 - Low', '5 - Planning'];

/** ServiceNow-style priority matrix: priority = impact + urgency - 1 (each 1-3). */
export function priorityFor(impact: string, urgency: string): string | undefined {
  const i = Number(impact);
  const u = Number(urgency);
  if (![1, 2, 3].includes(i) || ![1, 2, 3].includes(u)) return undefined;
  return PRIORITY_LABELS[i + u - 2];
}

/**
 * Supports the encoded-query subset the kit uses: `field=value`, `field!=value`, and
 * `fieldLIKEvalue` (case-insensitive contains), joined with `^`.
 */
export function matchesQuery(row: RecordRow, query: string): boolean {
  return query
    .split('^')
    .filter(Boolean)
    .every((cond) => {
      const m = cond.match(/^(\w+?)(!=|LIKE|=)(.*)$/);
      if (!m) throw new Error(`Unsupported query condition: ${cond}`);
      const [, field, op, value] = m;
      const actual = row[field] ?? '';
      if (op === '=') return actual === value;
      if (op === '!=') return actual !== value;
      return actual.toLowerCase().includes(value.toLowerCase());
    });
}

function pick(row: RecordRow, fields?: string[]): RecordRow {
  if (!fields?.length) return { ...row };
  return Object.fromEntries(fields.filter((f) => f in row).map((f) => [f, row[f]]));
}

/** In-memory stand-in for the Table API, so the kit runs and is testable without an instance. Data is fake. */
export class MockTableSource implements TableSource {
  private readonly tables = new Map<string, RecordRow[]>();
  private counter = 10050;

  constructor(
    seed: Record<string, RecordRow[]> = { incident: SAMPLE_INCIDENTS },
    private readonly latencyMs = 0,
  ) {
    for (const [name, rows] of Object.entries(seed)) this.tables.set(name, rows.map((r) => ({ ...r })));
  }

  async list(q: TableQuery): Promise<TablePage> {
    await this.delay();
    let rows = [...(this.tables.get(q.table) ?? [])];
    if (q.query) rows = rows.filter((r) => matchesQuery(r, q.query!));
    if (q.orderBy) {
      const field = q.orderBy;
      const dir = q.desc ? -1 : 1;
      rows.sort((a, b) => (a[field] ?? '').localeCompare(b[field] ?? '', undefined, { numeric: true }) * dir);
    }
    return { records: rows.slice(q.offset, q.offset + q.limit).map((r) => pick(r, q.fields)), total: rows.length };
  }

  async create(table: string, data: RecordRow): Promise<RecordRow> {
    await this.delay();
    this.counter += 1;
    const record: RecordRow = {
      sys_id: `mock-${this.counter}`,
      number: `INC${String(this.counter).padStart(7, '0')}`,
      state: 'New',
      assignment_group: '',
      sys_updated_on: new Date().toISOString().slice(0, 19).replace('T', ' '),
      ...data,
    };
    const priority = priorityFor(data.impact ?? '', data.urgency ?? '');
    if (priority) record.priority = priority;
    const rows = this.tables.get(table) ?? [];
    rows.unshift(record);
    this.tables.set(table, rows);
    return { ...record };
  }

  private delay(): Promise<void> {
    return this.latencyMs ? new Promise((resolve) => setTimeout(resolve, this.latencyMs)) : Promise.resolve();
  }
}

const incident = (n: number, short_description: string, priority: string, state: string, assignment_group: string, updated: string): RecordRow => ({
  sys_id: `mock-${10000 + n}`,
  number: `INC${String(10000 + n).padStart(7, '0')}`,
  short_description,
  priority,
  state,
  assignment_group,
  sys_updated_on: updated,
});

/** Fake sample incidents for the demo and tests. */
export const SAMPLE_INCIDENTS: RecordRow[] = [
  incident(1, 'Email not syncing on mobile device', '3 - Moderate', 'In Progress', 'Service Desk', '2026-09-01 09:12:44'),
  incident(2, 'VPN disconnects every few minutes', '2 - High', 'New', 'Network', '2026-09-02 10:03:10'),
  incident(3, 'Payroll report job failed overnight', '1 - Critical', 'In Progress', 'Database', '2026-09-03 06:41:27'),
  incident(4, 'Printer offline on floor 2', '4 - Low', 'On Hold', 'Service Desk', '2026-09-03 13:55:02'),
  incident(5, 'Cannot reset password in self-service portal', '3 - Moderate', 'Resolved', 'Identity', '2026-09-04 08:20:18'),
  incident(6, 'Conference room projector shows no signal', '4 - Low', 'New', 'Service Desk', '2026-09-05 15:31:40'),
  incident(7, 'Slow response times on customer API', '2 - High', 'In Progress', 'Application Support', '2026-09-06 11:47:33'),
  incident(8, 'Laptop will not boot after update', '3 - Moderate', 'New', 'Service Desk', '2026-09-07 09:05:51'),
  incident(9, 'Shared drive permissions missing for new hire', '3 - Moderate', 'Resolved', 'Identity', '2026-09-08 14:18:09'),
  incident(10, 'Database backup exceeded maintenance window', '2 - High', 'On Hold', 'Database', '2026-09-09 02:37:56'),
  incident(11, 'Wi-Fi drops in east building', '3 - Moderate', 'In Progress', 'Network', '2026-09-10 12:26:14'),
  incident(12, 'Order service returning 500 errors', '1 - Critical', 'New', 'Application Support', '2026-09-11 07:58:03'),
];
