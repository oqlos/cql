// frontend/src/modules/connect-scenario/helpers/scenarios.save.ts
// Extracted from connect-scenario-scenarios.page.ts — save and clone scenario logic
import { logger } from '../../../utils/logger';
import { notifyBottomLine } from '../../shared/generic-grid/utils';
import { ScenariosService } from './scenarios.service';
import { ScenariosLibrary } from './scenarios.library';
import { getScenarioCQRS } from '../cqrs/singleton';
import { collectGoalsFromDOM, collectFuncsFromDOM, scenarioToDsl, funcsToDsl } from './scenarios.serializer';
import { createExecContextFromDef } from '../../../components/dsl';

export interface SaveContext {
  setLastScenarioName(name: string): void;
  setCurrentExecCtx(ctx: any): void;
  writeScenarioIdToUrl(id: string): void;
  ensureGoalsInActivities(): void;
  refreshBuilderOptions(): void;
  dispatch(cmd: any): void;
  renderScenarioList(filter: string): Promise<void>;
  loadScenarioById(id: string): Promise<void>;
}

function extractGoalsWithCode(dsl: string): Array<{ name: string; code: string }> {
  const goals: Array<{ name: string; code: string }> = [];
  const lines = String(dsl || '').split('\n');
  let currentGoal: { name: string; codeLines: string[] } | null = null;

  for (const line of lines) {
    const goalMatch = line.match(/^\s*GOAL:\s*(.+)$/i);
    if (goalMatch) {
      if (currentGoal) {
        goals.push({ name: currentGoal.name, code: currentGoal.codeLines.join('\n') });
      }
      currentGoal = { name: goalMatch[1].trim(), codeLines: [] };
      continue;
    }

    if (line.match(/^\s*SCENARIO:/i)) continue;

    if (currentGoal && line.trim()) {
      currentGoal.codeLines.push(line.startsWith('  ') ? line.slice(2) : line);
    }
  }

  if (currentGoal) {
    goals.push({ name: currentGoal.name, code: currentGoal.codeLines.join('\n') });
  }

  return goals;
}

