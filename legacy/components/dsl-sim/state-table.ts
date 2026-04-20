// frontend/src/components/dsl-sim/state-table.ts
import { escapeHtml } from '../../utils/html.utils';

export type StateDefinition = {
  type: string;
  name: string;
  units?: string;
  origin?: string; // Source/origin info: 'user', 'sensor', 'default', 'scenario', etc.
};

export type StateValue = {
  [key: string]: any;
};

export class DslStateTable {
  private readonly element: HTMLElement;
  private tbody: HTMLElement | null = null;
  private readonly statusElement: HTMLElement | null = null;
  private autoRefreshTimer: any = null;

  constructor(elementOrSelector: HTMLElement | string, statusElementSelector?: string) {
    if (typeof elementOrSelector === 'string') {
      const el = document.querySelector(elementOrSelector) as HTMLElement;
      if (!el) throw new Error(`DSL State Table: Element not found: ${elementOrSelector}`);
      this.element = el;
    } else {
      this.element = elementOrSelector;
    }

    // Find tbody or create table structure
    this.tbody = this.element.querySelector('tbody');
    if (!this.tbody) {
      this.initializeTable();
    }

    if (statusElementSelector) {
      this.statusElement = document.querySelector(statusElementSelector) as HTMLElement;
    }
  }

  private initializeTable(): void {
    this.element.innerHTML = `
      <table class="dsl-data-table text-xs">
        <thead>
          <tr>
            <th class="text-color">Typ</th>
            <th class="text-color">Nazwa</th>
            <th class="text-color">Wartość</th>
            <th class="text-color">Jedn.</th>
            <th class="text-color">Źródło</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
    `;
    this.tbody = this.element.querySelector('tbody');
  }

  render(definitions: StateDefinition[], runtime: StateValue): void {
    if (!this.tbody) return;

    const rows = (definitions.length ? definitions : Object.keys(runtime).map(k => ({ 
      type: '', 
      name: k, 
      units: '',
      origin: ''
    })))
      .filter(v => String(v?.type || '').toLowerCase() !== 'function');

    const html = rows.map(v => {
      const key = v.name;
      const val = runtime[key];
      const valueStr = (val === undefined || val === null || val === '') ? '—' : String(val);
      const originStr = v.origin || '';
      const originBadge = this.getOriginBadge(originStr);
      return `
        <tr>
          <td>${escapeHtml(v.type)}</td>
          <td>${escapeHtml(v.name)}</td>
          <td>${escapeHtml(valueStr)}</td>
          <td>${escapeHtml(v.units || '')}</td>
          <td>${originBadge}</td>
        </tr>
      `;
    });

    this.tbody.innerHTML = html.join('') || '<tr><td colspan="5"><em>Brak danych</em></td></tr>';
    
    if (this.statusElement) {
      this.statusElement.textContent = new Date().toLocaleTimeString();
    }
  }

  clear(): void {
    if (this.tbody) {
      this.tbody.innerHTML = '<tr><td colspan="4"><em>Brak danych</em></td></tr>';
    }
  }

  startAutoRefresh(refreshFn: () => Promise<void>, intervalMs: number = 2500): void {
    this.stopAutoRefresh();
    this.autoRefreshTimer = setInterval(refreshFn, intervalMs);
  }

  stopAutoRefresh(): void {
    if (this.autoRefreshTimer) {
      clearInterval(this.autoRefreshTimer);
      this.autoRefreshTimer = null;
    }
  }

  private getOriginBadge(origin: string): string {
    if (!origin) return '<span style="color:var(--text-muted);">—</span>';
    const lc = origin.toLowerCase();
    let color = 'var(--text-muted)';
    let label = origin;
    if (lc === 'user' || lc === 'manual') { color = '#2196f3'; label = '👤 Użytkownik'; }
    else if (lc === 'sensor' || lc === 'device') { color = '#4caf50'; label = '📡 Czujnik'; }
    else if (lc === 'default' || lc === 'initial') { color = '#9e9e9e'; label = '⚙️ Domyślna'; }
    else if (lc === 'scenario' || lc === 'dsl') { color = '#ff9800'; label = '📋 Scenariusz'; }
    else if (lc === 'calculated' || lc === 'computed') { color = '#9c27b0'; label = '🔢 Obliczona'; }
    return `<span style="color:${color};font-size:0.85em;">${escapeHtml(label)}</span>`;
  }
}
