// scenarios.click-handlers.ts
// Click event handlers for scenarios page - extracted from scenarios.controller.ts

import type { ScenariosControllerCtx } from './scenarios.ui-types';

/** Registry of click handlers by element ID/class */
const clickHandlers: Record<string, (t: HTMLElement, ctx: ScenariosControllerCtx) => void> = {
  'scenario-add-btn': handleScenarioAddBtn,
  'scenario-save-new': handleScenarioSaveNew,
  'open-library-manager': handleOpenLibraryManager,
  'lm-add': handleLibraryAdd,
};

/** Main click handler dispatcher */
export function handleClick(e: MouseEvent, ctx: ScenariosControllerCtx, toggle: (selector: string, open: boolean) => void): void {
  const t = e.target as HTMLElement;

  // Check registry handlers
  for (const [key, handler] of Object.entries(clickHandlers)) {
    if (t.id === key || t.closest(`#${key}`)) {
      handler(t, ctx);
      return;
    }
  }

  // Modal close buttons
  if (t.matches('[data-modal-close]') || t.closest('[data-modal-close]')) {
    toggle('#scenario-add-modal', false);
    toggle('#library-modal', false);
    toggle('#dsl-console-modal', false);
    try { (window as any).__goalRunClose?.(); } catch { /* silent */ }
    return;
  }

  // Library delete
  if (t.classList.contains('lm-delete') || t.closest('.lm-delete')) {
    const row = t.closest('tr') as HTMLElement | null;
    if (row) {
      ctx.libraryDelete(row.dataset.value || '');
      ctx.libraryRender();
      ctx.refreshBuilderOptions();
    }
    return;
  }

  // Scenario list row interactions
  const tr = t.closest('tr.scenario-row') as HTMLElement | null;
  if (tr) {
    handleScenarioRowClick(tr, t, ctx);
    return;
  }

  // Sidebar cards
  const card = t.closest('#scenario-card-list .example-item') as HTMLElement | null;
  if (card) {
    const id = card.dataset.scenarioId || '';
    if (id) ctx.loadScenarioById(id);
  }
}

/** Handle scenario add button click */
function handleScenarioAddBtn(_t: HTMLElement, ctx: ScenariosControllerCtx): void {
  const quick = document.getElementById('scenario-add-name') as HTMLInputElement | null;
  const name = (quick?.value || '').trim();
  if (name) {
    if (ctx.addScenario) { try { (ctx.addScenario(name) as any); } catch { /* silent */ } }
    if (quick) quick.value = '';
  } else {
    const modal = document.querySelector('#scenario-add-modal') as HTMLElement | null;
    if (modal) modal.classList.remove('hidden');
  }
}

/** Handle scenario save new click */
function handleScenarioSaveNew(_t: HTMLElement, ctx: ScenariosControllerCtx): void {
  const input = document.getElementById('scenario-new-name') as HTMLInputElement | null;
  const name = (input?.value || '').trim();
  if (!name) return;
  if (ctx.addScenario) { try { (ctx.addScenario(name) as any); } catch { /* silent */ } }

  const modal = document.querySelector('#scenario-add-modal') as HTMLElement | null;
  if (modal) modal.classList.add('hidden');

  const inputEl = document.getElementById('scenario-new-name') as HTMLInputElement | null;
  if (inputEl) inputEl.value = '';
}

/** Handle open library manager click */
function handleOpenLibraryManager(_t: HTMLElement, ctx: ScenariosControllerCtx): void {
  ctx.openLibraryManager();
}

/** Handle library add click */
function handleLibraryAdd(_t: HTMLElement, ctx: ScenariosControllerCtx): void {
  ctx.libraryAdd();
  ctx.libraryRender();
  ctx.refreshBuilderOptions();
}

/** Handle scenario row click */
function handleScenarioRowClick(tr: HTMLElement, t: HTMLElement, ctx: ScenariosControllerCtx): void {
  const actionBtn = t.closest('button');
  if (actionBtn && actionBtn.classList.contains('scn-delete')) {
    ctx.deleteScenario(tr.dataset.id || '');
  } else if (actionBtn && actionBtn.classList.contains('scn-clone')) {
    ctx.cloneScenarioById?.(tr.dataset.id || '');
  } else {
    const id = tr.dataset.id || '';
    if (id) ctx.loadScenarioById(id);
  }
}
