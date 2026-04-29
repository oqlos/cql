import { handleActionSelectChange } from './variables.ui';
import { CONTAINER_CLICK_HANDLERS, handleContainerChange, handleVariableSelectChange } from './scenarios.ui-container-handlers';
import { promptText } from './scenario-dialogs';
import type { ScenariosControllerCtx } from './scenarios.ui-types';

export function bindContainerUiEvents(container: HTMLElement, ctx: ScenariosControllerCtx): void {
  container.addEventListener('input', (e) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('action-select')) {
      const varRow = target.closest('.var-row') as HTMLElement | null;
      if (varRow) {
        handleActionSelectChange(varRow);
        ctx.updatePreview();
      }
    }
  });

  container.addEventListener('focusin', (e) => {
    const sel = (e.target as HTMLElement).closest('select.object-select, select.function-select') as HTMLSelectElement | null;
    if (sel) { (sel as any).dataset.prevValue = sel.value || ''; }
  });


  container.addEventListener('click', async (e) => {
    for (const { selector, handler } of CONTAINER_CLICK_HANDLERS) {
      const btn = (e.target as HTMLElement).closest(selector) as HTMLElement | null;
      if (btn) { await handler(btn, e, container, ctx); return; }
    }
  });

  container.addEventListener('change', (e) => { handleContainerChange(e, container, ctx); });

  const renameAcrossScenario = (oldName: string, newName: string) => {
    const from = String(oldName || '').trim();
    const to = String(newName || '').trim();
    if (!from || !to || from === to) return;
    try {
      container.querySelectorAll<HTMLSelectElement>('select.param-select').forEach(sel => {
        const cur = (sel.value || '').trim();
        const hasTo = Array.from(sel.options).some(o => (o.text || o.value) === to);
        if (!hasTo) { const opt = document.createElement('option'); opt.text = to; opt.value = to; sel.add(opt, 0); }
        if (cur === from) { sel.value = to; }
        Array.from(sel.options).forEach(o => { if ((o.text || o.value) === from) { try { o.remove(); } catch { /* silent */ } } });
      });
    } catch { /* silent */ }
    try {
      container.querySelectorAll<HTMLSelectElement>('select.variable-select').forEach(sel => {
        const cur = (sel.value || '').trim();
        Array.from(sel.options).forEach(o => { const txt = (o.text || o.value); if (txt === from) { o.text = to; o.value = to; } });
        if (cur === from) sel.value = to;
      });
    } catch { /* silent */ }
    try { ctx.refreshBuilderOptions(); } catch { /* silent */ }
    try { ctx.updatePreview(); } catch { /* silent */ }
  };

  container.addEventListener('dblclick', async (e) => {
    const el = (e.target as HTMLElement).closest('select.param-select, select.variable-select, select.object-select, select.function-select') as HTMLSelectElement | null;
    if (!el) return;
    const oldName = (el.value || '').trim();
    if (!oldName || oldName === '*') return;
    const isVar = el.classList.contains('param-select') || el.classList.contains('variable-select');
    const isObj = el.classList.contains('object-select');
    const isFn = el.classList.contains('function-select');
    const label = isObj ? 'Nowa nazwa obiektu:' : isFn ? 'Nowa nazwa funkcji:' : 'Nowa nazwa zmiennej:';
    const next = await promptText(label, oldName, { title: 'Zmień nazwę' }) || '';
    const newName = next.trim();
    if (!newName || newName === oldName) return;
    const ev = e as MouseEvent;
    const perInstance = !!ev.shiftKey && (isObj || isFn);
    if (isVar) { renameAcrossScenario(oldName, newName); return; }
    if (perInstance) {
      if (!Array.from(el.options).some(o => (o.text || o.value) === newName)) { const opt = document.createElement('option'); opt.text = newName; opt.value = newName; el.add(opt, 0); }
      el.value = newName;
      try { ctx.updatePreview(); } catch { /* silent */ }
      return;
    }
    const selector = isObj ? 'select.object-select' : 'select.function-select';
    try {
      container.querySelectorAll<HTMLSelectElement>(selector).forEach(s => {
        const cur = (s.value || '').trim();
        if (!Array.from(s.options).some(o => (o.text || o.value) === newName)) { const opt = document.createElement('option'); opt.text = newName; opt.value = newName; s.add(opt, 0); }
        if (cur === oldName) { s.value = newName; }
        Array.from(s.options).forEach(o => { if ((o.text || o.value) === oldName) { try { o.remove(); } catch { /* silent */ } } });
      });
    } catch { /* silent */ }
    try { ctx.refreshBuilderOptions(); } catch { /* silent */ }
    try { ctx.updatePreview(); } catch { /* silent */ }
  });

  container.addEventListener('change', (e) => { handleVariableSelectChange(e, ctx); });
}
