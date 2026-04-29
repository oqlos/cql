// frontend/src/modules/connect-scenario/pages/dsl-editor.page.ts
import { notifyBottomLine } from '../modules/shared/generic-grid/utils';
import { escapeHtml } from '../utils/html.utils';
import { ScenariosService } from '../modules/connect-scenario/helpers/scenarios.service';
import { getDslEditorStyles } from '../modules/connect-scenario/helpers/dsl-editor.styles';
import { highlightDsl } from '../components/dsl/dsl.highlight';
import '../components/dsl/dsl.highlight.css';
import { validateDslFormat } from '../components/dsl/dsl.validator';
import { canonicalizeDslQuotes } from '../components/dsl/dsl.quotes';
import { AutosaveService } from '../shared/autosave.service';
// CQRS-style extracted modules
import { getDslEditorContent, getDslRunModalContent } from './connect-scenario-dsl-editor/dsl-editor.templates';
import { generateDslFromLibrary as generateDslFromLibraryFn, extractGoalsWithCode as extractGoalsWithCodeFn, parseGoalStructure as parseGoalStructureFn, extractStepsFromDsl as extractStepsFromDslFn, type GoalStructure } from './connect-scenario-dsl-editor/dsl-editor.parsing';
import {
  runScenario as _runScenarioFn, runSingleLine as _runSingleLineFn, switchRunTab as _switchRunTabFn,
  pauseExecution as _pauseExecutionFn, resumeExecution as _resumeExecutionFn,
  stopExecution as _stopExecutionFn, clearLogs as _clearLogsFn,
  refreshState as _refreshStateFn, fetchHardwareIdentity as _fetchHwIdentityFn,
  type DslRuntimeContext, type SingleLineRunRequest,
} from './connect-scenario-dsl-editor/dsl-editor.runtime';

export class DslEditorPage {

  /** Page discovery compatible render method */
  render(): string {
    return DslEditorPage.getContent();
  }
  private static currentScenarioId: string = '';
  private static currentScenarioTitle: string = '';
  private static scenariosList: Array<{ id: string; name: string; updatedAt?: string }> = [];
  private static scenarioFilter: string = '';
  private static dslCode: string = '';
  private static container: HTMLElement | null = null;
  private static autosave: AutosaveService | null = null;
  private static activeSourceLine = 0;

  private static getWebOqlDslClientUrl(): string {
    const override = String((globalThis as any).__WEBOQL_DSL_URL || '').trim();
    if (override) return override;

    try {
      const currentUrl = new URL(String(globalThis.location?.href || globalThis.location?.origin || 'http://localhost/'));
      return `${currentUrl.protocol}//${currentUrl.hostname}:8203/dsl`;
    } catch {
      return 'http://localhost:8203/dsl';
    }
  }

  static getContent(): string {
    return getDslEditorContent();
  }
  
  private static renderRunModal(): string {
    return getDslRunModalContent();
  }

  static getStyles(): string {
    return getDslEditorStyles();
  }

  static attach(container: HTMLElement): void {
    this.container = container;
    const scenarioId = this.readScenarioIdFromUrl();
    
    if (scenarioId) {
      this.currentScenarioId = scenarioId;
      this.loadScenariosList();
      this.loadScenarioAndInit();
    } else {
      this.loadScenariosAndRedirectToFirst();
    }
  }

  private static async loadScenariosAndRedirectToFirst(): Promise<void> {
    try {
      const list = await ScenariosService.listScenarios();
      this.scenariosList = (list || []).map(s => ({ id: s.id, name: s.name || s.id, updatedAt: (s as any).updatedAt || '' }));
      this.renderScenariosList();
      
      if (this.scenariosList.length > 0) {
        const firstId = this.scenariosList[0].id;
        const url = `/connect-scenario/dsl-editor?scenario=${encodeURIComponent(firstId)}`;
        globalThis.history.replaceState({}, '', url);
        
        this.currentScenarioId = firstId;
        this.loadScenarioAndInit();
      } else {
        this.bindEvents();
        notifyBottomLine('⚠️ Brak scenariuszy do edycji', 'warning', 3000);
      }
    } catch {
      this.scenariosList = [];
      this.renderScenariosList();
      this.bindEvents();
      notifyBottomLine('❌ Błąd ładowania scenariuszy', 'error', 3000);
    }
  }

