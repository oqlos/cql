/**
 * DEF Integration for Scenarios Page
 * Integrates DEF syntax highlighter with scenarios editor
 */

import { logger } from '../../../utils/logger';
import { ScenariosApiHelper } from '../../shared/scenarios-api.helper';
import { getScenarioCQRS } from '../cqrs/singleton';
import { DefEditor } from '../../../components/dsl-def/def-syntax-highlighter';
import { DslTable } from '../../../components/dsl-table';
import { FirmwareCQRS } from '../../../services/firmware-cqrs.service';
import { wsEventStream } from '../../../services/ws-event-stream.service';
import {
  extractCurrentObjects as libExtractObjects,
  extractCurrentFunctions as libExtractFunctions,
  extractCurrentParams as libExtractParams,
  extractCurrentUnits as libExtractUnits,
  getUnitFromUi as libGetUnitFromUi,
  updateDefLibraryFromCode as libUpdateDefFromCode
} from './def-library';
import { buildDefaultDefTemplate } from './def-integration.default-def';
import {
  ADD_TO_DEF_ERROR_MESSAGE,
  ADD_TO_DEF_MISSING_EDITOR_MESSAGE,
  buildAddToDefPromptMessage,
  buildAddToDefSuccessMessage,
  replaceAddToDefButtonWithSelect,
  updateAddToDefCode,
} from './def-integration.add-to-def';
import {
  bindDefIntegrationEventHandlers,
} from './def-integration.event-bindings';
import {
  applyDefSourceUiState,
  getDefSourceUiState,
  refreshDefIntegrationSelectlists,
  setDefSourceOverride,
  showDefIntegrationNotification,
  type DefIntegrationNotificationType,
} from './def-integration.ui-state';
import {
  DSL_CONSOLE_CLEARED_HTML,
  DSL_TOOLS_LOAD_ERROR_HTML,
  renderRuntimeErrorStatus,
  renderRuntimeSuccessStatus,
  resolveDslResultHtml,
  resolveExecutionErrorHtml,
  setElementHtml,
  shouldSkipRuntimeRefresh,
} from './def-integration.runtime';
import { runDslConsoleWithLoader } from './def-integration.dsl-runner';
import {
  importDefFromDatabase,
  loadScenarioDef,
  saveScenarioDef,
} from './def-integration.persistence';
import {
  bindDslRuntimePanelControls,
  startRuntimeAutoRefresh,
  stopRuntimeAutoRefresh,
} from './def-integration.runtime-controls';
import {
  hasDefLibraryBlock,
  replaceDefLibraryBlock,
  type DefUiLibrarySnapshot,
} from './def-integration.library';
import {
  scheduleDefLibrarySync,
  syncDefLibraryFromUi,
} from './def-integration.library-sync';
import {
  refreshDefIntegrationLiveState,
} from './def-integration.live-state';
import {
  destroyDefEditorInstance,
  initializeDefEditorInstance,
  removeDefEditorHighlightLayers,
} from './def-integration.editor-lifecycle';
import { promptText } from './scenario-dialogs';

export class ScenarioDefIntegration {
  private defEditor: DefEditor | null = null;
  private scenarioId: string = '';
  private autoRefreshInterval: number | null = null;
  private wsUnsubscribers: Array<() => void> = [];
  private eventBindingsCleanup: (() => void) | null = null;
  private runtimePanelCleanup: (() => void) | null = null;
  private lastDslContent: string = '';
  private librarySyncTimer: number | null = null;
  private liveTable: DslTable | null = null;
  private firmwareErrorCount = 0;
  private firmwareDisabled = false;

  initialize(scenarioId: string = ''): void {
    this.scenarioId = scenarioId;
    this.initDefEditor();
    this.attachEventHandlers();
    this.loadDefFromScenario();
    this.initDslRuntimePanel();
  }

