import { logger } from '../utils/logger';
import { protocolPreviewHtml as protocolPreviewHtmlUtil, buildDocHtml as buildDocHtmlUtil, renderInline as renderInlineUtil, esc as escUtil } from '../modules/connect-test/utils/protocol-utils';
import { fetchProtocolById as fetchProtocolByIdUtil } from '../modules/connect-test/services/protocols.service';
import { populateStepsWithThresholds as populateStepsWithThresholdsFn } from '../modules/connect-test-protocol/helpers/thresholds';
import { ProtocolStepsStyles } from '../modules/connect-test-protocol/helpers/styles';
import { getProtocolModalsHtml } from '../modules/connect-test-protocol/helpers/templates';
import { ProtocolStepsLogs } from '../modules/connect-test-protocol/helpers/logs';
import { updateProtocol as psUpdateProtocol } from '../modules/connect-test-protocol/helpers/persistence';
import { setStep as navSetStep, prev as navPrev, next as navNext } from '../modules/connect-test-protocol/helpers/nav';
import { fillParamUnitControls as uiFillParamUnitControls, updateUnitsForSelectedParam as uiUpdateUnitsForSelectedParam, updateValuePlaceholder as uiUpdateValuePlaceholder } from '../modules/connect-test-protocol/helpers/ui';
import { getProtocolCQRS as getConnectTestCQRS } from '../modules/connect-test-protocol/cqrs/singleton';
import { replaceRoute } from '../core/router/nav';
import { GoalExecutionModal } from '../components/goal-execution-modal';
import * as SessionOps from '../modules/connect-test-protocol/helpers/session';
import { fetchSessionUser } from '../modules/connect-test/services/auth.service';
import { toIntervalCode as svToIntervalCode } from '../modules/connect-test/helpers/scenario-view-utils';
import { showErrorChoice, showDemoLoginChoice } from '../components/error-choice-modal';
import { fetchNavigationOptions } from '../services/navigation-options.service';
import { startValueStream as fwStartValueStream, stopValueStream as fwStopValueStream, markValueInputAsUserEntered as fwMarkUserEntered, resetValueInputUserFlag as fwResetUserFlag, FirmwareStreamContext } from '../modules/connect-test-protocol/helpers/firmware';
import { normalizeResultsToGoals as _normalizeResultsToGoals, filterResultsStrictBySgi as _filterResultsBySgi, type IntervalsCache } from '../modules/connect-test-protocol/helpers/results-normalization';
import { parseNumericString as _parseNumericString, resolveVarNameCandidate as _resolveVarNameCandidate, resolveValueFromFirmwareVars as _resolveValueFromFirmwareVars } from '../modules/connect-test-protocol/helpers/value-resolver';
import { bindStepsInteractions } from '../modules/connect-test-protocol/helpers/steps-bindings';
import { captureMeasuredValueForStep as _captureFn, type CaptureContext } from '../modules/connect-test-protocol/helpers/protocol-steps.capture';
import { loadProtocol as _loadProtocolFn, loadSession as _loadSessionFn, type LoaderContext } from '../modules/connect-test-protocol/helpers/protocol-steps.loader';
import { doFinalize as _doFinalizeFn, cancel as _cancelFn, type FinalizeContext } from '../modules/connect-test-protocol/helpers/protocol-steps.finalize';
import { renderThresholdsTable as renderThresholdsTableFn, renderGoalStepsHtml as renderGoalStepsHtmlFn, ThresholdsRenderContext } from '../modules/connect-test-protocol/helpers/render';
import { logProtocolLoad } from '../modules/connect-test-protocol/helpers/dsl';
import { PressurePanelComponent } from '../modules/connect-test/components/pressure-panel.component';
import { getGoalRuntime } from '../modules/connect-test-protocol/helpers/dsl-goal-runtime';
import { FirmwareVarsSimService } from '../services/firmware-vars-sim.service';
import {
  renderFirmwareVarsSection as fwVarsRenderSection,
  startFirmwareVarsAutoRefresh as fwVarsStartAutoRefresh,
  stopFirmwareVarsAutoRefresh as fwVarsStopAutoRefresh,
  copyFirmwareVarsJson as fwVarsCopyJson,
} from '../modules/connect-test-protocol/helpers/firmware-vars';
import { loadScenarioContent as loadScenarioContentHelper } from '../modules/connect-test-protocol/helpers/scenario-content';
import { resolveAndLoadScenarioThresholds } from '../modules/connect-test-protocol/helpers/scenario-resolver';
import { normalizeGoalSteps as normalizeGoalStepsFn } from '../modules/connect-test-protocol/helpers/goal-normalizer';
import { copyCurrentGoalLogs as copyLogsFn, copyCurrentGoalDsl as copyDslFn, copyMeasurementsTableJson as copyMeasJsonFn, copyMeasurementsTableHtml as copyMeasHtmlFn } from '../modules/connect-test-protocol/helpers/copy-ops';
import { renderGoalMessagesHtml as renderGoalMessagesFn, renderMeasurementsDebugJson as renderMeasDebugJsonFn } from '../modules/connect-test-protocol/helpers/measurements-panel';
import { renderInnerHtml, type InnerRenderContext } from '../modules/connect-test-protocol/helpers/inner-renderer';
import { applyActivityAction as applyActivityActionFn, type ActivityContext } from '../modules/connect-test-protocol/helpers/activity-handler';
import {
  handleDslEvaluationResult as _handleDslEvalFn,
  initGoalRuntime as _initGoalRuntimeFn,
  type DslEvalContext,
} from '../modules/connect-test-protocol/helpers/dsl-evaluation';

import '../components/dsl/dsl.highlight.css';

