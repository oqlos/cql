// frontend/src/components/dsl-editor/renderers.ts
// Facade — delegates to extracted helpers & step-block renderers
import { escapeHtml } from '../../modules/shared/generic-grid/utils';
import { stepActions, buildSelect } from './renderers-helpers';
import * as StepBlocks from './renderers-step-blocks';

// Re-export types so existing consumers keep working
export type { TaskData, RenderOptions, ConditionData, ElseData, VariableData } from './renderers.types';
import type { TaskData, RenderOptions, ConditionData, ElseData, VariableData } from './renderers.types';

export class BlockRenderers {

  renderTaskBlock(data: TaskData, options: RenderOptions, taskId: string): string {
    const objSel = buildSelect(options.objectOptions, data.object, 'object-select');
    const fnSel = buildSelect(options.functionOptions, data.function, 'function-select');
    const ands = Array.isArray(data.ands) ? data.ands : [];
    const andHtml = ands.map((a: any) => `
      <div class="sentence-part and-row">
        <span class="sentence-text">AND</span>
        ${buildSelect(options.objectOptions, a?.object, 'object-select')}
        <button type="button" class="btn btn-outline-success btn-add-object" title="Dodaj obiekt">+</button>
        <button type="button" class="btn btn-outline-danger btn-remove-object" title="Usuń wybór">-</button>
        ${buildSelect(options.functionOptions, a?.function, 'function-select')}
        <button type="button" class="btn btn-outline-success btn-add-function" title="Dodaj funkcję">+</button>
        <button type="button" class="btn btn-outline-danger btn-remove-function" title="Usuń wybór">-</button>
        <button class="btn-delete-small btn-delete-and" title="Usuń">✕</button>
      </div>`).join('');
    
    return `
      <div class="task-container" data-task-id="${taskId}">
        <div class="task-header">
          <span class="task-label">SET</span>
          <button class="btn btn-secondary btn-move-up" data-action="task-up">⬆️</button>
          <button class="btn btn-secondary btn-move-down" data-action="task-down">⬇️</button>
          <button class="btn btn-secondary btn-clone" data-action="clone-task">⧉</button>
          <button class="btn-delete-small" data-action="delete-task">✕</button>
        </div>
        <div class="sentence-builder">
          <div class="sentence-part and-row">
            <span class="sentence-text"></span>
            ${objSel}
            <button type="button" class="btn btn-outline-success btn-add-object" title="Dodaj obiekt">+</button>
            <button type="button" class="btn btn-outline-danger btn-remove-object" title="Usuń wybór">-</button>
            <span class="sentence-text"></span>
            ${fnSel}
            <button type="button" class="btn btn-outline-success btn-add-function" title="Dodaj funkcję">+</button>
            <button type="button" class="btn btn-outline-danger btn-remove-function" title="Usuń wybór">-</button>
          </div>
          ${andHtml}
          <div class="sentence-part and-row">
            <button class="btn btn-warning btn-add-and">+ AND</button>
          </div>
        </div>
      </div>`;
  }

  private renderElseBlock(data: ElseData): string {
    const types = ['ERROR', 'WARNING', 'INFO', 'GOAL'];
    const actionType = String(data.actionType || 'ERROR').toUpperCase();
    const typeOptions = types.map(t => `<option${t === actionType ? ' selected' : ''}>${t}</option>`).join('');
    return `
      <div class="step-block condition-group else-block" data-condition-type="else" draggable="true" data-step-dnd="1">
        <div class="step-content">
          <span class="step-type-label else-label rounded-4">ELSE</span>
          <select class="action-type-select rounded-4">${typeOptions}</select>
          <input type="text" class="message-input rounded-4" value="${escapeHtml(data.actionMessage || '')}" size="20" placeholder="Wiadomość">
          ${stepActions('condition')}
        </div>
      </div>`;
  }