  private static readScenarioIdFromUrl(): string {
    try {
      const params = new URLSearchParams(globalThis.location.search);
      return (params.get('scenario') || params.get('scenario_id') || '').trim();
    } catch { return ''; }
  }

  /** Generate DSL text from library.goals */
  private static generateDslFromLibrary(title: string, library: any): string {
    return generateDslFromLibraryFn(title, library);
  }

  private static async loadScenarioAndInit(): Promise<void> {
    try {
      const scenario = await ScenariosService.fetchScenarioById(this.currentScenarioId);
      if (!scenario) {
        notifyBottomLine('❌ Nie znaleziono scenariusza', 'error', 3000);
        return;
      }
      
      this.currentScenarioTitle = scenario.title || this.currentScenarioId;
      // Load from library.goals (new format) or fallback to deprecated dsl column

      const generatedDsl = this.generateDslFromLibrary(this.currentScenarioTitle, scenario.library);

      this.dslCode = canonicalizeDslQuotes(generatedDsl || scenario.dsl || '');

      const titleEl = this.container?.querySelector('#scenario-title') as HTMLElement;
      if (titleEl) titleEl.textContent = this.currentScenarioTitle;
      
      // Initialize autosave service
      this.autosave = new AutosaveService({
        indicatorId: 'dsl-save-indicator',
        saveFn: async () => {
          // Save goals to library.goals (new format with full code)
          const goalsWithCode = this.extractGoalsWithCode(this.dslCode);
          await ScenariosService.updateScenario(this.currentScenarioId, { 
            library: JSON.stringify({ goals: goalsWithCode })
          });
        }
      });
      
      this.updateSourceEditor();
      this.bindEvents();
      
      notifyBottomLine(`📜 Edycja CQL: ${this.currentScenarioTitle}`, 'info', 2000);
    } catch (error) {
      notifyBottomLine('❌ Błąd ładowania scenariusza', 'error', 3000);
      this.dslCode = '';
      this.updateSourceEditor();
      this.bindEvents();
    }
  }

  private static async loadScenariosList(): Promise<void> {
    try {
      const list = await ScenariosService.listScenarios();
      this.scenariosList = (list || []).map(s => ({ id: s.id, name: s.name || s.id, updatedAt: (s as any).updatedAt || '' }));
      this.renderScenariosList();
    } catch {
      this.scenariosList = [];
      this.renderScenariosList();
    }
  }

