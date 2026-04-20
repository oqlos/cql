// scenarios.event-handlers.ts
// Event handlers for scenarios page - extracted from scenarios.controller.ts

import type { ScenariosControllerCtx } from './scenarios.ui-types';

/** Handle change events */
export function handleChange(ev: Event, ctx: ScenariosControllerCtx): void {
  const t = ev.target as HTMLElement;

  if (t && (t.classList.contains('param-select') || t.closest('.param-select'))) {
    ctx.refreshBuilderOptions();
  }
  ctx.updatePreview();
}

/** Handle library/dataset change events */
export function handleLibraryChange(e: Event, ctx: ScenariosControllerCtx): void {
  const t = e.target as HTMLElement;

  if ((t as HTMLSelectElement).id === 'lm-dataset') {
    ctx.libraryRender();
  }

  if ((t as HTMLSelectElement).id === 'scenario-sort') {
    const q = (document.getElementById('scenario-filter') as HTMLInputElement | null)?.value || '';
    const res = ctx.renderScenarioList(q);
    if (res && typeof (res as any).catch === 'function') {
      try { (res as any).catch(() => {}); } catch { /* silent */ }
    }
  }
}

/** Handle library filter input */
export function handleLibraryFilter(e: Event, ctx: ScenariosControllerCtx): void {
  const t = e.target as HTMLElement;
  if ((t as HTMLInputElement).id === 'lm-filter') {
    ctx.libraryRender();
  }
}

/** Handle scenario filter input */
export function handleScenarioFilter(e: Event, ctx: ScenariosControllerCtx): void {
  const t = e.target as HTMLElement;
  if ((t as HTMLInputElement).id === 'scenario-filter') {
    const q = (t as HTMLInputElement).value || '';
    const res = ctx.renderScenarioList(q);
    if (res && typeof (res as any).catch === 'function') {
      try { (res as any).catch(() => {}); } catch { /* silent */ }
    }
  }
}

/** Handle quick add scenario keydown */
export function handleQuickAddKeydown(e: KeyboardEvent, ctx: ScenariosControllerCtx): void {
  const t = e.target as HTMLElement;
  const inp = t && (t as HTMLInputElement).id === 'scenario-add-name' ? (t as HTMLInputElement) : null;
  if (!inp) return;

  if (e.key === 'Enter') {
    e.preventDefault();
    e.stopPropagation();
    const name = (inp.value || '').trim();
    if (!name) return;
    if (ctx.addScenario) { try { (ctx.addScenario(name) as any); } catch { /* silent */ } }
    inp.value = '';
  }
}