  renderConditionBlock(data: ConditionData, options: RenderOptions, type: 'if' | 'else' = 'if'): string {
    if (type === 'else') return this.renderElseBlock(data as any as ElseData);

    const paramSel = buildSelect(options.paramOptions, data.parameter, 'param-select');
    const opSel = buildSelect(options.operatorOptions, data.operator, 'operator-select');
    const varOptsRaw = Array.isArray(options.variableOptions) ? options.variableOptions : [];
    const varOpts = ['*', ...varOptsRaw];
    const selectedVar = String(data.value ?? '') || '*';
    const varSel = buildSelect(varOpts, selectedVar, 'variable-select');
    const conn = String(data.connector || '');
    const inConn = String((data as any).incomingConnector || '');
    const labelPrefix = (inConn === 'AND' || inConn === 'OR') ? `${inConn} ` : '';
    
    return `
      <div class="step-block condition-group if-block" data-condition-type="if" data-connector="${escapeHtml(conn)}" data-incoming="${escapeHtml(inConn)}" draggable="true" data-step-dnd="1">
        <div class="step-content">
          <span class="step-type-label if-label rounded-4" style="background: linear-gradient(135deg, #ffc107, #ff9800) !important; color: #000000 !important;">${labelPrefix}IF</span>
          ${paramSel}
          ${opSel}
          ${varSel}
          <button class="btn btn-outline-primary btn-xs btn-add-condition-and">+ AND</button>
          <button class="btn btn-outline-primary btn-xs btn-add-condition-or">+ OR</button>
          ${stepActions('condition')}
        </div>
      </div>`;
  }

  renderVariableBlock(data: VariableData, options: RenderOptions, kind: 'GET' | 'SET' | 'MAX' | 'MIN' | 'VAL', variableId: string): string {
    const parameter = data.parameter || '';
    const val = data.value ?? '';
    const paramSel = buildSelect(options.paramOptions, parameter, 'param-select');
    const showValue = (kind === 'SET' || kind === 'MAX' || kind === 'MIN');
    const labelClass = kind.toLowerCase();
    const valueHtml = showValue 
      ? `<input type="text" class="value-input rounded-4" value="${escapeHtml(String(val))}" size="12" placeholder="wartość">${data.unit ? ' <span class="unit-label">' + escapeHtml(data.unit) + '</span>' : ''}`
      : '';
    
    return `
      <div class="step-block variable-block ${labelClass}-block" data-var-kind="${kind}" data-variable-id="${variableId}" draggable="true" data-step-dnd="1">
        <div class="step-content">
          <span class="step-type-label ${labelClass}-label rounded-4">${kind}</span>
          ${paramSel}
          ${valueHtml}
          ${stepActions('step')}
        </div>
      </div>`;
  }

  renderGoalBlock(goalName: string, goalOptions: string[], goalId: string, stepsHtml: string): string {
    const goalSelect = buildSelect(goalOptions, goalName, 'goal-select');
    
    return `
      <div class="goal-section" data-goal-id="${goalId}">
        <div class="goal-header">
          <span class="goal-label rounded-4">GOAL</span>
          ${goalSelect}
          <button class="btn btn-secondary btn-move-up" data-action="goal-up">⬆️</button>
          <button class="btn btn-secondary btn-move-down" data-action="goal-down">⬇️</button>
          <button class="btn btn-secondary btn-clone" data-action="clone-goal">⧉</button>
          <button class="btn btn-danger btn-delete" data-action="delete-goal">🗑️</button>
        </div>
        <div class="steps-container">${stepsHtml}</div>
        <div class="goal-actions">
          <button class="btn btn-outline-primary btn-add-get">+ Dodaj GET</button>
          <button class="btn btn-outline-primary btn-add-set">+ Dodaj SET</button>
          <button class="btn btn-outline-primary btn-add-out">+ Dodaj OUT</button>
          <button class="btn btn-outline-primary btn-add-condition">+ Dodaj warunek</button>
          <button class="btn btn-outline-secondary btn-add-func-call">+ Wywołaj FUNC</button>
          <button class="btn btn-primary btn-run-scenario" data-action="run-scenario">▶️ Uruchom</button>
          <button class="btn btn-primary" data-action="run-goal-map">▶️ Uruchom (MAP)</button>
        </div>
      </div>`;
  }

