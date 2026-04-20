import { ScenariosLibrary } from './scenarios.library';
import { escapeHtml } from '../../../utils/html.utils';

function buildSelect(cls: string, opts: string[], selected?: string): string {
  const mapToCD = (c?: string): { href: string; label: string } => {
    const norm = String(c || '').toLowerCase();
    if (norm.indexOf('param-select') !== -1) return { href: '/connect-data/dsl-params/add-new', label: 'parametr' };
    if (norm.indexOf('unit-select') !== -1) return { href: '/connect-data/dsl-units/add-new', label: 'jednostkę' };
    return { href: '/connect-data', label: 'pozycję' };
  };
  if (!Array.isArray(opts) || opts.length === 0) {
    const { href, label } = mapToCD(cls);
    const text = `➕ Dodaj ${label} w Connect Data`;
    return `<a class="btn btn-outline-primary dsl-add-link" href="${href}">${escapeHtml(text)}</a>`;
  }
  return `<select class="${cls} rounded-4">${(opts||[]).map(o => `<option${selected && o === selected ? ' selected' : ''}>${escapeHtml(o)}</option>`).join('')}</select>`;
}

export function buildVariableContainer(kind: 'GET'|'SET'|'MAX'|'MIN'|'VAL'|null): HTMLElement {
  const paramOpts = ScenariosLibrary.load('params');
  const unitOpts = ScenariosLibrary.load('units');
  const defaultParam = (paramOpts && paramOpts.length) ? paramOpts[0] : '';
  const allowedUnits = defaultParam ? (ScenariosLibrary.getUnitsForParam(defaultParam) || []) : [];
  const initialUnits = (allowedUnits && allowedUnits.length) ? allowedUnits : unitOpts;
  const id = `variable${Date.now()}`;

  const container = document.createElement('div');
  container.className = 'variable-container';
  container.dataset.variableId = id;
  if (kind) (container as any).dataset.varKind = kind;

  if (!kind) {
    container.innerHTML = `
      <div class="variable-header">
        <span class="variable-label">VAR</span>
        <button class="btn btn-secondary btn-move-up" data-action="variable-up">⬆️</button>
        <button class="btn btn-secondary btn-move-down" data-action="variable-down">⬇️</button>
        <button class="btn btn-secondary btn-clone" data-action="clone-variable">⧉</button>
        <button class="btn-delete-small" data-action="delete-variable">✕</button>
      </div>
      <div class="variable-builder">
        <div class="variable-part var-row">
          ${buildSelect('action-select', ['SET','GET','MAX','MIN','VAL'],'GET')}
          ${buildSelect('param-select', paramOpts, defaultParam)}
          <span class="variable-text equals-sign" style="display: none;">=</span>
          <input type="text" class="value-input rounded-4" value="" size="8" style="display: none;">
          <button type="button" class="btn btn-outline-secondary btn-dec-val" style="display: none;">-</button>
          <button type="button" class="btn btn-outline-secondary btn-inc-val" style="display: none;">+</button>
          ${buildSelect('unit-select', initialUnits)}
          <button class="btn-delete-small btn-delete-var" title="Usuń zmienną">✕</button>
        </div>
        <div class="variable-part">
          <button class="btn btn-info btn-add-var">+ ADD VARIABLE</button>
        </div>
      </div>
    `;
  } else {
    const showValue = (kind === 'SET' || kind === 'MAX' || kind === 'MIN');
    container.innerHTML = `
      <div class="variable-header">
        <span class="variable-label">${kind}</span>
        <button class="btn btn-secondary btn-move-up" data-action="variable-up">⬆️</button>
        <button class="btn btn-secondary btn-move-down" data-action="variable-down">⬇️</button>
        <button class="btn btn-secondary btn-clone" data-action="clone-variable">⧉</button>
        <button class="btn-delete-small" data-action="delete-variable">✕</button>
      </div>
      <div class="variable-builder">
        <div class="variable-part var-row" data-kind="${kind}">
          ${buildSelect('param-select', paramOpts, defaultParam)}
          <span class="variable-text equals-sign" style="display: ${showValue ? 'inline' : 'none'};">=</span>
          <input type="text" class="value-input rounded-4" value="" size="8" style="display: ${showValue ? 'inline' : 'none'};">
          <button type="button" class="btn btn-outline-secondary btn-dec-val" style="display: ${showValue ? 'inline' : 'none'};">-</button>
          <button type="button" class="btn btn-outline-secondary btn-inc-val" style="display: ${showValue ? 'inline' : 'none'};">+</button>
          ${buildSelect('unit-select', initialUnits)}
          <button class="btn-delete-small btn-delete-var" title="Usuń zmienną">✕</button>
        </div>
      </div>
    `;
  }
  return container;
}

export function cloneVariableContainer(variableContainer: HTMLElement): HTMLElement {
  const cloned = variableContainer.cloneNode(true) as HTMLElement;
  const newId = `variable${Date.now()}`;
  cloned.dataset.variableId = newId;
  return cloned;
}

