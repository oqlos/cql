// frontend/src/pages/connect-scenario-library-editor.page.ts
import { escapeHtml, notifyBottomLine } from '../modules/shared/generic-grid/utils';
import { ScenariosService } from '../modules/connect-scenario/helpers/scenarios.service';
import { getDefEditorStyles } from '../modules/connect-scenario/helpers/def-editor.styles';
import * as LibraryRender from '../modules/connect-scenario/helpers/def-editor.render';
import type { DefData } from '../modules/connect-scenario/helpers/def-editor.render';
import { AutosaveService } from '../shared/autosave.service';
// CQRS-style extracted modules
import { getLibraryEditorContent } from './connect-scenario-library-editor/library-editor.templates';
import { validateLibraryJson as validateLibraryJsonFn } from './connect-scenario-library-editor/library-editor.validation';
import { generateDslFromGoals as generateDslFromGoalsFn, generateDefCode as generateDefCodeFn, generateLibraryJson as generateLibraryJsonFn, generateConfigJson as generateConfigJsonFn, generateLibraryJsonPretty as generateLibraryJsonPrettyFn, extractSetVarsFromGoals as extractSetVarsFromGoalsFn } from './connect-scenario-library-editor/library-editor.dsl';
import { highlightJson as highlightJsonFn, highlightSource as highlightSourceFn } from './connect-scenario-library-editor/library-editor.highlight';
import { parseDefFromCode as parseDefFromCodeFn, loadDefFromCurrentScenario as loadDefFromCurrentScenarioFn, loadScenarioData as loadScenarioDataFn } from './connect-scenario-library-editor/library-editor.data-loader';
import { bindLibraryEditorEvents } from './connect-scenario-library-editor/library-editor.events';
import {
  convertGoalToFunc as _convertGoalToFuncFn,
  convertFuncToGoal as _convertFuncToGoalFn,
  showFuncSelectionModal as _showFuncSelectionModalFn,
  addFuncToGoal as _addFuncToGoalFn,
  restoreCodeModal as _restoreCodeModalFn,
  type ConversionContext,
} from './connect-scenario-library-editor/library-editor.conversions';
import {
  addOptDefault as _addOptDefaultFn,
  editOptDefault as _editOptDefaultFn,
  deleteOptDefault as _deleteOptDefaultFn,
  renderOptDefaults as _renderOptDefaultsFn,
  addDefault as _addDefaultFn,
  deleteDefault as _deleteDefaultFn,
  scanDefaultsFromDsl as _scanDefaultsFromDslFn,
  renderDefaults as _renderDefaultsFn,
  type DefaultsContext,
} from './connect-scenario-library-editor/library-editor.defaults';
import {
  addItem as _addItemFn,
  editItem as _editItemFn,
  deleteItem as _deleteItemFn,
  addFunc as _addFuncFn,
  deleteFunc as _deleteFuncFn,
  bindFuncEditors as _bindFuncEditorsFn,
  addGoal as _addGoalFn,
  deleteGoal as _deleteGoalFn,
  moveGoal as _moveGoalFn,
  bindGoalEditors as _bindGoalEditorsFn,
  addObjectFunctionMapping as _addObjectFunctionMappingFn,
  removeObjectFunctionMapping as _removeObjectFunctionMappingFn,
  addParamUnitMapping as _addParamUnitMappingFn,
  removeParamUnitMapping as _removeParamUnitMappingFn,
  type CrudContext,
} from './connect-scenario-library-editor/library-editor.crud';
import {
  toggleGoalConfigEnabled as _toggleGoalConfigEnabledFn,
  moveGoalConfig as _moveGoalConfigFn,
  editGoalConfigOpt as _editGoalConfigOptFn,
  renderGoalsConfig as _renderGoalsConfigFn,
  syncGoalsConfigFromDsl as _syncGoalsConfigFromDslFn,
  type GoalsConfigContext,
} from './connect-scenario-library-editor/library-editor.goals-config';
import { showValidationResults as _showValidationResultsFn } from './connect-scenario-library-editor/library-editor.validation';

export class LibraryEditorPage {

