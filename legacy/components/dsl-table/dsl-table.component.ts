// frontend/src/components/dsl-table/dsl-table.component.ts
// Generic DSL State Table component

import { escapeHtml } from '../../utils/html.utils';
import type { DslTableDefinition, DslTableRuntime } from './dsl-table.types';

export class DslTable {
  private root: HTMLElement;
  private tbody: HTMLElement | null = null;
  private statusEl: HTMLElement | null = null;
  private autoRefreshTimer: any = null;
  private showUnits = false;

  constructor(elementOrSelector: HTMLElement | string, options?: { statusElementSelector?: string; tbodySelector?: string; showUnits?: boolean }) {
    if (typeof elementOrSelector === 'string') {
      const el = document.querySelector(elementOrSelector) as HTMLElement | null;
      if (!el) throw new Error(`DslTable: element not found: ${elementOrSelector}`);
      this.root = el;
    } else {
      this.root = elementOrSelector;
    }

    this.showUnits = !!options?.showUnits;

    // Try to locate tbody (prefer custom selector if provided)
    const tbodySel = options?.tbodySelector;
    this.tbody = tbodySel
      ? (this.root.querySelector(tbodySel) as HTMLElement | null)
      : (this.root.querySelector('tbody') as HTMLElement | null);

    if (!this.tbody) this.initializeStructure();

    if (options?.statusElementSelector) {
      this.statusEl = document.querySelector(options.statusElementSelector) as HTMLElement | null;
    }
  }

  private initializeStructure(): void {
    // If root is a table, use it; otherwise create inner table
    const isTable = this.root.tagName.toLowerCase() === 'table';
    if (isTable) {
      // Ensure thead/tbody exist
      if (!this.root.querySelector('thead')) {
        const thead = document.createElement('thead');
        thead.innerHTML = this.showUnits
          ? `
          <tr>
            <th>Typ</th>
            <th>Nazwa</th>
            <th>Wartość</th>
            <th>Jedn.</th>
          </tr>
        `
          : `
          <tr>
            <th>Typ</th>
            <th>Nazwa</th>
            <th>Wartość</th>
          </tr>
        `;
        this.root.prepend(thead);
      }
      let tbody = this.root.querySelector('tbody');
      if (!tbody) {
        tbody = document.createElement('tbody');
        this.root.appendChild(tbody);
      }
      this.tbody = tbody as HTMLElement;
      return;
    }

    // Create default table inside root
    const unitCol = this.showUnits ? '<th>Jedn.</th>' : '';
    this.root.innerHTML = `
      <table class="dsl-data-table text-xs">
        <thead>
          <tr>
            <th>Typ</th>
            <th>Nazwa</th>
            <th>Wartość</th>
            ${unitCol}
          </tr>
        </thead>
        <tbody></tbody>
      </table>
    `;
    this.tbody = this.root.querySelector('tbody') as HTMLElement;
  }

  render(definitions: DslTableDefinition[], runtime: DslTableRuntime | null | undefined): void {
    if (!this.tbody) return;

    const rows = (definitions?.length
      ? definitions
      : this.runtimeKeys(runtime).map((k) => ({ type: '', name: k, units: '' }))
    ).filter((v) => String(v?.type || '').toLowerCase() !== 'function');

    const html = rows.map((v) => {
      const val = this.getValue(v.type, v.name, runtime);
      const valueStr = val === undefined || val === null || val === '' ? '—' : String(val);
      const unitCell = this.showUnits ? `<td>${escapeHtml(v.units || '')}</td>` : '';
      return `
        <tr>
          <td>${escapeHtml(v.type)}</td>
          <td>${escapeHtml(v.name)}</td>
          <td>${escapeHtml(valueStr)}</td>
          ${unitCell}
        </tr>
      `;
    });

    const colspan = this.showUnits ? 4 : 3;
    this.tbody.innerHTML = html.join('') || `<tr><td colspan="${colspan}"><em>Brak danych</em></td></tr>`;

    if (this.statusEl) {
      try { this.statusEl.textContent = new Date().toLocaleTimeString(); } catch { /* silent */ }
    }
  }

  clear(): void {
    if (this.tbody) {
      const colspan = this.showUnits ? 4 : 3;
      this.tbody.innerHTML = `<tr><td colspan="${colspan}"><em>Brak danych</em></td></tr>`;
    }
  }

  startAutoRefresh(refreshFn: () => Promise<void>, intervalMs = 1500): void {
    this.stopAutoRefresh();
    this.autoRefreshTimer = setInterval(refreshFn, intervalMs);
  }

  stopAutoRefresh(): void {
    if (this.autoRefreshTimer) {
      clearInterval(this.autoRefreshTimer);
      this.autoRefreshTimer = null;
    }
  }

  private runtimeKeys(runtime: DslTableRuntime | null | undefined): string[] {
    if (!runtime) return [];
    if (Array.isArray(runtime)) return runtime.map((r) => String(r?.name || '')).filter(Boolean);
    const dictKeys = new Set<string>();
    const add = (o?: Record<string, any>) => { if (!o) return; Object.keys(o).forEach((k) => dictKeys.add(k)); };
    if (typeof runtime === 'object') {
      if ('params' in runtime || 'objects' in runtime || 'functions' in runtime) {
        add((runtime as any).params);
        add((runtime as any).objects);
        add((runtime as any).functions);
      } else {
        add(runtime as Record<string, any>);
      }
    }
    return Array.from(dictKeys);
  }

  private getValue(type: string, name: string, runtime: DslTableRuntime | null | undefined): any {
    if (!runtime) return undefined;
    try {
      if (Array.isArray(runtime)) {
        const row = runtime.find((x) => x && x.type === type && String(x.name || '').trim() === name);
        return row?.value;
      }
      if (typeof runtime === 'object') {
        // Structured state
        const r: any = runtime;
        if (type === 'param' && r.params) return r.params[name];
        if (type === 'object' && r.objects) return r.objects[name];
        if (type === 'function' && r.functions) return r.functions[name];
        // Fallback: plain dict
        return (r as Record<string, any>)[name];
      }
    } catch { /* silent */ }
    return undefined;
  }
}
