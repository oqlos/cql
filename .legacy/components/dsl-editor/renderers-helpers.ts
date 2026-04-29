// frontend/src/components/dsl-editor/renderers-helpers.ts
// Shared utility functions for block renderers

import { escapeHtml } from '../../modules/shared/generic-grid/utils';
import { LabelsService } from '../../services/labels.service';

/** Generate standard action buttons for step blocks (move up, move down, clone, delete) */
export function stepActions(stepType: string = 'step'): string {
  return `
    <div class="step-actions">
      <button class="btn btn-secondary btn-xs btn-move-up" data-action="${stepType}-up" title="Przesuń w górę">⬆️</button>
      <button class="btn btn-secondary btn-xs btn-move-down" data-action="${stepType}-down" title="Przesuń w dół">⬇️</button>
      <button class="btn btn-secondary btn-xs btn-clone" data-action="clone-${stepType}" title="Klonuj">⧉</button>
      <button class="btn-delete-small" data-action="delete-${stepType}" title="Usuń">✕</button>
    </div>`;
}

/** Map select CSS class to DEF library key for "Add to DEF" button */
export function mapClassToDefKey(cls: string): { label: string; defKey: string } {
  const norm = (cls || '').toLowerCase();
  if (norm.includes('object-select')) return { label: 'obiekt', defKey: 'objects' };
  if (norm.includes('func-call-select')) return { label: 'procedurę FUNC', defKey: 'funcs' };
  if (norm.includes('function-select')) return { label: 'funkcję', defKey: 'functions' };
  if (norm.includes('param-select')) return { label: 'parametr', defKey: 'params' };
  if (norm.includes('unit-select')) return { label: 'jednostkę', defKey: 'units' };
  if (norm.includes('variable-select')) return { label: 'zmienną', defKey: 'params' };
  if (norm.includes('goal-select')) return { label: 'aktywność', defKey: 'goals' };
  if (norm.includes('operator-select')) return { label: 'operator', defKey: 'operators' };
  if (norm.includes('log-select')) return { label: 'log', defKey: 'logs' };
  if (norm.includes('alarm-select')) return { label: 'alarm', defKey: 'alarms' };
  if (norm.includes('error-select')) return { label: 'błąd', defKey: 'errors' };
  return { label: 'pozycję', defKey: 'params' };
}

function getAddToDefText(label: string): string {
  const lang = (typeof LabelsService?.getLanguage === 'function' ? LabelsService.getLanguage() : 'pl') || 'pl';
  return lang === 'pl' ? `➕ Dodaj ${label} w DEF` : `➕ Add ${label} in DEF`;
}

function normalizeSelectList(opts: string[], value: string): string[] {
  if (opts.indexOf(value) !== -1) return opts;
  return [value, ...opts];
}

function renderSelectOptions(list: string[], value: string): string {
  return list.map((option) => {
    const selected = option === value ? ' selected' : '';
    return `<option${selected}>${escapeHtml(option)}</option>`;
  }).join('');
}

/** Build a <select> element from options, or show "Add to DEF" button if no options */
export function buildSelect(opts: string[], value?: string, cls?: string): string {
  if (!Array.isArray(opts) || opts.length === 0) {
    const { label, defKey } = mapClassToDefKey(cls || '');
    const textDef = getAddToDefText(label);
    return `<button type="button" class="btn btn-outline-primary btn-add-to-def" data-def-key="${defKey}" data-select-class="${cls || ''}">${escapeHtml(textDef)}</button>`;
  }
  const val = value || '';
  const list = normalizeSelectList(opts, val);
  const options = renderSelectOptions(list, val);
  return `<select class="${cls || ''} rounded-4">${options}</select>`;
}
