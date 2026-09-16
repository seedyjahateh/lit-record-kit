import { describe, expect, it } from 'vitest';
import { MockTableSource, matchesQuery, priorityFor } from '../src/data/mock-table-source.js';

describe('matchesQuery', () => {
  const row = { state: 'New', short_description: 'VPN disconnects', priority: '2 - High' };

  it('supports =, !=, LIKE, and ^ (AND)', () => {
    expect(matchesQuery(row, 'state=New')).toBe(true);
    expect(matchesQuery(row, 'state!=New')).toBe(false);
    expect(matchesQuery(row, 'short_descriptionLIKEvpn')).toBe(true);
    expect(matchesQuery(row, 'state=New^priority=2 - High')).toBe(true);
    expect(matchesQuery(row, 'state=New^priority=1 - Critical')).toBe(false);
  });

  it('rejects conditions it does not understand instead of silently matching', () => {
    expect(() => matchesQuery(row, 'priority>2')).toThrow(/Unsupported/);
  });
});

describe('priorityFor', () => {
  it('follows the impact x urgency matrix', () => {
    expect(priorityFor('1', '1')).toBe('1 - Critical');
    expect(priorityFor('2', '1')).toBe('2 - High');
    expect(priorityFor('2', '2')).toBe('3 - Moderate');
    expect(priorityFor('3', '2')).toBe('4 - Low');
    expect(priorityFor('3', '3')).toBe('5 - Planning');
    expect(priorityFor('4', '1')).toBeUndefined();
  });
});

describe('MockTableSource', () => {
  it('filters, sorts numerically, and pages', async () => {
    const source = new MockTableSource();
    const page = await source.list({ table: 'incident', limit: 2, offset: 0, query: 'state=New', orderBy: 'number', desc: true });
    expect(page.total).toBe(4);
    expect(page.records.map((r) => r.number)).toEqual(['INC0010012', 'INC0010008']);
  });

  it('returns only requested fields', async () => {
    const page = await new MockTableSource().list({ table: 'incident', limit: 1, offset: 0, fields: ['number'] });
    expect(Object.keys(page.records[0])).toEqual(['number']);
  });

  it('creates records with a number, New state, and computed priority', async () => {
    const source = new MockTableSource();
    const created = await source.create('incident', { short_description: 'Disk full', impact: '1', urgency: '2' });
    expect(created.number).toMatch(/^INC\d{7}$/);
    expect(created.state).toBe('New');
    expect(created.priority).toBe('2 - High');
    const page = await source.list({ table: 'incident', limit: 1, offset: 0, query: 'short_descriptionLIKEdisk' });
    expect(page.total).toBe(1);
  });

  it('does not share state between instances', async () => {
    await new MockTableSource().create('incident', { short_description: 'Only here' });
    const page = await new MockTableSource().list({ table: 'incident', limit: 50, offset: 0, query: 'short_descriptionLIKEonly here' });
    expect(page.total).toBe(0);
  });
});
