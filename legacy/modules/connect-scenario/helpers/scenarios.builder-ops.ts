// scenarios.builder-ops.ts
// Extracted from connect-scenario-scenarios.page.ts — DOM builder operations for GOALs, TASKs, CONDITIONs

import { ScenariosService } from './scenarios.service';
import { escapeHtml, notifyBottomLine } from '../../shared/generic-grid/utils';
import { blockRenderers, renderGoalActionsButtons } from '../../../components/dsl-editor';
import { promptText, showInfoDialog } from './scenario-dialogs';

export interface BuilderOpsContext {
  dispatch: (cmd: any) => void;
  renderGoalSelect: (selected?: string) => string;
  libraryLoad: (dataset: 'objects' | 'functions' | 'params' | 'units' | 'results' | 'operators') => string[];
  initializeDragAndDrop: () => void;
  refreshBuilderOptions: () => void;
  updatePreview: () => void;
  renumberTaskLabels: (goalSection: HTMLElement) => void;
  getCurrentFuncSrc: () => string;
  setCurrentFuncSrc: (src: string) => void;
}

export function addNewGoal(ctx: BuilderOpsContext): void {
  const goalsContainer = document.getElementById('goals-container');
  if (!goalsContainer) return;

  const goalId = `goal${Date.now()}`;
  const newGoal = document.createElement('div');
  newGoal.className = 'goal-section';
  newGoal.dataset.goalId = goalId;

  newGoal.innerHTML = `
    <div class="goal-header">
      <span class="goal-label rounded-4">GOAL</span>
      ${ctx.renderGoalSelect()}
      <button class="btn btn-secondary btn-move-up" data-action="goal-up">⬆️</button>
      <button class="btn btn-secondary btn-move-down" data-action="goal-down">⬇️</button>
      <button class="btn btn-secondary btn-clone" data-action="clone-goal">⧉</button>
      <button class="btn btn-danger btn-delete" data-action="delete-goal">🗑️</button>
    </div>
    <div class="steps-container"></div>
    <div class="goal-actions">
      ${renderGoalActionsButtons({ includeRun: true })}
    </div>
  `;

  goalsContainer.appendChild(newGoal);
  try {
    const scenarioId = (ScenariosService.getCurrentScenarioId && ScenariosService.getCurrentScenarioId()) || undefined;
    const select = newGoal.querySelector('.goal-select') as HTMLSelectElement | null;
    const goalName = (select?.value || 'Wytworzyć podciśnienie');
    ctx.dispatch({ type: 'AddGoal', scenarioId, goalId, name: goalName });
  } catch {
    // Non-blocking: GOAL can still be rendered locally if projection dispatch fails.
  }
  ctx.updatePreview();
}

export function addNewTask(ctx: BuilderOpsContext, goalSection: HTMLElement, insertAfter?: HTMLElement): void {
  const stepsContainer = goalSection.querySelector('.steps-container');
  if (!stepsContainer) return;

  const taskId = `task${Date.now()}`;
  const actionOptions = ctx.libraryLoad('functions');
  const objectOptions = ctx.libraryLoad('objects');
  const taskHtml = blockRenderers.renderTaskActionBlock(
    { action: actionOptions[0] || 'Włącz', object: objectOptions[0] || 'zawór 1' },
    taskId,
    actionOptions,
    objectOptions,
  );

  const wrapper = document.createElement('div');
  wrapper.innerHTML = taskHtml;
  const newTask = wrapper.firstElementChild as HTMLElement;
  if (!newTask) return;

  if (insertAfter && insertAfter.parentElement === stepsContainer) {
    stepsContainer.insertBefore(newTask, insertAfter.nextSibling);
  } else {
    stepsContainer.appendChild(newTask);
  }
  ctx.initializeDragAndDrop();
  try {
    const scenarioId = (ScenariosService.getCurrentScenarioId && ScenariosService.getCurrentScenarioId()) || undefined;
    const goalId = (goalSection as HTMLElement).dataset.goalId || '';
    const funcSel = newTask.querySelector('.task-action-select') as HTMLSelectElement | null;
    const objSel = newTask.querySelector('.task-object-select') as HTMLSelectElement | null;
    const func = funcSel?.value;
    const object = objSel?.value;
    ctx.dispatch({ type: 'AddTask', scenarioId, goalId, taskId, func, object });
  } catch {
    // Non-blocking: action block can remain editable even if projection dispatch fails.
  }
  ctx.updatePreview();
  ctx.refreshBuilderOptions();
}

