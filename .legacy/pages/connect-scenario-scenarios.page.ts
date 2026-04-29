import { logger } from '../utils/logger';
import { getScenarioCQRS } from '../modules/connect-scenario/cqrs/singleton';
import { ScenariosTemplates } from '../modules/connect-scenario/helpers/scenarios.templates';
import { ScenariosStyles } from '../modules/connect-scenario/helpers/scenarios.styles';
import { ScenariosLibrary } from '../modules/connect-scenario/helpers/scenarios.library';
import { DslTools } from '../components/dsl';
import type { ExecContext } from '../components/dsl';
import { ScenariosService } from '../modules/connect-scenario/helpers/scenarios.service';
import { ScenariosDnD } from '../modules/connect-scenario/helpers/scenarios.dnd';
import { ScenariosLibraryUI } from '../modules/connect-scenario/helpers/scenarios.library.ui';
import { notifyBottomLine } from '../modules/shared/generic-grid/utils';
import { renderBuilderFromData as builderRenderBuilderFromData, refreshBuilderOptions as builderRefreshBuilderOptions, renderGoalSelect as builderRenderGoalSelect } from '../modules/connect-scenario/helpers/scenarios.builder';
import { setupScenariosPage } from '../modules/connect-scenario/helpers/scenarios.controller';
import { runMaxMinPatcherPreset } from '../modules/connect-scenario/helpers/scenarios.patcher';
import { initializeDefIntegration } from '../modules/connect-scenario/helpers/def-integration';
import { setupUiBridge } from '../modules/connect-scenario/helpers/scenarios.ui-bridge';
import { loadScenarioById as loaderLoadScenarioById, ScenarioLoaderContext } from '../modules/connect-scenario/helpers/scenarios.loader';
import { saveScenario as _saveScenarioFn, cloneScenario as _cloneScenarioFn, type SaveContext } from '../modules/connect-scenario/helpers/scenarios.save';
import { renderScenarioList as _renderScenarioListFn, type ScenarioListContext } from '../modules/connect-scenario/helpers/scenarios.list';
import { updatePreview as _updatePreviewFn, type PreviewContext } from '../modules/connect-scenario/helpers/scenarios.preview';
import {
  addNewGoal as _addNewGoalFn, addNewTask as _addNewTaskFn, addNewCondition as _addNewConditionFn,
  addFuncCall as _addFuncCallFn, cloneGoal as _cloneGoalFn, cloneTask as _cloneTaskFn,
  cloneCondition as _cloneConditionFn,
  type BuilderOpsContext,
} from '../modules/connect-scenario/helpers/scenarios.builder-ops';
export class ScenariosPage {
  /** Page discovery compatible render method */
  render(): string { return ScenariosPage.getContent(); }

  private static lastScenarioName: string = '';
  private static renameTimer: any = null;
  // Guard: do not patch/dispatch title changes until scenario has finished loading
  private static allowTitlePatch: boolean = false;
  private static currentExecCtx: ExecContext | null = null;
  // Store current scenario's FUNC definitions for use in addFuncCall
  private static currentFuncSrc: string = '';

  private static dispatch(cmd: any): void {
    try {
      const cqrs = getScenarioCQRS();
      cqrs?.dispatch(cmd);
    } catch {
      // Non-blocking: UI interaction can proceed even if CQRS dispatch fails.
    }
  }

