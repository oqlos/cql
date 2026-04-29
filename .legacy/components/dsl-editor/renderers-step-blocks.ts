// frontend/src/components/dsl-editor/renderers-step-blocks.ts
// Simple step block renderers (action blocks within goals/functions)

import { escapeHtml } from '../../modules/shared/generic-grid/utils';
import { buildSelect, stepActions } from './renderers-helpers';
import type { RenderOptions } from './renderers.types';

/** Build a <select> for variable options, ensuring current value is included */
function buildVarSelectHtml(value: string, variableOptions: string[] | undefined, className: string, style?: string): string {
  const varBase = Array.isArray(variableOptions) ? variableOptions.filter(Boolean) : [];
  const varList = value && !varBase.includes(value) ? [value, ...varBase] : (varBase.length ? varBase : [value || 'niezdefiniowany']);
  const styleAttr = style ? ` style="${style}"` : '';
  return `<select class="${className} rounded-4"${styleAttr}>${varList
    .map(o => `<option${o === value ? ' selected' : ''}>${escapeHtml(o)}</option>`)
    .join('')}</select>`;
}

/** Render a timing step block encoded as SET [wait|delay] = [duration] */
export function renderWaitBlock(data: { duration?: string; unit?: string; action?: string }, stepId: string): string {
  const dur = escapeHtml(String(data.duration || ''));
  const waitActions = ['wait', 'delay', 'pause', 'timeout'];
  const action = (data.action || 'wait').toLowerCase();
  const actionOpts = waitActions
    .map(a => `<option value="${a}"${a === action ? ' selected' : ''}>${a.toUpperCase()}</option>`)
    .join('');
  return `
    <div class="step-block wait-block task-block" data-step-id="${stepId}" draggable="true" data-step-dnd="1">
      <div class="step-content">
        <span class="step-type-label set-label rounded-4">SET</span>
        <select class="task-wait-select rounded-4">${actionOpts}</select>
        <input type="text" class="wait-duration-input rounded-4" value="${dur}" size="10" placeholder="1 s">
        ${stepActions('step')}
      </div>
    </div>`;
}

/** Render a SET step block with [action] [object] format (formerly TASK/AKCJA) */
export function renderTaskActionBlock(
  data: { action?: string; object?: string },
  stepId: string,
  actionOptions?: string[],
  objectOptions?: string[]
): string {
  const actionVal = (data.action || '').trim();
  const objectVal = (data.object || '').trim();

  const actBase = Array.isArray(actionOptions) ? actionOptions.filter(Boolean) : ['Włącz', 'Wyłącz', 'Ustaw'];
  const actList = actionVal && !actBase.includes(actionVal) ? [actionVal, ...actBase] : (actBase.length ? actBase : [actionVal || 'Włącz']);
  const actSelectHtml = `<select class="task-action-select rounded-4">${actList
    .map(o => `<option${o === actionVal ? ' selected' : ''}>${escapeHtml(o)}</option>`)
    .join('')}</select>`;

  const objBase = Array.isArray(objectOptions) ? objectOptions.filter(Boolean) : [];
  const objList = objectVal && !objBase.includes(objectVal) ? [objectVal, ...objBase] : (objBase.length ? objBase : [objectVal || 'obiekt']);
  const objSelectHtml = `<select class="task-object-select rounded-4">${objList
    .map(o => `<option${o === objectVal ? ' selected' : ''}>${escapeHtml(o)}</option>`)
    .join('')}</select>`;

  return `
    <div class="step-block set-action-block" data-step-id="${stepId}" draggable="true" data-step-dnd="1">
      <div class="step-content">
        <span class="step-type-label set-label rounded-4">SET</span>
        ${actSelectHtml}
        ${objSelectHtml}
        ${stepActions('step')}
      </div>
    </div>`;
}

/** Render a LOG step block */
export function renderLogBlock(data: { message?: string }, options: RenderOptions, stepId: string): string {
  const msg = data.message || '';
  const logSel = buildSelect(options.logOptions || [], msg, 'log-select');
  return `
    <div class="step-block log-block" data-step-id="${stepId}" draggable="true" data-step-dnd="1">
      <div class="step-content">
        <span class="step-type-label log-label rounded-4">LOG</span>
        ${logSel}
        ${stepActions('step')}
      </div>
    </div>`;
}

