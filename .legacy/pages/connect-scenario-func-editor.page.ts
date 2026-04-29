// frontend/src/pages/connect-scenario-func-editor.page.ts
// FUNC Editor - edytor procedur wielokrotnego użytku

import { ScenariosService } from '../modules/connect-scenario/helpers/scenarios.service';
import { highlightDsl } from '../components/dsl';
import { escapeHtml } from '../utils/html.utils';
import '../components/dsl/dsl.highlight.css';
import { attachFuncEditorListeners, type FuncEditorCallbacks } from '../modules/connect-scenario/helpers/func-editor-bindings';
import { parseFuncDefinitions, validateFunc } from '../modules/connect-scenario/helpers/func-editor-parser';
import {
  getFuncEditorPlaceholder,
  getFuncEditorSyntaxExample,
  getFuncEditorUsageExample,
} from '../modules/connect-scenario/helpers/cql-editor-content';

export class FuncEditorPage {

  /** Page discovery compatible render method */
  render(): string {
    return FuncEditorPage.getContent();
  }
  private static currentScenarioId: string = '';
  private static currentScenarioTitle: string = '';
  private static originalFunc: string = '';
  private static isDirty: boolean = false;
  private static scenariosList: Array<{ id: string; name: string; updatedAt?: string }> = [];
  private static scenarioFilter: string = '';

  static getContent(): string {
    return `
      <div class="page-content func-editor-page">
        <div class="page-header d-flex items-center justify-between">
          <div>
            <h2>🔧 Edytor FUNC — Procedury wielokrotnego użytku w DSL</h2>
          </div>
          <div class="scenario-context" id="func-scenario-context">
            <span class="text-sm text-muted">Scenariusz:</span>
            <strong id="func-scenario-title">—</strong>
            <span id="func-status" class="text-xs ml-2"></span>
            <a href="/connect-scenario/scenarios" class="btn btn-secondary btn-sm ml-2">← Budowanie</a>
          </div>
        </div>
        
        <div class="func-editor-layout">
          <!-- Scenario List (Left) -->
          <div class="func-scenario-list">
            <div class="scenario-list-filter">
              <div class="filter-row d-flex gap-sm" style="flex-wrap:wrap;align-items:center;">
                <input type="text" id="func-scenario-filter" class="search-input" placeholder="Filtruj...">
                <select id="scenario-sort" class="search-input" style="flex:1 1 180px;min-width:160px;max-width:100%;">
                  <option value="date_desc">Data (najnowsze)</option>
                  <option value="date_asc">Data (najstarsze)</option>
                  <option value="name_asc">Nazwa (A→Z)</option>
                  <option value="name_desc">Nazwa (Z→A)</option>
                </select>
              </div>
            </div>
            <div class="scenario-table-wrapper">
              <table class="scenario-table text-sm">
                <thead>
                  <tr>
                    <th>Scenariusz</th>
                    <th>FUNC</th>
                  </tr>
                </thead>
                <tbody id="func-scenario-list-body"></tbody>
              </table>
            </div>
          </div>
          
          <!-- Editor (Center) -->
          <div class="func-editor-main">
            <div class="func-editor-header">
              <span class="text-sm text-muted">Definicje FUNC</span>
              <div class="d-flex gap-xs">
                <button id="func-save-btn" class="btn btn-primary btn-sm" disabled>💾 Zapisz</button>
                <button id="func-add-template" class="btn btn-secondary btn-sm">➕ Dodaj</button>
                <button id="func-validate" class="btn btn-secondary btn-sm">✅ Waliduj</button>
              </div>
            </div>
            <div class="func-editor-wrapper">
              <pre id="func-editor-highlight" class="func-editor-highlight" aria-hidden="true"></pre>
              <textarea id="func-editor-textarea" class="mono" spellcheck="false" placeholder="${escapeHtml(getFuncEditorPlaceholder())}"></textarea>
            </div>
          </div>
          
          <!-- Preview & Help (Right) -->
          <div class="func-editor-sidebar">
            <div class="func-panel">
              <div class="func-panel-header">📋 Zdefiniowane FUNC</div>
              <div class="func-panel-body" id="func-preview"></div>
            </div>
            
            <div class="func-panel">
              <div class="func-panel-header">👁️ Podgląd kodu</div>
              <div class="func-panel-body" id="func-code-preview">
                <p class="text-muted text-xs">Wpisz kod FUNC, aby zobaczyć podgląd z kolorowaniem składni</p>
              </div>
            </div>
            
            <div class="func-panel">
              <div class="func-panel-header">📖 Składnia <a href="/docs/connex-dsl.md" target="_blank" class="text-xs ml-2">📚 Pełna dokumentacja</a></div>
              <div class="func-panel-body text-xs" id="func-syntax-help"></div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  static getStyles(): string {
    return `
      .func-editor-page { height: 100%; display: flex; flex-direction: column; }
      .func-editor-layout { display: flex; flex: 1; gap: 12px; min-height: 0; margin-top: 12px; }
      
      /* Scenario List */
      .func-scenario-list {
        width: 200px;
        min-width: 180px;
        display: flex;
        flex-direction: column;
        background: var(--panel-bg);
        border: 1px solid var(--panel-border);
        border-radius: 6px;
        overflow: hidden;
      }
      .scenario-list-filter { padding: 8px; border-bottom: 1px solid var(--panel-border); }
      .search-input {
        width: 100%;
        padding: 6px 10px;
        border: 1px solid var(--panel-border);
        border-radius: 4px;
        background: var(--bg);
        color: var(--text);
        font-size: 12px;
      }
      .scenario-table-wrapper { flex: 1; overflow: auto; }
      .scenario-table { width: 100%; border-collapse: collapse; }
      .scenario-table th, .scenario-table td { padding: 8px; text-align: left; border-bottom: 1px solid var(--panel-border); }
      .scenario-table th { background: var(--bg-muted); font-weight: 600; font-size: 11px; }
      .scenario-table tr { cursor: pointer; }
      .scenario-table tr:hover { background: var(--bg-muted); }
      .scenario-table tr.active { background: var(--primary); color: white; }
      .scenario-table .func-count { font-size: 10px; color: var(--text-muted); }
      .scenario-table tr.active .func-count { color: rgba(255,255,255,0.8); }
      
      /* Editor */
      .func-editor-main { flex: 1; display: flex; flex-direction: column; min-height: 0; }
      .func-editor-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
      
      /* Syntax highlighted editor wrapper */
      .func-editor-wrapper {
        position: relative;
        flex: 1;
        display: flex;
        min-height: 300px;
      }
      
      .func-editor-highlight {
        position: absolute;
        top: 0; left: 0; right: 0; bottom: 0;
        margin: 0;
        padding: 12px;
        border: 1px solid var(--panel-border);
        border-radius: 6px;
        background: var(--panel-bg);
        font-family: 'Courier New', monospace;
        font-size: 13px;
        line-height: 1.5;
        white-space: pre-wrap;
        word-wrap: break-word;
        overflow: auto;
        pointer-events: none;
        color: var(--text);
      }
      
      #func-editor-textarea {
        position: relative;
        flex: 1;
        width: 100%;
        resize: none;
        border: 1px solid transparent;
        background: transparent;
        color: transparent;
        caret-color: var(--text);
        padding: 12px;
        border-radius: 6px;
        font-family: 'Courier New', monospace;
        font-size: 13px;
        line-height: 1.5;
        z-index: 1;
      }
      