  /** Page discovery compatible render method */
  render(): string {
    return LibraryEditorPage.getContent();
  }
  private static defData: DefData = {
    systemVars: {},
    optDefaults: {},  // OPT variable default descriptions (legacy)
    goalOpts: [],     // OPT values per GOAL
    library: {
      objects: [],
      functions: [],
      params: [],
      units: [],
      actions: [],
      logs: [],
      alarms: [],
      errors: [],
      funcs: [],
      defaults: [],  // OPT/SET variable defaults: { name, value, description, type: 'opt'|'set' }
      objectFunctionMap: {},
      paramUnitMap: {}
    }
  };

  private static currentTab: 'goals' | 'goals-order' | 'funcs' | 'defaults' | 'source' = 'goals';
  private static currentScenarioId: string = '';
  private static currentScenarioTitle: string = '';
  private static scenariosList: Array<{ id: string; name: string; updatedAt?: string }> = [];
  private static scenarioFilter: string = '';
  private static autosave: AutosaveService | null = null;

  static getContent(): string {
    return getLibraryEditorContent();
  }

  static getStyles(): string {
    return getDefEditorStyles();
  }

  static attach(container: HTMLElement): void {
    // Read scenario ID from URL
    const scenarioId = this.readScenarioIdFromUrl();
    
    if (scenarioId) {
      this.currentScenarioId = scenarioId;
      // Load scenarios list and current scenario
      this.loadScenariosList();
      this.loadScenarioAndInit(container);
    } else {
      // No scenario - load list and redirect to first one
      this.loadScenariosAndRedirectToFirst(container);
    }
  }

  private static async loadScenariosAndRedirectToFirst(container: HTMLElement): Promise<void> {
    try {
      const list = await ScenariosService.listScenarios();
      this.scenariosList = (list || []).map(s => ({ id: s.id, name: s.name || s.id, updatedAt: (s as any).updatedAt || '' }));
      this.renderScenariosList();
      
      if (this.scenariosList.length > 0) {
        // Redirect to first scenario
        const firstId = this.scenariosList[0].id;
        const url = `/connect-scenario/library-editor?scenario=${encodeURIComponent(firstId)}`;
        globalThis.history.replaceState({}, '', url);
        
        this.currentScenarioId = firstId;
        this.loadScenarioAndInit(container);
      } else {
        // No scenarios - just bind events
        this.bindEvents(container);
        notifyBottomLine('⚠️ Brak scenariuszy do edycji', 'warning', 3000);
      }
    } catch {
      this.scenariosList = [];
      this.renderScenariosList();
      this.bindEvents(container);
      notifyBottomLine('❌ Błąd ładowania scenariuszy', 'error', 3000);
    }
  }

  private static readScenarioIdFromUrl(): string {
    try {
      const params = new URLSearchParams(globalThis.location.search);
      return (params.get('scenario') || params.get('scenario_id') || '').trim();
    } catch { return ''; }
  }

  private static readTabFromUrl(): string {
    try {
      const params = new URLSearchParams(globalThis.location.search);
      return (params.get('tab') || '').trim();
    } catch { return ''; }
  }

  private static updateUrlWithTab(tabName: string): void {
    try {
      const url = new URL(globalThis.location.href);
      url.searchParams.set('tab', tabName);
      globalThis.history.replaceState({}, '', url.toString());
    } catch {
      // Non-blocking: tab switch should work locally even when URL sync fails.
    }
  }

  private static initTabFromUrl(container: HTMLElement): void {
    const tabFromUrl = this.readTabFromUrl();
    const validTabs = ['goals', 'goals-order', 'funcs', 'defaults', 'source'];
    
    if (tabFromUrl && validTabs.includes(tabFromUrl)) {
      this.currentTab = tabFromUrl as any;
      container.querySelectorAll('.def-tab').forEach(t => t.classList.remove('active'));
      container.querySelectorAll('.def-tab-content').forEach(c => c.classList.remove('active'));
      container.querySelector(`.def-tab[data-tab="${tabFromUrl}"]`)?.classList.add('active');
      container.querySelector(`[data-tab-content="${tabFromUrl}"]`)?.classList.add('active');
      
      if (tabFromUrl === 'source') {
        this.updateSourceEditor();
      } else if (tabFromUrl === 'defaults') {
        this.renderDefaults();
      } else if (tabFromUrl === 'goals-order') {
        this.renderGoalsOrderOnly();
      }
    } else {
      // Set default tab in URL if not present
      this.updateUrlWithTab(this.currentTab);
    }
  }

