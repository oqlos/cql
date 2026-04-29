      // frontend/src/modules/connect-scenario/helpers/scenarios.events.ts

export type ScenariosUiAction =
  | 'NavigateLibraryEditor'
  | 'NavigateVariablesEditor'
  | 'NavigateActivitiesEditor'
  | 'NavigateIntervalsEditor'
  | 'NavigateObjectsEditor'
  | 'AddGoal'
  | 'AddTask'
  | 'AddTaskAfter'
  | 'AddVariable'
  | 'AddGet'
  | 'AddSet'
  | 'AddCondition'
  | 'AddConditionAfter'
  | 'AddElse'
  | 'AddEnd'
  | 'AddRepeat'
  | 'AddFuncCall'
  | 'AddOut'
  | 'AddDialog'
  | 'AddInfo'
  | 'CloneGoal'
  | 'CloneTask'
  | 'CloneVariable'
  | 'CloneCondition'
  | 'CloneStep'
  | 'SaveScenario'
  | 'ExportScenario'
  | 'LoadExample'
  | 'DeleteGoal'
  | 'CloneScenario'
  | 'DeleteVariable'
  | 'DeleteCondition'
  | 'DeleteStep'
  | 'CopyPreview'
  | 'ValidateDsl'
  | 'RunDsl'
  | 'AutoFixDsl'
  | 'ApplyDslFix'
  | 'RunGoal'
  | 'DeleteTask'
  | 'GoalUp'
  | 'GoalDown'
  | 'TaskUp'
  | 'TaskDown'
  | 'VariableUp'
  | 'VariableDown'
  | 'ConditionUp'
  | 'ConditionDown'
  | 'StepUp'
  | 'StepDown'
  | 'AddAndRow'
  | 'DeleteAndRow'
  | 'AddVarRow'
  | 'DeleteVarRow'
  | 'DefValidate'
  | 'DefImport'
  | 'DefReload'
  | 'DefSave'
  | 'DefVisualEditor'
  | 'DslVisualEditor'
  | 'MapValidate'
  | 'MapReload'
  | 'MapSave'
  | 'MapVisualEditor'
  | 'FuncValidate'
  | 'FuncAddTemplate'
  | 'FuncSave'
  | 'FuncVisualEditor'
  | 'RunGoalMap';

export class ScenariosEvents {
  static attach(root?: ParentNode): void {
    const container = root || document.querySelector('#connect-scenario-content') || document.querySelector('#connect-manager-content') || document.querySelector('#connect-test-content') || document.querySelector('.module-main-content');
    if (!container) return;
    const el = container as HTMLElement;
    if (el.getAttribute('data-scenarios-events-bound') === '1') return;
    el.setAttribute('data-scenarios-events-bound', '1');

    el.addEventListener('click', (e) => this.handleClick(e));
  }

  // ==================== PRIVATE STATIC HANDLERS ====================

  private static handleClick(e: Event): void {
    const target = e.target as HTMLElement;

    // Navigation buttons
    if (this.tryHandleNavigation(target)) return;

    // Editor actions (def, dsl, map, func)
    if (this.tryHandleEditorActions(target)) return;

    // Add operations
    if (this.tryHandleAddActions(target)) return;

    // Clone operations
    if (this.tryHandleCloneActions(target)) return;

    // Save/Load operations
    if (this.tryHandleSaveLoadActions(target)) return;

    // Delete operations
    if (this.tryHandleDeleteActions(target)) return;

    // Run/Validate operations
    if (this.tryHandleRunValidateActions(target)) return;

    // Move up/down operations
    if (this.tryHandleMoveActions(target)) return;

    // AND/Variable row operations
    if (this.tryHandleRowOperations(target)) return;
  }