  // Ensure all GOAL names from current scenario exist as activities
  private static ensureGoalsInActivities(): void {
    try {
      const goalSelects = Array.from(document.querySelectorAll('.goal-section .goal-select')) as HTMLSelectElement[];
      if (!goalSelects.length) return;
      const names = Array.from(new Set(goalSelects.map(s => (s.value || '').trim()).filter(Boolean)));
      const cache = (globalThis as any).__activitiesCache as Array<{ id: string; name: string }>;
      const exists = (n: string) => Array.isArray(cache) ? cache.some(r => String(r?.name || '').trim().toLowerCase() === n.trim().toLowerCase()) : false;
      const guessCat = (n: string): string => {
        const t = n.toLowerCase();
        if (t.includes('przepły') || t.includes('flow')) return 'flow';
        if (t.includes('ciśn') || t.includes('bar') || t.includes('mbar') || t.includes('pressure')) return 'pressure';
        if (t.includes('wizual') || t.includes('visual')) return 'visual';
        if (t.includes('szczel') || t.includes('leak')) return 'safety';
        if (t.includes('analiz')) return 'analysis';
        if (t.includes('dokument')) return 'docs';
        if (t.includes('konfigur')) return 'config';
        return 'visual';
      };
      let added = 0;
      for (const n of names) {
        if (n && !exists(n)) {
          try {
            this.dispatch({ type: 'AddActivity', activityId: `act-${Date.now()}`, name: n, desc: '', duration: '', category: guessCat(n) });
          } catch {
            // Non-blocking: continue ensuring remaining goals are mapped to activities.
          }
          added++;
        }
      }
      if (added > 0) {
        notifyBottomLine(`✅ Dodano czynności z GOAL (${added})`, 'success', 2500);
      }
    } catch {
      // Non-blocking: goal-to-activity synchronization should never break editing.
    }
  }

  // DSL methods moved to DslTools component
  private static highlightDsl(text: string): string { return DslTools.highlightDsl(text); }

  

  private static renumberTaskLabels(goalSection: HTMLElement): void {
    const tasks = Array.from(goalSection.querySelectorAll('.task-container')) as HTMLElement[];
    tasks.forEach((el, _idx) => {
      const label = el.querySelector('.task-header .task-label') as HTMLElement | null;
      if (label) label.textContent = `SET`;
    });
  }

  // ===== Builder ops (delegated to scenarios.builder-ops.ts) =====

  private static getBuilderOpsContext(): BuilderOpsContext {
    return {
      dispatch: (cmd) => ScenariosPage.dispatch(cmd),
      renderGoalSelect: (sel) => ScenariosPage.renderGoalSelect(sel),
      libraryLoad: (ds) => ScenariosPage.libraryLoad(ds),
      initializeDragAndDrop: () => ScenariosPage.initializeDragAndDrop(),
      refreshBuilderOptions: () => ScenariosPage.refreshBuilderOptions(),
      updatePreview: () => ScenariosPage.updatePreview(),
      renumberTaskLabels: (gs) => ScenariosPage.renumberTaskLabels(gs),
      getCurrentFuncSrc: () => ScenariosPage.currentFuncSrc,
      setCurrentFuncSrc: (src) => { ScenariosPage.currentFuncSrc = src; },
    };
  }

  private static cloneGoal(goalSection: HTMLElement): void { _cloneGoalFn(this.getBuilderOpsContext(), goalSection); }

  // ===== Library DB sync =====
  private static async fetchLibraryFromDB(): Promise<void> { await ScenariosLibrary.fetchLibraryFromDB(); }

  private static async fetchVariablesFromDB(): Promise<void> { await ScenariosLibrary.fetchVariablesFromDB(); }

  // ===== DSL tools =====
  private static getPreviewText(): string {
    const el = document.getElementById('scenario-preview');
    return (el?.textContent || '').trim();
  }

  private static validateDsl(): void {
    const text = this.getPreviewText();
    DslTools.validateDslInElement(text, 'dsl-results');
  }

  private static runDsl(): void {
    const text = this.getPreviewText();
    const html = DslTools.runDslConsole(text, this.currentExecCtx || undefined);
    // On connect-test/scenarios route, update runtime panel instead of opening modal
    try {
      const path = (globalThis.location?.pathname || '').toString();
      const isConnectTest = path === '/connect-test/scenarios' || path.startsWith('/connect-test/scenarios');
      if (isConnectTest) {
        const panel = document.getElementById('dsl-runtime-output');
        if (panel) panel.innerHTML = html;
        const status = document.getElementById('dsl-runtime-status');
        if (status) {
          const now = new Date();
          const timeStr = (now as any).toLocaleTimeString ? now.toLocaleTimeString() : now.toISOString();
          status.textContent = `Status: ✅ Aktualny | Ostatnia aktualizacja: ${timeStr}`;
        }
        return;
      }
    } catch {
      // Non-blocking: fallback modal rendering is used when runtime panel update fails.
    }
    const out = document.getElementById('dsl-console-output');
    if (out) out.innerHTML = html;
    const modal = document.getElementById('dsl-console-modal');
    if (modal) modal.classList.remove('hidden');
  }

