import type { RecordRow, TablePage, TableQuery, TableSource } from './types.js';

export class TableApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'TableApiError';
  }
}

type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

type ApiBody = { result?: unknown; error?: { message?: string } } | null;

/** Client for the ServiceNow REST Table API (`/api/now/table/{table}`). */
export class TableApiClient implements TableSource {
  constructor(
    private readonly baseUrl = '/api/now',
    private readonly fetchFn: FetchFn = (input, init) => fetch(input, init),
  ) {}

  buildListUrl(q: TableQuery): string {
    const params = new URLSearchParams();
    params.set('sysparm_limit', String(q.limit));
    params.set('sysparm_offset', String(q.offset));
    const parts: string[] = [];
    if (q.query) parts.push(q.query);
    if (q.orderBy) parts.push(`${q.desc ? 'ORDERBYDESC' : 'ORDERBY'}${q.orderBy}`);
    if (parts.length) params.set('sysparm_query', parts.join('^'));
    if (q.fields?.length) params.set('sysparm_fields', q.fields.join(','));
    params.set('sysparm_display_value', 'true');
    params.set('sysparm_exclude_reference_link', 'true');
    return `${this.baseUrl}/table/${encodeURIComponent(q.table)}?${params.toString()}`;
  }

  async list(q: TableQuery): Promise<TablePage> {
    const res = await this.fetchFn(this.buildListUrl(q), { headers: { Accept: 'application/json' } });
    const body = await this.parse(res);
    const records = Array.isArray(body?.result) ? (body.result as RecordRow[]) : [];
    // The Table API reports the full match count in X-Total-Count.
    const header = res.headers.get('X-Total-Count');
    const total = header !== null && header !== '' && !Number.isNaN(Number(header)) ? Number(header) : q.offset + records.length;
    return { records, total };
  }

  async create(table: string, data: RecordRow): Promise<RecordRow> {
    const url = `${this.baseUrl}/table/${encodeURIComponent(table)}?sysparm_display_value=true&sysparm_exclude_reference_link=true`;
    const res = await this.fetchFn(url, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const body = await this.parse(res);
    return (body?.result ?? {}) as RecordRow;
  }

  private async parse(res: Response): Promise<ApiBody> {
    let body: ApiBody = null;
    try {
      body = (await res.json()) as ApiBody;
    } catch {
      body = null;
    }
    if (!res.ok) {
      throw new TableApiError(body?.error?.message ?? `Table API request failed (${res.status})`, res.status);
    }
    return body;
  }
}