/** Render an ALARM step block */
export function renderAlarmBlock(data: { message?: string }, options: RenderOptions, stepId: string): string {
  const msg = data.message || '';
  const alarmSel = buildSelect(options.alarmOptions || [], msg, 'alarm-select');
  return `
    <div class="step-block alarm-block" data-step-id="${stepId}" draggable="true" data-step-dnd="1">
      <div class="step-content">
        <span class="step-type-label alarm-label rounded-4">ALARM</span>
        ${alarmSel}
        ${stepActions('step')}
      </div>
    </div>`;
}

/** Render an ERROR step block */
export function renderErrorBlock(data: { message?: string }, options: RenderOptions, stepId: string): string {
  const msg = data.message || '';
  const errorSel = buildSelect(options.errorOptions || [], msg, 'error-select');
  return `
    <div class="step-block error-block" data-step-id="${stepId}" draggable="true" data-step-dnd="1">
      <div class="step-content">
        <span class="step-type-label error-label rounded-4">ERROR</span>
        ${errorSel}
        ${stepActions('step')}
      </div>
    </div>`;
}

/** Render a SAVE step block */
export function renderSaveBlock(data: { parameter?: string }, options: RenderOptions, stepId: string): string {
  const paramSel = buildSelect(options.paramOptions, data.parameter, 'param-select');
  return `
    <div class="step-block save-block" data-step-id="${stepId}" draggable="true" data-step-dnd="1">
      <div class="step-content">
        <span class="step-type-label save-label rounded-4">SAVE</span>
        ${paramSel}
        ${stepActions('step')}
      </div>
    </div>`;
}

/** Render a USER step block */
export function renderUserBlock(data: { action?: string; message?: string }, stepId: string): string {
  return `
    <div class="step-block user-block" data-step-id="${stepId}" draggable="true" data-step-dnd="1">
      <div class="step-content">
        <span class="step-type-label user-label rounded-4">USER</span>
        <input type="text" class="user-action-input rounded-4" value="${escapeHtml(data.action || '')}" placeholder="Akcja">
        <input type="text" class="user-message-input rounded-4" value="${escapeHtml(data.message || '')}" placeholder="Wiadomość" size="30">
        ${stepActions('step')}
      </div>
    </div>`;
}

/** Render a RESULT step block */
export function renderResultBlock(data: { status?: string }, stepId: string, resultOptions?: string[]): string {
  const status = (data.status || 'OK').trim();
  const opts = Array.isArray(resultOptions) && resultOptions.length > 0 ? resultOptions : ['OK', 'ERROR', 'WARNING', 'PASS', 'FAIL'];
  const list = opts.includes(status) ? opts : [status, ...opts];
  const optionsHtml = list.map(o => `<option${o === status ? ' selected' : ''}>${escapeHtml(o)}</option>`).join('');
  return `
    <div class="step-block result-block" data-step-id="${stepId}" draggable="true" data-step-dnd="1">
      <div class="step-content">
        <span class="step-type-label result-label rounded-4">RESULT</span>
        <select class="result-select rounded-4">${optionsHtml}</select>
        <button type="button" class="btn btn-outline-success btn-add-result" title="Dodaj status">+</button>
        <button type="button" class="btn btn-outline-danger btn-remove-result" title="Usuń status z listy">-</button>
        ${stepActions('step')}
      </div>
    </div>`;
}

/** Render an OPT step block */
export function renderOptBlock(
  data: { parameter?: string; description?: string },
  stepId: string,
  variableOptions?: string[],
  optDefaults?: Record<string, string>
): string {
  const paramVal = (data.parameter || '').trim();
  const descFromDef = optDefaults && paramVal ? (optDefaults[paramVal] || '') : '';
  const descVal = (data.description || descFromDef || '').trim();

  const varBase = Array.isArray(variableOptions) ? variableOptions.filter(Boolean) : [];
  const varList = paramVal && !varBase.includes(paramVal) ? [paramVal, ...varBase] : (varBase.length ? varBase : [paramVal || 'niezdefiniowany']);
  const varSelectHtml = `<select class="opt-param-select dsl-bracket-select rounded-4" data-opt-defaults="${escapeHtml(JSON.stringify(optDefaults || {}))}">${varList
    .map(o => `<option${o === paramVal ? ' selected' : ''}>${escapeHtml(o)}</option>`)
    .join('')}</select>`;

  return `
    <div class="step-block opt-block" data-step-id="${stepId}" draggable="true" data-step-dnd="1">
      <div class="step-content">
        <span class="step-type-label opt-label rounded-4">OPT</span>
        <span class="dsl-bracket">[</span>${varSelectHtml}<span class="dsl-bracket">]</span>
        <span class="dsl-quoted-value">"<input type="text" class="opt-desc-input rounded-4" value="${escapeHtml(descVal)}" placeholder="Opis parametru" size="40">"</span>
        ${stepActions('step')}
      </div>
    </div>`;
}