export class ProtocolStepsPage {
  /** Page discovery compatible render method */
  render(): string { return ProtocolStepsPage.getContent(); }
  private static protocolId: string | null = null;
  private static sessionId: string | null = null;
  private static results: any = null;
  private static currentStep: number = 1;
  private static finalComment: string = '';
  private static advancing: boolean = false;
  private static protoRow: any | null = null;
  // DSL caches (lightweight, local for this page)
  private static dslParams: Array<{ id: string; name: string }> = [];
  private static dslUnits: Array<{ id: string; code?: string; name?: string }> = [];
  private static dslParamUnits: Array<{ id: string; param_id: string; unit_id: string; is_default?: string }> = [];
  private static forcedIntervalCode: string | null = null;
  // Thresholds map: goal -> param -> { min?: number; max?: number; unit?: string }
  private static thresholds: Record<string, Record<string, { min?: number; max?: number; unit?: string }>> = {};
  // Scenario content with goals and steps
  private static scenarioContent: { goals?: Array<{ name: string; steps: any[] }> } | null = null;
  // DIALOG variable values (set by user clicking option buttons)
  private static dialogVariables: Record<string, string> = {};
  // Guards to prevent infinite loops
  private static isSettingUp = false;
  private static protocolLoadPromise: Promise<void> | null = null;
  private static rerenderTimeout: any = null;
  // Note: Firmware value stream state moved to protocol-steps.firmware.ts
  private static onRouteChangedBound: ((ev: Event) => void) | null = null;

  private static _intervalsCache: IntervalsCache = { items: [] };

  private static async filterResultsStrictBySgi(row: any, results: any): Promise<any> {
    return _filterResultsBySgi(row, results, ProtocolStepsPage._intervalsCache, () => ProtocolStepsPage.forcedIntervalCode, () => getConnectTestCQRS());
  }


  // === DSL helpers ===

  static getContent(): string {
    return `
      <div class="page-content protocol-steps">
        <div id="protocol-steps-root">${this.renderInner()}</div>
        ${getProtocolModalsHtml()}
      </div>
    `;
  }

  private static getLoaderContext(): LoaderContext {
    return {
      getProtocolId: () => ProtocolStepsPage.protocolId,
      setProtocolId: (id) => { ProtocolStepsPage.protocolId = id; },
      getSessionId: () => ProtocolStepsPage.sessionId,
      setResults: (r) => { ProtocolStepsPage.results = r; },
      setProtoRow: (r) => { ProtocolStepsPage.protoRow = r; },
      setFinalComment: (v) => { ProtocolStepsPage.finalComment = v; },
      getProtocolLoadPromise: () => ProtocolStepsPage.protocolLoadPromise,
      setProtocolLoadPromise: (p) => { ProtocolStepsPage.protocolLoadPromise = p; },
      filterResultsStrictBySgi: (row, results) => ProtocolStepsPage.filterResultsStrictBySgi(row, results),
    };
  }

  private static async loadSession(): Promise<void> { return _loadSessionFn(this.getLoaderContext()); }

  static getStyles(): string { return ProtocolStepsStyles.getStyles(); }

  static setup(container?: HTMLElement): void {
    // Guard against multiple concurrent setups
    if (ProtocolStepsPage.isSettingUp) {
      logger.debug('⚠️  Protocol Steps: Setup already in progress, skipping');
      return;
    }
    
    // Find root in container first (before DOM append), then fallback to document
    const findRoot = () => container?.querySelector('#protocol-steps-root') || document.getElementById('protocol-steps-root');
    
    const root = findRoot();
    if (!root) {
      // Limited retries to prevent infinite loop
      let retryCount = 0;
      const maxRetries = 3;
      const trySetup = () => {
        retryCount++;
        if (retryCount > maxRetries) {
          logger.error('❌ Protocol Steps: Failed to find root after', maxRetries, 'retries');
          return;
        }
        const r = findRoot();
        if (r) {
          ProtocolStepsPage.actualSetup(container);
        } else {
          setTimeout(trySetup, 100);
        }
      };
      setTimeout(trySetup, 0);
      return;
    }
    
    ProtocolStepsPage.actualSetup(container);
  }
  