  private static parseDsl(text: string): { ok: boolean; errors: string[]; ast: any } { return DslTools.parseDsl(text); }

  private static applyDslFix(): void {
    try {
      const pre = document.getElementById('scenario-preview');
      const src = pre?.textContent || '';
      const fixed = DslTools.autoFixText(src);
      if (pre) pre.innerHTML = DslTools.highlightDsl(fixed);

      const res = this.parseDsl(fixed);
      if (!res.ok) { notifyBottomLine('❌ Nie udało się zastosować poprawek (błąd parsowania)', 'error', 3000); return; }

      const scenarioName = (document.getElementById('scenario-name') as HTMLInputElement)?.value || 'Bez nazwy';
      // Odbuduj edytor z poprawionego AST
      this.renderBuilderFromData({ name: scenarioName, goals: (res.ast as any).goals });
      this.initializeDragAndDrop();
      this.refreshBuilderOptions();

      // Zapisz do DB (dsl column deprecated - goals stored in library.goals)
      const scenarioId = (ScenariosService.getCurrentScenarioId && ScenariosService.getCurrentScenarioId()) || '';
      if (scenarioId) {
        ScenariosService.updateScenario(scenarioId, { title: scenarioName, goals: (res.ast as any).goals });
      }

      try {
        DslTools.validateDslInElement(fixed, 'dsl-results');
      } catch {
        // Non-blocking: validation widget errors should not block successful DSL auto-fix.
      }
      notifyBottomLine('✅ Zastosowano poprawki i zapisano scenariusz', 'success', 3000);
    } catch {
      notifyBottomLine('❌ Nie udało się zastosować poprawek', 'error', 3000);
    }
  }

  // DB: Fetch scenario by id
  private static async fetchScenarioFromDBById(id: string): Promise<{ id: string; title: string; content?: any; library?: any; config?: any } | null> {
    try { return await ScenariosService.fetchScenarioById(id); } catch { return null; }
  }

  // DB: Patch scenario title using /api/v3/data/test_scenarios
  private static async patchScenarioTitle(scenarioId: string, name: string): Promise<void> {
    if (!scenarioId || !name) return;
    try {
      await ScenariosService.patchScenarioTitle(scenarioId, name);
    } catch {
      // Non-blocking: live title patch can fail without interrupting local editing.
    }
    try {
      this.renderScenarioList((document.getElementById('scenario-filter') as HTMLInputElement | null)?.value || '');
    } catch {
      // Non-blocking: keep current list view when post-patch refresh fails.
    }
  }

  static getContent(): string {
    return ScenariosTemplates.getContent();
  }

  static getStyles(): string {
    return ScenariosStyles.getStyles();
  }

