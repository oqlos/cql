// frontend/src/pages/connect-scenario-library-editor/library-editor.conversions.ts
// Extracted from library-editor.page.ts — Goal↔Func conversion and func selection modal

import { escapeHtml, notifyBottomLine } from '../../modules/shared/generic-grid/utils';
import { confirmAction } from '../../modules/connect-scenario/helpers/scenario-dialogs';
import type { DefData } from '../../modules/connect-scenario/helpers/def-editor.render';

export interface ConversionContext {
  defData: DefData;
  renderGoals: () => void;
  renderFuncs: () => void;
  bindGoalEditors: () => void;
  bindFuncEditors: () => void;
  scheduleAutosave: () => void;
  restoreCodeModal: () => void;
}

export async function convertGoalToFunc(ctx: ConversionContext, index: number): Promise<void> {
  const goals = ctx.defData.library.goals || [];
  const goal = goals[index];
  if (!goal) return;

  if (!(await confirmAction(`Konwertować GOAL "${goal.name}" do FUNC?`))) return;

  if (!ctx.defData.library.funcs) ctx.defData.library.funcs = [];
  
  // Add to funcs with same name and code
  ctx.defData.library.funcs.push({ 
    name: goal.name, 
    code: goal.code || '' 
  });

  // Remove from goals
  goals.splice(index, 1);

  // Re-render both lists
  ctx.renderGoals();
  ctx.renderFuncs();
  
  // Re-bind editors
  ctx.bindGoalEditors();
  ctx.bindFuncEditors();
  
  // Schedule autosave
  ctx.scheduleAutosave();
  
  notifyBottomLine(`🔄 Konwertowano GOAL "${goal.name}" do FUNC`, 'success', 2000);
}

export async function convertFuncToGoal(ctx: ConversionContext, index: number): Promise<void> {
  const funcs = ctx.defData.library.funcs || [];
  const func = funcs[index];
  if (!func) return;

  if (!(await confirmAction(`Konwertować FUNC "${func.name}" do GOAL?`))) return;

  if (!ctx.defData.library.goals) ctx.defData.library.goals = [];
  
  // Add to goals with same name and code
  ctx.defData.library.goals.push({ 
    name: func.name, 
    code: func.code || '' 
  });

  // Remove from funcs
  funcs.splice(index, 1);

  // Re-render both lists
  ctx.renderGoals();
  ctx.renderFuncs();
  
  // Re-bind editors
  ctx.bindGoalEditors();
  ctx.bindFuncEditors();
  
  // Schedule autosave
  ctx.scheduleAutosave();
  
  notifyBottomLine(`🔄 Konwertowano FUNC "${func.name}" do GOAL`, 'success', 2000);
}

export function showFuncSelectionModal(ctx: ConversionContext, goalIndex: number): void {
  const modal = document.getElementById('def-code-modal');
  const title = modal?.querySelector('.modal-header h4');
  const body = modal?.querySelector('.modal-body');
  const footer = modal?.querySelector('.modal-footer');
  
  if (!modal || !title || !body || !footer) return;
  
  const funcs = ctx.defData.library.funcs || [];
  
  // Update modal title
  title.textContent = '➕ Dodaj FUNC do GOAL';
  
  if (funcs.length === 0) {
    body.innerHTML = '<p class="text-sm text-muted">Brak dostępnych procedur FUNC. Najpierw dodaj FUNC w zakładce 🔧 FUNC.</p>';
  } else {
    body.innerHTML = `
      <p class="text-sm text-muted mb-3">Wybierz procedurę FUNC, którą chcesz dodać do GOAL:</p>
      <div class="func-selection-list">
        ${funcs.map((func, idx) => `
          <div class="func-selection-item" data-func-index="${idx}" data-goal-index="${goalIndex}" style="border: 1px solid var(--border); border-radius: 4px; padding: 12px; margin-bottom: 8px; cursor: pointer; transition: background-color 0.2s;" onmouseover="this.style.backgroundColor='var(--surface-hover)'" onmouseout="this.style.backgroundColor='transparent'">
            <div class="d-flex justify-between items-center">
              <div>
                <strong>${escapeHtml(func.name)}</strong>
                ${func.code ? `<div class="text-xs text-muted mt-1">${escapeHtml(func.code.substring(0, 100))}${func.code.length > 100 ? '...' : ''}</div>` : '<div class="text-xs text-muted mt-1">Brak kodu</div>'}
              </div>
              <button class="btn btn-primary btn-xs" data-action="select-func-for-goal">➕ Dodaj</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }
  
  // Update footer
  footer.innerHTML = '<button class="btn btn-secondary" data-action="close-modal">Anuluj</button>';
  
  // Store current mode for event handling
  (modal as any)._mode = 'func-selection';
  (modal as any)._goalIndex = goalIndex;
  
  modal.classList.remove('hidden');
}

export function addFuncToGoal(ctx: ConversionContext, goalIndex: number, funcIndex: number): void {
  const goals = ctx.defData.library.goals || [];
  const funcs = ctx.defData.library.funcs || [];
  
  const goal = goals[goalIndex];
  const func = funcs[funcIndex];
  
  if (!goal || !func) return;
  
  // Append only FUNC declaration comment to GOAL code
  const existingCode = goal.code || '';
  
  // Add separator if needed
  let separator = '';
  if (existingCode.trim()) {
    separator = '\n';
  }
  
  // Add only FUNC declaration comment (without // prefix)
  const funcDeclaration = `FUNC: ${func.name}`;
  
  // Combine codes
  const newCode = existingCode.trim() 
    ? `${existingCode.trim()}${separator}${funcDeclaration}`
    : funcDeclaration;
  
  goal.code = newCode;
  
  // Restore modal to original state and hide it
  ctx.restoreCodeModal();
  const modal = document.getElementById('def-code-modal');
  if (modal) {
    modal.classList.add('hidden');
  }
  
  // Re-render goals and bind editors
  ctx.renderGoals();
  ctx.bindGoalEditors();
  
  // Schedule autosave
  ctx.scheduleAutosave();
  
  notifyBottomLine(`✅ Dodano deklarację FUNC "${func.name}" do GOAL "${goal.name}"`, 'success', 2000);
}

export function restoreCodeModal(): void {
  const modal = document.getElementById('def-code-modal');
  const title = modal?.querySelector('.modal-header h4');
  const body = modal?.querySelector('.modal-body');
  const footer = modal?.querySelector('.modal-footer');
  
  if (!modal || !title || !body || !footer) return;
  
  // Restore original modal content
  title.textContent = '📄 Kod DEF';
  body.innerHTML = '<pre id="def-code-preview" class="mono text-sm" style="max-height:400px;overflow:auto;background:var(--bg-muted);padding:12px;border-radius:4px;"></pre>';
  footer.innerHTML = `
    <button class="btn btn-secondary" data-action="copy-code">📋 Kopiuj</button>
    <button class="btn btn-primary" data-action="close-modal">Zamknij</button>
  `;
  
  // Clear mode
  delete (modal as any)._mode;
  delete (modal as any)._goalIndex;
}