  private static actualSetup(container?: HTMLElement): void {
    // Find root in container first, then fallback to document
    const root = container?.querySelector('#protocol-steps-root') || document.getElementById('protocol-steps-root');
    if (!root) {
      ProtocolStepsPage.isSettingUp = false;
      return;
    }
    
    ProtocolStepsPage.isSettingUp = true;
    try {

    if (ProtocolStepsPage.onRouteChangedBound) {
      try { globalThis.removeEventListener('routeChanged', ProtocolStepsPage.onRouteChangedBound as any); } catch { /* silent */ }
    }
    ProtocolStepsPage.onRouteChangedBound = (e: Event) => {
      try {
        const route = String((e as CustomEvent)?.detail?.route || '');
        const path = globalThis.location?.pathname || '';
        const isOnProtocol = route.includes('/connect-test-protocol') || route.includes('/connect-test/protocol-steps') || path.includes('/connect-test-protocol') || path.includes('/connect-test/protocol-steps');
        if (!isOnProtocol) {
          try { ProtocolStepsPage.stopFirmwareVarsAutoRefresh(); } catch { /* silent */ }
          try { ProtocolStepsPage.stopValueStream(); } catch { /* silent */ }
          try { ProtocolStepsPage.stopLogsStreaming(); } catch { /* silent */ }
        }
      } catch { /* silent */ }
    };
    globalThis.addEventListener('routeChanged', ProtocolStepsPage.onRouteChangedBound as any);

    // Parse URL
    try {
      const url = new URL(globalThis.location.href);
      ProtocolStepsPage.protocolId = (url.searchParams.get('protocol') || url.searchParams.get('prtotocol') || '').trim() || null;
      ProtocolStepsPage.sessionId = (url.searchParams.get('session') || '').trim() || null;
      const s = Number.parseInt(url.searchParams.get('step') || '1', 10);
      ProtocolStepsPage.currentStep = Number.isFinite(s) && s > 0 ? s : 1;
      const t = (url.searchParams.get('type') || '').trim();
      if (t) ProtocolStepsPage.forcedIntervalCode = svToIntervalCode(t);
      
      // DSL: Log protocol page setup
      if (ProtocolStepsPage.protocolId || ProtocolStepsPage.sessionId) {
        logProtocolLoad(ProtocolStepsPage.protocolId || ProtocolStepsPage.sessionId || '', {
          step: ProtocolStepsPage.currentStep,
          sessionId: ProtocolStepsPage.sessionId || undefined
        });
      }
    } catch { /* silent */ }

    // Guard: missing both protocol and session -> show error modal with choices
    // Only show modal if the user actually navigated to the protocol page
    const currentPath = globalThis.location?.pathname || '';
    const isOnProtocolPage = currentPath === '/connect-test-protocol' || currentPath.startsWith('/connect-test-protocol/') || currentPath === '/connect-test/protocol-steps' || currentPath.startsWith('/connect-test/protocol-steps');
    if (!ProtocolStepsPage.protocolId && !ProtocolStepsPage.sessionId) {
      if (!isOnProtocolPage) {
        return;
      }
      (async () => {
        try {
          const sess = await fetchSessionUser();
          if (sess && (sess.username || sess.name)) {
            const opts = await fetchNavigationOptions('no-protocol', sess.role || undefined);
            showErrorChoice({
              title: '⚠️ Brak aktywnego protokołu',
              message: 'Nie znaleziono aktywnego protokołu testowego. Wybierz akcję:',
              choices: opts.map(o => ({
                label: o.label,
                icon: o.icon || undefined,
                route: o.route === '__reload__' ? undefined : o.route,
                action: o.route === '__reload__' ? () => location.reload() : undefined,
                primary: o.primary,
              })),
            });
          } else {
            showDemoLoginChoice();
          }
        } catch {
          showDemoLoginChoice();
        }
      })();
      return;
    }

      const loaderProto = ProtocolStepsPage.sessionId ? ProtocolStepsPage.loadSession() : ProtocolStepsPage.loadProtocol();
      const loaderDsl = ProtocolStepsPage.loadDslCaches();
      Promise.allSettled([loaderProto, loaderDsl]).then(async () => {
        try { await ProtocolStepsPage.loadScenarioThresholds(); } catch { /* silent */ }
        ProtocolStepsPage.rerender();
        ProtocolStepsPage.fillParamUnitControls();
        try { ProtocolStepsPage.startLogsStreaming(); } catch { /* silent */ }
      }).catch(() => {
        ProtocolStepsPage.rerender();
        ProtocolStepsPage.fillParamUnitControls();
        try { ProtocolStepsPage.startLogsStreaming(); } catch { /* silent */ }
      });

    // Bind DOM interactions
    bindStepsInteractions(root, {
      prev: () => ProtocolStepsPage.prev(),
      next: () => ProtocolStepsPage.next(),
      applyActivityAction: (a) => ProtocolStepsPage.applyActivityAction(a),
      clearCurrentGoalLogs: () => ProtocolStepsPage.clearCurrentGoalLogs(),
      copyCurrentGoalLogs: () => ProtocolStepsPage.copyCurrentGoalLogs(),
      copyCurrentGoalDsl: () => ProtocolStepsPage.copyCurrentGoalDsl(),
      copyMeasurementsTableJson: () => ProtocolStepsPage.copyMeasurementsTableJson(),
      copyMeasurementsTableHtml: () => ProtocolStepsPage.copyMeasurementsTableHtml(),
      copyFirmwareVarsJson: () => ProtocolStepsPage.copyFirmwareVarsJson(),
      fetchProtocolById: (id) => ProtocolStepsPage.fetchProtocolById(id),
      normalizeResultsToGoals: (res) => _normalizeResultsToGoals(res),
      protocolPreviewHtml: (row) => ProtocolStepsPage.protocolPreviewHtml(row),
      esc: (s) => ProtocolStepsPage.esc(s),
      renderInline: (el, fr, html) => ProtocolStepsPage.renderInline(el, fr, html),
      buildDocHtml: (t, b) => ProtocolStepsPage.buildDocHtml(t, b),
      pause: () => ProtocolStepsPage.pause(),
      resume: () => ProtocolStepsPage.resume(),
      showCancelConfirm: () => ProtocolStepsPage.showCancelConfirm(),
      showGoalModal: () => ProtocolStepsPage.showGoalModal(),
      setStep: (n) => ProtocolStepsPage.setStep(n),
      setDialogVariable: (name, value) => ProtocolStepsPage.setDialogVariable(name, value),
      hideCancelConfirm: () => ProtocolStepsPage.hideCancelConfirm(),
      cancel: () => ProtocolStepsPage.cancel(),
      hideSaveConfirm: () => ProtocolStepsPage.hideSaveConfirm(),
      doFinalize: () => ProtocolStepsPage.doFinalize(),
      getProtocolId: () => ProtocolStepsPage.protocolId,
      setFinalComment: (v) => { ProtocolStepsPage.finalComment = v; },
      updateUnitsForSelectedParam: () => ProtocolStepsPage.updateUnitsForSelectedParam(),
      updateValuePlaceholder: () => ProtocolStepsPage.updateValuePlaceholder(),
    });
    } finally {
      ProtocolStepsPage.isSettingUp = false;
    }
  }

  private static renderInner(): string {
    const ctx: InnerRenderContext = {
      protocolId: ProtocolStepsPage.protocolId,
      sessionId: ProtocolStepsPage.sessionId,
      currentStep: ProtocolStepsPage.currentStep,
      finalComment: ProtocolStepsPage.finalComment,
      scenarioContent: ProtocolStepsPage.scenarioContent,
      thresholds: ProtocolStepsPage.thresholds,
      getSteps: () => ProtocolStepsPage.getSteps(),
      getCurrentGoalName: () => ProtocolStepsPage.getCurrentGoalName(),
      getGoalLogs: (g) => ProtocolStepsPage.getGoalLogs(g),
      renderGoalMessagesHtml: () => ProtocolStepsPage.renderGoalMessagesHtml(),
      renderThresholdsTable: () => ProtocolStepsPage.renderThresholdsTable(),
      renderGoalStepsHtml: () => ProtocolStepsPage.renderGoalStepsHtml(),
      renderMeasurementsDebugJson: () => ProtocolStepsPage.renderMeasurementsDebugJson(),
      esc: (s) => ProtocolStepsPage.esc(s),
      parseNumericString: _parseNumericString,
      resolveValueFromFirmwareVars: _resolveValueFromFirmwareVars,
    };
    return renderInnerHtml(ctx);
  }

  private static getSteps(): any[] {
    const steps = (ProtocolStepsPage.results && Array.isArray(ProtocolStepsPage.results.steps)) ? ProtocolStepsPage.results.steps : [];
    return steps;
  }

  private static async loadProtocol(): Promise<void> { return _loadProtocolFn(this.getLoaderContext()); }

