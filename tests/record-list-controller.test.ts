import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { describe, expect, it } from 'vitest';
import { RecordListController } from '../src/controllers/record-list-controller.js';
import { MockTableSource } from '../src/data/mock-table-source.js';
import type { TablePage, TableQuery, TableSource } from '../src/data/types.js';

class FakeHost implements ReactiveControllerHost {
  controllers: ReactiveController[] = [];
  updates = 0;
  addController(c: ReactiveController) {
    this.controllers.push(c);
  }
  removeController() {}
  requestUpdate() {
    this.updates += 1;
  }
  get updateComplete() {
    return Promise.resolve(true);
  }
}

const baseQuery: TableQuery = { table: 'incident', limit: 5, offset: 0, orderBy: 'number' };

describe('RecordListController', () => {
  it('registers with its host and loads a page', async () => {
    const host = new FakeHost();
    const c = new RecordListController(host, new MockTableSource(), baseQuery);
    expect(host.controllers).toContain(c);
    await c.load();
    expect(c.status).toBe('ready');
    expect(c.records).toHaveLength(5);
    expect(c.total).toBe(12);
    expect(host.updates).toBeGreaterThanOrEqual(2);
  });

  it('resets paging when sorting or filtering', async () => {
    const c = new RecordListController(new FakeHost(), new MockTableSource(), baseQuery);
    await c.setOffset(5);
    expect(c.query.offset).toBe(5);
    await c.sortBy('priority', true);
    expect(c.query).toMatchObject({ orderBy: 'priority', desc: true, offset: 0 });
    await c.setOffset(5);
    await c.setFilter('state=New');
    expect(c.query.offset).toBe(0);
    expect(c.total).toBe(4);
  });

  it('surfaces source errors', async () => {
    const failing: TableSource = {
      list: () => Promise.reject(new Error('boom')),
      create: () => Promise.reject(new Error('boom')),
    };
    const c = new RecordListController(new FakeHost(), failing, baseQuery);
    await c.load();
    expect(c.status).toBe('error');
    expect(c.error).toBe('boom');
  });

  it('ignores responses that arrive after the host disconnects', async () => {
    let resolve!: (page: TablePage) => void;
    const slow: TableSource = {
      list: () => new Promise<TablePage>((r) => (resolve = r)),
      create: () => Promise.reject(new Error('unused')),
    };
    const c = new RecordListController(new FakeHost(), slow, baseQuery);
    const pending = c.load();
    c.hostDisconnected();
    resolve({ records: [{ number: 'LATE' }], total: 1 });
    await pending;
    expect(c.records).toEqual([]);
  });

  it('ignores a stale response that resolves after a newer request', async () => {
    const pending: Array<(page: TablePage) => void> = [];
    const slow: TableSource = {
      list: () => new Promise<TablePage>((resolve) => pending.push(resolve)),
      create: () => Promise.reject(new Error('unused')),
    };
    const c = new RecordListController(new FakeHost(), slow, baseQuery);
    const first = c.load();
    const second = c.load();
    pending[1]({ records: [{ number: 'NEW' }], total: 1 });
    await second;
    pending[0]({ records: [{ number: 'OLD' }], total: 1 });
    await first;
    expect(c.records).toEqual([{ number: 'NEW' }]);
  });
});