export function addNewCondition(ctx: BuilderOpsContext, goalSection: HTMLElement, insertAfter?: HTMLElement, connector?: 'AND' | 'OR'): void {
  const stepsContainer = goalSection.querySelector('.steps-container');
  if (!stepsContainer) return;

  const newCondition = document.createElement('div');
  newCondition.className = 'condition-group';
  newCondition.dataset.conditionType = 'if';
  if (connector) newCondition.dataset.connector = connector;
  const incoming = insertAfter ? String((insertAfter as HTMLElement).dataset.connector || '').toUpperCase() : '';
  if (incoming) newCondition.dataset.incoming = incoming;

  const pOpts = ctx.libraryLoad('params');
  const opOpts = ctx.libraryLoad('operators');
  const varParams = Array.from(goalSection.querySelectorAll<HTMLSelectElement>('.variable-container .var-row .param-select'))
    .map(sel => (sel?.value || '').trim())
    .filter(Boolean);
  const vOpts = ['*', ...Array.from(new Set(varParams))];
  const buildSel = (cls: string, opts: string[], defaultVal?: string) => {
    const list = opts.length ? opts : ['*'];
    return `<select class="${cls} rounded-4">${list.map(o => `<option${o === defaultVal ? ' selected' : ''}>${escapeHtml(o)}</option>`).join('')}</select>`;
  };
  const labelPrefix = (incoming === 'AND' || incoming === 'OR') ? `${incoming} ` : '';
  newCondition.innerHTML = `
    <div class="condition-header">
      <span class="condition-label" style="background: linear-gradient(135deg, #ffc107, #ff9800); color: #000000; padding: 4px 10px; font-weight: 700; border-radius: 4px;">${labelPrefix}IF</span>
      <button class="btn btn-secondary btn-move-up" data-action="condition-up">⬆️</button>
      <button class="btn btn-secondary btn-move-down" data-action="condition-down">⬇️</button>
      <button class="btn btn-secondary btn-clone" data-action="clone-condition">⧉</button>
      <button class="btn-delete-small" data-action="delete-condition">✕</button>
    </div>
    <div class="condition-builder d-flex flex-wrap items-center gap-sm">
      ${buildSel('param-select', pOpts)}
      ${buildSel('operator-select', opOpts)}
      ${buildSel('variable-select', vOpts)}
      <button class="btn btn-outline-primary btn-add-condition-and">+ AND</button>
      <button class="btn btn-outline-primary btn-add-condition-or">+ OR</button>
    </div>
  `;

  if (insertAfter && insertAfter.parentElement === stepsContainer) {
    stepsContainer.insertBefore(newCondition, insertAfter.nextSibling);
  } else {
    stepsContainer.appendChild(newCondition);
  }
  ctx.initializeDragAndDrop();
  ctx.updatePreview();
  ctx.refreshBuilderOptions();
}

function syncFuncEditorSource(source: string): void {
  const ta = document.getElementById('scenario-func-editor') as HTMLTextAreaElement | null;
  if (!ta) return;
  ta.value = source;
  try { ta.dispatchEvent(new Event('input', { bubbles: true })); } catch { /* silent */ }
}

async function ensureFuncExists(ctx: BuilderOpsContext): Promise<string[]> {
  const scenarioId = ScenariosService.getCurrentScenarioId?.() || '';
  const suggestedName = 'Nowa procedura';
  const createdName = (await promptText(
    'Brak zdefiniowanych FUNC. Podaj nazwę nowej procedury, aby dodać ją automatycznie do scenariusza.',
    suggestedName,
    { title: 'Utwórz FUNC' },
  ) || '').trim();

  if (!createdName) {
    await showInfoDialog('Nie dodano nowej procedury FUNC.', 'Brak FUNC');
    return [];
  }

  const template = `FUNC: ${createdName}\n  LOG [Procedura wykonana]\n`;
  const current = String(ctx.getCurrentFuncSrc() || '').trim();
  const nextFuncSrc = current ? `${current}\n\n${template}` : template;

  ctx.setCurrentFuncSrc(nextFuncSrc);
  syncFuncEditorSource(nextFuncSrc);
  try {
    if (scenarioId) {
      await ScenariosService.updateScenario(scenarioId, { func: nextFuncSrc });
    }
  } catch {
    // Non-blocking: keep the newly created FUNC available locally even if save fails.
  }

  try { ctx.refreshBuilderOptions(); } catch { /* silent */ }
  try { ctx.updatePreview(); } catch { /* silent */ }
  notifyBottomLine(`✅ Dodano FUNC: ${createdName}`, 'success', 2500);
  return [createdName];
}

