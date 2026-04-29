// frontend/src/pages/connect-scenario-library-editor/library-editor.defaults.ts
// Extracted from library-editor.page.ts — OPT/SET defaults and variable management

import { formatDslLiteral } from '../../components/dsl/dsl.quotes';
import { escapeHtml, notifyBottomLine } from '../../modules/shared/generic-grid/utils';
import { confirmAction, promptText } from '../../modules/connect-scenario/helpers/scenario-dialogs';
import type { DefData } from '../../modules/connect-scenario/helpers/def-editor.render';
import { replaceGoalVariableLineValue } from './library-editor.dsl';

export interface DefaultsContext {
  defData: DefData;
  extractSetVarsFromGoals: () => Array<{ goalName: string; goalIdx: number; varName: string; value: string; type: 'set' | 'opt'; lineIdx: number }>;
  updateSourceEditor: () => void;
  scheduleAutosave: () => void;
}

// ===== OPT Defaults Management =====

export async function addOptDefault(ctx: DefaultsContext): Promise<void> {
  const name = await promptText('Nazwa zmiennej OPT:', '', { title: 'Dodaj OPT' });
  if (!name?.trim()) return;
  const desc = await promptText('Domyślny opis OPT:', 'Ta zmienna pozwala na ustawienie...', { title: 'Dodaj OPT' });
  if (desc === null) return;
  if (!ctx.defData.optDefaults) ctx.defData.optDefaults = {};
  ctx.defData.optDefaults[name.trim()] = desc;
  renderOptDefaults(ctx);
  ctx.scheduleAutosave();
  notifyBottomLine(`✅ Dodano OPT: ${name.trim()}`, 'success', 2000);
}

export async function editOptDefault(ctx: DefaultsContext, name: string): Promise<void> {
  if (!ctx.defData.optDefaults) return;
  const current = ctx.defData.optDefaults[name] || '';
  const newDesc = await promptText(`Opis OPT dla "${name}":`, current, { title: 'Edytuj OPT' });
  if (newDesc !== null) {
    ctx.defData.optDefaults[name] = newDesc;
    renderOptDefaults(ctx);
    ctx.scheduleAutosave();
  }
}

export async function deleteOptDefault(ctx: DefaultsContext, name: string): Promise<void> {
  if (await confirmAction(`Usunąć OPT "${name}"?`)) {
    if (ctx.defData.optDefaults) {
      delete ctx.defData.optDefaults[name];
    }
    renderOptDefaults(ctx);
    ctx.scheduleAutosave();
    notifyBottomLine(`🗑️ Usunięto OPT: ${name}`, 'info', 2000);
  }
}

export function renderOptDefaults(ctx: DefaultsContext): void {
  const list = document.getElementById('opts-list');
  if (!list) return;
  
  const opts = ctx.defData.optDefaults || {};
  const entries = Object.entries(opts);
  
  if (entries.length === 0) {
    list.innerHTML = '<p class="text-sm text-muted">Brak domyślnych wartości OPT</p>';
    return;
  }
  
  list.innerHTML = entries.map(([name, desc]) => `
    <div class="def-item def-opt-item" data-name="${escapeHtml(name)}">
      <div class="def-opt-content">
        <span class="def-opt-name">${escapeHtml(formatDslLiteral(name))}</span>
        <span class="def-opt-desc">${escapeHtml(formatDslLiteral(String(desc)))}</span>
      </div>
      <div class="def-item-actions">
        <button class="btn btn-secondary btn-xs" data-action="edit-opt-default" title="Edytuj">✏️</button>
        <button class="btn btn-danger btn-xs" data-action="delete-opt-default" title="Usuń">🗑️</button>
      </div>
    </div>
  `).join('');
}

// ===== Defaults (OPT/SET) Management =====

export async function addDefault(ctx: DefaultsContext): Promise<void> {
  const name = await promptText('Nazwa zmiennej:', '', { title: 'Dodaj zmienną domyślną' });
  if (!name?.trim()) return;
  const value = await promptText('Wartość domyślna:', '', { title: 'Dodaj zmienną domyślną' });
  if (value === null) return;
  const typeStr = await promptText('Typ (opt/set):', 'set', { title: 'Dodaj zmienną domyślną' });
  const type = (typeStr === 'opt' ? 'opt' : 'set') as 'opt' | 'set';
  
  if (!ctx.defData.library.defaults) ctx.defData.library.defaults = [];
  ctx.defData.library.defaults.push({ name: name.trim(), value: value.trim(), type, description: '' });
  renderDefaults(ctx);
  ctx.scheduleAutosave();
  notifyBottomLine(`✅ Dodano ${type.toUpperCase()}: ${name.trim()}`, 'success', 2000);
}

export async function deleteDefault(ctx: DefaultsContext, index: number): Promise<void> {
  const defaults = ctx.defData.library.defaults || [];
  const def = defaults[index];
  if (def && await confirmAction(`Usunąć "${def.name}"?`)) {
    defaults.splice(index, 1);
    renderDefaults(ctx);
    ctx.scheduleAutosave();
    notifyBottomLine(`🗑️ Usunięto: ${def.name}`, 'info', 2000);
  }
}

export function scanDefaultsFromDsl(ctx: DefaultsContext): void {
  renderDefaults(ctx); // Just refresh from GOALs
  notifyBottomLine('🔍 Odświeżono zmienne SET/OPT z GOALi', 'success', 2000);
}

