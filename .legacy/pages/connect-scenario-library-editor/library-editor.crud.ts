// frontend/src/pages/connect-scenario-library-editor/library-editor.crud.ts
// Extracted from library-editor.page.ts — library item CRUD and editor binding logic

import { notifyBottomLine } from '../../modules/shared/generic-grid/utils';
import { confirmAction, promptText } from '../../modules/connect-scenario/helpers/scenario-dialogs';
import type { DefData } from '../../modules/connect-scenario/helpers/def-editor.render';

export interface CrudContext {
  defData: DefData;
  renderList: (type: string, items: string[]) => void;
  renderMappings: () => void;
  renderFuncs: () => void;
  renderGoals: () => void;
  scheduleAutosave: () => void;
}

// ===== Library Item CRUD =====

export async function addItem(type: string, ctx: CrudContext): Promise<void> {
  const labels: Record<string, string> = {
    objects: 'obiekt',
    functions: 'funkcję',
    params: 'parametr',
    units: 'jednostkę',
    logs: 'log',
    alarms: 'alarm',
    errors: 'błąd',
    funcs: 'procedurę FUNC'
  };
  const name = await promptText(`Podaj nazwę (${labels[type]}):`, '', { title: 'Dodaj element biblioteki' });
  if (!name?.trim()) return;
  const list = (ctx.defData.library as any)[type] as string[];
  if (!list.includes(name.trim())) {
    list.push(name.trim());
    ctx.renderList(type, list);
    ctx.renderMappings();
    notifyBottomLine(`✅ Dodano ${labels[type]}: ${name.trim()}`, 'success', 2000);
  }
}

export async function editItem(type: string, index: number, ctx: CrudContext): Promise<void> {
  const list = (ctx.defData.library as any)[type] as string[];
  const current = list[index];
  const newName = await promptText('Edytuj nazwę:', current, { title: 'Edytuj element biblioteki' });
  if (newName?.trim() && newName.trim() !== current) {
    list[index] = newName.trim();
    ctx.renderList(type, list);
    ctx.renderMappings();
  }
}

export async function deleteItem(type: string, index: number, ctx: CrudContext): Promise<void> {
  const list = (ctx.defData.library as any)[type] as string[];
  const name = list[index];
  if (await confirmAction(`Usunąć "${name}"?`)) {
    list.splice(index, 1);
    ctx.renderList(type, list);
    ctx.renderMappings();
    notifyBottomLine(`🗑️ Usunięto: ${name}`, 'info', 2000);
  }
}

// ===== FUNC CRUD =====

export async function addFunc(ctx: CrudContext): Promise<void> {
  const name = await promptText('Nazwa procedury FUNC:', '', { title: 'Dodaj FUNC' });
  if (!name?.trim()) return;
  if (!ctx.defData.library.funcs) ctx.defData.library.funcs = [];
  ctx.defData.library.funcs.push({ name: name.trim(), code: '' });
  ctx.renderFuncs();
  notifyBottomLine(`✅ Dodano FUNC: ${name.trim()}`, 'success', 2000);
}

export async function deleteFunc(index: number, ctx: CrudContext): Promise<void> {
  const funcs = ctx.defData.library.funcs || [];
  const func = funcs[index];
  if (func && await confirmAction(`Usunąć FUNC "${func.name}"?`)) {
    funcs.splice(index, 1);
    ctx.renderFuncs();
    notifyBottomLine(`🗑️ Usunięto FUNC: ${func.name}`, 'info', 2000);
  }
}

export function bindFuncEditors(ctx: CrudContext): void {
  const funcItems = document.querySelectorAll('.def-func-item');
  funcItems.forEach(item => {
    const idx = parseInt((item as HTMLElement).dataset.index || '0', 10);
    const nameInput = item.querySelector('.def-func-name') as HTMLInputElement;
    const codeArea = item.querySelector('.def-func-code') as HTMLTextAreaElement;
    if (nameInput) {
      nameInput.addEventListener('input', () => {
        if (ctx.defData.library.funcs && ctx.defData.library.funcs[idx]) {
          ctx.defData.library.funcs[idx].name = nameInput.value;
          ctx.scheduleAutosave();
        }
      });
    }
    if (codeArea) {
      codeArea.addEventListener('input', () => {
        if (ctx.defData.library.funcs && ctx.defData.library.funcs[idx]) {
          ctx.defData.library.funcs[idx].code = codeArea.value;
          ctx.scheduleAutosave();
        }
      });
    }
  });
}