  // === DSL helpers ===
  private static async loadDslCaches(): Promise<void> {
    try {
      // Use shared DSL data service instead of direct fetch calls
      const { dslDataService } = await import('../components/dsl');
      const data = await dslDataService.loadAll();
      
      ProtocolStepsPage.dslParams = data.params.map(p => ({ id: p.id, name: p.name }));
      ProtocolStepsPage.dslUnits = data.units.map(u => ({ id: u.id, code: u.code, name: u.name }));
      ProtocolStepsPage.dslParamUnits = data.paramUnits.map(pu => ({ 
        id: pu.id, 
        param_id: pu.param_id, 
        unit_id: pu.unit_id, 
        is_default: pu.is_default 
      }));
    } catch {
      // Fallback to empty arrays if service fails
      ProtocolStepsPage.dslParams = [];
      ProtocolStepsPage.dslUnits = [];
      ProtocolStepsPage.dslParamUnits = [];
    }
  }

  private static fillParamUnitControls(): void {
    uiFillParamUnitControls(
      ProtocolStepsPage.dslParams,
      ProtocolStepsPage.dslUnits,
      ProtocolStepsPage.dslParamUnits,
      ProtocolStepsPage.thresholds,
      () => ProtocolStepsPage.getCurrentGoalName()
    );
  }

  private static updateUnitsForSelectedParam(): void {
    uiUpdateUnitsForSelectedParam(
      ProtocolStepsPage.dslParams,
      ProtocolStepsPage.dslUnits,
      ProtocolStepsPage.dslParamUnits,
      ProtocolStepsPage.thresholds,
      () => ProtocolStepsPage.getCurrentGoalName()
    );
  }

  private static async loadScenarioContent(scenarioId: string): Promise<void> {
    const result = await loadScenarioContentHelper(scenarioId, ProtocolStepsPage.normalizeGoalSteps);
    if (result) ProtocolStepsPage.scenarioContent = result;
  }

  private static async loadScenarioThresholds(): Promise<void> {
    await resolveAndLoadScenarioThresholds({
      getResults: () => ProtocolStepsPage.results,
      setResults: (r) => { ProtocolStepsPage.results = r; },
      getProtoRow: () => ProtocolStepsPage.protoRow,
      getThresholds: () => ProtocolStepsPage.thresholds,
      setThresholds: (t) => { ProtocolStepsPage.thresholds = t; },
      loadScenarioContent: (sid) => ProtocolStepsPage.loadScenarioContent(sid),
      populateStepsWithThresholds: () => ProtocolStepsPage.populateStepsWithThresholds(),
      updateProtocol: (opts) => psUpdateProtocol(opts),
      getProtocolId: () => ProtocolStepsPage.protocolId,
    });
  }

  private static updateValuePlaceholder(): void {
    uiUpdateValuePlaceholder(
      ProtocolStepsPage.thresholds,
      () => ProtocolStepsPage.getCurrentGoalName()
    );
  }

  private static populateStepsWithThresholds(): void {
    populateStepsWithThresholdsFn({
      getSteps: () => ProtocolStepsPage.getSteps(),
      thresholds: ProtocolStepsPage.thresholds,
      scenarioGoals: ProtocolStepsPage.scenarioContent?.goals || [],
      normalizeGoalSteps: ProtocolStepsPage.normalizeGoalSteps,
      getGoalLogs: (name) => ProtocolStepsPage.getGoalLogs(name),
      parseNumericString: _parseNumericString,
      resolveVarNameCandidate: _resolveVarNameCandidate,
    });
  }

  private static fillHiddenInputsFromScenario(): void {
    // Fill hidden inputs with VAL data from scenario for use by saveCurrentValue
    const steps = ProtocolStepsPage.getCurrentGoalSteps();
    const valStep = steps.find((s: any) => String(s?.type || '').toUpperCase() === 'VAL');
    
    const psel = document.getElementById('ps-param-select') as HTMLInputElement | null;
    const usel = document.getElementById('ps-unit-select') as HTMLInputElement | null;
    
    if (psel && valStep) {
      psel.value = String(valStep.parameter || '');
    }
    if (usel && valStep) {
      usel.value = String(valStep.unit || '');
    }
  }

  // ===== Per-goal DSL logs support =====

  private static getCurrentGoalName(): string {
    try {
      const steps = ProtocolStepsPage.getSteps();
      const idx = ProtocolStepsPage.currentStep - 1;
      const s = steps[idx];
      if (s) return String(s?.name || '').trim();
      const last = Array.isArray(steps) ? steps.at(-1) : null;
      return String((last as any)?.name || '').trim();
    } catch { return ''; }
  }

  private static normalizeGoalSteps(goal: any): any[] {
    return normalizeGoalStepsFn(goal);
  }

  private static getCurrentGoalSteps(): any[] {
    try {
      if (!ProtocolStepsPage.scenarioContent?.goals) return [];
      
      // Get goal by index (currentStep - 1) to handle duplicate goal names
      const goalIndex = ProtocolStepsPage.currentStep - 1;
      const goals = ProtocolStepsPage.scenarioContent.goals;
      
      if (goalIndex >= 0 && goalIndex < goals.length) {
        const goal = goals[goalIndex];
        const steps = ProtocolStepsPage.normalizeGoalSteps(goal);
        if (steps.length) return steps;
      }
      
      // Fallback: try to match by name if index doesn't work
      const canonGoalName = (x: any): string => {
        try { return String(x || '').trim().replace(/\s+/g, ' ').toLowerCase(); } catch { return ''; }
      };
      const goalName = canonGoalName(ProtocolStepsPage.getCurrentGoalName());
      if (!goalName) return [];
      const goal = goals.find((g: any) => canonGoalName(g?.name || (g as any)?.goal) === goalName);
      const steps = ProtocolStepsPage.normalizeGoalSteps(goal);
      if (!steps.length) return [];
      return steps;
    } catch { return []; }
  }

  // Rendering - delegated to protocol-steps.render.ts
  private static getRenderContext(): ThresholdsRenderContext {
    return {
      getCurrentGoalSteps: () => ProtocolStepsPage.getCurrentGoalSteps(),
      getSteps: () => ProtocolStepsPage.getSteps(),
      getCurrentStep: () => ProtocolStepsPage.currentStep,
      getDslRuntimeState: () => {
        try {
          const runtime = getGoalRuntime();
          return runtime.getState();
        } catch { return null; }
      },
    };
  }

  private static renderThresholdsTable(): string {
    return renderThresholdsTableFn(ProtocolStepsPage.getRenderContext());
  }