  renderFuncBlock(funcName: string, funcId: string, stepsHtml: string): string {
    return `
      <div class="func-section" data-func-id="${funcId}">
        <div class="func-header">
          <span class="func-label rounded-4">FUNC</span>
          <input type="text" class="func-name-input rounded-4" value="${escapeHtml(funcName)}" placeholder="Nazwa procedury">
          <button class="btn btn-secondary btn-move-up" data-action="func-up">⬆️</button>
          <button class="btn btn-secondary btn-move-down" data-action="func-down">⬇️</button>
          <button class="btn btn-secondary btn-clone" data-action="clone-func">⧉</button>
          <button class="btn btn-danger btn-delete" data-action="delete-func">🗑️</button>
        </div>
        <div class="steps-container">${stepsHtml}</div>
        <div class="func-actions">
          <button class="btn btn-outline-primary btn-add-set">+ Dodaj SET</button>
          <button class="btn btn-outline-primary btn-add-condition">+ Dodaj warunek</button>
        </div>
      </div>`;
  }

  renderFuncCallBlock(funcName: string, availableFuncs: string[], args: string[], stepId: string): string {
    const funcSelect = buildSelect(availableFuncs, funcName, 'func-call-select');
    const argsHtml = args.map(a => `<input type="text" class="func-arg-input rounded-4" value="${escapeHtml(a)}" size="10" placeholder="Arg">`).join('');
    return `
      <div class="step-block func-call-block" data-step-id="${stepId}" draggable="true" data-step-dnd="1">
        <div class="step-content">
          <span class="step-type-label func-call-label rounded-4">FUNC</span>
          ${funcSelect}
          <div class="func-args-container" style="display:inline-flex;gap:4px;">${argsHtml}</div>
          ${stepActions('step')}
        </div>
      </div>`;
  }

  // --- Step block delegators (implementations in renderers-step-blocks.ts) ---
  renderWaitBlock(data: { duration?: string; unit?: string; action?: string }, stepId: string): string {
    return StepBlocks.renderWaitBlock(data, stepId);
  }
  renderTaskActionBlock(data: { action?: string; object?: string }, stepId: string, actionOptions?: string[], objectOptions?: string[]): string {
    return StepBlocks.renderTaskActionBlock(data, stepId, actionOptions, objectOptions);
  }
  renderLogBlock(data: { message?: string }, options: RenderOptions, stepId: string): string {
    return StepBlocks.renderLogBlock(data, options, stepId);
  }
  renderAlarmBlock(data: { message?: string }, options: RenderOptions, stepId: string): string {
    return StepBlocks.renderAlarmBlock(data, options, stepId);
  }
  renderErrorBlock(data: { message?: string }, options: RenderOptions, stepId: string): string {
    return StepBlocks.renderErrorBlock(data, options, stepId);
  }
  renderSaveBlock(data: { parameter?: string }, options: RenderOptions, stepId: string): string {
    return StepBlocks.renderSaveBlock(data, options, stepId);
  }
  renderUserBlock(data: { action?: string; message?: string }, stepId: string): string {
    return StepBlocks.renderUserBlock(data, stepId);
  }
  renderResultBlock(data: { status?: string }, stepId: string, resultOptions?: string[]): string {
    return StepBlocks.renderResultBlock(data, stepId, resultOptions);
  }
  renderOptBlock(data: { parameter?: string; description?: string }, stepId: string, variableOptions?: string[], optDefaults?: Record<string, string>): string {
    return StepBlocks.renderOptBlock(data, stepId, variableOptions, optDefaults);
  }
  renderInfoBlock(data: { level?: string; message?: string }, stepId: string): string {
    return StepBlocks.renderInfoBlock(data, stepId);
  }
  renderRepeatBlock(stepId: string): string {
    return StepBlocks.renderRepeatBlock(stepId);
  }
  renderEndBlock(stepId: string): string {
    return StepBlocks.renderEndBlock(stepId);
  }
  renderOutBlock(data: { outType?: string; value?: string }, stepId: string, variableOptions?: string[]): string {
    return StepBlocks.renderOutBlock(data, stepId, variableOptions);
  }
  renderDialogBlock(data: { parameter?: string; message?: string }, stepId: string, variableOptions?: string[]): string {
    return StepBlocks.renderDialogBlock(data, stepId, variableOptions);
  }
}

export const blockRenderers = new BlockRenderers();