  static attachEventListeners(root?: HTMLElement): void {
    const container = root ||
      document.querySelector('#connect-manager-content') ||
      document.querySelector('#connect-test-content') ||
      document.querySelector('.module-main-content');
    if (!container) return;
    const el = container as HTMLElement;
    if (el.getAttribute('data-scenarios-bound') === '1') return;
    el.setAttribute('data-scenarios-bound', '1');

    try {
      (globalThis as any).runMaxMinPatcherPreset = runMaxMinPatcherPreset;
      (globalThis as any).refreshBuilderOptions = () => ScenariosPage.refreshBuilderOptions();
    } catch {
      // Non-blocking: exposing debug helpers is optional.
    }

    setupScenariosPage(el, {
      updatePreview: () => ScenariosPage.updatePreview(),
      initializeDragAndDrop: () => ScenariosPage.initializeDragAndDrop(),
      renderScenarioList: (filter?: string) => ScenariosPage.renderScenarioList(filter || ''),
      renderSidebarLibrary: () => ScenariosPage.renderSidebarLibrary(),
      refreshBuilderOptions: () => ScenariosPage.refreshBuilderOptions(),
      fetchLibraryFromDB: () => ScenariosPage.fetchLibraryFromDB(),
      fetchVariablesFromDB: () => ScenariosPage.fetchVariablesFromDB(),
      loadScenarioById: (id: string) => ScenariosPage.loadScenarioById(id),
      loadExample: (id: string) => ScenariosPage.loadExample(id),
      addNewGoal: () => ScenariosPage.addNewGoal(),
      addNewTask: (goalSection: HTMLElement, afterEl?: HTMLElement) => ScenariosPage.addNewTask(goalSection, afterEl),
      addNewCondition: (goalSection: HTMLElement, insertAfter?: HTMLElement, connector?: 'AND'|'OR') => ScenariosPage.addNewCondition(goalSection, insertAfter, connector),
      addFuncCall: (goalSection: HTMLElement) => ScenariosPage.addFuncCall(goalSection),
      cloneGoal: (goalSection: HTMLElement) => ScenariosPage.cloneGoal(goalSection),
      cloneTask: (taskContainer: HTMLElement) => ScenariosPage.cloneTask(taskContainer),
      cloneCondition: (conditionEl: HTMLElement) => ScenariosPage.cloneCondition(conditionEl),
      deleteScenario: (id: string) => ScenariosPage.deleteScenario(id),
      openLibraryManager: () => ScenariosPage.openLibraryManager(),
      libraryAdd: () => ScenariosPage.libraryAdd(),
      libraryDelete: (value: string) => ScenariosPage.libraryDelete(value),
      libraryRender: () => ScenariosPage.libraryRender(),
      saveScenario: () => ScenariosPage.saveScenario(),
      readScenarioIdFromUrl: () => ScenariosPage.readScenarioIdFromUrl(),
      addScenario: (name: string) => ScenariosPage.addScenario(name),
      cloneScenario: () => ScenariosPage.cloneScenario(),
      cloneScenarioById: (id: string) => ScenariosPage.cloneScenarioById(id),
      validateDsl: () => ScenariosPage.validateDsl(),
      runDsl: () => ScenariosPage.runDsl(),
      applyDslFix: () => ScenariosPage.applyDslFix(),
      autoFixDsl: () => {
        try {
          const pre = document.getElementById('scenario-preview');
          const src = pre?.textContent || '';
          const fixed = DslTools.autoFixText(src);
          if (pre) pre.innerHTML = DslTools.highlightDsl(fixed);
        } catch {
          // Non-blocking: preview remains unchanged if inline auto-fix rendering fails.
        }
      },
    });

    // Setup UI Bridge for button event handlers (+ and - buttons)
    setupUiBridge(el, {
      updatePreview: () => ScenariosPage.updatePreview(),
      initializeDragAndDrop: () => ScenariosPage.initializeDragAndDrop(),
      renderScenarioList: (filter?: string) => ScenariosPage.renderScenarioList(filter || ''),
      renderSidebarLibrary: () => ScenariosPage.renderSidebarLibrary(),
      refreshBuilderOptions: () => ScenariosPage.refreshBuilderOptions(),
      fetchLibraryFromDB: () => ScenariosPage.fetchLibraryFromDB(),
      fetchVariablesFromDB: () => ScenariosPage.fetchVariablesFromDB(),
      loadScenarioById: (id: string) => ScenariosPage.loadScenarioById(id),
      loadExample: (id: string) => ScenariosPage.loadExample(id),
      addNewGoal: () => ScenariosPage.addNewGoal(),
      addNewTask: (goalSection: HTMLElement, afterEl?: HTMLElement) => ScenariosPage.addNewTask(goalSection, afterEl),
      addNewCondition: (goalSection: HTMLElement, insertAfter?: HTMLElement, connector?: 'AND'|'OR') => ScenariosPage.addNewCondition(goalSection, insertAfter, connector),
      addFuncCall: (goalSection: HTMLElement) => ScenariosPage.addFuncCall(goalSection),
      cloneGoal: (goalSection: HTMLElement) => ScenariosPage.cloneGoal(goalSection),
      cloneTask: (taskContainer: HTMLElement) => ScenariosPage.cloneTask(taskContainer),
      cloneCondition: (conditionEl: HTMLElement) => ScenariosPage.cloneCondition(conditionEl),
      deleteScenario: (id: string) => ScenariosPage.deleteScenario(id),
      openLibraryManager: () => ScenariosPage.openLibraryManager(),
      libraryAdd: () => ScenariosPage.libraryAdd(),
      libraryDelete: (value: string) => ScenariosPage.libraryDelete(value),
      libraryRender: () => ScenariosPage.libraryRender(),
      saveScenario: () => ScenariosPage.saveScenario(),
      readScenarioIdFromUrl: () => ScenariosPage.readScenarioIdFromUrl(),
      addScenario: (name: string) => ScenariosPage.addScenario(name),
      cloneScenario: () => ScenariosPage.cloneScenario(),
      cloneScenarioById: (id: string) => ScenariosPage.cloneScenarioById(id),
      validateDsl: () => ScenariosPage.validateDsl(),
      runDsl: () => ScenariosPage.runDsl(),
      applyDslFix: () => ScenariosPage.applyDslFix()
    } as any);

    // Initialize DEF integration
    try {
      const currentScenarioId = ScenariosService.getCurrentScenarioId();
      initializeDefIntegration(currentScenarioId || '');
    } catch (error) {
      logger.warn('Failed to initialize DEF integration:', error);
    }
  }

