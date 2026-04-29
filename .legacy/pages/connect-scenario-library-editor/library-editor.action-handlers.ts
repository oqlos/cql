// frontend/src/pages/connect-scenario-library-editor/library-editor.action-handlers.ts
// Extracted action handlers for bindLibraryEditorEvents - reduces CC from 112

import { notifyBottomLine } from '../../modules/shared/generic-grid/utils';
import type { LibraryEditorEventContext } from './library-editor.events';

export type ActionHandler = (
  target: HTMLElement,
  ctx: LibraryEditorEventContext
) => void;

/** Registry of all action handlers for the library editor */
export const actionHandlers: Record<string, ActionHandler> = {
  'add-object': (_t, ctx) => ctx.addItem('objects'),
  'add-function': (_t, ctx) => ctx.addItem('functions'),
  'add-param': (_t, ctx) => ctx.addItem('params'),
  'add-unit': (_t, ctx) => ctx.addItem('units'),
  'add-action': (_t, ctx) => ctx.addItem('actions'),
  'add-log': (_t, ctx) => ctx.addItem('logs'),
  'add-alarm': (_t, ctx) => ctx.addItem('alarms'),
  'add-error': (_t, ctx) => ctx.addItem('errors'),
  'add-func': (_t, ctx) => ctx.addFunc(),
  'add-goal': (_t, ctx) => ctx.addGoal(),
  'add-opt-default': (_t, ctx) => ctx.addOptDefault(),
  'add-default': (_t, ctx) => ctx.addDefault(),
  'scan-defaults': (_t, ctx) => ctx.scanDefaultsFromDsl(),
  'export-dsl-file': (_t, ctx) => ctx.exportDslToFile(),
  'copy-dsl-all': (_t, ctx) => ctx.copyAllDsl(),
  'sync-goals-config': (_t, ctx) => ctx.syncGoalsConfigFromDsl(),

  'delete-default': (t, ctx) => {
    const item = t.closest('.def-default-item') as HTMLElement;
    if (item) ctx.deleteDefault(Number.parseInt(item.dataset.index!, 10));
  },

  'edit-item': (t, ctx) => {
    const item = t.closest('.def-item') as HTMLElement;
    if (item) ctx.editItem(item.dataset.type!, parseInt(item.dataset.index!, 10));
  },

  'delete-item': (t, ctx) => {
    const item = t.closest('.def-item') as HTMLElement;
    if (item) ctx.deleteItem(item.dataset.type!, parseInt(item.dataset.index!, 10));
  },

  'delete-func': (t, ctx) => {
    const item = t.closest('.def-func-item') as HTMLElement;
    if (item) ctx.deleteFunc(parseInt(item.dataset.index!, 10));
  },

  'delete-goal': (t, ctx) => {
    const item = t.closest('.def-goal-item') as HTMLElement;
    if (item) ctx.deleteGoal(parseInt(item.dataset.index!, 10));
  },

  'convert-goal-to-func': (t, ctx) => {
    const item = t.closest('.def-goal-item') as HTMLElement;
    if (item) ctx.convertGoalToFunc(parseInt(item.dataset.index!, 10));
  },

  'convert-func-to-goal': (t, ctx) => {
    const item = t.closest('.def-func-item') as HTMLElement;
    if (item) ctx.convertFuncToGoal(parseInt(item.dataset.index!, 10));
  },

  'add-func-to-goal': (t, ctx) => {
    const item = t.closest('.def-goal-item') as HTMLElement;
    if (item) ctx.showFuncSelectionModal(parseInt(item.dataset.index!, 10));
  },

  'select-func-for-goal': (t, ctx) => {
    const funcItem = t.closest('.func-selection-item') as HTMLElement;
    if (funcItem) {
      const funcIndex = parseInt(funcItem.dataset.funcIndex!, 10);
      const goalIndex = parseInt(funcItem.dataset.goalIndex!, 10);
      ctx.addFuncToGoal(goalIndex, funcIndex);
    }
  },

  'move-goal-up': (t, ctx) => {
    const item = t.closest('.def-goal-item') as HTMLElement;
    if (item) ctx.moveGoal(parseInt(item.dataset.index!, 10), -1);
  },

  'move-goal-down': (t, ctx) => {
    const item = t.closest('.def-goal-item') as HTMLElement;
    if (item) ctx.moveGoal(parseInt(item.dataset.index!, 10), 1);
  },

  'edit-opt-default': (t, ctx) => {
    const item = t.closest('.def-item') as HTMLElement;
    if (item) ctx.editOptDefault(item.dataset.name!);
  },

  'delete-opt-default': (t, ctx) => {
    const item = t.closest('.def-item') as HTMLElement;
    if (item) ctx.deleteOptDefault(item.dataset.name!);
  },

  'add-of-mapping': (t, ctx) => {
    const obj = t.dataset.object;
    if (obj) ctx.addObjectFunctionMapping(obj);
  },

  'remove-of-mapping': (t, ctx) => {
    const row = t.closest('.mapping-row') as HTMLElement;
    const tag = t.closest('.mapping-tag') as HTMLElement;
    if (row && tag) ctx.removeObjectFunctionMapping(row.dataset.object!, tag.dataset.fn!);
  },

  'add-pu-mapping': (t, ctx) => {
    const param = t.dataset.param;
    if (param) ctx.addParamUnitMapping(param);
  },

  'remove-pu-mapping': (t, ctx) => {
    const row = t.closest('.mapping-row') as HTMLElement;
    const tag = t.closest('.mapping-tag') as HTMLElement;
    if (row && tag) ctx.removeParamUnitMapping(row.dataset.param!, tag.dataset.unit!);
  },

  'edit-goal-opt': (t, ctx) => {
    const optItem = t.closest('.goal-opt-item') as HTMLElement;
    if (optItem) {
      const goalName = optItem.dataset.goalName || '';
      const optName = optItem.dataset.optName || '';
      ctx.editGoalConfigOpt(goalName, optName);
    }
  },

  'toggle-goal-config': (t, ctx) => {
    const section = t.closest('.goal-config-section') as HTMLElement;
    if (section) {
      const idx = Number.parseInt(section.dataset.goalIndex || '0', 10);
      ctx.toggleGoalConfigEnabled(idx);
    }
  },

  'goal-config-up': (t, ctx) => {
    const section = t.closest('.goal-config-section') as HTMLElement;
    if (section) {
      const idx = Number.parseInt(section.dataset.goalIndex || '0', 10);
      ctx.moveGoalConfig(idx, -1);
    }
  },

  'goal-config-down': (t, ctx) => {
    const section = t.closest('.goal-config-section') as HTMLElement;
    if (section) {
      const idx = Number.parseInt(section.dataset.goalIndex || '0', 10);
      ctx.moveGoalConfig(idx, 1);
    }
  },

  'close-modal': (_t, ctx) => {
    const modal = document.getElementById('def-code-modal');
    if ((modal as any)?._mode === 'func-selection') {
      ctx.restoreCodeModal();
    }
    modal?.classList.add('hidden');
  },

  'copy-code': (_t, _ctx) => {
    const code = document.getElementById('def-code-preview')?.textContent || '';
    navigator.clipboard.writeText(code).then(() => {
      notifyBottomLine('📋 Skopiowano kod DEF', 'success', 2000);
    });
  },

  'source-validate': (_t, ctx) => {
    const editor = document.getElementById('def-source-editor') as HTMLTextAreaElement;
    const src = (editor?.value || '').trim();
    if (!src) { notifyBottomLine('❌ Brak kodu do walidacji', 'error', 2500); return; }

    const validation = ctx.validateLibraryJson(src);
    if (validation.valid) {
      notifyBottomLine(`✅ Walidacja OK: ${validation.goals} celów, ${validation.funcs} procedur`, 'success', 3000);
    } else {
      notifyBottomLine(`❌ Błędy walidacji: ${validation.errors.slice(0, 2).join('; ')}`, 'error', 5000);
    }
    ctx.showValidationResults(validation);
  },

  'source-apply': (_t, ctx) => {
    const editor = document.getElementById('def-source-editor') as HTMLTextAreaElement;
    const src = (editor?.value || '').trim();
    if (!src) { notifyBottomLine('❌ Brak kodu do zastosowania', 'error', 2500); return; }
    try {
      ctx.parseDefFromCode(src);
      ctx.renderAll();
      ctx.scheduleAutosave();
      notifyBottomLine('✅ Zastosowano zmiany z kodu', 'success', 2000);
    } catch (err: any) {
      notifyBottomLine(`❌ Błąd parsowania: ${String(err?.message || err)}`, 'error', 3500);
    }
  },
};

/** Get action handler by name */
export function getActionHandler(action: string): ActionHandler | undefined {
  return actionHandlers[action];
}
