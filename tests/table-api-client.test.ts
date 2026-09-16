import { describe, expect, it, vi } from 'vitest';
import { TableApiClient, TableApiError } from '../src/data/table-api-client.js';

const jsonResponse = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' }, ...init });

describe('TableApiClient', () => {
  it('builds Table API list URLs with paging, ordering, fields, and display values', () => {
    const client = new TableApiClient('/api/now');
    const url = new URL(
      client.buildListUrl({ table: 'incident', limit: 5, offset: 10, query: 'active=true', orderBy: 'number', desc: true, fields: ['number', 'state'] }),
      'http://x',
    );
    expect(url.pathname).toBe('/api/now/table/incident');
    expect(url.searchParams.get('sysparm_limit')).toBe('5');
    expect(url.searchParams.get('sysparm_offset')).toBe('10');
    expect(url.searchParams.get('sysparm_query')).toBe('active=true^ORDERBYDESCnumber');
    expect(url.searchParams.get('sysparm_fields')).toBe('number,state');
    expect(url.searchParams.get('sysparm_display_value')).toBe('true');
  });

  it('uses ascending ORDERBY and omits the query when there is nothing to filter', () => {
    const url = new URL(new TableApiClient().buildListUrl({ table: 'incident', limit: 1, offset: 0, orderBy: 'number' }), 'http://x');
    expect(url.searchParams.get('sysparm_query')).toBe('ORDERBYnumber');
    expect(new URL(new TableApiClient().buildListUrl({ table: 'incident', limit: 1, offset: 0 }), 'http://x').searchParams.has('sysparm_query')).toBe(false);
  });

  it('reads records from result and the total from X-Total-Count', async () => {
    const fetchFn = vi.fn(async () => jsonResponse({ result: [{ number: 'INC1' }] }, { headers: { 'X-Total-Count': '42' } }));
    const page = await new TableApiClient('/api/now', fetchFn).list({ table: 'incident', limit: 1, offset: 0 });
    expect(page).toEqual({ records: [{ number: 'INC1' }], total: 42 });
  });

  it('falls back to offset + page size when X-Total-Count is missing', async () => {
    const fetchFn = vi.fn(async () => jsonResponse({ result: [{ number: 'A' }, { number: 'B' }] }));
    const page = await new TableApiClient('/api/now', fetchFn).list({ table: 'incident', limit: 2, offset: 4 });
    expect(page.total).toBe(6);
  });

  it('throws TableApiError with the ServiceNow error message', async () => {
    const fetchFn = vi.fn(async () => jsonResponse({ error: { message: 'User Not Authenticated' } }, { status: 401 }));
    const err = await new TableApiClient('/api/now', fetchFn).list({ table: 'incident', limit: 1, offset: 0 }).catch((e) => e);
    expect(err).toBeInstanceOf(TableApiError);
    expect(err.status).toBe(401);
    expect(err.message).toBe('User Not Authenticated');
  });

  it('POSTs JSON to create a record', async () => {
    const fetchFn = vi.fn(async () => jsonResponse({ result: { number: 'INC0010051' } }, { status: 201 }));
    const created = await new TableApiClient('/api/now', fetchFn).create('incident', { short_description: 'Test' });
    expect(created.number).toBe('INC0010051');
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url.startsWith('/api/now/table/incident?')).toBe(true);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ short_description: 'Test' });
  });
});
