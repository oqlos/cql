import { mergeScenarioContent } from '../../shared/scenarios-api.helper';
import { ScenariosApiHelper } from '../../shared/scenarios-api.helper';
// frontend/src/modules/connect-scenario/cqrs/handlers.ts
import type { HandlerDefinitions } from '../../../core/cqrs/module-factory';
import type { ScenarioCommand, ScenarioEvent, ScenarioContent } from './types';

export const connectScenarioHandlers: HandlerDefinitions<ScenarioCommand, ScenarioEvent> = {
  // Pure in-frontend handlers with event sourcing via event store
  'AddGoal': async (cmd, emit) => {
    emit({ type: 'GoalAdded', payload: { scenarioId: cmd.scenarioId, goalId: cmd.goalId, name: cmd.name } });
  },

  'DeleteGoal': async (cmd, emit) => {
    emit({ type: 'GoalDeleted', payload: { scenarioId: cmd.scenarioId, goalId: cmd.goalId } });
  },

  'AddTask': async (cmd, emit) => {
    emit({ type: 'TaskAdded', payload: { scenarioId: cmd.scenarioId, goalId: cmd.goalId, taskId: cmd.taskId, func: cmd.func, object: cmd.object } });
  },

  'DeleteTask': async (cmd, emit) => {
    emit({ type: 'TaskDeleted', payload: { scenarioId: cmd.scenarioId, goalId: cmd.goalId, taskId: cmd.taskId } });
  },

  'ReorderGoals': async (cmd, emit) => {
    emit({ type: 'GoalsReordered', payload: { scenarioId: cmd.scenarioId, order: cmd.order } });
  },

  'ReorderTasks': async (cmd, emit) => {
    emit({ type: 'TasksReordered', payload: { scenarioId: cmd.scenarioId, goalId: cmd.goalId, order: cmd.order } });
  },

  'UpdateScenarioName': async (cmd, emit) => {
    emit({ type: 'ScenarioNameUpdated', payload: { scenarioId: cmd.scenarioId, name: cmd.name } });
  },

  'SaveScenario': async (cmd, emit) => {
    emit({ type: 'ScenarioSaved', payload: { scenarioId: cmd.scenarioId, data: cmd.data } });
  },

  // Projection-only updates (no I/O): keep read-model in sync after successful HTTP patches
  'UpdateScenarioDSL': async (cmd, emit) => {
    emit({ type: 'ScenarioDSLUpdated', payload: { scenarioId: String(cmd.scenarioId || ''), dsl: String(cmd.dsl || '') } });
  },

  'UpdateScenarioDEF': async (cmd, emit) => {
    emit({ type: 'ScenarioDEFUpdated', payload: { scenarioId: String(cmd.scenarioId || ''), def: String(cmd.def || '') } });
  },

  'UpdateScenarioContent': async (cmd, emit) => {
    emit({ type: 'ScenarioContentUpdated', payload: { scenarioId: String(cmd.scenarioId || ''), content: cmd.content } });
  },

  // ===== Loads from API =====
  'LoadScenarioById': async (cmd, emit) => {
    const id = String(cmd.id || '').trim();
    if (!id) return;
    emit({ type: 'ScenarioRequested', payload: { by: 'id', value: id } });
    try {
      const row = await ScenariosApiHelper.fetchScenarioById(id);
      if (!row) throw new Error('not_found');
      emit({ type: 'ScenarioLoaded', payload: normalizeScenarioRow(row) });
    } catch (err: unknown) {
      emit({ type: 'ScenarioLoadFailed', payload: { by: 'id', value: id, error: String(err instanceof Error ? err.message : err || '') } });
    }
  },

  'LoadScenarioByTitle': async (cmd, emit) => {
    const title = String(cmd.title || '').trim();
    if (!title) return;
    emit({ type: 'ScenarioRequested', payload: { by: 'title', value: title } });
    try {
      const rows = await ScenariosApiHelper.listScenarioRows(title);
      const lc = title.toLowerCase();
      const found = rows.find((r) => String((r as any)?.title || (r as any)?.name || '').toLowerCase() === lc)
        || rows.find((r) => String((r as any)?.title || (r as any)?.name || '').toLowerCase().startsWith(lc))
        || rows.find((r) => String((r as any)?.title || (r as any)?.name || '').toLowerCase().includes(lc));
      if (!found) throw new Error('not_found');
      emit({ type: 'ScenarioLoaded', payload: normalizeScenarioRow(found) });
    } catch (err: unknown) {
      emit({ type: 'ScenarioLoadFailed', payload: { by: 'title', value: title, error: String(err instanceof Error ? err.message : err || '') } });
    }
  },
};

function normalizeScenarioRow(row: Record<string, unknown>): { scenarioId: string; title: string; content?: ScenarioContent; dsl?: string; def?: string; obj?: string; map?: string; library?: string; config?: string } {
  const scenarioId = String(row?.id || row?.scenario_id || '');
  const title = String(row?.title || row?.name || '');
  const { content: contentObj } = mergeScenarioContent(row);
  const dsl = contentObj?.dsl;
  const def = contentObj?.def;
  const obj = contentObj?.obj;
  const map = contentObj?.map;
  const library = row?.library as string | undefined;
  const config = row?.config as string | undefined;
  return { scenarioId, title, content: contentObj as ScenarioContent | undefined, dsl, def, obj, map, library, config };
}
