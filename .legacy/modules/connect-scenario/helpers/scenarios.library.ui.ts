// frontend/src/modules/connect-scenario/helpers/scenarios.library.ui.ts

import { ScenariosLibrary } from './scenarios.library';
import { ScenariosDnD } from './scenarios.dnd';
import { getScenarioCQRS } from '../cqrs/singleton';

export class ScenariosLibraryUI {
  // Sidebar widgets for draggable library chips
  static renderSidebarLibrary(): void {
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const renderSection = (containerId: string, dataset: 'objects'|'functions'|'params', typeAttr: 'object'|'function'|'param') => {
      const el = document.getElementById(containerId);
      if (!el) return;
      const items = ScenariosLibrary.load(dataset);
      el.innerHTML = items.map(v => `<span class="library-item" draggable="true" data-type="${typeAttr}">${esc(v)}</span>`).join('');
    };
    renderSection('lib-objects', 'objects', 'object');
    renderSection('lib-functions', 'functions', 'function');
    renderSection('lib-params', 'params', 'param');
    // Re-bind drag and drop on new items
    try { ScenariosDnD.initialize(document); } catch { /* silent */ }
  }

  // Modal: open/close and render table
  static openManager(): void {
    this.toggleModal('#library-modal', true);
    this.render();
  }

  static render(): void {
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const dsSel = document.getElementById('lm-dataset') as HTMLSelectElement | null;
    const tbody = document.getElementById('lm-tbody');
    const filterEl = document.getElementById('lm-filter') as HTMLInputElement | null;
    if (!dsSel || !tbody) return;
    const ds = (dsSel.value as any) || 'objects';
    const q = (filterEl?.value || '').toLowerCase();
    const items = ScenariosLibrary.load(ds).filter(v => !q || v.toLowerCase().includes(q));
    (tbody as HTMLElement).innerHTML = items.map(v => `
      <tr data-value="${esc(v)}">
        <td>${esc(v)}</td>
        <td style="text-align:right;"><button class="btn btn-secondary lm-delete">🗑️</button></td>
      </tr>
    `).join('') || '<tr><td colspan="2"><em>Brak wyników</em></td></tr>';
  }

  static addItem(): void {
    const dsSel = document.getElementById('lm-dataset') as HTMLSelectElement | null;
    const input = document.getElementById('lm-new-value') as HTMLInputElement | null;
    if (!dsSel || !input) return;
    const val = (input.value || '').trim();
    if (!val) return;
    const ds = dsSel.value as any;
    const items = ScenariosLibrary.load(ds);
    if (!items.includes(val)) {
      items.push(val);
      ScenariosLibrary.save(ds, items);
      try { const cqrs = getScenarioCQRS(); cqrs?.dispatch({ type: 'LibraryAddItem', dataset: ds, value: val }); } catch { /* silent */ }
    }
    input.value = '';
    this.render();
  }

  static deleteItem(value: string): void {
    const dsSel = document.getElementById('lm-dataset') as HTMLSelectElement | null;
    if (!dsSel) return;
    const ds = dsSel.value as any;
    const items = ScenariosLibrary.load(ds).filter(v => v !== value);
    ScenariosLibrary.save(ds, items);
    try { const cqrs = getScenarioCQRS(); cqrs?.dispatch({ type: 'LibraryDeleteItem', dataset: ds, value }); } catch { /* silent */ }
    this.render();
  }

  private static toggleModal(selector: string, open: boolean): void {
    const el = document.querySelector(selector) as HTMLElement | null;
    if (!el) return;
    el.classList.toggle('hidden', !open);
  }
}