  private static tryHandleNavigation(target: HTMLElement): boolean {
    const navActions: Record<string, string> = {
      'library-editor': '/connect-scenario/library-editor',
      'variables-editor': '/connect-data/dsl-params/search',
      'activities-editor': '/connect-data/activities/search',
      'intervals-editor': '/connect-data/intervals/search',
      'objects-editor': '/connect-data/dsl-objects/search',
    };

    for (const [action, route] of Object.entries(navActions)) {
      if (target.dataset.action === action || target.closest(`[data-action="${action}"]`)) {
        this.navigateTo(route);
        return true;
      }
    }
    return false;
  }

  private static tryHandleEditorActions(target: HTMLElement): boolean {
    const editorActions: Record<string, ScenariosUiAction> = {
      'def-visual-editor': 'DefVisualEditor',
      'dsl-visual-editor': 'DslVisualEditor',
      'def-validate': 'DefValidate',
      'def-import': 'DefImport',
      'def-reload': 'DefReload',
      'def-save': 'DefSave',
      'map-validate': 'MapValidate',
      'map-reload': 'MapReload',
      'map-save': 'MapSave',
      'map-visual-editor': 'MapVisualEditor',
      'func-visual-editor': 'FuncVisualEditor',
      'func-validate': 'FuncValidate',
      'func-add-template': 'FuncAddTemplate',
      'func-save': 'FuncSave',
    };

    for (const [attr, action] of Object.entries(editorActions)) {
      if (target.dataset.action === attr || target.closest(`[data-action="${attr}"]`)) {
        this.emit(action, {});
        return true;
      }
    }
    return false;
  }

  private static tryHandleAddActions(target: HTMLElement): boolean {
    const goalSection = target.closest('.goal-section') as HTMLElement | null;

    if (target.id === 'add-goal-btn' || target.closest('#add-goal-btn')) {
      this.emit('AddGoal', {});
      return true;
    }

    const classActions: Array<[string, ScenariosUiAction, (el: HTMLElement) => any]> = [
      ['btn-add-task', 'AddTask', () => ({ goalSection })],
      ['btn-add-variable', 'AddVariable', () => ({ goalSection })],
      ['btn-add-get', 'AddGet', () => ({ goalSection })],
      ['btn-add-set', 'AddSet', () => ({ goalSection })],
      ['btn-add-condition', 'AddCondition', () => ({ goalSection })],
      ['btn-add-func-call', 'AddFuncCall', () => ({ goalSection })],
      ['btn-add-out', 'AddOut', () => ({ goalSection })],
      ['btn-add-dialog', 'AddDialog', () => ({ goalSection })],
      ['btn-add-info', 'AddInfo', () => ({ goalSection })],
      ['btn-add-end', 'AddEnd', () => ({ goalSection })],
      ['btn-add-else', 'AddElse', () => ({ goalSection })],
      ['btn-add-repeat', 'AddRepeat', () => ({ goalSection })],
    ];

    for (const [className, action, getPayload] of classActions) {
      if (target.classList.contains(className) || target.closest(`.${className}`)) {
        this.emit(action, getPayload(target));
        return true;
      }
    }

    // Add Task After (with condition)
    if (target.classList.contains('btn-add-task-here') || target.closest('.btn-add-task-here')) {
      const afterEl = target.closest('.condition-group') as HTMLElement | null;
      this.emit('AddTaskAfter', { goalSection, afterEl });
      return true;
    }

    // Add Condition After with connector
    if (target.classList.contains('btn-add-condition-and') || target.closest('.btn-add-condition-and')) {
      const condition = target.closest('.condition-group') as HTMLElement | null;
      this.emit('AddConditionAfter', { goalSection, condition, connector: 'AND' });
      return true;
    }
    if (target.classList.contains('btn-add-condition-or') || target.closest('.btn-add-condition-or')) {
      const condition = target.closest('.condition-group') as HTMLElement | null;
      this.emit('AddConditionAfter', { goalSection, condition, connector: 'OR' });
      return true;
    }

    return false;
  }

