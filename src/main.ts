import './components/incident-workspace.js';
import { MockTableSource } from './data/mock-table-source.js';
import { TableApiClient } from './data/table-api-client.js';

const usePdi = import.meta.env.VITE_USE_PDI === 'true';

const workspace = document.createElement('incident-workspace');
// Set the source before connecting so the first load goes to the right backend.
workspace.source = usePdi ? new TableApiClient('/api/now') : new MockTableSource(undefined, 250);
document.querySelector('#app')?.append(workspace);

const mode = document.querySelector('#mode');
if (mode) mode.textContent = usePdi ? 'Live: ServiceNow instance via the Vite dev proxy' : 'Mock data (no instance needed)';