  private static getScenarioListContext(): ScenarioListContext {
    return {
      readScenarioIdFromUrl: () => ScenariosPage.readScenarioIdFromUrl(),
      loadScenarioById: (id) => ScenariosPage.loadScenarioById(id),
      writeScenarioIdToUrl: (id) => ScenariosPage.writeScenarioIdToUrl(id),
    };
  }

  // ===== Scenarios list management =====
  private static async renderScenarioList(filter: string = ''): Promise<void> { return _renderScenarioListFn(filter, this.getScenarioListContext()); }

  private static async addScenario(name: string): Promise<void> {
    let id = '';
    try {
      id = await ScenariosService.createScenario(name);
    } catch {
      // Non-blocking: handled by user-facing notification below when id is missing.
    }
    if (!id) { notifyBottomLine('❌ Nie udało się utworzyć scenariusza w bazie', 'error', 3000); return; }
    ScenariosService.setCurrentScenarioId(id);
    this.writeScenarioIdToUrl(id);
    await this.renderScenarioList((document.getElementById('scenario-filter') as HTMLInputElement | null)?.value || '');
    await this.loadScenarioById(id);
  }

  private static async deleteScenario(id: string): Promise<void> {
    const scenarioId = String(id || '').trim();
    if (!scenarioId) {
      notifyBottomLine('❌ Nie można usunąć scenariusza — brak identyfikatora rekordu', 'error', 3500);
      logger.error('Scenario delete skipped because the row is missing data-id');
      return;
    }

    try {
      await ScenariosService.deleteScenario(scenarioId);
      if (this.readScenarioIdFromUrl() === scenarioId) {
        this.writeScenarioIdToUrl('');
      }
      await this.renderScenarioList((document.getElementById('scenario-filter') as HTMLInputElement | null)?.value || '');
      notifyBottomLine('🗑️ Scenariusz został usunięty', 'success', 2500);
    } catch (error) {
      logger.error('Failed to delete scenario:', error);
      notifyBottomLine('❌ Nie udało się usunąć scenariusza', 'error', 3500);
    }
  }

  private static async cloneScenarioById(id: string): Promise<void> {
    if (!id) return;
    try {
      // First load the scenario to clone
      await this.loadScenarioById(id);
      // Then clone it using existing method
      await this.cloneScenario();
    } catch {
      notifyBottomLine('❌ Błąd klonowania scenariusza', 'error', 3000);
    }
  }