export function renderDefaults(ctx: DefaultsContext): void {
  const list = document.getElementById('defaults-list');
  if (!list) return;
  
  const vars = ctx.extractSetVarsFromGoals();
  
  if (vars.length === 0) {
    list.innerHTML = '<p class="text-sm text-muted">Brak zmiennych SET/OPT w GOALach. Dodaj SET lub OPT w kodzie GOAL.</p>';
    return;
  }
  
  // Group by goal index (each goal gets its own section, even if names are the same)
  const byGoalIdx = new Map<number, { name: string; vars: typeof vars }>();
  for (const v of vars) {
    if (!byGoalIdx.has(v.goalIdx)) {
      byGoalIdx.set(v.goalIdx, { name: v.goalName, vars: [] });
    }
    byGoalIdx.get(v.goalIdx)!.vars.push(v);
  }
  
  let html = '';
  for (const [goalIdx, goalData] of byGoalIdx) {
    const goalLabel = `#${goalIdx + 1} ${escapeHtml(goalData.name)}`;
    html += `<div class="def-vars-goal-section" data-goal-idx="${goalIdx}">
      <div class="def-vars-goal-header">🎯 ${goalLabel}</div>
      <div class="def-vars-goal-list">`;
    
    for (const v of goalData.vars) {
      // Get saved role for this variable
      const varKey = `${v.goalIdx}:${v.varName}`;
      const savedRole = (ctx.defData.library as any).varRoles?.[varKey] || '';
      
      html += `
        <div class="def-set-var-item" data-goal-idx="${v.goalIdx}" data-line-idx="${v.lineIdx}" data-var-name="${escapeHtml(v.varName)}">
          <span class="def-var-type ${v.type}">${v.type.toUpperCase()}</span>
          <span class="def-var-name">${escapeHtml(formatDslLiteral(v.varName))}</span>
          <span class="def-var-eq">=</span>
          <input type="text" class="def-var-value" value="${escapeHtml(v.value)}" placeholder="wartość" />
          <select class="def-var-role" title="Rola użytkownika">
            <option value="">-- Rola --</option>
            <option value="operator" ${savedRole === 'operator' ? 'selected' : ''}>Operator</option>
            <option value="technician" ${savedRole === 'technician' ? 'selected' : ''}>Technik</option>
            <option value="manager" ${savedRole === 'manager' ? 'selected' : ''}>Manager</option>
            <option value="admin" ${savedRole === 'admin' ? 'selected' : ''}>Admin</option>
            <option value="configurator" ${savedRole === 'configurator' ? 'selected' : ''}>Konfigurator</option>
          </select>
        </div>`;
    }
    
    html += '</div></div>';
  }
  
  list.innerHTML = html;
  bindSetVarEditors(ctx);
}

export function bindSetVarEditors(ctx: DefaultsContext): void {
  const items = document.querySelectorAll('.def-set-var-item');
  items.forEach(item => {
    const goalIdx = Number.parseInt((item as HTMLElement).dataset.goalIdx || '0', 10);
    const lineIdx = Number.parseInt((item as HTMLElement).dataset.lineIdx || '0', 10);
    const varName = (item as HTMLElement).dataset.varName || '';
    const valueInput = item.querySelector('.def-var-value') as HTMLInputElement;
    const roleSelect = item.querySelector('.def-var-role') as HTMLSelectElement;
    
    valueInput?.addEventListener('input', () => {
      updateSetVarInGoal(ctx, goalIdx, lineIdx, varName, valueInput.value);
    });
    
    roleSelect?.addEventListener('change', () => {
      updateVarRole(ctx, goalIdx, varName, roleSelect.value);
    });
  });
}

/** Update the role assignment for a variable in DEF JSON */
export function updateVarRole(ctx: DefaultsContext, goalIdx: number, varName: string, role: string): void {
  // Initialize varRoles if not exists
  if (!(ctx.defData.library as any).varRoles) {
    (ctx.defData.library as any).varRoles = {};
  }
  
  const varKey = `${goalIdx}:${varName}`;
  
  if (role) {
    (ctx.defData.library as any).varRoles[varKey] = role;
  } else {
    delete (ctx.defData.library as any).varRoles[varKey];
  }
  
  ctx.updateSourceEditor();
  ctx.scheduleAutosave();
}

/** Update a SET/OPT variable value in the GOAL code */
export function updateSetVarInGoal(ctx: DefaultsContext, goalIdx: number, lineIdx: number, varName: string, newValue: string): void {
  const goals = ctx.defData.library.goals;
  if (!goals || !goals[goalIdx]) return;
  
  const code = goals[goalIdx].code || '';
  const lines = code.split('\n');
  
  if (lineIdx >= lines.length) return;
  
  const line = lines[lineIdx];

  const updated = replaceGoalVariableLineValue(line, varName, newValue);
  if (updated === line) return;
  
  lines[lineIdx] = updated;
  goals[goalIdx].code = lines.join('\n');
  
  // Also update the GOAL textarea if visible
  const goalItem = document.querySelector(`.def-goal-item[data-index="${goalIdx}"]`);
  const codeArea = goalItem?.querySelector('.def-goal-code') as HTMLTextAreaElement;
  if (codeArea) codeArea.value = goals[goalIdx].code;
  
  ctx.scheduleAutosave();
}
