import type { ReactiveController, ReactiveControllerHost } from 'lit';
import type { RecordRow, TableQuery, TableSource } from '../data/types.js';

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * Reactive controller that owns list state (query, paging, sorting, loading, errors) for any host
 * element. Keeping data logic here lets the table component stay purely presentational.
 */
export class RecordListController implements ReactiveController {
  records: RecordRow[] = [];
  total = 0;
  status: LoadStatus = 'idle';
  error = '';
  query: TableQuery;
  private requestId = 0;

  constructor(
    private readonly host: ReactiveControllerHost,
    public source: TableSource,
    query: TableQuery,
  ) {
    this.query = { ...query };
    host.addController(this);
  }

  /** Invalidate in-flight requests so a response arriving after removal doesn't update a detached host. */
  hostDisconnected(): void {
    this.requestId += 1;
  }

  async load(): Promise<void> {
    const id = ++this.requestId;
    this.status = 'loading';
    this.error = '';
    this.host.requestUpdate();
    try {
      const page = await this.source.list(this.query);
      if (id !== this.requestId) return; // superseded by a newer request; drop the stale response
      this.records = page.records;
      this.total = page.total;
      this.status = 'ready';
    } catch (e) {
      if (id !== this.requestId) return;
      this.records = [];
      this.error = e instanceof Error ? e.message : String(e);
      this.status = 'error';
    }
    this.host.requestUpdate();
  }

  setOffset(offset: number): Promise<void> {
    this.query = { ...this.query, offset: Math.max(0, offset) };
    return this.load();
  }

  sortBy(field: string, desc: boolean): Promise<void> {
    this.query = { ...this.query, orderBy: field, desc, offset: 0 };
    return this.load();
  }

  setFilter(query: string | undefined): Promise<void> {
    this.query = { ...this.query, query: query || undefined, offset: 0 };
    return this.load();
  }

  setSource(source: TableSource): Promise<void> {
    this.source = source;
    this.query = { ...this.query, offset: 0 };
    return this.load();
  }
}