export function addVariableRow(variableContainer: HTMLElement, requestedKind?: string): HTMLElement | null {
  const builder = variableContainer?.querySelector('.variable-builder') as HTMLElement | null;
  if (!builder) return null;

  const paramOpts = ScenariosLibrary.load('params');
  const unitOpts = ScenariosLibrary.load('units');
  const varRow = document.createElement('div');
  varRow.className = 'variable-part var-row';

  const req = String(requestedKind || '').toUpperCase();
  const contKind = (variableContainer?.getAttribute('data-var-kind') || (variableContainer as any)?.dataset?.varKind || '').toUpperCase();

  if (['SET','GET','MAX','MIN'].includes(req) || ['SET','GET','MAX','MIN'].includes(contKind)) {
    const kind = (req || contKind) as 'SET'|'GET'|'MAX'|'MIN';
    const showValue = (kind === 'SET' || kind === 'MAX' || kind === 'MIN');
    varRow.setAttribute('data-kind', kind);
    varRow.innerHTML = `
      ${buildSelect('param-select', paramOpts)}
      <span class="variable-text equals-sign" style="display: ${showValue ? 'inline' : 'none'};">=</span>
      <input type="text" class="value-input rounded-4" value="" size="8" style="display: ${showValue ? 'inline' : 'none'};">
      <button type="button" class="btn btn-outline-secondary btn-dec-val" style="display: ${showValue ? 'inline' : 'none'};">-</button>
      <button type="button" class="btn btn-outline-secondary btn-inc-val" style="display: ${showValue ? 'inline' : 'none'};">+</button>
      ${buildSelect('unit-select', unitOpts)}
      <button class="btn-delete-small btn-delete-var" title="Usuń zmienną">✕</button>
    `;
    const targetGroup = (kind as string).toUpperCase();
    const groupEl = builder.querySelector(`.variable-group[data-group="${targetGroup}"]`) as HTMLElement | null;
    if (groupEl) {
      groupEl.appendChild(varRow);
    } else {
      const addPart = builder.querySelector('.btn-add-var')?.closest('.variable-part') as HTMLElement | null;
      if (addPart) builder.insertBefore(varRow, addPart); else builder.appendChild(varRow);
    }
  } else {
    varRow.innerHTML = `
      <select class="action-select rounded-4"><option>SET</option><option selected>GET</option><option>MAX</option><option>MIN</option></select>
      ${buildSelect('param-select', paramOpts)}
      <span class="variable-text equals-sign" style="display: none;">=</span>
      <input type="text" class="value-input rounded-4" value="" size="8" style="display: none;">
      <button type="button" class="btn btn-outline-secondary btn-dec-val" style="display: none;">-</button>
      <button type="button" class="btn btn-outline-secondary btn-inc-val" style="display: none;">+</button>
      ${buildSelect('unit-select', unitOpts)}
      <button class="btn-delete-small btn-delete-var" title="Usuń zmienną">✕</button>
    `;
    const actionSel = varRow.querySelector('.action-select') as HTMLSelectElement | null;
    const targetGroup = ((actionSel?.value || 'GET').toUpperCase());
    const groupEl = builder.querySelector(`.variable-group[data-group="${targetGroup}"]`) as HTMLElement | null;
    if (groupEl) {
      groupEl.appendChild(varRow);
    } else {
      const addPart = builder.querySelector('.btn-add-var')?.closest('.variable-part') as HTMLElement | null;
      if (addPart) builder.insertBefore(varRow, addPart); else builder.appendChild(varRow);
    }
  }
  return varRow;
}

export function handleActionSelectChange(varRow: HTMLElement): void {
  const actionSel = varRow.querySelector('.action-select') as HTMLSelectElement | null;
  const equalsSign = varRow.querySelector('.equals-sign') as HTMLElement | null;
  const valueInput = varRow.querySelector('.value-input') as HTMLInputElement | null;
  const incBtn = varRow.querySelector('.btn-inc-val') as HTMLElement | null;
  const decBtn = varRow.querySelector('.btn-dec-val') as HTMLElement | null;
  const action = ((actionSel?.value || varRow.getAttribute('data-kind') || '').toUpperCase());
  const showValue = (action === 'SET' || action === 'MAX' || action === 'MIN');
  if (equalsSign) equalsSign.style.display = showValue ? 'inline' : 'none';
  if (valueInput) valueInput.style.display = showValue ? 'inline' : 'none';
  if (incBtn) incBtn.style.display = showValue ? 'inline' : 'none';
  if (decBtn) decBtn.style.display = showValue ? 'inline' : 'none';
  const builder = varRow.closest('.variable-builder') as HTMLElement | null;
  if (builder) {
    const groupEl = builder.querySelector(`.variable-group[data-group="${action}"]`) as HTMLElement | null;
    if (groupEl && varRow.parentElement !== groupEl) {
      groupEl.appendChild(varRow);
    }
  }
}

export function handleParamChange(varRow: HTMLElement, param: string): void {
  const unitSel = varRow.querySelector('.unit-select') as HTMLSelectElement | null;
  if (unitSel) {
    const units = ScenariosLibrary.getUnitsForParam(param) || [];
    const current = unitSel.value;
    unitSel.innerHTML = (units || []).map(u => `<option${u === current ? ' selected' : ''}>${u}</option>`).join('');
  }
}
