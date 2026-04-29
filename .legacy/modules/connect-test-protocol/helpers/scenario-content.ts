/**
 * scenario-content.ts
 * Loads and merges scenario content from multiple sources (goals column, library, DSL).
 * Extracted from protocol-steps.page.ts
 */

import { ScenariosApiHelper } from '../../shared/scenarios-api.helper';
import { parseDsl } from '../../../components/dsl';
import { unifiedDsl } from '../../../utils/unified-dsl';

export interface ScenarioContentResult {
  goals?: Array<{ name: string; steps: any[] }>;
}

/**
 * Load scenario content from DB, merging goals from multiple sources.
 * @param scenarioId - The scenario ID to load
 * @param normalizeGoalSteps - Function to normalize goal steps (from page class)
 * @returns The merged scenario content, or null on failure
 */
export async function loadScenarioContent(
  scenarioId: string,
  normalizeGoalSteps: (goal: any) => any[],
): Promise<ScenarioContentResult | null> {
  try {
    const sid = (scenarioId || '').trim();
    if (!sid) return null;
    const row = await ScenariosApiHelper.fetchScenarioById(sid);
    if (!row) return null;
    // content column is deprecated - use dedicated columns only
    const hasStepData = (g: any): boolean => {
      try {
        if (!g || typeof g !== 'object') return false;
        if (Array.isArray(g.steps) && g.steps.length) return true;
        try {
          const norm = normalizeGoalSteps(g);
          if (Array.isArray(norm) && norm.length) return true;
        } catch { /* silent */ }
        return false;
      } catch { return false; }
    };
    const hasAnyStepData = (goals: any[]): boolean => {
      try { return Array.isArray(goals) && goals.some(hasStepData); } catch { return false; }
    };

    const goalsFromContent: any[] = []; // deprecated - no longer using content column
    let goalsFromColumn: any[] | null = null;
    try {
      if (row.goals) {
        const goalsObj = typeof row.goals === 'string' ? JSON.parse(row.goals) : row.goals;
        if (goalsObj && typeof goalsObj === 'object' && Array.isArray(goalsObj.goals)) {
          goalsFromColumn = goalsObj.goals;
        }
      }
    } catch { /* silent */ }
    
    // Load from library.goals (new format with {name, code})
    let goalsFromLibrary: any[] | null = null;
    try {
      if (row.library) {
        const libObj = typeof row.library === 'string' ? JSON.parse(row.library) : row.library;
        if (libObj && Array.isArray(libObj.goals)) {
          // Parse each goal's DSL code to get structured steps
          goalsFromLibrary = libObj.goals.map((g: any) => {
            const goalName = g?.name || '';
            const goalCode = g?.code || '';
            if (!goalCode.trim()) return { name: goalName, steps: [] };
            // Wrap in GOAL block and parse
            const codeLines = goalCode.split('\n').map((line: string) => line.trim() ? `  ${line}` : '').join('\n');
            const dslText = `GOAL: ${goalName}\n${codeLines}`;
            try {
              const parsed = parseDsl(dslText);
              console.debug('[loadScenarioContent] Parsed DSL for goal:', goalName, 'result:', parsed?.ok, 'steps:', parsed?.ast?.goals?.[0]?.steps?.length);
              if (parsed?.ok && parsed.ast?.goals?.length > 0) {
                const goal = parsed.ast.goals[0];
                console.debug('[loadScenarioContent] Goal steps:', goal.steps);
                return goal;
              }
            } catch (e) { console.error('[loadScenarioContent] Parse error:', e); }
            return { name: goalName, steps: [] };
          });
        }
      }
    } catch { /* silent */ }

    const toGoalObj = (g: any): any | null => {
      try {
        if (g && typeof g === 'object') return g;
        const nm = String(g || '').trim();
        if (!nm) return null;
        return { name: nm };
      } catch { return null; }
    };
    const pickArr = (a: any, b: any): any[] | undefined => {
      try {
        if (Array.isArray(a) && Array.isArray(b) && a.length && b.length) return a.length >= b.length ? a : b;
        if (Array.isArray(a) && a.length) return a;
        if (Array.isArray(b) && b.length) return b;
        if (Array.isArray(a)) return a;
        if (Array.isArray(b)) return b;
        return undefined;
      } catch { return undefined; }
    };
    const mergeGoal = (a: any, b: any): any | null => {
      const oa = toGoalObj(a);
      const ob = toGoalObj(b);
      if (!oa && !ob) return null;
      const out: any = {};
      if (ob) Object.assign(out, ob);
      if (oa) Object.assign(out, oa);
      const nm = String(oa?.name || (oa as any)?.goal || ob?.name || (ob as any)?.goal || '').trim();
      if (nm && !out.name) out.name = nm;
      const steps = pickArr(oa?.steps, ob?.steps);
      if (steps !== undefined) out.steps = steps;
      const tasks = pickArr(oa?.tasks, ob?.tasks);
      if (tasks !== undefined) out.tasks = tasks;
      const variables = pickArr(oa?.variables, ob?.variables);
      if (variables !== undefined) out.variables = variables;
      const conditions = pickArr(oa?.conditions, ob?.conditions);
      if (conditions !== undefined) out.conditions = conditions;
      return out;
    };

    // Prefer library.goals if it has step data (new format)
    const libGoals = Array.isArray(goalsFromLibrary) ? goalsFromLibrary : [];
    if (libGoals.length && hasAnyStepData(libGoals)) {
      unifiedDsl.log('SCENARIO_CONTENT', scenarioId, { goalsCount: libGoals.length, source: 'library' });
      return { goals: libGoals };
    }

    const colGoals = Array.isArray(goalsFromColumn) ? goalsFromColumn : [];
    const maxLen = Math.max(goalsFromContent.length, colGoals.length, libGoals.length);
    let goals: any[] = [];
    let source: string = 'merged';
    if (maxLen) {
      for (let i = 0; i < maxLen; i++) {
        // Merge from all sources, preferring library goals
        let g = mergeGoal(goalsFromContent[i], colGoals[i]);
        if (libGoals[i]) g = mergeGoal(g, libGoals[i]);
        if (g) goals.push(g);
      }
    }

    const dslText = String(row.dsl || '').trim();
    const needsDsl = Boolean(dslText) && (!goals.length || goals.some(g => !hasStepData(g)));
    if (needsDsl) {
      try {
        const parsed = parseDsl(dslText);
        const parsedGoals = Array.isArray(parsed?.ast?.goals) ? parsed.ast.goals : [];
        if (parsedGoals.length) {
          if (!goals.length) {
            goals = parsedGoals;
            source = 'dsl';
          } else {
            const canon = (x: any): string => {
              try { return String(x || '').trim().replace(/\s+/g, ' ').toLowerCase(); } catch { return ''; }
            };
            const q = new Map<string, any[]>();
            for (const pg of parsedGoals) {
              const k = canon(pg?.name);
              if (!k) continue;
              if (!q.has(k)) q.set(k, []);
              q.get(k)!.push(pg);
            }
            const merged = goals.map((g: any, idx: number) => {
              const out = (g && typeof g === 'object') ? { ...g } : { name: String(g || '') };
              const baseName = String(out?.name || (out as any)?.goal || '').trim();
              const key = canon(baseName);
              let pick: any = null;
              if (key && q.has(key) && (q.get(key) || []).length) pick = q.get(key)!.shift();
              if (!pick && idx < parsedGoals.length) pick = parsedGoals[idx];
              if (!out.name && pick?.name) out.name = String(pick.name || '').trim();
              const fill = (k: string) => {
                if ((!Array.isArray((out as any)[k]) || (out as any)[k].length === 0) && Array.isArray(pick?.[k]) && pick[k].length) {
                  (out as any)[k] = pick[k];
                }
              };
              fill('steps');
              fill('tasks');
              fill('variables');
              fill('conditions');
              return out;
            });
            if (!hasAnyStepData(merged) && hasAnyStepData(parsedGoals)) {
              goals = parsedGoals;
              source = 'dsl';
            } else {
              goals = merged;
              source = 'merged+dsl';
            }
          }
        }
      } catch { /* silent */ }
    }

    unifiedDsl.log('SCENARIO_CONTENT', scenarioId, { goalsCount: goals.length, source });
    return { goals };
  } catch (e: any) {
    unifiedDsl.log('SCENARIO_ERROR', scenarioId, { error: e?.message || 'load failed' });
    return null;
  }
}