  private static renderGoalStepsHtml(): string {
    const fn: any = () => ProtocolStepsPage.getCurrentGoalSteps();
    try { fn.goalName = String(ProtocolStepsPage.getCurrentGoalName() || '').trim(); } catch { /* silent */ }
    return renderGoalStepsHtmlFn(fn);
  }

  private static renderGoalMessagesHtml(): string {
    return renderGoalMessagesFn(
      () => ProtocolStepsPage.getCurrentGoalSteps(),
      ProtocolStepsPage.esc.bind(ProtocolStepsPage),
    );
  }

  /** Render debug JSON panel showing measurements context for report template debugging */
  private static renderMeasurementsDebugJson(): string {
    return renderMeasDebugJsonFn({
      getSteps: () => ProtocolStepsPage.getSteps(),
      getCurrentGoalSteps: () => ProtocolStepsPage.getCurrentGoalSteps(),
      getCurrentGoalName: () => ProtocolStepsPage.getCurrentGoalName(),
      thresholds: ProtocolStepsPage.thresholds,
      scenarioContent: ProtocolStepsPage.scenarioContent,
      currentStep: ProtocolStepsPage.currentStep,
      protoRow: ProtocolStepsPage.protoRow,
      esc: ProtocolStepsPage.esc.bind(ProtocolStepsPage),
      renderFirmwareVarsSection: () => ProtocolStepsPage.renderFirmwareVarsSection(),
    });
  }

  private static refreshDebugJson(): void {
    try {
      const panel = document.querySelector('.measurements-panel') as HTMLElement | null;
      if (!panel) return;
      panel.innerHTML = ProtocolStepsPage.renderMeasurementsDebugJson();
    } catch { /* silent */ }
  }

  private static renderFirmwareVarsSection(): string {
    return fwVarsRenderSection(ProtocolStepsPage.esc.bind(ProtocolStepsPage));
  }

  private static startFirmwareVarsAutoRefresh(): void { fwVarsStartAutoRefresh(); }
  private static stopFirmwareVarsAutoRefresh(): void { fwVarsStopAutoRefresh(); }
  private static copyFirmwareVarsJson(): void { fwVarsCopyJson(); }

  private static ensureGoalLogsObject(): void {
    if (!ProtocolStepsPage.results || typeof ProtocolStepsPage.results !== 'object') ProtocolStepsPage.results = { steps: [], dsl_goal_logs: {} };
    if (!ProtocolStepsPage.results.dsl_goal_logs || typeof ProtocolStepsPage.results.dsl_goal_logs !== 'object') ProtocolStepsPage.results.dsl_goal_logs = {};
  }

  // ===== DSL Evaluation (delegated to helpers/dsl-evaluation.ts) =====

  private static getDslEvalContext(): DslEvalContext {
    return {
      getSteps: () => ProtocolStepsPage.getSteps(),
      getCurrentStep: () => ProtocolStepsPage.currentStep,
      getCurrentGoalName: () => ProtocolStepsPage.getCurrentGoalName(),
      getCurrentGoalSteps: () => ProtocolStepsPage.getCurrentGoalSteps(),
      getProtocolId: () => ProtocolStepsPage.protocolId,
      getResults: () => ProtocolStepsPage.results,
      getThresholds: () => ProtocolStepsPage.thresholds,
      getScenarioContent: () => ProtocolStepsPage.scenarioContent,
      appendLogToCurrentGoal: (line) => ProtocolStepsPage.appendLogToCurrentGoal(line),
      populateStepsWithThresholds: () => ProtocolStepsPage.populateStepsWithThresholds(),
      captureMeasuredValueForStep: (idx, persist) => ProtocolStepsPage.captureMeasuredValueForStep(idx, persist),
      next: () => ProtocolStepsPage.next(),
      rerender: () => ProtocolStepsPage.rerender(),
      parseNumericString: _parseNumericString,
      resolveValueFromFirmwareVars: _resolveValueFromFirmwareVars,
      esc: ProtocolStepsPage.esc.bind(ProtocolStepsPage),
    };
  }

  /** Set a DIALOG variable value when user clicks an option button */
  private static setDialogVariable(varName: string, varValue: string): void {
    const name = (varName || '').trim();
    if (!name) return;
    ProtocolStepsPage.dialogVariables[name] = varValue;
    // Log the selection
    ProtocolStepsPage.appendLogToCurrentGoal(`[DIALOG] ${name} = "${varValue}"`);
    // Also store in global runtime if available for IF condition checks
    const g = globalThis as any;
    if (!g.__dslRuntime) g.__dslRuntime = {};
    g.__dslRuntime[name] = varValue;
    
    // Use DSL goal runtime to evaluate conditions
    const runtime = getGoalRuntime();
    runtime.setVariable(name, varValue);
    
    // Evaluate IF/ELSE conditions and update UI
    const evalResult = runtime.evaluateConditions();
    ProtocolStepsPage.handleDslEvaluationResult(evalResult);
  }

  private static handleDslEvaluationResult(evalResult: { result: 'OK' | 'ERROR' | 'pending'; messages: string[] }): void {
    _handleDslEvalFn(ProtocolStepsPage.getDslEvalContext(), evalResult);
  }
  private static initGoalRuntime(): void { _initGoalRuntimeFn(ProtocolStepsPage.getDslEvalContext(), ProtocolStepsPage.dialogVariables); }

  private static getGoalLogs(goal: string): string[] {
    ProtocolStepsPage.ensureGoalLogsObject();
    const g = (goal || '').trim();
    const map = ProtocolStepsPage.results.dsl_goal_logs as Record<string, string[]>;
    return Array.isArray(map[g]) ? map[g] : [];
  }

  private static setGoalLogs(goal: string, lines: string[]): void {
    ProtocolStepsPage.ensureGoalLogsObject();
    const g = (goal || '').trim();
    const map = ProtocolStepsPage.results.dsl_goal_logs as Record<string, string[]>;
    map[g] = (lines || []).slice();
  }

  private static clearCurrentGoalLogs(): void {
    const goal = ProtocolStepsPage.getCurrentGoalName();
    if (!goal) return;
    ProtocolStepsPage.setGoalLogs(goal, []);
    ProtocolStepsPage.updateLogsDom();
  }

  private static copyCurrentGoalLogs(): void {
    copyLogsFn((g) => ProtocolStepsPage.getGoalLogs(g), () => ProtocolStepsPage.getCurrentGoalName());
  }

