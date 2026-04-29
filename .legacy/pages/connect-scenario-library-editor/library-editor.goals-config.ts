// frontend/src/pages/connect-scenario-library-editor/library-editor.goals-config.ts
// Extracted from library-editor.page.ts — goals config management logic

import { notifyBottomLine } from '../../modules/shared/generic-grid/utils';
import * as LibraryRender from '../../modules/connect-scenario/helpers/def-editor.render';
import { promptText } from '../../modules/connect-scenario/helpers/scenario-dialogs';
import { ScenariosService } from '../../modules/connect-scenario/helpers/scenarios.service';
import { autoSyncFromDsl as autoSyncFromDslFn } from './library-editor.data-loader';
import type { DefData } from '../../modules/connect-scenario/helpers/def-editor.render';

export interface GoalsConfigContext {
  defData: DefData;
  currentScenarioId: string;
  scheduleAutosave: () => void;
}

export function toggleGoalConfigEnabled(idx: number, ctx: GoalsConfigContext): void {
  const goals = ctx.defData.goalsConfig;
  if (!goals || idx < 0 || idx >= goals.length) return;
  goals[idx].enabled = !goals[idx].enabled;
  LibraryRender.renderGoalsConfig(goals);
  ctx.scheduleAutosave();
}

export function moveGoalConfig(idx: number, direction: -1 | 1, ctx: GoalsConfigContext): void {
  const goals = ctx.defData.goalsConfig;
  if (!goals) return;
  const newIdx = idx + direction;
  if (newIdx < 0 || newIdx >= goals.length) return;
  [goals[idx], goals[newIdx]] = [goals[newIdx], goals[idx]];
  goals[idx].order = idx;
  goals[newIdx].order = newIdx;
  LibraryRender.renderGoalsConfig(goals);
  ctx.scheduleAutosave();
}

export async function editGoalConfigOpt(goalName: string, optName: string, ctx: GoalsConfigContext): Promise<void> {
  const goals = ctx.defData.goalsConfig || [];
  const goal = goals.find(g => g.name === goalName);
  if (!goal) return;
  const opt = goal.opts.find((o: any) => o.name === optName);
  if (!opt) return;
  const newValue = await promptText(`Wartość dla [${optName}] w "${goalName}":`, opt.value, { title: 'Edytuj konfigurację GOAL' });
  if (newValue !== null) {
    opt.value = newValue;
    LibraryRender.renderGoalsConfig(goals);
    ctx.scheduleAutosave();
  }
}

export function renderGoalsConfig(ctx: GoalsConfigContext): void {
  LibraryRender.renderGoalsConfig(ctx.defData.goalsConfig || []);
}

export async function syncGoalsConfigFromDsl(ctx: GoalsConfigContext): Promise<void> {
  try {
    if (!ctx.currentScenarioId) {
      notifyBottomLine('❌ Wybierz scenariusz', 'error', 2000);
      return;
    }
    const scenario = await ScenariosService.fetchScenarioById(ctx.currentScenarioId);
    const dsl = scenario?.dsl || '';
    if (!dsl) {
      notifyBottomLine('❌ Brak DSL w scenariuszu', 'error', 2000);
      return;
    }
    autoSyncFromDslFn(ctx.defData, dsl);
    LibraryRender.renderGoalsConfig(ctx.defData.goalsConfig || []);
    ctx.scheduleAutosave();
    const count = ctx.defData.goalsConfig?.length || 0;
    notifyBottomLine(`✅ Zsynchronizowano ${count} czynności GOAL`, 'success', 2000);
  } catch {
    notifyBottomLine('❌ Błąd synchronizacji', 'error', 2000);
  }
}