  private static async loadScenarioAndInit(container: HTMLElement): Promise<void> {
    try {
      const scenario = await ScenariosService.fetchScenarioById(this.currentScenarioId);
      if (!scenario) {
        notifyBottomLine('❌ Nie znaleziono scenariusza', 'error', 3000);
        return;
      }
      
      this.currentScenarioTitle = scenario.title || this.currentScenarioId;
      
      // Update header with scenario title
      const titleEl = document.getElementById('scenario-title');
      if (titleEl) titleEl.textContent = this.currentScenarioTitle;
      
      // Initialize autosave service
      this.autosave = new AutosaveService({
        indicatorId: 'save-indicator',
        saveFn: async () => {
          const libraryJson = this.generateLibraryJson();
          const configJson = this.generateConfigJson();
          await ScenariosService.updateScenario(this.currentScenarioId, { 
            library: libraryJson,
            config: configJson
          });
          // Update global DEF library
          (globalThis as any).__scenarioDefLibrary = {
            objects: [...this.defData.library.objects],
            functions: [...this.defData.library.functions],
            params: [...this.defData.library.params],
            units: [...this.defData.library.units],
            logs: [...(this.defData.library.logs || [])],
            alarms: [...(this.defData.library.alarms || [])],
            errors: [...(this.defData.library.errors || [])],
            funcs: [...(this.defData.library.funcs || [])],
            objectFunctionMap: { ...this.defData.library.objectFunctionMap },
            paramUnitMap: { ...this.defData.library.paramUnitMap }
          };
        }
      });
      
      // Load scenario data using shared method
      this.loadScenarioData(scenario);
      
      this.renderAll();
      this.bindEvents(container);
      this.initTabFromUrl(container);
      this.updateSourceEditor(); // Initialize source view
      
      notifyBottomLine(`📝 Edycja DEF: ${this.currentScenarioTitle}`, 'info', 2000);
    } catch (error) {
      notifyBottomLine('❌ Błąd ładowania scenariusza', 'error', 3000);
      this.loadDefFromCurrentScenario();
      this.renderAll();
      this.bindEvents(container);
      this.updateSourceEditor();
    }
  }

  private static parseDefFromCode(defCode: string): void {
    parseDefFromCodeFn(this.defData, defCode);
  }

  private static loadDefFromCurrentScenario(): void {
    loadDefFromCurrentScenarioFn(this.defData);
  }

  // ===== Scenario List Methods =====
  
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
    const tbody = document.getElementById('def-scenario-list-body');
    if (!tbody) return;
    
