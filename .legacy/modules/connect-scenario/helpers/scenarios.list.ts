// frontend/src/modules/connect-scenario/helpers/scenarios.list.ts
// Extracted from connect-scenario-scenarios.page.ts — scenario list rendering
import { escapeHtml } from '../../shared/generic-grid/utils';
import { ScenariosService } from './scenarios.service';

export interface ScenarioListContext {
  readScenarioIdFromUrl(): string;
  loadScenarioById(id: string): Promise<void>;
  writeScenarioIdToUrl(id: string): void;
}

export async function renderScenarioList(filter: string = '', ctx: ScenarioListContext): Promise<void> {
  const body = document.getElementById('scenario-list-body');
  if (!body) return;
  let list: Array<{ id: string; name: string; updatedAt: string; summary?: string }> = [];
  try { list = await ScenariosService.listScenarios(filter); } catch { list = []; }

  const sortMode = (document.getElementById('scenario-sort') as HTMLSelectElement | null)?.value || 'date_desc';
  const toTs = (s: string): number => {
    const raw = String(s || '').trim();
    if (!raw) return 0;
    const n = Number(raw);
    if (!Number.isNaN(n) && Number.isFinite(n)) return n;
    const t = Date.parse(raw);
    return Number.isNaN(t) ? 0 : t;
  };
  const byName = (a: string, b: string): number => a.localeCompare(b, 'pl', { sensitivity: 'base' });

  list = (list || []).slice().sort((a, b) => {
    const an = String(a?.name || '').trim();
    const bn = String(b?.name || '').trim();
    const at = toTs(String(a?.updatedAt || ''));
    const bt = toTs(String(b?.updatedAt || ''));
    switch (sortMode) {
      case 'name_asc': return byName(an, bn);
      case 'name_desc': return byName(bn, an);
      case 'date_asc': return at - bt;
      case 'date_desc':
      default: return bt - at;
    }
  });

  const rows = list.map(s => `
        <tr class="scenario-row" data-id="${s.id}">
          <td>${escapeHtml(s.name)}</td>
          <td class="scenario-actions">
            <button class="btn btn-secondary scn-clone" title="Klonuj scenariusz">📋</button>
            <button class="btn btn-secondary scn-delete" title="Usuń">🗑️</button>
          </td>
        </tr>`).join('');
  body.innerHTML = rows || '<tr><td colspan="2"><em>Brak wyników</em></td></tr>';

  const cards = document.getElementById('scenario-card-list');
  if (cards) {
    const cardHtml = list.map(s => `
        <div class="example-item" data-scenario-id="${escapeHtml(s.id)}">
          <strong>${escapeHtml(s.name)}</strong>
          <small>${escapeHtml(s.summary || '')}</small>
        </div>
      `).join('');
    cards.innerHTML = cardHtml || '<div class="text-sm"><em>Brak scenariuszy</em></div>';
  }

  try {
    const path = (globalThis.location?.pathname || '').toString();
    const isScenariosRoute = path === '/connect-test/scenarios' || path.startsWith('/connect-test/scenarios')
      || path === '/connect-scenario' || path.startsWith('/connect-scenario');
    const urlId = ctx.readScenarioIdFromUrl();
    const currentId = urlId || (ScenariosService.getCurrentScenarioId && ScenariosService.getCurrentScenarioId()) || '';
    if (isScenariosRoute && !currentId && list.length > 0) {
      await ctx.loadScenarioById(list[0].id);
      ctx.writeScenarioIdToUrl(list[0].id);
    }
  } catch {
    // Non-blocking: scenario list can still render if auto-select bootstrap fails.
  }
}