      #func-editor-textarea:focus {
        outline: 2px solid var(--primary);
        outline-offset: -1px;
      }
      
      #func-editor-textarea::selection {
        background: rgba(var(--primary-rgb, 59, 130, 246), 0.3);
      }
      
      /* Sidebar */
      .func-editor-sidebar { width: 280px; min-width: 240px; display: flex; flex-direction: column; gap: 12px; }
      .func-panel {
        border: 1px solid var(--panel-border);
        border-radius: 6px;
        background: var(--panel-bg);
        overflow: hidden;
      }
      .func-panel-header {
        padding: 8px 12px;
        background: var(--bg-muted);
        border-bottom: 1px solid var(--panel-border);
        font-weight: 600;
        font-size: 13px;
      }
      .func-panel-body { padding: 12px; max-height: 250px; overflow: auto; }
      .func-item {
        padding: 8px;
        border: 1px solid var(--panel-border);
        border-radius: 4px;
        margin-bottom: 8px;
        background: var(--bg-muted);
        cursor: pointer;
      }
      .func-item:hover { border-color: var(--primary); }
      .func-item-name { font-weight: 600; color: var(--primary); margin-bottom: 4px; font-size: 13px; }
      .func-item-steps { font-size: 11px; color: var(--text-muted); }
      .dirty-indicator { color: var(--warning); font-weight: bold; }
      .scenario-context { display: flex; align-items: center; gap: 8px; }
      
      /* Syntax highlighted code preview */
      .dsl-highlighted {
        font-family: 'Courier New', monospace;
        font-size: 12px;
        line-height: 1.6;
        white-space: pre-wrap;
        word-break: break-word;
        background: var(--bg);
        padding: 10px;
        border-radius: 4px;
        border: 1px solid var(--panel-border);
      }
      #func-code-preview .dsl-highlighted {
        max-height: 200px;
        overflow: auto;
      }
      
      /* Syntax help list */
      .syntax-list {
        margin: 8px 0 0 0;
        padding-left: 16px;
        list-style: none;
      }
      .syntax-list li {
        margin-bottom: 4px;
        position: relative;
      }
      .syntax-list li::before {
        content: "→";
        position: absolute;
        left: -14px;
        color: var(--primary);
      }
      .syntax-list code {
        background: var(--bg-muted);
        padding: 1px 4px;
        border-radius: 3px;
        font-weight: 600;
        color: var(--primary);
      }
    `;
  }

  static attachEventListeners(): void {
    const callbacks: FuncEditorCallbacks = {
      getCurrentScenarioId: () => FuncEditorPage.currentScenarioId,
      setCurrentScenarioId: (id) => { FuncEditorPage.currentScenarioId = id; },
      getCurrentScenarioTitle: () => FuncEditorPage.currentScenarioTitle,
      setCurrentScenarioTitle: (title) => { FuncEditorPage.currentScenarioTitle = title; },
      getOriginalFunc: () => FuncEditorPage.originalFunc,
      setOriginalFunc: (v) => { FuncEditorPage.originalFunc = v; },
      getIsDirty: () => FuncEditorPage.isDirty,
      setIsDirty: (v) => { FuncEditorPage.isDirty = v; },
      getScenariosList: () => FuncEditorPage.scenariosList,
      setScenariosList: (list) => { FuncEditorPage.scenariosList = list; },
      getScenarioFilter: () => FuncEditorPage.scenarioFilter,
      setScenarioFilter: (v) => { FuncEditorPage.scenarioFilter = v; },
      loadScenarioList: (lb) => FuncEditorPage.loadScenarioList(lb),
      renderScenarioList: (lb) => FuncEditorPage.renderScenarioList(lb),
      loadScenario: (id, ta, pr, st, ti, lb) => FuncEditorPage.loadScenario(id, ta, pr, st, ti, lb),
      updatePreview: (t, p) => FuncEditorPage.updatePreview(t, p),
      updateCodePreview: (t, cp) => FuncEditorPage.updateCodePreview(t, cp),
      validateFunc: (t) => validateFunc(t),
      initializeSyntaxHelp: (sh) => FuncEditorPage.initializeSyntaxHelp(sh),
      saveScenario: (id, func) => ScenariosService.updateScenario(id, { func }),
    };
    attachFuncEditorListeners(callbacks);
  }

  private static async loadScenarioList(listBody: HTMLElement): Promise<void> {
    try {
      const list: any[] = await ScenariosService.listScenarios('');
      this.scenariosList = (list || []).map((s: any) => ({
        id: String(s?.id || ''),
        name: String(s?.name || s?.id || ''),
        updatedAt: String(s?.updatedAt || ''),
      }));
      this.renderScenarioList(listBody);
    } catch { /* silent */ }
  }

  private static renderScenarioList(listBody: HTMLElement): void {
    if (!listBody) return;

    const sortMode = (document.getElementById('scenario-sort') as HTMLSelectElement | null)?.value || 'date_desc';
    const filtered = this.scenariosList.filter(s =>
      !this.scenarioFilter ||
      (s.name || s.id).toLowerCase().includes(this.scenarioFilter)
    ).slice();

    const toTs = (s: string | undefined): number => {
      const raw = String(s || '').trim();
      if (!raw) return 0;
      const t = Date.parse(raw);
      return Number.isFinite(t) ? t : 0;
    };
    const byName = (a: string, b: string): number => a.localeCompare(b, 'pl', { sensitivity: 'base' });

    filtered.sort((a, b) => {
      const an = String(a?.name || a?.id || '').toLowerCase();
      const bn = String(b?.name || b?.id || '').toLowerCase();
      const at = toTs(a?.updatedAt);
      const bt = toTs(b?.updatedAt);
      switch (sortMode) {
        case 'name_asc': return byName(an, bn);
        case 'name_desc': return byName(bn, an);
        case 'date_asc': return at - bt;
        case 'date_desc':
        default: return bt - at;
      }
    });
    
    listBody.innerHTML = filtered.map(s => `
      <tr data-id="${s.id}" class="${s.id === this.currentScenarioId ? 'active' : ''}">
        <td>${escapeHtml(s.name || s.id)}</td>
        <td class="func-count">—</td>
      </tr>
    `).join('');
  }

  private static async loadScenario(
    id: string,
    textarea: HTMLTextAreaElement,
    preview: HTMLElement,
    status: HTMLElement,
    titleEl: HTMLElement,
    listBody: HTMLElement
  ): Promise<void> {
    try {

      const row = await ScenariosService.fetchScenarioById(id);

      if (!row) {

        return;
      }

      this.currentScenarioId = id;
      this.currentScenarioTitle = row.title || id;
      // Try to get func from multiple sources:
      // 1. row.func (legacy text column)
      // 2. row.content.func
      // 3. row.funcs array (from library.funcs) - convert to DSL text
      // 4. row.content.funcs array
      let funcText = (row as any).func || (row.content as any)?.func || '';
      
      // If no func text, try to build from funcs array
      if (!funcText) {
        const funcsArray = (row as any).funcs || (row.content as any)?.funcs || [];
        if (Array.isArray(funcsArray) && funcsArray.length > 0) {
          funcText = funcsArray.map((f: any) => {
            const name = f?.name || 'Unnamed';
            const code = f?.code || '';
            const lines = [`FUNC: ${name}`];
            if (code) {
              for (const line of code.split('\n')) {
                if (line.trim()) lines.push(`  ${line}`);
              }
            }
            return lines.join('\n');
          }).join('\n\n');
        }
      }

      this.originalFunc = funcText;
      this.isDirty = false;

      if (textarea) textarea.value = funcText;
      if (titleEl) titleEl.textContent = this.currentScenarioTitle;
      this.updatePreview(funcText, preview);
      
      // Update code preview with highlighting
      const codePreview = document.getElementById('func-code-preview') as HTMLElement;
      this.updateCodePreview(funcText, codePreview);
      
      // Update main editor highlight
      const highlightPre = document.getElementById('func-editor-highlight') as HTMLPreElement;
      if (highlightPre) {
        highlightPre.innerHTML = highlightDsl(funcText) + '\n';
      }
      
      const saveBtn = document.getElementById('func-save-btn') as HTMLButtonElement;
      if (saveBtn) saveBtn.disabled = true;
      if (status) status.textContent = '';

      // Update active row
      listBody?.querySelectorAll('tr').forEach(r => {
        r.classList.toggle('active', r.getAttribute('data-id') === id);
      });

      // Update URL
      const url = new URL(window.location.href);
      url.searchParams.set('scenario', id);
      history.replaceState({}, '', url.toString());
    } catch (e) {
      if (status) { status.textContent = '❌ Błąd ładowania'; status.className = 'text-xs text-danger'; }
    }
  }

  private static initializeSyntaxHelp(syntaxHelp: HTMLElement): void {
    if (!syntaxHelp) return;
    const exampleCode = getFuncEditorSyntaxExample();
    const usageCode = getFuncEditorUsageExample();
    
    syntaxHelp.innerHTML = `
      <div class="dsl-highlighted">${highlightDsl(exampleCode)}</div>
      <p class="mt-xs text-muted">Wywołanie w GOAL:</p>
      <div class="dsl-highlighted">${highlightDsl(usageCode)}</div>
      <p class="mt-xs text-muted"><strong>Komendy:</strong></p>
      <ul class="syntax-list">
        <li><code>SET</code> - ustaw stan zaworu lub wartość zmiennej</li>
        <li><code>SET 'POMPA'</code> - ustaw przepływ pompy</li>
        <li><code>GET</code> - pobierz wartość z urządzenia</li>
        <li><code>MIN/MAX</code> - ustaw limity</li>
        <li><code>SET 'WAIT'</code> - odczekaj określony czas</li>
        <li><code>SAVE</code> - zapisz do protokołu</li>
        <li><code>LOG</code> - zapisz do loga</li>
        <li><code>ALARM</code> - ostrzeżenie (kontynuuj)</li>
        <li><code>ERROR</code> - błąd (zatrzymaj)</li>
      </ul>
    `;
  }

  private static updateCodePreview(text: string, codePreview: HTMLElement): void {
    if (!codePreview) return;
    
    if (!text.trim()) {
      codePreview.innerHTML = '<p class="text-muted text-xs">Wpisz kod FUNC, aby zobaczyć podgląd z kolorowaniem składni</p>';
      return;
    }
    
    codePreview.innerHTML = `<div class="dsl-highlighted">${highlightDsl(text)}</div>`;
  }

  private static updatePreview(text: string, preview: HTMLElement): void {
    if (!preview) return;
    const funcs = parseFuncDefinitions(text);
    if (funcs.length === 0) {
      preview.innerHTML = '<p class="text-muted text-xs">Brak zdefiniowanych FUNC</p>';
      return;
    }
    preview.innerHTML = funcs.map(f => `
      <div class="func-item">
        <div class="func-item-name">🔧 ${escapeHtml(f.name)}</div>
        <div class="func-item-steps">${f.steps.length} kroków</div>
      </div>
    `).join('');
  }

}
