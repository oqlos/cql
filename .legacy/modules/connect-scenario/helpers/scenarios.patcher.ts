// frontend/src/modules/connect-scenario/helpers/scenarios.patcher.ts

import { ScenariosService } from './scenarios.service';
import { dslFromScenarioContent } from '../../../components/dsl/dsl-content-helpers';
import { parseDsl } from '../../../components/dsl';
import { astToDslText } from '../../../components/dsl/dsl.serialize.text';
import { ScenariosApiHelper } from '../../shared/scenarios-api.helper';

export type MaxMinPatch = {
  title: string;           // scenario title to match (exact)
  goalName?: string;       // optional goal name; default: first goal
  param: string;           // e.g., "czas"
  min?: string | number;   // e.g., 4
  max?: string | number;   // e.g., 2
  unit?: string;           // e.g., "s"
};

async function fetchScenarioIdByTitle(title: string): Promise<string | null> {
  try {
    const rows = await ScenariosApiHelper.listScenarioRows(title);
    const lc = String(title || '').trim().toLowerCase();
    const row = rows.find((r: any) => String(r?.title || r?.name || '').toLowerCase() === lc)
      || rows.find((r: any) => String(r?.title || r?.name || '').toLowerCase().startsWith(lc))
      || rows.find((r: any) => String(r?.title || r?.name || '').toLowerCase().includes(lc));
    return row?.id ? String(row.id) : row?.scenario_id ? String(row.scenario_id) : null;
  } catch { return null; }
}

function appendMaxMinToDsl(dsl: string, patch: MaxMinPatch): string {
  const res = parseDsl(dsl);
  if (!res.ok || !res.ast) return dsl;
  const ast = res.ast as any;
  if (!Array.isArray(ast.goals) || !ast.goals.length) return dsl;
  const goalIdx = (() => {
    if (patch.goalName) {
      const idx = ast.goals.findIndex((g: any) => String(g?.name || '').trim().toLowerCase() === String(patch.goalName || '').trim().toLowerCase());
      if (idx >= 0) return idx;
    }
    return 0;
  })();
  const g = ast.goals[goalIdx];
  g.steps = Array.isArray(g.steps) ? g.steps.slice() : [];
  if (typeof patch.max !== 'undefined') {
    g.steps.push({ type: 'max', parameter: String(patch.param), value: String(patch.max), unit: patch.unit || '' });
  }
  if (typeof patch.min !== 'undefined') {
    g.steps.push({ type: 'min', parameter: String(patch.param), value: String(patch.min), unit: patch.unit || '' });
  }
  return astToDslText(ast);
}

export async function patchScenariosMaxMin(patches: MaxMinPatch[]): Promise<Array<{ title: string; id?: string; ok: boolean; error?: string }>> {
  const results: Array<{ title: string; id?: string; ok: boolean; error?: string }> = [];
  for (const p of patches) {
    try {
      const id = await fetchScenarioIdByTitle(p.title);
      if (!id) { results.push({ title: p.title, ok: false, error: 'Scenario not found' }); continue; }
      const row = await ScenariosService.fetchScenarioById(id);
      if (!row) { results.push({ title: p.title, id, ok: false, error: 'Fetch failed' }); continue; }
      const dsl = dslFromScenarioContent(row.content, row.title) || '';
      const updated = appendMaxMinToDsl(dsl, p);
      const content = { ...(row.content || {}), dsl: updated };
      await ScenariosService.patchScenarioContent(id, content);
      results.push({ title: p.title, id, ok: true });
    } catch (e: any) {
      results.push({ title: p.title, ok: false, error: String(e?.message || e) });
    }
  }
  return results;
}

// Preset runner for ts-c20, ts-pressure, ts-f5c2518f (param: czas, unit: s, MAX=2, MIN=4)
export async function runMaxMinPatcherPreset(): Promise<void> {
  const list: MaxMinPatch[] = [
    { title: 'ts-c20', param: 'czas', max: 2, min: 4, unit: 's' },
    { title: 'ts-pressure', param: 'czas', max: 2, min: 4, unit: 's' },
    { title: 'ts-f5c2518f', param: 'czas', max: 2, min: 4, unit: 's' },
  ];
  await patchScenariosMaxMin(list);
}
