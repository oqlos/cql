// frontend/src/modules/connect-scenario/helpers/scenarios.service.ts

import type { Goal, ScenarioContent } from '@/shared/types/scenario.types';
import { getScenarioCQRS } from '../cqrs/singleton';
import { ScenariosApiHelper } from '../../shared/scenarios-api.helper';

export type ScenarioListItem = { id: string; name: string; updatedAt: string; summary?: string };
export type ScenarioRow = { 
  id: string; 
  title: string; 
  content?: ScenarioContent; 
  dsl?: string; 
  def?: string; 
  obj?: string; 
  map?: string; 
  func?: string; 
  funcs?: any[];
  library?: string;  // JSON: objects, functions, params, units, funcs, goals
  config?: string;   // JSON: systemVars, optDefaults, objectFunctionMap, paramUnitMap
} | null;

export class ScenariosService {
  // ===== HTTP helpers =====
  static async createScenario(title: string, base?: string): Promise<string> {
    return ScenariosApiHelper.createScenario(title, base);
  }

  static async deleteScenario(id: string, base?: string): Promise<void> {
    return ScenariosApiHelper.deleteScenario(id, base);
  }

  static async listScenarios(filter: string = ''): Promise<ScenarioListItem[]> {
    // Prefer the API as the authoritative list source so row actions always have
    // up-to-date scenario IDs after create/delete operations.
    try {
      const rows = await ScenariosApiHelper.listScenarios(filter);
      if (rows.length) return rows;
    } catch {
      // Fall back to CQRS cache below when the API is temporarily unavailable.
    }

    try {
      const cqrs = getScenarioCQRS() as any;
      if (cqrs?.dispatch) {
        await cqrs.dispatch({ type: 'LoadScenarioById', id: '' });
        const st = cqrs.getState?.();
        const rows = Object.values(st?.scenarios || {});
        if (rows.length) {
          const lc = String(filter || '').trim().toLowerCase();
          return rows
            .map((r: any) => ({
              id: String(r.id || r.scenario_id || ''),
              name: String(r.title || r.name || ''),
              updatedAt: String(r.updated_at || r.updatedAt || ''),
              summary: String(r.summary || ''),
            }))
            .filter((row) => !lc || row.name.toLowerCase().includes(lc));
        }
      }
    } catch { /* silent */ }

    return [];
  }

  static async fetchScenarioById(id: string): Promise<ScenarioRow> {
    return ScenariosApiHelper.fetchScenarioById(id);
  }

  static async patchScenarioTitle(scenarioId: string, name: string): Promise<void> {
    if (!scenarioId || !name) return;
    try {
      await ScenariosApiHelper.updateScenario(scenarioId, { title: name });
      return;
    } catch { /* silent */ }
  }

  static async patchScenarioContent(scenarioId: string, content: any): Promise<void> {
    if (!scenarioId) return;
    // Delegate to shared helper (handles v3/v1 fallback + payload building)
    await ScenariosApiHelper.updateScenario(scenarioId, { content });
  }

  static async updateScenario(
    scenarioId: string,
    payload: { title?: string; content?: ScenarioContent | any; dsl?: string; def?: string; map?: string; func?: string; goals?: Goal[]; base?: string; library?: string; config?: string }
  ): Promise<void> {
    if (!scenarioId) return;
    // Delegate to shared helper (handles v3/v1 fallback + payload building)
    await ScenariosApiHelper.updateScenario(scenarioId, payload);
  }

  // ===== Local persistence (list + per-scenario cache) =====
  static loadScenarioList(): Array<{ id: string; name: string; updatedAt: string }> { return []; }

  static saveScenarioList(_list: Array<{ id: string; name: string; updatedAt: string }>): void { /* no-op */ }

  static setCurrentScenarioId(_id: string): void { /* no-op: use URL param 'scenario' instead */ }

  static getCurrentScenarioId(): string {
    try {
      const url = new URL(globalThis.location.href);
      return (url.searchParams.get('scenario') || url.searchParams.get('scenario_id') || '').trim();
    } catch { return ''; }
  }

  static loadScenarioLocal(_id: string): any | null { return null; }

  static saveScenarioLocal(_id: string, _data: any): void { /* no-op */ }

  static removeScenarioLocal(_id: string): void { /* no-op */ }
}