/** Render an INFO step block */
export function renderInfoBlock(data: { level?: string; message?: string }, stepId: string): string {
  const levels = ['INFO', 'ERROR', 'WARNING', 'ALARM', 'PROMPT'];
  const lvl = (data.level || 'INFO').toUpperCase();
  const opts = levels.map(l => `<option${l === lvl ? ' selected' : ''}>${l}</option>`).join('');
  const msgVal = (data.message || '').trim();
  return `
    <div class="step-block info-block" data-step-id="${stepId}" draggable="true" data-step-dnd="1">
      <div class="step-content">
        <span class="step-type-label info-label rounded-4">INFO</span>
        <select class="info-level-select rounded-4">${opts}</select>
        <input type="text" class="info-message-input rounded-4" value="${escapeHtml(msgVal)}" placeholder="Wiadomość" size="35">
        ${stepActions('step')}
      </div>
    </div>`;
}

/** Render a REPEAT step block */
export function renderRepeatBlock(stepId: string): string {
  return `
    <div class="step-block repeat-block" data-step-id="${stepId}" draggable="true" data-step-dnd="1">
      <div class="step-content">
        <span class="step-type-label repeat-label rounded-4">REPEAT</span>
        <span class="text-muted text-sm ml-2">Powtórz sekcję</span>
        ${stepActions('step')}
      </div>
    </div>`;
}

/** Render an END step block */
export function renderEndBlock(stepId: string): string {
  return `
    <div class="step-block end-block" data-step-id="${stepId}" draggable="true" data-step-dnd="1">
      <div class="step-content">
        <span class="step-type-label end-label rounded-4">END</span>
        <span class="text-muted text-sm ml-2">Zamknij blok IF/ELSE</span>
        ${stepActions('step')}
      </div>
    </div>`;
}

/** Render an OUT step block */
export function renderOutBlock(data: { outType?: string; value?: string }, stepId: string, variableOptions?: string[]): string {
  const outTypes = ['RESULT', 'VAL', 'MAX', 'MIN', 'UNIT'];
  const outType = (data.outType || 'RESULT').toUpperCase();
  const typeOpts = outTypes.map(t => `<option${t === outType ? ' selected' : ''}>${t}</option>`).join('');
  const val = (data.value || '').trim();
  const isResultType = outType === 'RESULT' || outType === 'UNIT';

  return `
    <div class="step-block out-block" data-step-id="${stepId}" draggable="true" data-step-dnd="1">
      <div class="step-content">
        <span class="step-type-label out-label rounded-4">OUT</span>
        <select class="out-type-select rounded-4">${typeOpts}</select>
        <input type="text" class="out-value-input rounded-4" value="${escapeHtml(val)}" placeholder="OK/ERROR" size="10" style="display:${isResultType ? 'inline-block' : 'none'}">
        ${buildVarSelectHtml(val, variableOptions, 'out-value-select', `display:${isResultType ? 'none' : 'inline-block'}`)}
        ${stepActions('step')}
      </div>
    </div>`;
}

/** Render a DIALOG step block */
export function renderDialogBlock(data: { parameter?: string; message?: string }, stepId: string, variableOptions?: string[]): string {
  const paramVal = (data.parameter || '').trim();
  const msgVal = (data.message || '').trim();

  return `
    <div class="step-block dialog-block" data-step-id="${stepId}" draggable="true" data-step-dnd="1">
      <div class="step-content">
        <span class="step-type-label dialog-label rounded-4">DIALOG</span>
        ${buildVarSelectHtml(paramVal, variableOptions, 'dialog-param-select')}
        <input type="text" class="dialog-message-input rounded-4" value="${escapeHtml(msgVal)}" placeholder="Wiadomość dla użytkownika" size="30">
        ${stepActions('step')}
      </div>
    </div>`;
}
