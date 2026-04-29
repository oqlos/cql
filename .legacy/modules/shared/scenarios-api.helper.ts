// frontend/src/modules/shared/scenarios-api.helper.ts
/**
 * Shared API helper for test_scenarios CRUD operations.
 * Refactored from 512 lines to ~280 lines by splitting into:
 * - scenarios-api.types.ts: Type definitions
 * - scenarios-api.payload.ts: Payload builders
 * - scenarios-api.content.ts: Content merging utilities
 * 
 * Eliminates duplicate payload-building and fallback logic across:
 *   - ScenariosService (connect-scenario)
 *   - connect-manager CQRS handlers
 *   - connect-scenario CQRS handlers
 *   - connect-test device-testing page
 */

import { MAX_PAGE_SIZE } from '../../config/api.config';
import { fetchWithAuth, fetchWithAuthFallback, fetchApiRowsWithFallback } from '../../utils/fetch.utils';
import { parseApiResponseFromResponse } from '../../utils/api-response.utils';
import { ScenarioApi, isApiSuccess } from '../../services/api-client.v3';

// Re-export types
export type { ScenarioRow, ScenarioUpdatePayload, ScenarioListItem } from './scenarios-api.types';

// Re-export utilities
export { buildScenarioUpdatePayload } from './scenarios-api.payload';
export { mergeScenarioContent, normalizeScenarioRow } from './scenarios-api.content';

// Import for internal use
import type { ScenarioRow, ScenarioUpdatePayload, ScenarioListItem } from './scenarios-api.types';
import { buildScenarioUpdatePayload } from './scenarios-api.payload';
import { normalizeScenarioRow, mergeScenarioContent } from './scenarios-api.content';

// ── CRUD operations with v3/v1 fallback ─────────────────────────────────────

export class ScenariosApiHelper {
  /**
   * List raw scenario rows with merged content (v3 API first, fallback to v1 data endpoint).
   */
  static async listScenarioRows(filter?: string, signal?: AbortSignal): Promise<ScenarioRow[]> {
    try {
      const rows = await fetchApiRowsWithFallback<any>([
        `/api/v3/data/test_scenarios?skip=0&limit=${MAX_PAGE_SIZE}`,
      ], { signal });

      const lc = filter && filter.trim() ? filter.trim().toLowerCase() : '';
      const filtered = lc
        ? rows.filter((r: any) => String(r?.title || r?.name || '').toLowerCase().includes(lc))
        : rows;

      return filtered.map((row: any) => normalizeScenarioRow(row));
    } catch {
      // Fallback: summary API, converted into minimal rows
      try {
        const params: { title_search?: string; limit?: number; offset?: number } = { limit: MAX_PAGE_SIZE, offset: 0 };
        if (filter && filter.trim()) params.title_search = filter.trim();
        const res = await ScenarioApi.list(params);
        if (isApiSuccess(res)) {
          const items = Array.isArray(res.data?.scenarios) ? res.data.scenarios : [];
          return items.map((item: any) => normalizeScenarioRow({
            id: item.scenario_id || item.id,
            title: item.title,
          }));
        }
      } catch { /* silent */ }
      return [];
    }
  }

  /**
   * Load all scenario rows via the data endpoint, walking pages until the backend stops returning rows.
   * Falls back to the regular listScenarioRows() if paging cannot be completed.
   */
  static async listAllScenarioRows(filter?: string, signal?: AbortSignal): Promise<ScenarioRow[]> {
    const allRows: ScenarioRow[] = [];
    const lc = filter && filter.trim() ? filter.trim().toLowerCase() : '';

    try {
      let page = 0;
      while (true) {
        const skip = page * MAX_PAGE_SIZE;
        const res = await fetchWithAuth(`/api/v3/data/test_scenarios?skip=${skip}&limit=${MAX_PAGE_SIZE}`, { signal });
        if (!res.ok) break;
        const pageRows = await parseApiResponseFromResponse<any>(res);
        if (!Array.isArray(pageRows) || pageRows.length === 0) break;

        const filtered = lc
          ? pageRows.filter((r: any) => String(r?.title || r?.name || '').toLowerCase().includes(lc))
          : pageRows;
        allRows.push(...filtered.map((row: any) => normalizeScenarioRow(row)));

        if (pageRows.length < MAX_PAGE_SIZE) break;
        page += 1;
      }

      if (allRows.length) return allRows;
    } catch {
      // fall through to best-effort single-page loader below
    }

    return this.listScenarioRows(filter, signal);
  }

  static async listScenarios(filter?: string, signal?: AbortSignal): Promise<ScenarioListItem[]> {
    try {
      const rows = await this.listScenarioRows(filter, signal);
      return rows.map((r: any) => {
        let summary = '';
        const goalsArr = Array.isArray(r?.content?.goals) ? r.content.goals : [];
        if (goalsArr.length) {
          const g = goalsArr[0];
          const tasks = Array.isArray(g.tasks) ? g.tasks : [];
          if (tasks.length) {
            const t = tasks[0];
            const parts: string[] = [];
            if (t?.function && t?.object) parts.push(`${t.function} [${t.object}]`);
            if (Array.isArray(t?.ands)) {
              for (const a of t.ands) {
                if (a?.function && a?.object) parts.push(`${a.function} [${a.object}]`);
              }
            }
            if (parts.length) summary = `AKCJA ${parts.join('  AND ')}`;
          }
        }
        const upd = (r as any).updated_at || (r as any).updatedAt || '';
        return { id: String(r.id || r.scenario_id || ''), name: String(r.title || ''), updatedAt: String(upd), summary };
      });
    } catch {
      return [];
    }
  }