  // Scenario loading - delegated to scenarios.loader.ts
  private static getLoaderContext(): ScenarioLoaderContext {
    return {
      parseDsl: (text: string) => ScenariosPage.parseDsl(text),
      highlightDsl: (text: string) => ScenariosPage.highlightDsl(text),
      renderBuilderFromData: (data) => ScenariosPage.renderBuilderFromData(data),
      validateDsl: () => ScenariosPage.validateDsl(),
      updatePreview: () => ScenariosPage.updatePreview(),
      initializeDragAndDrop: () => ScenariosPage.initializeDragAndDrop(),
      refreshBuilderOptions: () => ScenariosPage.refreshBuilderOptions(),
      fetchScenarioFromDBById: (id: string) => ScenariosPage.fetchScenarioFromDBById(id),
      writeScenarioIdToUrl: (id: string) => ScenariosPage.writeScenarioIdToUrl(id),
      setLastScenarioName: (name: string) => { ScenariosPage.lastScenarioName = name; },
      setAllowTitlePatch: (allow: boolean) => { ScenariosPage.allowTitlePatch = allow; },
      setCurrentExecCtx: (ctx) => { ScenariosPage.currentExecCtx = ctx; },
      clearRenameTimer: () => {
        try {
          if (ScenariosPage.renameTimer) {
            clearTimeout(ScenariosPage.renameTimer);
            ScenariosPage.renameTimer = null;
          }
        } catch {
          // Non-blocking: stale timer cleanup errors should not block scenario loading.
        }
      },
    };
  }

  private static async loadScenarioById(id: string): Promise<void> {
    return loaderLoadScenarioById(id, ScenariosPage.getLoaderContext());
  }

  // ===== Library manager =====
  private static libraryLoad(dataset: 'objects'|'functions'|'params'|'units'|'results'|'operators'): string[] {
    return ScenariosLibrary.load(dataset);
  }
  static openLibraryManager(): void {
    ScenariosLibraryUI.openManager();
  }
  private static libraryRender(): void {
    ScenariosLibraryUI.render();
  }
  private static libraryAdd(): void {
    ScenariosLibraryUI.addItem();
  }
  private static libraryDelete(value: string): void {
    ScenariosLibraryUI.deleteItem(value);
  }

  // ===== URL param sync (scenario id) =====
  private static readScenarioIdFromUrl(): string {
    try {
      const params = new URLSearchParams(globalThis.location.search);
      return (params.get('scenario') || params.get('scenario_id') || '').trim();
    } catch { return ''; }
  }

  private static writeScenarioIdToUrl(id: string): void {
    try {
      const url = new URL(globalThis.location.href);
      if (id) url.searchParams.set('scenario', id); else url.searchParams.delete('scenario');
      globalThis.history.replaceState({}, '', `${url.pathname}${url.search}`);
    } catch {
      // Non-blocking: URL sync failure should not block editing workflow.
    }
  }

  // Render right sidebar library from store and rebind DnD
  private static renderSidebarLibrary(): void {
    ScenariosLibraryUI.renderSidebarLibrary();
  }

  // Update all builder selects (functions/objects/params) from library, preserve selection
  private static refreshBuilderOptions(): void { builderRefreshBuilderOptions(); }

  private static renderGoalSelect(selected?: string): string { return builderRenderGoalSelect(selected); }

  // Build builder UI (goals/tasks/conditions) from stored data
  private static renderBuilderFromData(data: { name?: string; goals?: any[] }): void { builderRenderBuilderFromData(data); }

  private static addNewGoal(): void { _addNewGoalFn(this.getBuilderOpsContext()); }
  private static addNewTask(goalSection: HTMLElement, insertAfter?: HTMLElement): void { _addNewTaskFn(this.getBuilderOpsContext(), goalSection, insertAfter); }
  private static addNewCondition(goalSection: HTMLElement, insertAfter?: HTMLElement, connector?: 'AND'|'OR'): void { _addNewConditionFn(this.getBuilderOpsContext(), goalSection, insertAfter, connector); }
  private static async addFuncCall(goalSection: HTMLElement): Promise<void> { return _addFuncCallFn(this.getBuilderOpsContext(), goalSection); }

  private static cloneTask(taskContainer: HTMLElement): void { _cloneTaskFn(this.getBuilderOpsContext(), taskContainer); }
  private static cloneCondition(conditionEl: HTMLElement): void { _cloneConditionFn(this.getBuilderOpsContext(), conditionEl); }