  private static copyCurrentGoalDsl(): void {
    copyDslFn(() => ProtocolStepsPage.getCurrentGoalName(), () => ProtocolStepsPage.getCurrentGoalSteps());
  }

  private static copyMeasurementsTableJson(): void { copyMeasJsonFn(); }
  private static copyMeasurementsTableHtml(): void { copyMeasHtmlFn(); }

  private static appendLogToCurrentGoal(line: string): void {
    const goal = ProtocolStepsPage.getCurrentGoalName();
    if (!goal) return;
    const list = ProtocolStepsPage.getGoalLogs(goal).slice();
    const ts = new Date().toISOString();
    list.push(`${ts} ${String(line || '')}`);
    const MAX = 500;
    const trimmed = list.length > MAX ? list.slice(list.length - MAX) : list;
    ProtocolStepsPage.setGoalLogs(goal, trimmed);
    ProtocolStepsPage.updateLogsDom();
  }

  private static updateLogsDom(): void {
    try {
      const pre = document.getElementById('ps-goal-logs') as HTMLElement | null;
      if (!pre) return;
      const goal = ProtocolStepsPage.getCurrentGoalName();
      const lines = ProtocolStepsPage.getGoalLogs(goal);
      pre.textContent = (lines || []).join('\n');
      pre.scrollTop = pre.scrollHeight;
    } catch { /* silent */ }
  }

  // ============= Firmware Value Stream (SSE) - delegated to protocol-steps.firmware.ts =============
  
  private static getFirmwareContext(): FirmwareStreamContext {
    return {
      getSteps: () => ProtocolStepsPage.getSteps(),
      getCurrentStep: () => ProtocolStepsPage.currentStep,
      getThresholds: () => ProtocolStepsPage.thresholds,
      appendLogToCurrentGoal: (line: string) => ProtocolStepsPage.appendLogToCurrentGoal(line),
      setDslVariable: (name: string, value: string) => {
        const runtime = getGoalRuntime();
        runtime.setVariable(name, value);
        // Also set in global runtime for resolveValue
        const g = globalThis as any;
        if (!g.__dslRuntime) g.__dslRuntime = {};
        g.__dslRuntime[name] = value;
      },
      getOutValVariable: () => {
        // Get the variable name from OUT VAL declaration in current goal
        const goalSteps = ProtocolStepsPage.getCurrentGoalSteps();
        for (const step of goalSteps) {
          if (step.type?.toUpperCase() === 'OUT' && step.outType?.toUpperCase() === 'VAL') {
            return step.value || null;
          }
        }
        return null;
      },
      isCurrentStepMeasurement: () => {
        try {
          const stepIdx = Math.max(0, ProtocolStepsPage.currentStep - 1);
          const steps = ProtocolStepsPage.getSteps();
          const goalName = String(steps?.[stepIdx]?.name || '').trim();
          const goalThr = goalName ? (ProtocolStepsPage.thresholds?.[goalName] || null) : null;
          const hasAnyThresholds = !!goalThr && Object.keys(goalThr).length > 0;
          const goalSteps = ProtocolStepsPage.scenarioContent?.goals?.[stepIdx]?.steps || [];
          const hasValOrGet = Array.isArray(goalSteps) && goalSteps.some((s: any) => {
            const t = String(s?.type || '').toUpperCase();
            return t === 'VAL' || t === 'GET';
          });
          const hasMinOrMax = Array.isArray(goalSteps) && goalSteps.some((s: any) => {
            const t = String(s?.type || '').toUpperCase();
            return t === 'MIN' || t === 'MAX';
          });
          const hasOutMeta = Array.isArray(goalSteps) && goalSteps.some((s: any) => {
            const t = String(s?.type || '').toUpperCase();
            const o = String(s?.outType || '').toUpperCase();
            return t === 'OUT' && (o === 'VAL' || o === 'MIN' || o === 'MAX' || o === 'UNIT');
          });
          return hasAnyThresholds || hasValOrGet || hasMinOrMax || hasOutMeta;
        } catch {
          return false;
        }
      },
    };
  }

  private static startValueStream(): void {
    const ctx = ProtocolStepsPage.getFirmwareContext();
    try {
      if (ctx.isCurrentStepMeasurement && !ctx.isCurrentStepMeasurement()) {
        fwStopValueStream();
        try {
          const vinp = document.getElementById('ps-value-input-table') as HTMLInputElement | null;
          if (vinp) vinp.value = '';
        } catch { /* silent */ }
        try {
          const hidden = document.getElementById('ps-value-input') as HTMLInputElement | null;
          if (hidden) hidden.value = '';
        } catch { /* silent */ }
        return;
      }
    } catch { /* silent */ }

    // Apply firmware simulator overrides to global runtime before starting firmware polling.
    // This allows other parts of the page to see user-set values in __dslRuntime when configured.
    try {
      const g = globalThis as any;
      if (!g.__dslRuntime) g.__dslRuntime = {};
      const goalSteps = ProtocolStepsPage.getCurrentGoalSteps();
      for (const step of (goalSteps || [])) {
        const t = String((step as any)?.type || '').toUpperCase();
        if (t !== 'GET') continue;
        const p = String((step as any)?.parameter || '').trim();
        if (!p) continue;
        try {
          if (FirmwareVarsSimService && FirmwareVarsSimService.hasVar(p)) {
            const v = FirmwareVarsSimService.getEffectiveVarAsString(p);
            if (v !== undefined) g.__dslRuntime[p] = v;
          }
        } catch { /* silent */ }
      }
    } catch { /* silent */ }

    fwStartValueStream(ctx);
  }

  private static stopValueStream(): void {
    try { fwStopValueStream(); } catch { /* silent */ }
  }

  private static markValueInputAsUserEntered(): void {
    fwMarkUserEntered();
  }
  
  private static resetValueInputUserFlag(): void {
    fwResetUserFlag();
  }

  private static getCaptureContext(): CaptureContext {
    return {
      getSteps: () => ProtocolStepsPage.getSteps(),
      thresholds: ProtocolStepsPage.thresholds,
      scenarioContent: ProtocolStepsPage.scenarioContent,
      protocolId: ProtocolStepsPage.protocolId,
      getResults: () => ProtocolStepsPage.results,
      populateStepsWithThresholds: () => ProtocolStepsPage.populateStepsWithThresholds(),
      retry: (idx, p) => { void ProtocolStepsPage.captureMeasuredValueForStep(idx, p); },
    };
  }

