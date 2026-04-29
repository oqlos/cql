import { unifiedDsl } from '../../../utils/unified-dsl';
import { parseDsl } from '../../../components/dsl';
import { ScenariosApiHelper } from '../../shared/scenarios-api.helper';

export type Row = { id: string; name: string };
export type ActivityRow = { id: string; name: string; stepCount: number };

/** Parse goals from JSON string or object */
const parseGoals = (raw: any): any[] => {
  if (!raw) return [];
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(parsed?.goals) ? parsed.goals : (Array.isArray(parsed) ? parsed : []);
  } catch {
    return [];
  }
};

/** Convert raw goal to Row */
const goalToRow = (g: any, idx: number): Row => ({
  id: String(g?.id || g?.goal_id || `goal-${idx + 1}`),
  name: String(g?.name || g?.goal || `Cel ${idx + 1}`)
});

export const getActivitiesForScenario = async (scenarioId: string): Promise<Row[]> => {
  const sid = scenarioId?.trim();
  if (!sid) return [];
  
  try {
    const row = await ScenariosApiHelper.fetchScenarioById(sid);
    if (!row) {
      unifiedDsl.log('ACTIVITIES_LOAD', sid, { found: false });
      return [];
    }
    
    // Try multiple columns in order of preference (check length, not truthiness)
    let goals = parseGoals((row as any).content?.goals || row.goals || row.content);
    let source = 'goals';
    // Try content.goals if content is an object with goals property
    if (!goals.length && row.content && typeof row.content === 'object' && Array.isArray(row.content.goals)) {
      goals = row.content.goals;
      source = 'content.goals';
    }
    // Try library column (may contain { goals: [...] })
    if (!goals.length) {
      goals = parseGoals(row.library);
      source = 'library';
    }
    // Try def column (may contain embedded goals)
    if (!goals.length) {
      goals = parseGoals(row.def);
      source = 'def';
    }
    // Fallback: parse DSL text if available
    if (!goals.length) {
      const dslText = String(row.dsl || row.content?.dsl || '').trim();
      if (dslText) {
        try {
          const parsed = parseDsl(dslText);
          if (parsed.ok && Array.isArray(parsed.ast?.goals)) {
            goals = parsed.ast.goals;
            source = 'dsl';
          }
        } catch { /* silent */ }
      }
    }
    unifiedDsl.log('ACTIVITIES_LOAD', sid, { found: true, goalsCount: goals.length, source });
    return goals.map(goalToRow);
  } catch (e) {
    unifiedDsl.log('ACTIVITIES_ERROR', sid, { error: (e as Error)?.message });
    return [];
  }
};

/** Count steps within a goal (tasks, steps, or any sub-items) */
const countStepsInGoal = (goal: any): number => {
  if (!goal) return 0;
  // Check for steps array
  if (Array.isArray(goal.steps)) return goal.steps.length;
  // Check for tasks array
  if (Array.isArray(goal.tasks)) {
    let count = 0;
    for (const task of goal.tasks) {
      if (Array.isArray(task.steps)) count += task.steps.length;
      else count += 1;
    }
    return count || goal.tasks.length;
  }
  return 0;
};

/** Get activities with step counts for a scenario */
export const getActivitiesWithStepCounts = async (scenarioId: string): Promise<{ goals: ActivityRow[]; totalSteps: number }> => {
  const sid = scenarioId?.trim();
  if (!sid) return { goals: [], totalSteps: 0 };
  
  try {
    const row = await ScenariosApiHelper.fetchScenarioById(sid);
    if (!row) return { goals: [], totalSteps: 0 };
    
    // Try multiple columns in order of preference (check length, not truthiness)
    let goals = parseGoals((row as any).content?.goals || row.goals || row.content);
    if (!goals.length && row.content?.goals) goals = row.content.goals;
    if (!goals.length) goals = parseGoals(row.library);
    if (!goals.length) goals = parseGoals(row.def);
    // Fallback: parse DSL text if available
    if (!goals.length) {
      const dslText = String(row.dsl || row.content?.dsl || '').trim();
      if (dslText) {
        try {
          const parsed = parseDsl(dslText);
          if (parsed.ok && Array.isArray(parsed.ast?.goals)) {
            goals = parsed.ast.goals;
          }
        } catch { /* silent */ }
      }
    }
    let totalSteps = 0;
    const result: ActivityRow[] = goals.map((g: any, idx: number) => {
      const stepCount = countStepsInGoal(g);
      totalSteps += stepCount;
      return {
        id: String(g?.id || g?.goal_id || `goal-${idx + 1}`),
        name: String(g?.name || g?.goal || `Cel ${idx + 1}`),
        stepCount
      };
    });
    unifiedDsl.log('ACTIVITIES_WITH_STEPS', sid, { goalsCount: result.length, totalSteps });
    return { goals: result, totalSteps };
  } catch (e) {
    unifiedDsl.log('ACTIVITIES_STEPS_ERROR', sid, { error: (e as Error)?.message });
    return { goals: [], totalSteps: 0 };
  }
};