  private static renderScenariosList(): void {
    const tbody = this.container?.querySelector('#dsl-scenario-list-body') as HTMLElement;
    if (!tbody) return;

    const sortMode = (this.container?.querySelector('#scenario-sort') as HTMLSelectElement | null)?.value
      || (document.getElementById('scenario-sort') as HTMLSelectElement | null)?.value
      || 'date_desc';

    const filter = this.scenarioFilter.toLowerCase();
    const filtered = (filter
      ? this.scenariosList.filter(s => s.name.toLowerCase().includes(filter) || s.id.toLowerCase().includes(filter))
      : this.scenariosList
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
    
    tbody.innerHTML = filtered.map(s => `
      <tr class="scenario-row${s.id === this.currentScenarioId ? ' active' : ''}" data-id="${escapeHtml(s.id)}">
        <td>
          <div class="scenario-row-inner">
            <span class="scenario-name">${escapeHtml(s.name)}</span>
            <button type="button" class="scenario-delete-btn" data-action="scenario-delete" data-id="${escapeHtml(s.id)}" title="Usuń scenariusz">🗑️</button>
          </div>
        </td>
      </tr>
    `).join('') || '<tr><td class="text-sm text-muted">Brak scenariuszy</td></tr>';
  }
  

  private static async switchToScenario(scenarioId: string): Promise<void> {
    if (scenarioId === this.currentScenarioId) return;
    
    this.currentScenarioId = scenarioId;
    this.dslCode = '';
    
    try {
      const scenario = await ScenariosService.fetchScenarioById(scenarioId);
      if (!scenario) {
        notifyBottomLine('❌ Nie znaleziono scenariusza', 'error', 3000);
        return;
      }
      
      this.currentScenarioTitle = scenario.title || scenarioId;
      // Load from library.goals (new format) or fallback to deprecated dsl column
      this.dslCode = canonicalizeDslQuotes(this.generateDslFromLibrary(this.currentScenarioTitle, scenario.library) || scenario.dsl || '');
      
      const url = new URL(globalThis.location.href);
      url.searchParams.set('scenario', scenarioId);
      globalThis.history.replaceState({}, '', url.toString());
      
      const titleEl = this.container?.querySelector('#scenario-title') as HTMLElement;
      if (titleEl) titleEl.textContent = this.currentScenarioTitle;
      
      this.updateSourceEditor();
      this.renderScenariosList();
      
      notifyBottomLine(`📜 Przełączono na: ${this.currentScenarioTitle}`, 'info', 2000);
    } catch {
      notifyBottomLine('❌ Błąd ładowania scenariusza', 'error', 3000);
    }
  }

  private static updateSourceEditor(): void {
    const editor = this.container?.querySelector('#dsl-source-editor') as HTMLTextAreaElement;
    const highlight = this.container?.querySelector('#dsl-source-highlight') as HTMLElement;
    console.debug('[DSL-EDITOR] updateSourceEditor:', { 
      hasContainer: !!this.container, 
      hasEditor: !!editor, 
      hasHighlight: !!highlight,
      dslCodeLength: this.dslCode?.length || 0 
    });
    if (editor && highlight) {
      editor.value = this.dslCode;
      this.highlightSource(this.dslCode, highlight);
      this.syncSourceScroll(editor, highlight);
    } else if (highlight && !editor) {
      // Highlight only - textarea may not exist yet
      this.highlightSource(this.dslCode, highlight);
    }
    this.renderGoalStructure();
  }

  private static highlightSource(code: string, container: HTMLElement): void {
    const lines = String(code || '').split('\n');
    container.innerHTML = lines.map((line, idx) => {
      const html = line ? highlightDsl(line) : '&nbsp;';
      const active = idx === this.activeSourceLine ? ' active' : '';
      return `<div class="dsl-source-line${active}" data-line-number="${idx + 1}">${html}</div>`;
    }).join('');
  }

  private static syncSourceScroll(editor: HTMLTextAreaElement, highlight: HTMLElement): void {
    highlight.scrollTop = editor.scrollTop;
    highlight.scrollLeft = editor.scrollLeft;
  }

  private static getActiveLineIndex(editor: HTMLTextAreaElement): number {
    const caret = Math.max(0, editor.selectionStart ?? 0);
    return editor.value.slice(0, caret).split('\n').length - 1;
  }

  private static setActiveSourceLine(lineIndex: number): void {
    const lineCount = Math.max(1, String(this.dslCode || '').split('\n').length);
    this.activeSourceLine = Math.min(Math.max(lineIndex, 0), lineCount - 1);
    const highlight = this.container?.querySelector('#dsl-source-highlight') as HTMLElement | null;
    if (highlight) this.highlightSource(this.dslCode, highlight);
  }

  private static findNearestGoalName(lines: string[], fromIndex: number): string {
    for (let i = fromIndex; i >= 0; i--) {
      const match = String(lines[i] || '').match(/^\s*GOAL:\s*(.+)$/i);
      if (match) return match[1].trim();
    }
    return `Linia ${fromIndex + 1}`;
  }

  private static findPreviousRuntimeLine(lines: string[], fromIndex: number, pattern: RegExp): string {
    for (let i = fromIndex - 1; i >= 0; i--) {
      const candidate = String(lines[i] || '').trim();
      if (!candidate || candidate.startsWith('//') || candidate.startsWith('#')) continue;
      if (pattern.test(candidate)) return candidate;
    }
    return '';
  }

  private static buildSingleLineRunRequest(lineNumber: number): SingleLineRunRequest | null {
    const lines = String(this.dslCode || '').split(/\r?\n/);
    const lineIndex = Math.min(Math.max(lineNumber - 1, 0), Math.max(lines.length - 1, 0));
    const rawLine = String(lines[lineIndex] || '');
    const trimmed = rawLine.trim();
    const goalName = this.findNearestGoalName(lines, lineIndex);

    if (!rawLine && !trimmed) return null;
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#')) {
      return { lineNumber, lineText: rawLine, runtimeDsl: '', goalName };
    }

    const executablePattern = /^(?:SCENARIO:|GOAL:|TASK\b|AND\b|SET\b|PUMP\b|GET\b|IF\b|WHEN\b|ELSE\b|OR\s+IF\b|OUT\b|INFO\b|DIALOG\b|WAIT\b|END\b)/i;
    if (!executablePattern.test(trimmed)) {
      return { lineNumber, lineText: rawLine, runtimeDsl: '', goalName };
    }

    const runtimeLines = [
      `SCENARIO: ${(this.currentScenarioTitle || this.currentScenarioId || 'DSL Editor').trim()}`,
      `GOAL: ${goalName}`,
    ];

    if (/^AND\b/i.test(trimmed)) {
      const taskLine = this.findPreviousRuntimeLine(lines, lineIndex, /^\s*TASK\b/i);
      if (taskLine) runtimeLines.push(taskLine);
    }

    if (/^(?:OR\s+IF|ELSE)\b/i.test(trimmed)) {
      const ifLine = this.findPreviousRuntimeLine(lines, lineIndex, /^\s*(?:IF|OR\s+IF)\b/i);
      if (ifLine) runtimeLines.push(ifLine);
    }

    if (/^SCENARIO:/i.test(trimmed)) {
      runtimeLines[0] = trimmed;
      runtimeLines[1] = `GOAL: ${goalName}`;
      runtimeLines.push('INFO "Wybrano scenariusz z edytora"');
    } else if (/^GOAL:/i.test(trimmed)) {
      runtimeLines[1] = trimmed;
      runtimeLines.push(`INFO "Aktywowano ${goalName}"`);
    } else {
      runtimeLines.push(trimmed);
    }

    return {
      lineNumber,
      lineText: rawLine,
      runtimeDsl: runtimeLines.join('\n'),
      goalName,
    };
  }