  private static async captureMeasuredValueForStep(stepIdx: number, persist: boolean): Promise<void> {
    return _captureFn(stepIdx, persist, ProtocolStepsPage.getCaptureContext());
  }

  private static async startLogsStreaming(): Promise<void> {
    try { ProtocolStepsPage.stopLogsStreaming(); } catch { /* silent */ }
    
    // Add initial header with scenario and goal names
    const scenarioId = String(ProtocolStepsPage.results?.scenarioId || '');
    const scenarioName = String(ProtocolStepsPage.results?.scenarioName || 'Nieznany scenariusz');
    const goalName = ProtocolStepsPage.getCurrentGoalName() || 'Brak';
    const totalGoals = ProtocolStepsPage.scenarioContent?.goals?.length || 0;
    const currentGoal = totalGoals > 0 ? Math.min(ProtocolStepsPage.currentStep, totalGoals) : ProtocolStepsPage.currentStep;
    
    ProtocolStepsPage.appendLogToCurrentGoal(`📋 Scenariusz: ${scenarioName}`);
    ProtocolStepsPage.appendLogToCurrentGoal(`🎯 GOAL ${currentGoal}/${totalGoals}: ${goalName}`);
    ProtocolStepsPage.appendLogToCurrentGoal('─'.repeat(40));
    
    await ProtocolStepsLogs.startStreaming((line: string) => {
      // Translate technical IDs to human-readable names in log lines
      let translatedLine = line;
      
      // Replace technical scenario ID with name (ts-*, tes-* patterns)
      if (scenarioId && scenarioName) {
        translatedLine = translatedLine.replace(new RegExp(scenarioId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), scenarioName);
      }
      // Also catch tes-XXXX pattern if scenarioId doesn't match
      translatedLine = translatedLine.replace(/tes-[a-f0-9]{6,}/gi, scenarioName || 'Scenariusz');
      
      // Replace goal-runtime-* patterns with actual goal name
      if (goalName && goalName !== 'Brak') {
        translatedLine = translatedLine.replace(/goal-runtime-[\w-]+/g, goalName);
      }
      
      ProtocolStepsPage.appendLogToCurrentGoal(translatedLine);
    });
  }

  private static stopLogsStreaming(): void { ProtocolStepsLogs.stopStreaming(); }

  private static setStep(n: number): void {
    navSetStep({
      getSteps: () => ProtocolStepsPage.getSteps(),
      getCurrent: () => ProtocolStepsPage.currentStep,
      setCurrent: (v: number) => { ProtocolStepsPage.currentStep = v; },
      updateUrl: () => ProtocolStepsPage.updateUrl(),
      rerender: () => ProtocolStepsPage.rerender(),
    }, n);
  }

  private static prev(): void {
    navPrev({
      getSteps: () => ProtocolStepsPage.getSteps(),
      getCurrent: () => ProtocolStepsPage.currentStep,
      setCurrent: (v: number) => { ProtocolStepsPage.currentStep = v; },
      updateUrl: () => ProtocolStepsPage.updateUrl(),
      rerender: () => ProtocolStepsPage.rerender(),
    });
  }
  private static next(): void {
    navNext({
      getSteps: () => ProtocolStepsPage.getSteps(),
      getCurrent: () => ProtocolStepsPage.currentStep,
      setCurrent: (v: number) => { ProtocolStepsPage.currentStep = v; },
      updateUrl: () => ProtocolStepsPage.updateUrl(),
      rerender: () => ProtocolStepsPage.rerender(),
    });
  }

  private static async applyActivityAction(action: 'accept'|'skip'|'repeat'): Promise<void> {
    if (ProtocolStepsPage.advancing) return;
    ProtocolStepsPage.advancing = true;
    try {
      const ctx: ActivityContext = {
        getSteps: () => ProtocolStepsPage.getSteps(),
        getCurrentStep: () => ProtocolStepsPage.currentStep,
        getProtocolId: () => ProtocolStepsPage.protocolId,
        getSessionId: () => ProtocolStepsPage.sessionId,
        getResults: () => ProtocolStepsPage.results,
        getThresholds: () => ProtocolStepsPage.thresholds,
        getScenarioContent: () => ProtocolStepsPage.scenarioContent,
        getDslParams: () => ProtocolStepsPage.dslParams,
        getDslUnits: () => ProtocolStepsPage.dslUnits,
        getProtoRow: () => ProtocolStepsPage.protoRow,
        parseNumericString: (s) => _parseNumericString(s),
        resolveValueFromFirmwareVars: (s) => _resolveValueFromFirmwareVars(s),
        populateStepsWithThresholds: () => ProtocolStepsPage.populateStepsWithThresholds(),
        captureMeasuredValueForStep: (idx, persist) => ProtocolStepsPage.captureMeasuredValueForStep(idx, persist),
        next: () => ProtocolStepsPage.next(),
        rerender: () => ProtocolStepsPage.rerender(),
        doFinalize: () => ProtocolStepsPage.doFinalize(),
        stopValueStream: () => ProtocolStepsPage.stopValueStream(),
      };
      await applyActivityActionFn(action, ctx);
    } finally {
      ProtocolStepsPage.advancing = false;
    }
  }

  private static updateUrl(): void {
    try {
      const url = new URL(globalThis.location.href);
      const pid = (ProtocolStepsPage.protocolId || '').trim();
      const sid = (ProtocolStepsPage.sessionId || '').trim();
      if (pid) url.searchParams.set('protocol', pid); else url.searchParams.delete('protocol');
      if (sid) url.searchParams.set('session', sid); else url.searchParams.delete('session');
      url.searchParams.set('step', String(ProtocolStepsPage.currentStep));
      // Use silent replaceRoute to avoid triggering routeChanged event (prevents unwanted module reloads)
      replaceRoute(url.toString(), { silent: true });
    } catch { /* silent */ }
  }