  /**
   * Fetch a single scenario by ID (v3 API first, fallback to v1 data endpoint).
   */
  static async fetchScenarioById(id: string, signal?: AbortSignal): Promise<ScenarioRow | null> {
    if (!id) return null;

    // Preferred: v3 API
    try {
      const res = await ScenarioApi.get(id, { include_activities: false, include_content: true });
      if (isApiSuccess(res)) {
        const row: any = res.data || null;
        if (!row) return null;
        const { content, funcs } = mergeScenarioContent(row);
        return {
          id: row.scenario_id || row.id,
          title: row.title || '',
          content,
          dsl: content?.dsl,
          def: content?.def,
          map: content?.map,
          func: content?.func,
          funcs,
          obj: row.obj || content?.obj,
          library: row.library,
          config: row.config,
        };
      }
    } catch { /* fallback below */ }

    // Fallback: v1 data endpoint
    try {
      const filters = encodeURIComponent(JSON.stringify({ id }));
      const res = await fetchWithAuth(`/api/v3/data/test_scenarios?filters=${filters}`, { signal });
      if (!res.ok) return null;
      const data = await res.json();
      const row = Array.isArray(data?.data) ? data.data[0] : (Array.isArray(data?.rows) ? data.rows[0] : null);
      if (!row) return null;
      const { content, funcs } = mergeScenarioContent(row);
      return {
        id: row.id,
        title: row.title || '',
        content,
        def: content?.def,
        map: content?.map,
        func: content?.func,
        funcs,
        obj: row.obj || content?.obj,
        library: row.library,
        config: row.config,
      };
    } catch {
      return null;
    }
  }

  /**
   * Create a new scenario (v3 API first, fallback to v1 data endpoint).
   */
  static async createScenario(title: string, base?: string): Promise<string> {
    // Legacy path for external/base URLs
    if (base) {
      try {
        const url = `${base}/api/v3/data/test_scenarios`;
        const res = await fetchWithAuth(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ data: { title } }),
        });
        const data = await res.json();
        return (data?.row?.id || data?.id || '').toString() || '';
      } catch {
        return '';
      }
    }

    // Preferred: v3 API
    try {
      const res = await ScenarioApi.create({ title });
      if (isApiSuccess(res)) {
        return (res.data.scenario_id || '').toString() || '';
      }
    } catch { /* fallback below */ }

    // Fallback: v1 data endpoint
    try {
      const res = await fetchWithAuthFallback([
        '/api/v3/scenarios',
        '/api/v3/data/test_scenarios',
      ], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      if (res && res.ok) {
        const js = await res.json();
        return (js?.data?.scenario_id || js?.row?.id || js?.id || '').toString() || '';
      }
    } catch { /* silent */ }

    return '';
  }

  /**
   * Delete a scenario (v3 API first, fallback to v1 data endpoint).
   */
  static async deleteScenario(id: string, base?: string): Promise<void> {
    if (!id) {
      throw new Error('Missing scenario id');
    }

    // Legacy path for external/base URLs
    if (base) {
      const res = await fetchWithAuth(`${base}/api/v3/data/test_scenarios/${id}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      if (!res.ok) {
        throw new Error(`Delete scenario failed: HTTP ${res.status}`);
      }
      return;
    }

    // Preferred: v3 API
    try {
      await ScenarioApi.delete(id);
      return;
    } catch {
      // fallback below
    }

    // Fallback: v1 data endpoint
    const res = await fetchWithAuthFallback([
      `/api/v3/scenarios/${encodeURIComponent(id)}`,
      `/api/v3/data/test_scenarios/${encodeURIComponent(id)}`,
    ], { method: 'DELETE' });

    if (!res || !res.ok) {
      throw new Error(`Delete scenario failed${res ? `: HTTP ${res.status}` : ''}`);
    }
  }

  /**
   * Update a scenario (v3 API first, fallback to v1 data endpoint).
   */
  static async updateScenario(scenarioId: string, payload: ScenarioUpdatePayload): Promise<void> {
    if (!scenarioId) return;

    // Legacy path for external/base URLs
    if (payload.base) {
      try {
        const data = buildScenarioUpdatePayload(payload, false);
        const url = `${payload.base}/api/v3/data/test_scenarios/${scenarioId}`;
        await fetchWithAuth(url, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ data }),
        });
      } catch { /* silent */ }
      return;
    }

    // Preferred: v3 API
    try {
      const data = buildScenarioUpdatePayload(payload, true);
      await ScenarioApi.update(scenarioId, data);
      return;
    } catch { /* fallback below */ }

    // Fallback: v1 data endpoint
    try {
      const data = buildScenarioUpdatePayload(payload, false);
      await fetchWithAuth(`/api/v3/data/test_scenarios/${scenarioId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data }),
      });
    } catch { /* silent */ }
  }
}