  private static async runSelectedDslLine(lineNumber: number): Promise<void> {
    const request = this.buildSingleLineRunRequest(lineNumber);
    if (!request) return;
    return _runSingleLineFn(this.getRuntimeContext(), request);
  }

  private static bindEvents(): void {
    if (!this.container) return;

    this.bindScenarioListEvents();
    this.bindFilterAndSortEvents();
    this.bindEditorEvents();
    this.bindModalEvents();
    this.bindActionEvents();
  }

  private static bindScenarioListEvents(): void {
    if (!this.container) return;

    this.container.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const delBtn = target.closest('[data-action="scenario-delete"]') as HTMLButtonElement | null;
      if (delBtn && delBtn.dataset.id) {
        e.preventDefault();
        this.deleteScenarioFromList(delBtn.dataset.id);
        return;
      }

      const row = target.closest('.scenario-row') as HTMLElement;
      if (row && row.dataset.id) this.switchToScenario(row.dataset.id);
    });
  }

  private static bindFilterAndSortEvents(): void {
    if (!this.container) return;

    const filterInput = this.container.querySelector('#dsl-scenario-filter') as HTMLInputElement;
    if (filterInput) {
      filterInput.addEventListener('input', () => {
        this.scenarioFilter = filterInput.value;
        this.renderScenariosList();
      });
    }

    const sortSelect = this.container.querySelector('#scenario-sort') as HTMLSelectElement | null;
    if (sortSelect) {
      sortSelect.addEventListener('change', () => {
        this.renderScenariosList();
      });
    }
  }

  private static bindEditorEvents(): void {
    if (!this.container) return;

    const sourceEditor = this.container.querySelector('#dsl-source-editor') as HTMLTextAreaElement;
    const sourceHighlight = this.container.querySelector('#dsl-source-highlight') as HTMLElement;
    if (sourceEditor && sourceHighlight) {
      const syncFromCursor = () => {
        this.setActiveSourceLine(this.getActiveLineIndex(sourceEditor));
        this.syncSourceScroll(sourceEditor, sourceHighlight);
      };

      sourceEditor.addEventListener('input', () => {
        this.dslCode = sourceEditor.value;
        this.highlightSource(this.dslCode, sourceHighlight);
        this.renderGoalStructure();
        syncFromCursor();
        this.autosave?.schedule();
      });

      sourceEditor.addEventListener('scroll', () => {
        this.syncSourceScroll(sourceEditor, sourceHighlight);
      });

      sourceEditor.addEventListener('keyup', () => {
        syncFromCursor();
      });

      sourceEditor.addEventListener('click', () => {
        syncFromCursor();
        void this.runSelectedDslLine(this.getActiveLineIndex(sourceEditor) + 1);
      });

      syncFromCursor();
    }

    // Refresh structure button
    this.container.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-action="refresh-structure"]')) {
        this.renderGoalStructure();
      }
    });
  }

  private static bindModalEvents(): void {
    if (!this.container) return;

    // Add scenario button
    const addBtn = this.container.querySelector('#dsl-add-scenario-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => this.showAddScenarioModal());
    }

    // Save new scenario button
    const saveNewBtn = document.getElementById('scenario-save-new');
    if (saveNewBtn) {
      saveNewBtn.addEventListener('click', () => this.createNewScenario());
    }

    // Modal close buttons
    this.container.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.matches('[data-modal-close]') || target.closest('[data-modal-close]')) {
        this.closeModals();
      }
    });

    // Run modal tab switching
    this.container.addEventListener('click', (e) => {
      const tab = (e.target as HTMLElement).closest('.run-tab') as HTMLElement;
      if (tab && tab.dataset.runTab) {
        this.switchRunTab(tab.dataset.runTab);
      }
    });

    // Run modal controls
    const pauseBtn = document.getElementById('dsl-run-pause');
    const resumeBtn = document.getElementById('dsl-run-resume');
    const stopBtn = document.getElementById('dsl-run-stop');
    const clearLogsBtn = document.getElementById('dsl-run-logs-clear');
    const refreshStateBtn = document.getElementById('dsl-run-state-refresh');
    const refreshFwBtn = document.getElementById('dsl-run-fw-refresh');

    if (pauseBtn) pauseBtn.addEventListener('click', () => this.pauseExecution());
    if (resumeBtn) resumeBtn.addEventListener('click', () => this.resumeExecution());
    if (stopBtn) stopBtn.addEventListener('click', () => this.stopExecution());
    if (clearLogsBtn) clearLogsBtn.addEventListener('click', () => this.clearLogs());
    if (refreshStateBtn) refreshStateBtn.addEventListener('click', () => this.refreshState());
    if (refreshFwBtn) refreshFwBtn.addEventListener('click', () => _fetchHwIdentityFn());
  }

  private static bindActionEvents(): void {
    if (!this.container) return;

    this.container.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const action = target.dataset.action || target.closest('[data-action]')?.getAttribute('data-action');

      if (!action) return;

      switch (action) {
        case 'dsl-run': this.runScenario(); break;
        case 'dsl-validate': this.handleDslValidate(); break;
        case 'dsl-format': this.handleDslFormat(); break;
        case 'dsl-copy': this.handleDslCopy(); break;
        case 'open-weboql-dsl-client': this.openWebOqlDslClient(); break;
        case 'dsl-save': this.saveDsl(); break;
        case 'dsl-clear-inline-terminal': this.clearLogs(); break;
      }
    });
  }

  private static openWebOqlDslClient(): void {
    const url = this.getWebOqlDslClientUrl();
    globalThis.open(url, '_blank', 'noopener,noreferrer');
    notifyBottomLine('🧭 Otwieram współdzielony klient DSL w WebOQL', 'info', 2500);
  }

  private static handleDslValidate(): void {
    const src = this.dslCode.trim();
    if (!src) { notifyBottomLine('❌ Brak kodu do walidacji', 'error', 2500); return; }

    const result = validateDslFormat(src);

    if (result.ok && result.warnings.length === 0) {
      notifyBottomLine('✅ Kod DSL jest poprawny', 'success', 2000);
    } else if (result.ok && result.warnings.length > 0) {
      const warningMsg = result.warnings.slice(0, 3).join('\n');
      notifyBottomLine(`⚠️ Ostrzeżenia:\n${warningMsg}`, 'warning', 5000);
    } else {
      const errorMsg = result.errors.slice(0, 3).join('\n');
      notifyBottomLine(`❌ Błędy walidacji:\n${errorMsg}`, 'error', 5000);
    }
  }

  private static handleDslFormat(): void {
    const src = this.dslCode.trim();
    if (!src) { notifyBottomLine('❌ Brak kodu do formatowania', 'error', 2500); return; }

    const result = validateDslFormat(src);

    if (result.fixedText && result.fixedText !== src) {
      this.dslCode = result.fixedText;
      this.updateSourceEditor();

      const fixCount = result.violations.filter(v => v.fixedLine).length;
      if (fixCount > 0) {
        notifyBottomLine(`🎨 Sformatowano i naprawiono ${fixCount} problemów`, 'success', 3000);
      } else {
        notifyBottomLine('🎨 Sformatowano kod', 'success', 2000);
      }
    } else {
      const formatted = this.dslCode
        .split('\n')
        .map(l => l.trimEnd())
        .join('\n');
      this.dslCode = formatted;
      this.updateSourceEditor();
      notifyBottomLine('🎨 Sformatowano kod', 'success', 2000);
    }
  }

  private static handleDslCopy(): void {
    const editor = document.getElementById('dsl-source-editor') as HTMLTextAreaElement | null;
    const text = String(editor?.value ?? this.dslCode ?? '').trimEnd();
    if (!text) { notifyBottomLine('❌ Brak kodu do skopiowania', 'error', 2500); return; }

    const doFallback = () => {
      if (!editor) return;
      editor.focus();
      editor.select();
      try { document.execCommand('copy'); } catch { /* silent */ }
    };

    try {
      navigator.clipboard.writeText(text).then(() => {
        notifyBottomLine('✅ Skopiowano DSL', 'success', 1500);
      }).catch(() => {
        doFallback();
        notifyBottomLine('✅ Skopiowano DSL', 'success', 1500);
      });
    } catch {
      doFallback();
      notifyBottomLine('✅ Skopiowano DSL', 'success', 1500);
    }
  }

  private static async deleteScenarioFromList(scenarioId: string): Promise<void> {
    const id = String(scenarioId || '').trim();
    if (!id) return;

    const name = this.scenariosList.find(s => s.id === id)?.name || id;

    try {
      await ScenariosService.deleteScenario(id);
      notifyBottomLine(`🗑️ Usunięto scenariusz: ${name}`, 'success', 2000);
      await this.loadScenariosList();

      if (id === this.currentScenarioId) {
        if (this.scenariosList.length > 0) {
          await this.switchToScenario(this.scenariosList[0].id);
        } else {
          this.currentScenarioId = '';
          this.currentScenarioTitle = '';
          this.dslCode = '';

          const url = new URL(globalThis.location.href);
          url.searchParams.delete('scenario');
          globalThis.history.replaceState({}, '', url.toString());

          const titleEl = this.container?.querySelector('#scenario-title') as HTMLElement | null;
          if (titleEl) titleEl.textContent = '—';
          this.updateSourceEditor();
          this.renderScenariosList();
        }
      }
    } catch {
      notifyBottomLine('❌ Nie udało się usunąć scenariusza', 'error', 3000);
    }
  }
  
  // ===== Add Scenario =====
  private static showAddScenarioModal(): void {
    const modal = document.getElementById('scenario-add-modal');
    if (modal) modal.classList.remove('hidden');
  }
  
  private static async createNewScenario(): Promise<void> {
    const nameInput = document.getElementById('scenario-new-name') as HTMLInputElement;
    const name = nameInput?.value?.trim();
    if (!name) {
      notifyBottomLine('⚠️ Podaj nazwę scenariusza', 'warning', 2500);
      return;
    }
    
    try {
      const newId = await ScenariosService.createScenario(name);
      if (newId) {
        this.closeModals();
        nameInput.value = '';
        await this.loadScenariosList();
        this.switchToScenario(newId);
        notifyBottomLine(`✅ Utworzono scenariusz: ${name}`, 'success', 2500);
      } else {
        notifyBottomLine('❌ Błąd tworzenia scenariusza', 'error', 3000);
      }
    } catch {
      notifyBottomLine('❌ Błąd tworzenia scenariusza', 'error', 3000);
    }
  }
  
  private static closeModals(): void {
    document.querySelectorAll('.modal').forEach(m => {
      m.classList.add('hidden');
      (m as HTMLElement).style.display = 'none';
    });
  }
  
  // ===== Run/execution operations (delegated to dsl-editor.runtime.ts) =====

  private static getRuntimeContext(): DslRuntimeContext {
    return {
      getDslCode: () => this.dslCode,
      getCurrentScenarioId: () => this.currentScenarioId,
      getCurrentScenarioTitle: () => this.currentScenarioTitle,
      renderRunModal: () => this.renderRunModal(),
      extractStepsFromDsl: (dsl: string) => extractStepsFromDslFn(dsl),
    };
  }

  private static async runScenario(): Promise<void> { return _runScenarioFn(this.getRuntimeContext()); }
  private static switchRunTab(tabId: string): void { _switchRunTabFn(tabId); }
  private static async pauseExecution(): Promise<void> { return _pauseExecutionFn(); }
  private static async resumeExecution(): Promise<void> { return _resumeExecutionFn(); }
  private static async stopExecution(): Promise<void> { return _stopExecutionFn(); }
  private static clearLogs(): void { _clearLogsFn(); }
  private static async refreshState(): Promise<void> { return _refreshStateFn(); }

  private static async saveDsl(): Promise<void> {
    try {
      if (this.currentScenarioId) {
        // Save goals to library.goals (new format with full code)
        const goalsWithCode = this.extractGoalsWithCode(this.dslCode);
        await ScenariosService.updateScenario(this.currentScenarioId, { 
          library: JSON.stringify({ goals: goalsWithCode })
        });
        notifyBottomLine(`💾 Zapisano DSL: ${this.currentScenarioTitle}`, 'success', 2000);
      } else {
        notifyBottomLine('⚠️ Brak aktywnego scenariusza', 'warning', 2500);
      }
    } catch {
      notifyBottomLine('❌ Błąd zapisywania DSL', 'error', 3000);
    }
  }

  /** Extract goals with full code for library.goals format */
  private static extractGoalsWithCode(dsl: string): Array<{ name: string; code: string }> {
    return extractGoalsWithCodeFn(dsl);
  }

  /** Parse DSL and extract GOAL structure with OUT/OPT fields */
  private static parseGoalStructure(dsl: string): GoalStructure[] {
    return parseGoalStructureFn(dsl);
  }

  /** Render GOAL structure panel */
  private static renderGoalStructure(): void {
    const container = document.getElementById('dsl-goal-structure');
    if (!container) return;
    
    const goals = this.parseGoalStructure(this.dslCode);
    
    if (goals.length === 0) {
      container.innerHTML = '<p class="text-sm text-muted">Brak zdefiniowanych celów (GOAL)</p>';
      return;
    }
    
    container.innerHTML = goals.map((goal, idx) => `
      <div class="goal-card" data-goal-index="${idx}">
        <div class="goal-header">
          <span class="goal-number">${idx + 1}</span>
          <span class="goal-name">${escapeHtml(goal.name)}</span>
        </div>
        <div class="goal-outputs">
          <div class="output-row">
            <span class="output-label">📊 VAL:</span>
            <span class="output-value ${goal.outputs.val ? '' : 'empty'}">${goal.outputs.val ? `[${escapeHtml(goal.outputs.val)}]` : '—'}</span>
          </div>
          <div class="output-row">
            <span class="output-label">📈 MAX:</span>
            <span class="output-value ${goal.outputs.max ? '' : 'empty'}">${goal.outputs.max ? `[${escapeHtml(goal.outputs.max)}]` : '—'}</span>
          </div>
          <div class="output-row">
            <span class="output-label">📉 MIN:</span>
            <span class="output-value ${goal.outputs.min ? '' : 'empty'}">${goal.outputs.min ? `[${escapeHtml(goal.outputs.min)}]` : '—'}</span>
          </div>
          <div class="output-row result-row">
            <span class="output-label">🏁 RESULT:</span>
            <span class="output-value result-${goal.outputs.result.toLowerCase()}">${escapeHtml(goal.outputs.result)}</span>
          </div>
        </div>
        ${goal.options.length > 0 ? `
          <div class="goal-options">
            <div class="options-title">⚙️ Opcje:</div>
            ${goal.options.map(opt => `
              <div class="option-row">
                <span class="option-name">[${escapeHtml(opt.name)}]</span>
                <span class="option-desc">${escapeHtml(opt.description)}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `).join('');
  }

}