  private static tryHandleCloneActions(target: HTMLElement): boolean {
    const cloneActions: Array<[string, string, ScenariosUiAction, string]> = [
      ['clone-goal', '.goal-section', 'CloneGoal', 'goalSection'],
      ['clone-task', '.task-container', 'CloneTask', 'taskContainer'],
      ['clone-variable', '.variable-container', 'CloneVariable', 'variableContainer'],
      ['clone-condition', '.condition-group', 'CloneCondition', 'condition'],
      ['clone-scenario', '', 'CloneScenario', ''],
    ];

    for (const [attr, closest, action, payloadKey] of cloneActions) {
      if (target.dataset.action === attr || target.closest(`[data-action="${attr}"]`)) {
        const payload: any = {};
        if (closest && payloadKey) {
          payload[payloadKey] = target.closest(closest) as HTMLElement | null;
        }
        this.emit(action, payload);
        return true;
      }
    }

    return false;
  }

  private static tryHandleSaveLoadActions(target: HTMLElement): boolean {
    if (target.classList.contains('btn-save-scenario') || target.closest('.btn-save-scenario')) {
      this.emit('SaveScenario', {});
      return true;
    }

    if (target.classList.contains('btn-export') || target.closest('.btn-export') || target.dataset.action === 'export-scenario' || target.closest('[data-action="export-scenario"]')) {
      this.emit('ExportScenario', {});
      return true;
    }

    if (target.classList.contains('example-item') || target.closest('.example-item')) {
      const example = target.closest('.example-item') as HTMLElement | null;
      const exampleId = example?.dataset.exampleId;
      if (exampleId) this.emit('LoadExample', { exampleId });
      return true;
    }

    if (target.dataset.action === 'copy-scenario' || target.closest('[data-action="copy-scenario"]')) {
      this.emit('CopyPreview', {});
      return true;
    }

    return false;
  }

  private static tryHandleDeleteActions(target: HTMLElement): boolean {

    const deleteActions: Array<[string, ScenariosUiAction, string, string]> = [
      ['delete-goal', 'DeleteGoal', '.goal-section', 'goalSection'],
      ['delete-condition', 'DeleteCondition', '.condition-group', 'cond'],
      ['delete-task', 'DeleteTask', '.task-container', 'taskContainer'],
    ];

    for (const [attr, action, closest, payloadKey] of deleteActions) {
      if (target.dataset.action === attr || target.closest(`[data-action="${attr}"]`)) {
        const payload: any = {};
        payload[payloadKey] = target.closest(closest) as HTMLElement | null;
        this.emit(action, payload);
        return true;
      }
    }

    if (target.dataset.action === 'delete-variable' || target.closest('[data-action="delete-variable"]')) {
      const variableContainer = target.closest('.variable-container') as HTMLElement | null;
      this.emit('DeleteVariable', { variableContainer });
      return true;
    }

    return false;
  }

  private static tryHandleRunValidateActions(target: HTMLElement): boolean {
    const runActions: Record<string, ScenariosUiAction> = {
      'validate-dsl': 'ValidateDsl',
      'autofix-dsl': 'AutoFixDsl',
      'apply-dsl-fix': 'ApplyDslFix',
      'run-dsl': 'RunDsl',
    };

    for (const [attr, action] of Object.entries(runActions)) {
      if (target.dataset.action === attr || target.closest(`[data-action="${attr}"]`)) {
        this.emit(action, {});
        return true;
      }
    }

    if (target.dataset.action === 'run-goal-map' || target.closest('[data-action="run-goal-map"]')) {
      const goalSection = target.closest('.goal-section') as HTMLElement | null;
      this.emit('RunGoalMap', { goalSection });
      return true;
    }

    if (target.dataset.action === 'run-scenario' || target.closest('[data-action="run-scenario"]')) {
      const goalSection = target.closest('.goal-section') as HTMLElement | null;
      this.emit('RunGoal', { goalSection });
      return true;
    }

    return false;
  }