export async function addFuncCall(ctx: BuilderOpsContext, goalSection: HTMLElement): Promise<void> {
  const stepsContainer = goalSection.querySelector('.steps-container');
  if (!stepsContainer) return;

  let availableFuncs = await getAvailableFuncsAsync(ctx);

  if (availableFuncs.length === 0) {
    availableFuncs = await ensureFuncExists(ctx);
    if (availableFuncs.length === 0) return;
  }

  const stepId = `func-call-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const funcCallHtml = blockRenderers.renderFuncCallBlock(availableFuncs[0], availableFuncs, [], stepId);

  const wrapper = document.createElement('div');
  wrapper.innerHTML = funcCallHtml;
  const funcCallEl = wrapper.firstElementChild as HTMLElement;

  stepsContainer.appendChild(funcCallEl);
  ctx.initializeDragAndDrop();
  ctx.updatePreview();
}

export async function getAvailableFuncsAsync(ctx: BuilderOpsContext): Promise<string[]> {
  const funcSrc = ctx.getCurrentFuncSrc();
  if (funcSrc) {
    const matches = funcSrc.match(/^\s*FUNC:\s*(.+)$/gim) || [];
    const funcs = matches.map((m: string) => m.replace(/^\s*FUNC:\s*/i, '').trim()).filter(Boolean);
    if (funcs.length > 0) return funcs;
  }

  try {
    const scenarioId = ScenariosService.getCurrentScenarioId?.() || '';
    if (scenarioId) {
      const row = await ScenariosService.fetchScenarioById(scenarioId);
      const fSrc = (row as any)?.func || (row?.content as any)?.func || '';
      if (fSrc) {
        ctx.setCurrentFuncSrc(fSrc);
        syncFuncEditorSource(fSrc);
        const matches = fSrc.match(/^\s*FUNC:\s*(.+)$/gim) || [];
        return matches.map((m: string) => m.replace(/^\s*FUNC:\s*/i, '').trim()).filter(Boolean);
      }
    }
  } catch {
    // Non-blocking: fall back to global FUNC registry when scenario fetch fails.
  }

  try {
    const { getGlobalFuncLibrary } = await import('../../../components/dsl');
    const lib = getGlobalFuncLibrary();
    if (lib && Object.keys(lib).length > 0) {
      return Object.keys(lib);
    }
  } catch {
    // Non-blocking: returning empty FUNC list is acceptable when registry lookup fails.
  }

  return [];
}

export function cloneGoal(ctx: BuilderOpsContext, goalSection: HTMLElement): void {
  const container = document.getElementById('goals-container');
  if (!container) return;
  const clone = goalSection.cloneNode(true) as HTMLElement;
  const newId = `goal-${Date.now()}`;
  clone.dataset.goalId = newId;
  container.insertBefore(clone, goalSection.nextSibling);
  ctx.initializeDragAndDrop();
  ctx.refreshBuilderOptions();
  ctx.updatePreview();
  notifyBottomLine('📄 Sklonowano GOAL', 'info', 3000);
}

export function cloneTask(ctx: BuilderOpsContext, taskContainer: HTMLElement): void {
  const goalSection = taskContainer.closest('.goal-section') as HTMLElement | null;
  const stepsContainer = goalSection?.querySelector('.steps-container') as HTMLElement | null;
  if (!goalSection || !stepsContainer) return;
  const clone = taskContainer.cloneNode(true) as HTMLElement;
  clone.dataset.taskId = `task${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  stepsContainer.insertBefore(clone, taskContainer.nextSibling);
  ctx.initializeDragAndDrop();
  ctx.renumberTaskLabels(goalSection);
  try {
    const scenarioId = (ScenariosService.getCurrentScenarioId && ScenariosService.getCurrentScenarioId()) || undefined;
    const goalId = goalSection.dataset.goalId || '';
    const funcSel = clone.querySelector('.function-select') as HTMLSelectElement | null;
    const objSel = clone.querySelector('.object-select') as HTMLSelectElement | null;
    const func = funcSel?.value;
    const object = objSel?.value;
    if (goalId && clone.dataset.taskId) {
      ctx.dispatch({ type: 'AddTask', scenarioId, goalId, taskId: clone.dataset.taskId, func, object });
    }
  } catch {
    // Non-blocking: cloned task remains in DOM even if projection dispatch fails.
  }
  ctx.updatePreview();
  ctx.refreshBuilderOptions();
}

export function cloneCondition(ctx: BuilderOpsContext, conditionEl: HTMLElement): void {
  const goalSection = conditionEl.closest('.goal-section') as HTMLElement | null;
  const stepsContainer = goalSection?.querySelector('.steps-container') as HTMLElement | null;
  if (!goalSection || !stepsContainer) return;
  const clone = conditionEl.cloneNode(true) as HTMLElement;
  clone.dataset.conditionType = (conditionEl as HTMLElement).dataset.conditionType || 'if';
  stepsContainer.insertBefore(clone, conditionEl.nextSibling);
  ctx.initializeDragAndDrop();
  ctx.updatePreview();
  ctx.refreshBuilderOptions();
}