  private async refreshLiveState(): Promise<void> {
    const nextState = await refreshDefIntegrationLiveState({
      firmwareDisabled: this.firmwareDisabled,
      firmwareErrorCount: this.firmwareErrorCount,
      liveTable: this.liveTable,
      container: document.getElementById('dsl-live-state'),
      body: document.getElementById('dsl-live-state-body'),
      buildUiLibrarySnapshot: () => this.buildUiLibrarySnapshot(),
      getUnitFromUi: (paramName) => libGetUnitFromUi(paramName),
      getFirmwareBaseUrl: () => FirmwareCQRS.baseUrl,
      fetchStateCandidates: () => FirmwareCQRS.getStateCandidates(),
      createLiveTable: (container) => new DslTable(container, { tbodySelector: '#dsl-live-state-body', showUnits: true }),
    });

    this.liveTable = nextState.liveTable as DslTable | null;
    this.firmwareErrorCount = nextState.firmwareErrorCount;
    this.firmwareDisabled = nextState.firmwareDisabled;
  }

  private scheduleSyncDefLibraryFromUI(): void {
    this.librarySyncTimer = scheduleDefLibrarySync({
      currentTimerId: this.librarySyncTimer,
      onSync: () => this.syncDefLibraryFromUI(),
    });
  }

  // Update only the `const library = { ... }` section in DEF based on current UI selectlists
  private syncDefLibraryFromUI(): void {
    const ta = document.getElementById('scenario-def-editor') as HTMLTextAreaElement | null;
    if (!ta) return;

    syncDefLibraryFromUi({
      getEditorCode: () => String(ta.value || ''),
      hasLibraryBlock: hasDefLibraryBlock,
      ensureLibraryBlock: () => this.generateDefaultDef(),
      getCurrentLibrary: () => (globalThis as any).__scenarioDefLibrary || {},
      buildUiLibrarySnapshot: () => this.buildUiLibrarySnapshot(),
      replaceDefLibraryBlock,
      setEditorCode: (nextCode) => {
        if (this.defEditor) {
          try { this.defEditor.setValue(nextCode); } catch { /* silent */ }
          return;
        }
        ta.value = nextCode;
      },
      updateDefLibraryFromCode: (nextCode) => this.updateDefLibraryFromCode(nextCode),
    });
  }

  private initDefEditor(): void {
    this.defEditor = initializeDefEditorInstance({
      textareaId: 'scenario-def-editor',
      existingEditor: this.defEditor,
      createEditor: (textareaId) => new DefEditor(textareaId),
      onDestroyError: (error) => {
        logger.warn('Failed to destroy existing DEF editor:', error);
      },
      onInitError: (error) => {
        logger.warn('Failed to initialize DEF editor:', error);
      },
    });
  }

  private attachEventHandlers(): void {
    this.eventBindingsCleanup?.();
    this.eventBindingsCleanup = bindDefIntegrationEventHandlers({
      previewElement: document.getElementById('scenario-preview'),
      goalsContainer: document.getElementById('goals-container'),
      isAutoRefreshEnabled: () => !!this.autoRefreshInterval,
      onScheduleSyncDefLibrary: () => this.scheduleSyncDefLibraryFromUI(),
      onDefSourceToggle: (checkbox) => {
        const useDef = checkbox.checked;
        const badge = document.getElementById('def-source-badge');
        const state = getDefSourceUiState(useDef);
        setDefSourceOverride(useDef);
        applyDefSourceUiState({ badge, toggle: checkbox }, useDef);
        this.refreshSelectlists();
        this.showNotification(state.notificationMessage, 'info');
      },
      onAddToDef: (defKey, selectClass, button) => {
        void this.handleAddToDef(defKey, selectClass, button);
      },
      onSaveDefRequested: (defCode) => {
        void this.saveDefToScenario(defCode);
      },
      onImportFromDatabase: () => {
        void this.importFromDatabase();
      },
      onDefLibraryUpdated: () => this.refreshSelectlists(),
      onRunRuntime: () => this.runDslRuntime(),
      onRunConsole: () => this.runDslConsole(),
    });
  }