  private static tryHandleMoveActions(target: HTMLElement): boolean {
    const goalSection = target.closest('.goal-section') as HTMLElement | null;

    const moveActions: Array<[string, ScenariosUiAction, string | null, string]> = [
      ['goal-up', 'GoalUp', null, 'goalSection'],
      ['goal-down', 'GoalDown', null, 'goalSection'],
      ['task-up', 'TaskUp', '.task-container', 'taskEl'],
      ['task-down', 'TaskDown', '.task-container', 'taskEl'],
      ['variable-up', 'VariableUp', '.variable-container', 'variableEl'],
      ['variable-down', 'VariableDown', '.variable-container', 'variableEl'],
      ['condition-up', 'ConditionUp', '.condition-group', 'conditionEl'],
      ['condition-down', 'ConditionDown', '.condition-group', 'conditionEl'],
      ['step-up', 'StepUp', '.step-block', 'stepEl'],
      ['step-down', 'StepDown', '.step-block', 'stepEl'],
    ];

    for (const [attr, action, closest, payloadKey] of moveActions) {
      if (target.dataset.action === attr || target.closest(`[data-action="${attr}"]`)) {
        const payload: any = { goalSection };
        if (closest) {
          payload[payloadKey] = target.closest(closest) as HTMLElement | null;
        }
        this.emit(action, payload);
        return true;
      }
    }

    if (target.dataset.action === 'delete-step' || target.closest('[data-action="delete-step"]')) {
      const stepEl = target.closest('.step-block') as HTMLElement | null;
      this.emit('DeleteStep', { stepEl, goalSection });
      return true;
    }

    return false;
  }

  private static tryHandleRowOperations(target: HTMLElement): boolean {
    if (target.classList.contains('btn-add-and') || target.closest('.btn-add-and')) {
      const taskContainer = target.closest('.task-container') as HTMLElement | null;
      this.emit('AddAndRow', { taskContainer });
      return true;
    }
    if (target.classList.contains('btn-delete-and') || target.closest('.btn-delete-and')) {
      const andRow = target.closest('.and-row') as HTMLElement | null;
      this.emit('DeleteAndRow', { andRow });
      return true;
    }

    if (target.classList.contains('btn-add-var') || target.closest('.btn-add-var')) {
      const btn = (target.closest('.btn-add-var') as HTMLElement | null) || (target as HTMLElement);
      const kindRaw = btn?.getAttribute('data-kind') || '';
      const kind = kindRaw ? kindRaw.toUpperCase() : undefined;
      const variableContainer = target.closest('.variable-container') as HTMLElement | null;
      this.emit('AddVarRow', { variableContainer, kind });
      return true;
    }
    if (target.classList.contains('btn-delete-var') || target.closest('.btn-delete-var')) {
      const varRow = target.closest('.var-row') as HTMLElement | null;
      this.emit('DeleteVarRow', { varRow });
      return true;
    }

    return false;
  }

  private static navigateTo(route: string): void {
    try {
      // Preserve current scenario ID in URL if present
      const params = new URLSearchParams(globalThis.location.search);
      const scenarioId = params.get('scenario') || '';
      const targetUrl = scenarioId ? `${route}?scenario=${scenarioId}` : route;
      globalThis.history.pushState({}, '', targetUrl);
      globalThis.dispatchEvent(new PopStateEvent('popstate'));
    } catch { /* silent */ }
  }

  private static emit(action: ScenariosUiAction, payload: any): void {
    // short de-dup guard: prevent accidental multiple emits in a tight loop
    const now = Date.now();
    const el = document.body as HTMLElement;
    const last = Number(el.getAttribute('data-scenarios-last-emit-ts') || '0');
    const lastAct = el.getAttribute('data-scenarios-last-emit-act') || '';
    if (lastAct === action && now - last < 150) {
      return;
    }
    el.setAttribute('data-scenarios-last-emit-ts', String(now));
    el.setAttribute('data-scenarios-last-emit-act', action);
    try { window.dispatchEvent(new CustomEvent('scenarios:ui', { detail: { action, ...payload } })); } catch { /* silent */ }
  }
}