export async function saveScenario(ctx: SaveContext): Promise<void> {
  const scenarioName = ((document.getElementById('scenario-name') as HTMLInputElement)?.value || '').trim();
  if (!scenarioName) { notifyBottomLine('❌ Podaj nazwę scenariusza!', 'error', 3000); return; }

  const goalsArr = collectGoalsFromDOM();
  const funcsArr = collectFuncsFromDOM();
  const fullDsl = scenarioToDsl(scenarioName, goalsArr);
  const dslBody = fullDsl.startsWith('SCENARIO:') ? fullDsl.split('\n').slice(2).join('\n') : fullDsl;
  const funcEditorValue = ((document.getElementById('scenario-func-editor') as HTMLTextAreaElement | null)?.value || '').trim();
  const funcDsl = funcsToDsl(funcsArr) || funcEditorValue;
  const defText = (document.getElementById('scenario-def-editor') as HTMLTextAreaElement | null)?.value || '';
  const scenarioData = {
    name: scenarioName, goals: goalsArr, funcs: funcsArr,
    dsl: dslBody, func: funcDsl, def: defText, timestamp: new Date().toISOString()
  };

  logger.debug('Saving scenario:', scenarioData);

  let scenarioId = ScenariosService.getCurrentScenarioId() || '';
  if (!scenarioId) {
    try { scenarioId = await ScenariosService.createScenario(scenarioName); } catch {
      // Non-blocking: error is surfaced below when scenarioId remains empty.
    }
    if (!scenarioId) { notifyBottomLine('❌ Nie udało się utworzyć scenariusza w bazie', 'error', 3000); return; }
    ScenariosService.setCurrentScenarioId(scenarioId);
    ctx.writeScenarioIdToUrl(scenarioId);
  } else {
    ctx.writeScenarioIdToUrl(scenarioId);
  }

  try { ctx.ensureGoalsInActivities(); } catch {
    // Non-blocking: saving scenario should proceed even if activity sync fails.
  }

  try { ctx.dispatch({ type: 'SaveScenario', scenarioId, data: scenarioData }); } catch {
    // Non-blocking: DB persistence below remains the source of truth.
  }

  try {
    const librarySnapshot = {
      ...ScenariosLibrary.snapshot(),
      goals: extractGoalsWithCode(fullDsl),
    };
    await ScenariosService.updateScenario(scenarioId, {
      title: scenarioName,
      goals: goalsArr,
      dsl: dslBody,
      func: funcDsl,
      def: defText,
      library: JSON.stringify(librarySnapshot)
    });
    try {
      const cqrs = getScenarioCQRS();
      cqrs?.dispatch({ type: 'UpdateScenarioContent', scenarioId, content: scenarioData });
      if (defText) cqrs?.dispatch({ type: 'UpdateScenarioDEF', scenarioId, def: defText });
    } catch {
      // Non-blocking: local projection failure should not invalidate persisted scenario.
    }
  } catch {
    // Non-blocking: save notification flow continues even when persistence throws.
  }

  try {
    if (defText && typeof defText === 'string') {
      try { ctx.setCurrentExecCtx(createExecContextFromDef(defText)); } catch {
        // Non-blocking: keep previous exec context when DEF parsing fails.
      }
      const badge = document.getElementById('def-source-badge') as HTMLElement | null;
      if (badge) badge.textContent = 'Źródło: DEF';
      ctx.refreshBuilderOptions();
    }
  } catch {
    // Non-blocking: DEF UI refresh errors should not cancel successful save.
  }

  notifyBottomLine('✅ Scenariusz został zapisany!', 'success', 3000);
  ctx.setLastScenarioName(scenarioName);
}

export async function cloneScenario(ctx: SaveContext): Promise<void> {
  const nameInput = document.getElementById('scenario-name') as HTMLInputElement | null;
  const oldName = ((nameInput?.value || '').trim()) || 'Bez nazwy';
  const newName = `${oldName} (clone)`;
  const goals = collectGoalsFromDOM();
  const funcs = collectFuncsFromDOM();
  const fullDsl = scenarioToDsl(newName, goals);
  const dslBody = fullDsl.startsWith('SCENARIO:') ? fullDsl.split('\n').slice(2).join('\n') : fullDsl;
  const funcDsl = funcsToDsl(funcs);

  let id = '';
  try {
    id = await ScenariosService.createScenario(newName);
  } catch {
    // Non-blocking: clone flow handles missing id with user-facing notification.
  }
  if (!id) { notifyBottomLine('❌ Nie udało się utworzyć klonu w bazie', 'error', 3000); return; }

  ScenariosService.setCurrentScenarioId(id);
  ctx.writeScenarioIdToUrl(id);

  try {
    const objCode = ScenariosLibrary.serializeAsClassJs();
    await ScenariosService.updateScenario(id, {
      title: newName,
      content: {
        name: newName,
        goals,
        funcs,
        dsl: dslBody,
        func: funcDsl,
        obj: objCode,
        timestamp: new Date().toISOString(),
      },
      func: funcDsl,
      goals,
    });
  } catch {
    try { await ScenariosService.deleteScenario(id); } catch { /* silent */ }
    notifyBottomLine('❌ Nie udało się zapisać klonu w bazie', 'error', 3000);
    return;
  }

  const filterVal = (document.getElementById('scenario-filter') as HTMLInputElement | null)?.value || '';
  await ctx.renderScenarioList(filterVal);
  await ctx.loadScenarioById(id);
  const input = document.getElementById('scenario-name') as HTMLInputElement | null;
  if (input) input.value = newName;
  ctx.setLastScenarioName(newName);
  notifyBottomLine('✅ Utworzono klon scenariusza', 'success', 3000);
}
