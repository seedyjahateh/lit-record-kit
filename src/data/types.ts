/** A record as returned by the Table API with sysparm_display_value=true: field name -> display string. */
export type RecordRow = Record<string, string>;

export interface TableQuery {
  table: string;
  limit: number;
  offset: number;
  /** ServiceNow encoded query, e.g. "active=true^priority=1". */
  query?: string;
  fields?: string[];
  orderBy?: string;
  desc?: boolean;
}

export interface TablePage {
  records: RecordRow[];
  /** Total matching records across all pages. */
  total: number;
}

/**
 * Anything that can list and create records. Components depend on this interface, not on a
 * concrete backend, so the live Table API and the in-memory mock are interchangeable.
 */
export interface TableSource {
  list(query: TableQuery): Promise<TablePage>;
  create(table: string, data: RecordRow): Promise<RecordRow>;
}