    const filter = this.scenarioFilter.toLowerCase();
    const sortMode = (document.getElementById('scenario-sort') as HTMLSelectElement | null)?.value || 'date_desc';
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
        <td>${escapeHtml(s.name)}</td>
      </tr>
    `).join('') || '<tr><td class="text-sm text-muted">Brak scenariuszy</td></tr>';
  }

  /** Shared method to load scenario data into defData */
  private static loadScenarioData(scenario: any): void {
    loadScenarioDataFn(this.defData, scenario);
  }

  private static async switchToScenario(scenarioId: string): Promise<void> {
    if (scenarioId === this.currentScenarioId) return;
    
    // Reset DEF data
    this.defData = {
      systemVars: {},
      goalOpts: [],
      goalsConfig: [],
      library: { objects: [], functions: [], params: [], units: [], goalsOrder: [], objectFunctionMap: {}, paramUnitMap: {} }
    };
    
    this.currentScenarioId = scenarioId;
    
    try {
      const scenario = await ScenariosService.fetchScenarioById(scenarioId);
      if (!scenario) {
        notifyBottomLine('❌ Nie znaleziono scenariusza', 'error', 3000);
        return;
      }
      
      this.currentScenarioTitle = scenario.title || scenarioId;
      
      // Update URL without reload
      const url = new URL(globalThis.location.href);
      url.searchParams.set('scenario', scenarioId);
      globalThis.history.replaceState({}, '', url.toString());
      
      // Update header
      const titleEl = document.getElementById('scenario-title');
      if (titleEl) titleEl.textContent = this.currentScenarioTitle;
      
      // Load scenario data using shared method
      this.loadScenarioData(scenario);
      
      this.renderAll();
      this.renderScenariosList(); // Update active state
      
      // Preserve current tab - render content for active tab
      if (this.currentTab === 'source') {
        this.updateSourceEditor();
      } else if (this.currentTab === 'defaults') {
        this.renderDefaults();
      } else if (this.currentTab === 'goals-order') {
        this.renderGoalsOrderOnly();
      }
      // GOAL and FUNC tabs are already rendered by renderAll()
      
      notifyBottomLine(`📝 Przełączono na: ${this.currentScenarioTitle}`, 'info', 2000);
    } catch {
      notifyBottomLine('❌ Błąd ładowania scenariusza', 'error', 3000);
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
        document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
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

  private static renderAll(): void {
    LibraryRender.renderAll(this.defData);
    this.bindFuncEditors();
    this.bindGoalEditors();
    this.renderOptDefaults();
    this.renderGoalsConfig();
  }

  private static renderList(type: string, items: string[]): void {
    LibraryRender.renderList(type, items);
  }

  private static renderMappings(): void {
    LibraryRender.renderMappings(this.defData.library);
  }

  private static bindEvents(container: HTMLElement): void {
    const page = this;
    bindLibraryEditorEvents(container, {
      switchToScenario: (id: string) => page.switchToScenario(id),
      renderScenariosList: () => { page.scenarioFilter = (document.getElementById('def-scenario-filter') as HTMLInputElement)?.value || ''; page.renderScenariosList(); },
      showAddScenarioModal: () => page.showAddScenarioModal(),
      createNewScenario: () => page.createNewScenario(),
      highlightSource: (code: string, el: HTMLElement) => page.highlightSource(code, el),
      updateUrlWithTab: (tab: string) => page.updateUrlWithTab(tab),
      setCurrentTab: (tab: string) => { page.currentTab = tab as any; },
      updateSourceEditor: () => page.updateSourceEditor(),
      renderDefaults: () => page.renderDefaults(),
      renderGoalsOrderOnly: () => page.renderGoalsOrderOnly(),
      addItem: (type: string) => page.addItem(type),
      addFunc: () => page.addFunc(),
      addGoal: () => page.addGoal(),
      addOptDefault: () => page.addOptDefault(),
      addDefault: () => page.addDefault(),
      scanDefaultsFromDsl: () => page.scanDefaultsFromDsl(),
      exportDslToFile: () => page.exportDslToFile(),
      copyAllDsl: () => page.copyAllDsl(),
      deleteDefault: (idx: number) => page.deleteDefault(idx),
      editItem: (type: string, idx: number) => page.editItem(type, idx),
      deleteItem: (type: string, idx: number) => page.deleteItem(type, idx),
      deleteFunc: (idx: number) => page.deleteFunc(idx),
      deleteGoal: (idx: number) => page.deleteGoal(idx),
      convertGoalToFunc: (idx: number) => page.convertGoalToFunc(idx),
      convertFuncToGoal: (idx: number) => page.convertFuncToGoal(idx),
      showFuncSelectionModal: (idx: number) => page.showFuncSelectionModal(idx),
      addFuncToGoal: (gi: number, fi: number) => page.addFuncToGoal(gi, fi),
      moveGoal: (idx: number, dir: -1 | 1) => page.moveGoal(idx, dir),
      editOptDefault: (name: string) => page.editOptDefault(name),
      deleteOptDefault: (name: string) => page.deleteOptDefault(name),
      addObjectFunctionMapping: (obj: string) => page.addObjectFunctionMapping(obj),
      removeObjectFunctionMapping: (obj: string, fn: string) => page.removeObjectFunctionMapping(obj, fn),
      addParamUnitMapping: (param: string) => page.addParamUnitMapping(param),
      removeParamUnitMapping: (param: string, unit: string) => page.removeParamUnitMapping(param, unit),
      syncGoalsConfigFromDsl: () => page.syncGoalsConfigFromDsl(),
      editGoalConfigOpt: (gn: string, on: string) => page.editGoalConfigOpt(gn, on),
      toggleGoalConfigEnabled: (idx: number) => page.toggleGoalConfigEnabled(idx),
      moveGoalConfig: (idx: number, dir: -1 | 1) => page.moveGoalConfig(idx, dir),
      restoreCodeModal: () => page.restoreCodeModal(),
      parseDefFromCode: (src: string) => page.parseDefFromCode(src),
      renderAll: () => page.renderAll(),
      scheduleAutosave: () => page.autosave?.schedule(),
      validateLibraryJson: (src: string) => page.validateLibraryJson(src),
      showValidationResults: (v: any) => page.showValidationResults(v),
      saveDef: () => page.saveDef(),
      importFromDB: () => page.importFromDB(),
      showCodePreview: () => page.showCodePreview(),
    });
  }

  private static getCrudContext(): CrudContext {
    return {
      defData: this.defData,
      renderList: (type, items) => this.renderList(type, items),
      renderMappings: () => this.renderMappings(),
      renderFuncs: () => this.renderFuncs(),
      renderGoals: () => this.renderGoals(),
      scheduleAutosave: () => this.autosave?.schedule(),
    };
  }

  private static addItem(type: string): void { _addItemFn(type, this.getCrudContext()); }
  private static editItem(type: string, index: number): void { _editItemFn(type, index, this.getCrudContext()); }
  private static deleteItem(type: string, index: number): void { _deleteItemFn(type, index, this.getCrudContext()); }
  private static addFunc(): void { _addFuncFn(this.getCrudContext()); }
  private static deleteFunc(index: number): void { _deleteFuncFn(index, this.getCrudContext()); }

  private static renderFuncs(): void {
    LibraryRender.renderFuncs(this.defData.library.funcs || []);
    this.bindFuncEditors();
  }

  private static bindFuncEditors(): void { _bindFuncEditorsFn(this.getCrudContext()); }

  // ===== GOAL Methods =====

  private static addGoal(): void { _addGoalFn(this.getCrudContext()); }
  private static deleteGoal(index: number): void { _deleteGoalFn(index, this.getCrudContext()); }
  private static moveGoal(index: number, direction: -1 | 1): void { _moveGoalFn(index, direction, this.getCrudContext()); }

  private static moveGoalOrderOnly(index: number, direction: -1 | 1): void {
    const goals = this.defData.library.goals || [];
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= goals.length) return;
    [goals[index], goals[newIndex]] = [goals[newIndex], goals[index]];
    this.renderGoalsOrderOnly();
    this.autosave?.schedule();
  }

  private static syncGoalsOrderFromOrderListDom(): void {
    const list = document.getElementById('goals-order-list') as HTMLElement | null;
    if (!list) return;
    const nodes = Array.from(list.querySelectorAll('.goal-order-item')) as HTMLElement[];
    if (!nodes.length) return;
    const goals = this.defData.library.goals || [];
    const indices = nodes
      .map((n) => parseInt(String(n.dataset.index || ''), 10))
      .filter((n) => Number.isFinite(n) && n >= 0 && n < goals.length);
    if (!indices.length || indices.length !== nodes.length) return;
    const next = indices.map(i => goals[i]);
    if (next.length !== goals.length) return;
    this.defData.library.goals = next;
  }

  private static renderGoalsOrderOnly(): void {
    const list = document.getElementById('goals-order-list') as HTMLElement | null;
    const goals = this.defData.library.goals || [];
    const items = goals.map((g: any) => ({ name: String(g?.name || '').trim(), enabled: true }));
    LibraryRender.renderGoalsOrder(items as any);

    const list2 = document.getElementById('goals-order-list') as HTMLElement | null;
    if (!list2) return;

    // Operator view: show only ordering controls (no enable checkbox)
    try {
      const labels = Array.from(list2.querySelectorAll('.goal-order-checkbox')) as HTMLElement[];
      for (const lbl of labels) {
        const nameSpan = lbl.querySelector('.def-item-name') as HTMLElement | null;
        if (!nameSpan) continue;
        const repl = document.createElement('span');
        repl.className = 'def-item-name';
        repl.textContent = String(nameSpan.textContent || '');
        lbl.replaceWith(repl);
      }
    } catch {
      // Non-blocking: preserve original checkbox view if operator-view rewrite fails.
    }

    if (list2.getAttribute('data-goals-order-bound') !== '1') {
      list2.setAttribute('data-goals-order-bound', '1');

      list2.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const btn = target.closest('[data-action]') as HTMLElement | null;
        if (!btn) return;
        const action = String(btn.getAttribute('data-action') || '').trim();
        const item = btn.closest('.goal-order-item') as HTMLElement | null;
        if (!item) return;
        const idx = parseInt(String(item.dataset.index || ''), 10);
        if (!Number.isFinite(idx)) return;
        if (action === 'goal-up') this.moveGoalOrderOnly(idx, -1);
        if (action === 'goal-down') this.moveGoalOrderOnly(idx, 1);
      });

      list2.addEventListener('goals-reordered', () => {
        this.syncGoalsOrderFromOrderListDom();
        this.renderGoalsOrderOnly();
        this.autosave?.schedule();
      });
    }

    if (list && list !== list2) {
      try {
        list.removeAttribute('data-goals-order-bound');
      } catch {
        // Non-blocking: stale binding marker should not block current list behavior.
      }
    }
  }

  private static renderGoals(): void {
    LibraryRender.renderGoals(this.defData.library.goals || []);
    this.bindGoalEditors();
  }

  private static bindGoalEditors(): void { _bindGoalEditorsFn(this.getCrudContext()); }

  // ===== GOAL ↔ FUNC Conversion Methods (delegated to library-editor.conversions.ts) =====

  private static getConversionContext(): ConversionContext {
    return {
      defData: this.defData,
      renderGoals: () => this.renderGoals(),
      renderFuncs: () => this.renderFuncs(),
      bindGoalEditors: () => this.bindGoalEditors(),
      bindFuncEditors: () => this.bindFuncEditors(),
      scheduleAutosave: () => this.autosave?.schedule(),
      restoreCodeModal: () => this.restoreCodeModal(),
    };
  }

  private static convertGoalToFunc(index: number): void { _convertGoalToFuncFn(this.getConversionContext(), index); }
  private static convertFuncToGoal(index: number): void { _convertFuncToGoalFn(this.getConversionContext(), index); }
  private static showFuncSelectionModal(goalIndex: number): void { _showFuncSelectionModalFn(this.getConversionContext(), goalIndex); }
  private static addFuncToGoal(goalIndex: number, funcIndex: number): void { _addFuncToGoalFn(this.getConversionContext(), goalIndex, funcIndex); }
  private static restoreCodeModal(): void { _restoreCodeModalFn(); }

  // ===== DSL Export and Copy Methods =====

  private static generateDslFromGoals(): string {
    return generateDslFromGoalsFn(this.defData);
  }

  private static exportDslToFile(): void {
    const dslContent = this.generateDslFromGoals();
    const scenarioName = this.currentScenarioId || 'scenario';
    const fileName = `${scenarioName}-goals.dsl`;
    
    // Create blob and download
    const blob = new Blob([dslContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up URL
    URL.revokeObjectURL(url);
    
    notifyBottomLine(`📁 Wyeksportowano DSL do pliku: ${fileName}`, 'success', 3000);
  }

  private static copyAllDsl(): void {
    const dslContent = this.generateDslFromGoals();
    
    navigator.clipboard.writeText(dslContent).then(() => {
      notifyBottomLine('📋 Skopiowano cały DSL do schowka', 'success', 2000);
    }).catch(_err => {

      notifyBottomLine('❌ Błąd kopiowania DSL do schowka', 'error', 2000);
    });
  }

  // ===== OPT/SET Defaults Management (delegated to library-editor.defaults.ts) =====

  private static getDefaultsContext(): DefaultsContext {
    return {
      defData: this.defData,
      extractSetVarsFromGoals: () => this.extractSetVarsFromGoals(),
      updateSourceEditor: () => this.updateSourceEditor(),
      scheduleAutosave: () => this.autosave?.schedule(),
    };
  }

  /** Extract SET/OPT variables from all GOALs for display */
  private static extractSetVarsFromGoals(): Array<{ goalName: string; goalIdx: number; varName: string; value: string; type: 'set' | 'opt'; lineIdx: number }> {
    return extractSetVarsFromGoalsFn(this.defData);
  }

  private static addOptDefault(): void { _addOptDefaultFn(this.getDefaultsContext()); }
  private static editOptDefault(name: string): void { _editOptDefaultFn(this.getDefaultsContext(), name); }
  private static deleteOptDefault(name: string): void { _deleteOptDefaultFn(this.getDefaultsContext(), name); }
  private static renderOptDefaults(): void { _renderOptDefaultsFn(this.getDefaultsContext()); }
  private static addDefault(): void { _addDefaultFn(this.getDefaultsContext()); }
  private static deleteDefault(index: number): void { _deleteDefaultFn(this.getDefaultsContext(), index); }
  private static scanDefaultsFromDsl(): void { _scanDefaultsFromDslFn(this.getDefaultsContext()); }
  private static renderDefaults(): void { _renderDefaultsFn(this.getDefaultsContext()); }

  private static getGoalsConfigContext(): GoalsConfigContext {
    return {
      defData: this.defData,
      currentScenarioId: this.currentScenarioId,
      scheduleAutosave: () => this.autosave?.schedule(),
    };
  }

  /** Toggle goal config enabled/disabled state */
  private static toggleGoalConfigEnabled(idx: number): void { _toggleGoalConfigEnabledFn(idx, this.getGoalsConfigContext()); }

  /** Move goal config up or down in order */
  private static moveGoalConfig(idx: number, direction: -1 | 1): void { _moveGoalConfigFn(idx, direction, this.getGoalsConfigContext()); }

  /** Edit a goal config OPT value */
  private static editGoalConfigOpt(goalName: string, optName: string): void { _editGoalConfigOptFn(goalName, optName, this.getGoalsConfigContext()); }

  /** Render goals config list */
  private static renderGoalsConfig(): void { _renderGoalsConfigFn(this.getGoalsConfigContext()); }

  /** Sync goals config from DSL (manual refresh button) */
  private static async syncGoalsConfigFromDsl(): Promise<void> { return _syncGoalsConfigFromDslFn(this.getGoalsConfigContext()); }

  private static addObjectFunctionMapping(obj: string): void { _addObjectFunctionMappingFn(obj, this.getCrudContext()); }
  private static removeObjectFunctionMapping(obj: string, fn: string): void { _removeObjectFunctionMappingFn(obj, fn, this.getCrudContext()); }
  private static addParamUnitMapping(param: string): void { _addParamUnitMappingFn(param, this.getCrudContext()); }
  private static removeParamUnitMapping(param: string, unit: string): void { _removeParamUnitMappingFn(param, unit, this.getCrudContext()); }

  /** Generate library JSON for database storage */
  private static generateLibraryJson(): string {
    return generateLibraryJsonFn(this.defData);
  }

  /** Generate config JSON for database storage */
  private static generateConfigJson(): string {
    return generateConfigJsonFn(this.defData);
  }

  private static generateDefCode(): string {
    return generateDefCodeFn(this.defData);
  }

  private static showCodePreview(): void {
    const modal = document.getElementById('def-code-modal');
    const preview = document.getElementById('def-code-preview');
    if (modal && preview) {
      preview.textContent = this.generateDefCode();
      modal.classList.remove('hidden');
    }
  }

  private static updateSourceEditor(): void {
    const editor = document.getElementById('def-source-editor') as HTMLTextAreaElement;
    const highlight = document.getElementById('def-source-highlight');
    if (editor && highlight) {
      const code = this.generateLibraryJsonPretty();
      editor.value = code;
      this.highlightJson(code, highlight);
    }
  }

  private static generateLibraryJsonPretty(): string {
    return generateLibraryJsonPrettyFn(this.defData);
  }

  private static highlightJson(code: string, container: HTMLElement): void {
    highlightJsonFn(code, container);
  }

  private static highlightSource(code: string, container: HTMLElement): void {
    highlightSourceFn(code, container);
  }

  private static async saveDef(): Promise<void> {
    try {
      const libraryJson = this.generateLibraryJson();
      const configJson = this.generateConfigJson();
      
      if (this.currentScenarioId) {
        // Save library and config JSON columns
        await ScenariosService.updateScenario(this.currentScenarioId, { 
          library: libraryJson,
          config: configJson
        });
        notifyBottomLine(`💾 Zapisano Library do: ${this.currentScenarioTitle}`, 'success', 2000);
      } else {
        notifyBottomLine('⚠️ Brak aktywnego scenariusza', 'warning', 2500);
      }
      
      // Update global DEF library
      (globalThis as any).__scenarioDefLibrary = {
        objects: [...this.defData.library.objects],
        functions: [...this.defData.library.functions],
        params: [...this.defData.library.params],
        units: [...this.defData.library.units],
        logs: [...(this.defData.library.logs || [])],
        alarms: [...(this.defData.library.alarms || [])],
        errors: [...(this.defData.library.errors || [])],
        funcs: [...(this.defData.library.funcs || [])],
        objectFunctionMap: { ...this.defData.library.objectFunctionMap },
        paramUnitMap: { ...this.defData.library.paramUnitMap }
      };
    } catch (error) {
      notifyBottomLine('❌ Błąd zapisu DEF', 'error', 3000);
    }
  }

  private static async importFromDB(): Promise<void> {
    try {
      // Import from __variablesCache and __libraryCache
      const vars = (globalThis as any).__variablesCache as Array<{ type: string; name: string }> || [];
      const libCache = (globalThis as any).__libraryCache || {};
      
      if (Array.isArray(vars) && vars.length) {
        const objects = vars.filter(v => v.type === 'objects').map(v => v.name);
        const functions = vars.filter(v => v.type === 'functions').map(v => v.name);
        const params = vars.filter(v => v.type === 'params').map(v => v.name);
        const units = vars.filter(v => v.type === 'units').map(v => v.name);
        
        if (objects.length) this.defData.library.objects = [...new Set([...this.defData.library.objects, ...objects])];
        if (functions.length) this.defData.library.functions = [...new Set([...this.defData.library.functions, ...functions])];
        if (params.length) this.defData.library.params = [...new Set([...this.defData.library.params, ...params])];
        if (units.length) this.defData.library.units = [...new Set([...this.defData.library.units, ...units])];
      }
      
      if (libCache) {
        if (Array.isArray(libCache.objects)) this.defData.library.objects = [...new Set([...this.defData.library.objects, ...libCache.objects])];
        if (Array.isArray(libCache.functions)) this.defData.library.functions = [...new Set([...this.defData.library.functions, ...libCache.functions])];
        if (Array.isArray(libCache.params)) this.defData.library.params = [...new Set([...this.defData.library.params, ...libCache.params])];
        if (Array.isArray(libCache.units)) this.defData.library.units = [...new Set([...this.defData.library.units, ...libCache.units])];
      }
      
      this.renderAll();
      notifyBottomLine('📥 Zaimportowano dane z bazy', 'success', 2000);
    } catch {
      notifyBottomLine('❌ Błąd importu', 'error', 3000);
    }
  }

  /** Validate library JSON and DSL code */
  private static validateLibraryJson(src: string) {
    return validateLibraryJsonFn(src);
  }

  /** Show validation results in a modal or panel */
  private static showValidationResults(validation: any): void { _showValidationResultsFn(validation); }
}