  /**
   * Handle "Add to DEF" button click - prompts for new item and adds to DEF library
   */
  private async handleAddToDef(defKey: string, selectClass: string, btn: HTMLButtonElement): Promise<void> {
    const promptMessage = buildAddToDefPromptMessage(defKey);
    
    const newValue = await promptText(promptMessage, '', { title: 'Dodaj do biblioteki DEF' });
    if (!newValue || !newValue.trim()) return;
    
    const trimmed = newValue.trim();
    
    // Add to DEF library in editor
    const ta = document.getElementById('scenario-def-editor') as HTMLTextAreaElement | null;
    if (!ta) {
      this.showNotification(ADD_TO_DEF_MISSING_EDITOR_MESSAGE, 'error');
      return;
    }
    
    try {
      const result = updateAddToDefCode({
        code: String(ta.value || ''),
        library: (globalThis as any).__scenarioDefLibrary || {},
        defKey,
        newValue: trimmed,
      });

      if (!result.ok) {
        this.showNotification(result.errorMessage, 'error');
        return;
      }
      
      // Update editor
      if (this.defEditor) {
        this.defEditor.setValue(result.nextCode);
      } else {
        ta.value = result.nextCode;
      }
      
      // Update global cache
      this.updateDefLibraryFromCode(result.nextCode);
      
      // Refresh UI selectlists
      this.refreshSelectlists();
      
      // Replace the button with a select containing the new value
      this.replaceAddButtonWithSelect(btn, result.nextLibrary, selectClass, trimmed);
      
      this.showNotification(buildAddToDefSuccessMessage(trimmed), 'success');
    } catch (error) {
      logger.error('Failed to add to DEF:', error);
      this.showNotification(ADD_TO_DEF_ERROR_MESSAGE, 'error');
    }
  }

  /**
   * Replace an "Add to DEF" button with a select element containing the new value
   */
  private replaceAddButtonWithSelect(
    btn: HTMLButtonElement,
    library: unknown,
    selectClass: string,
    newValue: string,
  ): void {
    try {
      replaceAddToDefButtonWithSelect(btn, library, selectClass, newValue);
    } catch (error) {
      logger.warn('Failed to replace button with select:', error);
    }
  }

  private async loadDefFromScenario(): Promise<void> {
    await loadScenarioDef({
      scenarioId: this.scenarioId,
      hasEditor: !!this.defEditor,
      fetchScenario: (scenarioId) => ScenariosApiHelper.fetchScenarioById(scenarioId),
      applyDefSourceUiState: (hasDef) => {
        const badge = document.getElementById('def-source-badge');
        const toggle = document.getElementById('def-source-toggle') as HTMLInputElement | null;
        applyDefSourceUiState({ badge, toggle }, hasDef);
      },
      setDefCode: (defCode) => this.defEditor?.setValue(defCode),
      updateDefLibraryFromCode: (defCode) => this.updateDefLibraryFromCode(defCode),
      generateDefaultDef: () => this.generateDefaultDef(),
      onError: (error) => {
        logger.error('Failed to load DEF from scenario:', error);
      },
    });
  }

  private generateDefaultDef(): void {
    if (!this.defEditor) return;

    const template = buildDefaultDefTemplate({
      scenarioId: this.scenarioId,
      currentLibrary: (globalThis as any).__scenarioDefLibrary || {},
      uiLibrarySnapshot: this.buildUiLibrarySnapshot(),
    });

    this.defEditor.setValue(template);
  }

  // Extraction methods - delegated to def-library.ts
  private extractCurrentObjects(): string[] {
    return libExtractObjects();
  }

  private extractCurrentFunctions(): string[] {
    return libExtractFunctions();
  }

  private extractCurrentParams(): string[] {
    return libExtractParams();
  }

  private extractCurrentUnits(): string[] {
    return libExtractUnits();
  }