  private static getPreviewContext(): PreviewContext {
    return {
      getLastScenarioName: () => ScenariosPage.lastScenarioName,
      setLastScenarioName: (n) => { ScenariosPage.lastScenarioName = n; },
      isAllowTitlePatch: () => ScenariosPage.allowTitlePatch,
      getRenameTimer: () => ScenariosPage.renameTimer,
      setRenameTimer: (t) => { ScenariosPage.renameTimer = t; },
      dispatch: (cmd) => ScenariosPage.dispatch(cmd),
      patchScenarioTitle: (id, name) => ScenariosPage.patchScenarioTitle(id, name),
    };
  }

  private static updatePreview(): void { _updatePreviewFn(this.getPreviewContext()); }

  private static getSaveContext(): SaveContext {
    return {
      setLastScenarioName: (n) => { ScenariosPage.lastScenarioName = n; },
      setCurrentExecCtx: (ctx) => { ScenariosPage.currentExecCtx = ctx; },
      writeScenarioIdToUrl: (id) => ScenariosPage.writeScenarioIdToUrl(id),
      ensureGoalsInActivities: () => ScenariosPage.ensureGoalsInActivities(),
      refreshBuilderOptions: () => ScenariosPage.refreshBuilderOptions(),
      dispatch: (cmd) => ScenariosPage.dispatch(cmd),
      renderScenarioList: (f) => ScenariosPage.renderScenarioList(f),
      loadScenarioById: (id) => ScenariosPage.loadScenarioById(id),
    };
  }

  private static async saveScenario(): Promise<void> { return _saveScenarioFn(this.getSaveContext()); }

  private static async cloneScenario(): Promise<void> { return _cloneScenarioFn(this.getSaveContext()); }

  

  private static loadExample(exampleId: string): void {
    // Example scenarios to load
    const examples: Record<string, any> = {
      '1': {
        name: 'Test przepływu',
        goals: [{
          name: 'Zmierzyć przepływ',
          tasks: [
            { function: 'Włącz', object: 'pompa 2' },
            { function: 'Zmierz', object: 'przepływ' }
          ]
        }]
      },
      '2': {
        name: 'Kontrola ciśnienia',
        goals: [{
          name: 'Przetestować ciśnienie',
          tasks: [
            { function: 'Ustaw', object: 'regulator' },
            { function: 'Sprawdź', object: 'ciśnienie' }
          ]
        }]
      }
    };

    const example = examples[exampleId];
    if (example) {
      // Load example into UI
      (document.getElementById('scenario-name') as HTMLInputElement).value = example.name;
      // Load more data...
      this.updatePreview();
      notifyBottomLine(`✅ Załadowano przykład: ${example.name}`, 'success', 3000);
    }
  }

  private static initializeDragAndDrop(): void {
    // Delegate DnD wiring to a dedicated module
    ScenariosDnD.initialize(document);

    // Bind once: react to steps reorder stream and bridge to CQRS
    const flag = (document.body as HTMLElement);
    if (flag.getAttribute('data-scenarios-dnd-bound') === '1') return;
    flag.setAttribute('data-scenarios-dnd-bound', '1');

    window.addEventListener('scenarios:steps-reordered', (ev: Event) => {
      const detail = (ev as CustomEvent).detail || {};
      const goalId = String(detail.goalId || '');
      if (!goalId) return;
      const goalSection = document.querySelector(`.goal-section[data-goal-id="${goalId}"]`) as HTMLElement | null;
      const list = goalSection?.querySelector('.steps-container') as HTMLElement | null;
      if (!list) return;
      const scenarioId = (ScenariosService.getCurrentScenarioId && ScenariosService.getCurrentScenarioId()) || undefined;
      const order = Array.from(list.querySelectorAll('.task-container')).map(el => (el as HTMLElement).dataset.taskId || '').filter(Boolean);
      if (goalId) this.dispatch({ type: 'ReorderTasks', scenarioId, goalId, order });
      if (goalSection) this.renumberTaskLabels(goalSection);
      this.updatePreview();
    });
  }
}