  private static rerender(): void {
    // Debounce rerenders to prevent excessive updates
    if (ProtocolStepsPage.rerenderTimeout) {
      clearTimeout(ProtocolStepsPage.rerenderTimeout);
    }
    
    ProtocolStepsPage.rerenderTimeout = setTimeout(() => {
      const root = document.getElementById('protocol-steps-root');
      if (!root) return;
      root.innerHTML = ProtocolStepsPage.renderInner();
      try { ProtocolStepsPage.fillHiddenInputsFromScenario(); } catch { /* silent */ }
      // Update logs header when goal changes
      try { ProtocolStepsPage.updateLogsForCurrentGoal(); } catch { /* silent */ }
      // Initialize DSL goal runtime with current goal steps (skip on final/summary step)
      const onFinalStepForRuntime = ProtocolStepsPage.currentStep > (ProtocolStepsPage.getSteps().length || 0);
      if (!onFinalStepForRuntime) {
        try { ProtocolStepsPage.initGoalRuntime(); } catch { /* silent */ }
      }
      // Refresh debug JSON after runtime initialization to show current state
      try { ProtocolStepsPage.refreshDebugJson(); } catch { /* silent */ }
      
      // Start firmware value stream for live sensor readings
      try { 
        ProtocolStepsPage.resetValueInputUserFlag();
        ProtocolStepsPage.startValueStream(); 
      } catch { /* silent */ }

      try { ProtocolStepsPage.startFirmwareVarsAutoRefresh(); } catch { /* silent */ }
      
      // Add input listener to detect user manual input
      try {
        const valueInput = document.getElementById('ps-value-input-table') as HTMLInputElement | null;
        if (valueInput) {
          valueInput.addEventListener('input', () => {
            ProtocolStepsPage.markValueInputAsUserEntered();
          });
          valueInput.addEventListener('focus', () => {
            ProtocolStepsPage.markValueInputAsUserEntered();
          });
        }
      } catch { /* silent */ }
      
      // Initialize pressure panel
      try {
        const pressureContainer = document.getElementById('pressure-panel-container');
        console.debug('[ProtocolStepsPage] Pressure container found?', !!pressureContainer, pressureContainer);
        if (pressureContainer) {
          const pressurePanel = new PressurePanelComponent();
          pressurePanel.render(pressureContainer);
        } else {
            console.error('[ProtocolStepsPage] Pressure container NOT FOUND');
        }
      } catch (e) { 
        console.error('[ProtocolStepsPage] Error initializing pressure panel:', e);
      }

      ProtocolStepsPage.rerenderTimeout = null;
    }, 50); // 50ms debounce
  }

  private static updateLogsForCurrentGoal(): void {
    const goalName = ProtocolStepsPage.getCurrentGoalName() || 'Brak';
    const scenarioName = String(ProtocolStepsPage.results?.scenarioName || 'Nieznany scenariusz');
    const totalGoals = ProtocolStepsPage.scenarioContent?.goals?.length || 0;
    const currentGoal = totalGoals > 0 ? Math.min(ProtocolStepsPage.currentStep, totalGoals) : ProtocolStepsPage.currentStep;
    
    // Add separator and new goal header to logs
    ProtocolStepsPage.appendLogToCurrentGoal('');
    ProtocolStepsPage.appendLogToCurrentGoal('═'.repeat(40));
    ProtocolStepsPage.appendLogToCurrentGoal(`📋 Scenariusz: ${scenarioName}`);
    ProtocolStepsPage.appendLogToCurrentGoal(`🎯 GOAL ${currentGoal}/${totalGoals}: ${goalName}`);
    ProtocolStepsPage.appendLogToCurrentGoal('─'.repeat(40));
  }
  private static async fetchProtocolById(id: string): Promise<any | null> { return fetchProtocolByIdUtil(id); }
  private static protocolPreviewHtml(row: any): string { return protocolPreviewHtmlUtil(row); }
  private static buildDocHtml(title: string, bodyHtml: string): string { return buildDocHtmlUtil(title, bodyHtml); }
  private static renderInline(inlineDiv: HTMLElement, iframe: HTMLIFrameElement, html: string): void { return renderInlineUtil(inlineDiv, iframe, html); }
  private static esc(s: string): string { return escUtil(s); }
  private static async pause(): Promise<void> {
    await SessionOps.pauseSession({ sessionId: ProtocolStepsPage.sessionId, protocolId: ProtocolStepsPage.protocolId });
  }

  private static async resume(): Promise<void> {
    await SessionOps.resumeSession({ sessionId: ProtocolStepsPage.sessionId, protocolId: ProtocolStepsPage.protocolId });
  }

  private static showGoalModal(): void {
    const steps = Array.isArray(ProtocolStepsPage.results?.steps) ? ProtocolStepsPage.results.steps : [];
    const currentIdx = Math.max(0, ProtocolStepsPage.currentStep - 1);
    const step = steps[currentIdx] || { name: 'Krok', status: 'pending' };
    const goalName = String(step.name || 'Goal');
    
    // Try to get DSL from dsl_goal_logs
    let dsl = '';
    try {
      const logs = ProtocolStepsPage.results?.dsl_goal_logs || {};
      dsl = String(logs[goalName] || logs[step.name] || '');
    } catch { /* ignore */ }
    
    GoalExecutionModal.show({
      goalName,
      goalDsl: dsl || `GOAL: ${goalName}`,
      scenarioId: String(ProtocolStepsPage.results?.scenarioId || ''),
      executionId: ProtocolStepsPage.sessionId || undefined,
      baseUrl: '',
      definitions: [],
      runtime: {}
    });
  }

  private static showCancelConfirm(): void {
    SessionOps.showCancelConfirm();
  }

  private static hideCancelConfirm(): void {
    SessionOps.hideCancelConfirm();
  }

  private static hideSaveConfirm(): void {
    SessionOps.hideSaveConfirm();
  }

  private static getFinalizeContext(): FinalizeContext {
    return {
      getProtocolId: () => ProtocolStepsPage.protocolId,
      getSessionId: () => ProtocolStepsPage.sessionId,
      getResults: () => ProtocolStepsPage.results,
      getFinalComment: () => ProtocolStepsPage.finalComment,
      setFinalComment: (v) => { ProtocolStepsPage.finalComment = v; },
      stopFirmwareVarsAutoRefresh: () => ProtocolStepsPage.stopFirmwareVarsAutoRefresh(),
      stopValueStream: () => ProtocolStepsPage.stopValueStream(),
      stopLogsStreaming: () => ProtocolStepsPage.stopLogsStreaming(),
    };
  }

  private static async doFinalize(): Promise<void> { return _doFinalizeFn(this.getFinalizeContext()); }
  private static async cancel(): Promise<void> { return _cancelFn(this.getFinalizeContext()); }
}
