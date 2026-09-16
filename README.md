# lit-record-kit

Reusable [Lit](https://lit.dev) web components for browsing and creating ServiceNow-style records. The kit runs against an in-memory mock or a live ServiceNow Personal Developer Instance (PDI) through the REST Table API.

The components are standard custom elements, so they work in plain HTML or inside any framework.

## Components

| Element | Role | API |
|---|---|---|
| `<record-table>` | Presentational list | Properties: `columns`, `records`, `total`, `offset`, `limit`, `sortField`, `sortDesc`, `loading`, `error`. Events: `sort-change`, `page-change`, `row-select`. Slot: `empty`. |
| `<record-form>` | Schema-driven form | Properties: `fields` (text, textarea, choice; `required`, `maxLength`), `submitting`. Event: `record-submit` with the cleaned values. Method: `reset()`. |
| `<status-badge>` | Priority/state pill | Properties: `value`, optional `tone`. Themed with CSS custom properties (`--badge-danger-bg`, ...). |
| `<incident-workspace>` | Example container | Wires a `TableSource` to the table and form. |

## Design

- **`TableSource` interface.** `TableApiClient` (live) and `MockTableSource` (in-memory) are interchangeable implementations. Components depend on the interface, not a backend, which keeps them reusable and testable.
- **`RecordListController` (a Lit `ReactiveController`).** It owns query, paging, sorting, loading and error state for any host element. It discards stale responses, from an older request or after the host disconnects, so fast clicking can't show out-of-order data.
- **Presentational vs. container components.** `record-table` and `record-form` only render props and emit events. `incident-workspace` decides where data comes from and what happens on submit.
- **Accessibility.**
  - Sortable headers are buttons with `aria-sort`.
  - Rows can be selected with Enter or Space.
  - Invalid fields get `aria-invalid` and `aria-describedby`.
  - Errors use `role="alert"`.
- **Security.**
  - PDI credentials stay in `.env` and are added by the Vite dev proxy on the Node side, never bundled into browser code.
  - Search text is sanitized so it can't inject extra encoded-query conditions (`^`, `=`).

## Run

```bash
npm install
npm run dev        # http://localhost:5173, mock data
npm test           # Vitest + happy-dom
npm run build      # type-check + production build
```

### Against a ServiceNow PDI

1. Request a free instance at developer.servicenow.com.
2. `cp .env.example .env` and fill in `SN_INSTANCE`, `SN_USER`, `SN_PASSWORD`, and `VITE_USE_PDI=true`.
3. `npm run dev`. Requests to `/api/now/...` are proxied to the instance with Basic auth.

## Table API details used

- `GET /api/now/table/{table}` with `sysparm_limit`, `sysparm_offset`, `sysparm_query` (with `ORDERBY`/`ORDERBYDESC`), `sysparm_fields`, `sysparm_display_value=true`, and `sysparm_exclude_reference_link=true`.
- The total count comes from the `X-Total-Count` response header.
- `POST /api/now/table/{table}` with a JSON body to create a record. ServiceNow errors (`error.message`) surface as `TableApiError`.
- The mock computes priority from impact × urgency (priority = impact + urgency − 1).