// ===== GOAL CRUD =====

export async function addGoal(ctx: CrudContext): Promise<void> {
  const name = await promptText('Nazwa czynności GOAL:', '', { title: 'Dodaj GOAL' });
  if (!name?.trim()) return;
  if (!ctx.defData.library.goals) ctx.defData.library.goals = [];
  ctx.defData.library.goals.push({ name: name.trim(), code: '' });
  ctx.renderGoals();
  notifyBottomLine(`✅ Dodano GOAL: ${name.trim()}`, 'success', 2000);
}

export async function deleteGoal(index: number, ctx: CrudContext): Promise<void> {
  const goals = ctx.defData.library.goals || [];
  const goal = goals[index];
  if (goal && await confirmAction(`Usunąć GOAL "${goal.name}"?`)) {
    goals.splice(index, 1);
    ctx.renderGoals();
    notifyBottomLine(`🗑️ Usunięto GOAL: ${goal.name}`, 'info', 2000);
  }
}

export function moveGoal(index: number, direction: -1 | 1, ctx: CrudContext): void {
  const goals = ctx.defData.library.goals || [];
  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= goals.length) return;
  [goals[index], goals[newIndex]] = [goals[newIndex], goals[index]];
  ctx.renderGoals();
  ctx.scheduleAutosave();
}

export function bindGoalEditors(ctx: CrudContext): void {
  const goalItems = document.querySelectorAll('.def-goal-item');
  goalItems.forEach(item => {
    const idx = parseInt((item as HTMLElement).dataset.index || '0', 10);
    const nameInput = item.querySelector('.def-goal-name') as HTMLInputElement;
    const codeArea = item.querySelector('.def-goal-code') as HTMLTextAreaElement;
    if (nameInput) {
      nameInput.addEventListener('input', () => {
        if (ctx.defData.library.goals && ctx.defData.library.goals[idx]) {
          ctx.defData.library.goals[idx].name = nameInput.value;
          ctx.scheduleAutosave();
        }
      });
    }
    if (codeArea) {
      codeArea.addEventListener('input', () => {
        if (ctx.defData.library.goals && ctx.defData.library.goals[idx]) {
          ctx.defData.library.goals[idx].code = codeArea.value;
          ctx.scheduleAutosave();
        }
      });
    }
  });
}

// ===== Mapping CRUD =====

export async function addObjectFunctionMapping(obj: string, ctx: CrudContext): Promise<void> {
  const available = ctx.defData.library.functions;
  const fn = await promptText(`Wybierz funkcję dla "${obj}":\n${available.join(', ')}`, '', { title: 'Dodaj mapowanie obiekt → funkcja' });
  if (!fn?.trim()) return;
  if (!ctx.defData.library.objectFunctionMap) ctx.defData.library.objectFunctionMap = {};
  if (!ctx.defData.library.objectFunctionMap[obj]) ctx.defData.library.objectFunctionMap[obj] = { functions: [] };
  const fns = ctx.defData.library.objectFunctionMap[obj].functions;
  if (!fns.includes(fn.trim())) {
    fns.push(fn.trim());
    ctx.renderMappings();
  }
}

export function removeObjectFunctionMapping(obj: string, fn: string, ctx: CrudContext): void {
  const map = ctx.defData.library.objectFunctionMap;
  if (map && map[obj]) {
    map[obj].functions = map[obj].functions.filter((f: string) => f !== fn);
    ctx.renderMappings();
  }
}

export async function addParamUnitMapping(param: string, ctx: CrudContext): Promise<void> {
  const available = ctx.defData.library.units;
  const unit = await promptText(`Wybierz jednostkę dla "${param}":\n${available.join(', ')}`, '', { title: 'Dodaj mapowanie parametr → jednostka' });
  if (!unit?.trim()) return;
  if (!ctx.defData.library.paramUnitMap) ctx.defData.library.paramUnitMap = {};
  if (!ctx.defData.library.paramUnitMap[param]) ctx.defData.library.paramUnitMap[param] = { units: [] };
  const units = ctx.defData.library.paramUnitMap[param].units;
  if (!units.includes(unit.trim())) {
    units.push(unit.trim());
    ctx.renderMappings();
  }
}

export function removeParamUnitMapping(param: string, unit: string, ctx: CrudContext): void {
  const map = ctx.defData.library.paramUnitMap;
  if (map && map[param]) {
    map[param].units = map[param].units.filter((u: string) => u !== unit);
    ctx.renderMappings();
  }
}