  private buildUiLibrarySnapshot(): DefUiLibrarySnapshot {
    const uniq = (values: string[]) => Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));
    return {
      objects: uniq(this.extractCurrentObjects()),
      functions: uniq(this.extractCurrentFunctions()),
      params: uniq(this.extractCurrentParams()),
      units: uniq(this.extractCurrentUnits()),
    };
  }

  private updateDefLibraryFromCode(defCode: string): void {
    libUpdateDefFromCode(defCode, () => this.refreshSelectlists());
  }

  // buildObjectFunctionMap and buildParamUnitMap delegated to def-library.ts
  
  private async saveDefToScenario(defCode: string): Promise<void> {
    await saveScenarioDef({
      scenarioId: this.scenarioId,
      defCode,
      updateScenario: (scenarioId, payload) => ScenariosApiHelper.updateScenario(scenarioId, payload),
      notify: (message, type) => this.showNotification(message, type),
      dispatchScenarioDefUpdate: ({ type, scenarioId, def }) => {
        const cqrs = getScenarioCQRS();
        cqrs?.dispatch({ type, scenarioId, def });
      },
      updateDefLibraryFromCode: (nextDefCode) => this.updateDefLibraryFromCode(nextDefCode),
      refreshSelectlists: () => this.refreshSelectlists(),
      onError: (error) => {
        logger.error('Failed to save DEF:', error);
      },
      onRefreshError: (error) => {
        logger.warn('Failed to refresh builder after DEF save:', error);
      },
    });
  }

  private async importFromDatabase(): Promise<void> {
    importDefFromDatabase({
      hasEditor: !!this.defEditor,
      setSourceOverride: (source) => {
        (globalThis as any).__dslLibrarySourceOverride = source;
      },
      refreshSelectlists: () => this.refreshSelectlists(),
      generateDefaultDef: () => this.generateDefaultDef(),
      notify: (message, type) => this.showNotification(message, type),
      onError: (error) => {
        logger.error('Failed to import from DB:', error);
      },
    });
  }

  private refreshSelectlists(): void {
    refreshDefIntegrationSelectlists();
  }

  private showNotification(message: string, type: DefIntegrationNotificationType): void {
    showDefIntegrationNotification(message, type);
  }

  // Public API
  getDefEditor(): DefEditor | null {
    return this.defEditor;
  }

  getCurrentScenarioId(): string {
    return this.scenarioId;
  }

  setScenarioId(scenarioId: string): void {
    this.scenarioId = scenarioId;
    this.loadDefFromScenario();
  }

  destroy(): void {
    this.eventBindingsCleanup?.();
    this.eventBindingsCleanup = null;
    this.runtimePanelCleanup?.();
    this.runtimePanelCleanup = null;
    this.stopAutoRefresh();
    this.defEditor = destroyDefEditorInstance(this.defEditor);
  }

  private initDslRuntimePanel(): void {
    this.runtimePanelCleanup?.();
    this.runtimePanelCleanup = bindDslRuntimePanelControls({
      autoRefreshCheckbox: document.getElementById('dsl-auto-refresh') as HTMLInputElement | null,
      manualRefreshBtn: document.getElementById('dsl-manual-refresh'),
      manualStateBtn: document.getElementById('dsl-state-manual-refresh'),
      consoleRefreshBtn: document.getElementById('dsl-console-refresh'),
      consoleClearBtn: document.getElementById('dsl-console-clear'),
      onStartAutoRefresh: () => this.startAutoRefresh(),
      onStopAutoRefresh: () => this.stopAutoRefresh(),
      onRunRuntime: () => this.runDslRuntime(),
      onResetLiveState: () => {
        this.firmwareDisabled = false;
        FirmwareCQRS.resetConnectionCache();
        this.refreshLiveState();
      },
      onRunConsole: () => this.runDslConsole(),
      onClearConsole: () => {
        const consoleOutput = document.getElementById('dsl-console-output');
        setElementHtml(consoleOutput, DSL_CONSOLE_CLEARED_HTML);
      },
    });
  }

  private startAutoRefresh(): void {
    const refreshRuntimePanels = () => {
      this.runDslRuntime();
      if (FirmwareCQRS.isKnownAvailable) {
        this.refreshLiveState();
      }
    };

    this.stopAutoRefresh();

    const nextState = startRuntimeAutoRefresh({
      subscribeToEvent: (eventType, handler) => wsEventStream.on(eventType, () => handler()),
      onRefreshRuntimePanels: refreshRuntimePanels,
    });
    this.wsUnsubscribers = nextState.wsUnsubscribers;
    this.autoRefreshInterval = nextState.intervalId;
  }

  private stopAutoRefresh(): void {
    const nextState = stopRuntimeAutoRefresh({
      wsUnsubscribers: this.wsUnsubscribers,
      intervalId: this.autoRefreshInterval,
    });
    this.wsUnsubscribers = nextState.wsUnsubscribers;
    this.autoRefreshInterval = nextState.intervalId;
  }

  private runDslRuntime(): void {
    try {
      const previewElement = document.getElementById('scenario-preview');
      const outputElement = document.getElementById('dsl-runtime-output');
      const statusElement = document.getElementById('dsl-runtime-status');

      if (!previewElement || !outputElement) return;

      const currentDslContent = previewElement.textContent || '';
      
      // Skip if DSL content hasn't changed
      if (shouldSkipRuntimeRefresh(currentDslContent, this.lastDslContent, outputElement.innerHTML)) {
        return;
      }

      this.lastDslContent = currentDslContent;

      runDslConsoleWithLoader(currentDslContent).then((runtimeResult) => {
        // Update output
        setElementHtml(outputElement, resolveDslResultHtml(runtimeResult));

        // Update status
        renderRuntimeSuccessStatus(statusElement, new Date().toLocaleTimeString());
      }).catch(error => {
        logger.warn('Failed to load DslTools:', error);

        setElementHtml(outputElement, DSL_TOOLS_LOAD_ERROR_HTML);
        renderRuntimeErrorStatus(statusElement, error.message);
      });

    } catch (error) {
      logger.error('DSL Runtime error:', error);
      
      const outputElement = document.getElementById('dsl-runtime-output');
      const statusElement = document.getElementById('dsl-runtime-status');

      setElementHtml(outputElement, resolveExecutionErrorHtml(error));
      renderRuntimeErrorStatus(statusElement, new Date().toLocaleTimeString());
    }
  }

  private runDslConsole(): void {
    try {
      const previewElement = document.getElementById('scenario-preview');
      const consoleOutput = document.getElementById('dsl-console-output');

      if (!previewElement || !consoleOutput) return;

      const currentDslContent = previewElement.textContent || '';

      runDslConsoleWithLoader(currentDslContent).then((consoleResult) => {
        // Update console output
        setElementHtml(consoleOutput, resolveDslResultHtml(consoleResult));
      }).catch(error => {
        logger.warn('Failed to load DslTools for console:', error);

        setElementHtml(consoleOutput, DSL_TOOLS_LOAD_ERROR_HTML);
      });

    } catch (error) {
      logger.error('DSL Console error:', error);
      
      const consoleOutput = document.getElementById('dsl-console-output');
      setElementHtml(consoleOutput, resolveExecutionErrorHtml(error));
    }
  }
}

// Global instance for integration
let globalDefIntegration: ScenarioDefIntegration | null = null;

export function initializeDefIntegration(scenarioId: string = ''): ScenarioDefIntegration {
  removeDefEditorHighlightLayers(document, (error) => {
    logger.warn('Failed to clean up highlight layer:', error);
  });

  if (globalDefIntegration) {
    globalDefIntegration.destroy();
  }
  
  globalDefIntegration = new ScenarioDefIntegration();
  globalDefIntegration.initialize(scenarioId);
  
  return globalDefIntegration;
}

export function getDefIntegration(): ScenarioDefIntegration | null {
  return globalDefIntegration;
}

// Expose globally for cross-module access
if (typeof globalThis !== 'undefined') {
  (globalThis as any).getDefIntegration = getDefIntegration;
}
