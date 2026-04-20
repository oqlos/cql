// frontend/src/pages/connect-scenario-scenario-editor.page.ts
import { ModuleStyleHelper } from '../utils/style-helper';
import { quoteDslValue as q, getDslEngine, normalizeDsl, dslFromScenarioContent } from '../components/dsl';
import { renderLegacyTaskAsDslLines } from '../components/dsl/dsl-content-helpers';
import { ScenariosService } from '../modules/connect-scenario/helpers/scenarios.service';
import { runDslSandbox } from '../modules/connect-scenario/helpers/scenario-editor.sandbox';
import { getFirmware, fetchDslFunctions, fetchDefinitions, fetchRuntimeState, renderStateRows } from '../modules/connect-scenario/helpers/scenario-editor.api';
import { escapeHtml } from '../utils/html.utils';
import { fetchWithAuth } from '../utils/fetch.utils';
import { getScenarioEditorDefault, getScenarioEditorPlaceholder } from '../modules/connect-scenario/helpers/cql-editor-content';

type ScenarioEditorElements = {
  dslInput: HTMLTextAreaElement | null;
  validateBox: HTMLElement | null;
  btnRun: HTMLButtonElement | null;
  btnStop: HTMLButtonElement | null;
  cbAuto: HTMLInputElement | null;
  stepsOl: HTMLOListElement | null;
  progressFill: HTMLElement | null;
  statusEl: HTMLElement | null;
  logsPre: HTMLElement | null;
  codePre: HTMLElement | null;
  stepsSimOl: HTMLOListElement | null;
  btnLogsClear: HTMLButtonElement | null;
  btnSimJs: HTMLButtonElement | null;
  inputScenarioId: HTMLInputElement | null;
  inputGoal: HTMLInputElement | null;
  selDbScenario: HTMLSelectElement | null;
  selDbGoal: HTMLSelectElement | null;
  stateBody: HTMLTableSectionElement | null;
  btnStateRefresh: HTMLButtonElement | null;
  stateUpdated: HTMLElement | null;
};

type ScenarioEditorActionSet = {
  refreshStateFn: () => void;
  startAutoRefreshFn: () => () => void;
  validateDslFn: (text: string) => void;
  renderPreviewFn: (text: string) => void;
  renderSimulationFn: (text: string) => Promise<void>;
  runDslFn: (text: string) => Promise<void>;
};

type ScenarioLoadHandler = (id: string, goal?: string) => Promise<void>;

export class ScenarioEditorPage {

  /** Page discovery compatible render method */
  render(): string {
    return ScenarioEditorPage.getContent();
  }
  private static debounceHandle: any = null;
  private static execStream: EventSource | null = null;
  private static logsStream: EventSource | null = null;

  static getContent(): string {
    return `
      <div class="page-content scenario-editor">
        <div class="page-header d-flex items-center justify-between mb-sm">
          <h2 class="text-md">✏️</h2>
          <div class="d-flex items-center gap-sm">
            <label class="text-sm">Scenario (DB):
              <select id="se-db-scn" class="form-input" style="min-width:180px">
                <option value="">— wybierz —</option>
              </select>
            </label>
            <label class="text-sm">Goal:
              <select id="se-db-goal" class="form-input" style="min-width:180px">
                <option value="">— wybierz —</option>
              </select>
            </label>
            <label class="text-sm">Scenario ID: <input id="se-scenario-id" class="form-input" size="18" value="dsl-editor"/></label>
            <label class="text-sm">Goal: <input id="se-goal-name" class="form-input" size="24" value="Wytworzyć podciśnienie"/></label>
            <label class="text-sm"><input type="checkbox" id="se-auto-run" checked> Auto‑run</label>
            <button id="se-run" class="btn btn-primary btn-sm">▶️ </button>
            <button id="se-stop" class="btn btn-danger btn-sm">⏹️ </button>
            <button id="se-sim-js" class="btn btn-secondary btn-sm">🧪 Symuluj JS</button>
          </div>
        </div>
        <div class="se-layout">

          <div class="se-right">
            <div class="">
              <div class="mb-xs d-flex items-center justify-between">
                <span class="text-sm text-muted">Kod DSL</span>
                <span class="text-xs text-muted">Auto‑walidacja przy wpisywaniu</span>
              </div>
              <textarea id="se-dsl-input" class="mono" spellcheck="false" placeholder="${getScenarioEditorPlaceholder()}"></textarea>
              <div id="se-validate" class="se-validate mt-xs"></div>
            </div>
            <div class="se-panel mb-sm">
              <div class="panel-header d-flex items-center justify-between">
                <h5 class="text-sm m-0">🧾 Podgląd DSL</h5>
              </div>
              <div class="panel-body"><pre id="se-code-pre" class="mono"></pre></div>
            </div>
            <div id="se-validate" class="se-validate mt-xs"></div>
            <div class="se-panel mb-sm">
              <div class="panel-header d-flex items-center justify-between">
                <h5 class="text-sm m-0">▶️ Wykonanie</h5>
                <div class="text-xs text-muted">Status: <span id="se-status">idle</span></div>
              </div>
              <div class="panel-body">
                <div class="progress-bar"><div id="se-progress" class="progress-fill" style="width:0%"></div></div>
                <div class="text-xs text-muted mb-xxs" style="font-weight:600;">Kroki:</div>
                <ol id="se-steps" class="text-xs"></ol>
                <div class="text-xs text-muted mt-xxs" style="font-weight:600;">Symulacja:</div>
                <ol id="se-steps-sim" class="text-xs se-sim"></ol>
              </div>
            </div>
            <div class="se-panel">
              <div class="panel-header d-flex items-center justify-between">
                <h5 class="text-sm m-0">🖥️ Logi</h5>
                <button id="se-logs-clear" class="btn btn-secondary btn-xs">Wyczyść</button>
              </div>
              <div class="panel-body logs-wrap"><pre id="se-logs" class="mono"></pre></div>
            </div>
            <div class="se-panel mt-sm">
              <div class="panel-header d-flex items-center justify-between">
                <h5 class="text-sm m-0">🧩 Stan elementów</h5>
                <div class="d-flex items-center gap-xs">
                  <button id="se-state-refresh" class="btn btn-secondary btn-xs">Odśwież</button>
                  <span id="se-state-updated" class="text-xs text-muted"></span>
                </div>
              </div>
              <div class="panel-body">
                <div class="overflow-auto" style="max-height:220px">
                  <table class="text-xs" style="width:100%;border-collapse:collapse;">
                    <thead>
                      <tr style="background:var(--bg-muted);">
                        <th style="text-align:left;padding:6px;border-bottom:1px solid var(--panel-border);font-weight:600;">Typ</th>
                        <th style="text-align:left;padding:6px;border-bottom:1px solid var(--panel-border);font-weight:600;">Nazwa</th>
                        <th style="text-align:left;padding:6px;border-bottom:1px solid var(--panel-border);font-weight:600;">Wartość</th>
                        <th style="text-align:left;padding:6px;border-bottom:1px solid var(--panel-border);font-weight:600;">Jedn.</th>
                      </tr>
                    </thead>
                    <tbody id="se-state-body"></tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  static getStyles(): string {
    return `
      .scenario-editor { height: 100%; }
      .se-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; height: calc(100vh - 130px); }
      .se-left, .se-right { min-height: 0; display: flex; flex-direction: column; }
      #se-dsl-input { flex: 1; width: 100%; resize: none; border: 1px solid var(--panel-border); background: var(--panel-bg); color: var(--text); padding: 8px; border-radius: 6px; }
      .se-validate { min-height: 40px; border-left: 3px solid transparent; padding-left: 8px; }
      .se-validate.ok { border-color: var(--success); color: var(--success); }
      .se-validate.err { border-color: var(--danger); color: var(--danger); }
      .se-panel { border: 1px solid var(--panel-border); border-radius: 6px; background: var(--panel-bg); color: var(--on-panel); overflow: hidden; display: flex; flex-direction: column; min-height: 0; }
      .panel-header { padding: 8px 12px; border-bottom: 1px solid var(--panel-border); background: var(--bg-muted); }
      .panel-body { padding: 10px; min-height: 0; overflow: auto; }
      .progress-bar { height: 8px; background: var(--bg-muted); border-radius: 4px; overflow: hidden; margin-bottom: 8px; }
      .progress-fill { height: 100%; background: var(--success); transition: width .3s; }
      #se-steps { margin: 4px 0 0 18px; padding: 0; }
      .logs-wrap { height: 240px; }
      #se-logs { margin: 0; padding: 8px; background: #111; color: #eee; height: 100%; overflow: auto; }
      #se-state-body td { padding: 6px; border-bottom: 1px solid #eee; }

      body.fixed-1280 .page-content.scenario-editor {
        display: flex;
        flex-direction: column;
        min-height: 0;
        overflow: hidden;
      }
      body.fixed-1280 .page-content.scenario-editor .se-layout {
        flex: 1 1 auto;
        min-height: 0;
        height: 100%;
      }
      body.fixed-1280 .page-content.scenario-editor .se-left,
      body.fixed-1280 .page-content.scenario-editor .se-right {
        min-height: 0;
        overflow: auto;
      }
      /* DSL syntax highlighting - using shared component styles inline */
      .dsl-kw { color: #d73a49; font-weight: 700; }
      .dsl-goal { color: #6f42c1; font-weight: 600; }
      .dsl-task { color: #005cc5; font-weight: 600; }
      .dsl-num { color: #005cc5; }
      .dsl-arrow { color: #6a737d; }
      .dsl-fn { color: #22863a; font-weight: 600; }
      .dsl-br { color: #032f62; }
      .dsl-op { color: #e36209; font-weight: 700; }
      .dsl-string { color: #0b69a3; }
      .dsl-type { color: #b31d28; font-weight: 700; }
      .dsl-comment { color: #6a737d; font-style: italic; }
      .preview-code { font-family: 'Courier New', monospace; line-height: 1.6; color: var(--text); white-space: pre-wrap; margin: 0; }
      .se-sim li.pass { color: var(--success); }
      .se-sim li.fail { color: var(--danger); }
      .se-sim .badge { margin-left: 6px; font-weight: 700; }
      @media (max-width: 1100px) { .se-layout { grid-template-columns: 1fr; } }
    `;
  }

  // ==================== REFACTORED PRIVATE METHODS ====================

  private static getElements(el: HTMLElement): ScenarioEditorElements {
    return {
      dslInput: el.querySelector('#se-dsl-input') as HTMLTextAreaElement | null,
      validateBox: el.querySelector('#se-validate') as HTMLElement | null,
      btnRun: el.querySelector('#se-run') as HTMLButtonElement | null,
      btnStop: el.querySelector('#se-stop') as HTMLButtonElement | null,
      cbAuto: el.querySelector('#se-auto-run') as HTMLInputElement | null,
      stepsOl: el.querySelector('#se-steps') as HTMLOListElement | null,
      progressFill: el.querySelector('#se-progress') as HTMLElement | null,
      statusEl: el.querySelector('#se-status') as HTMLElement | null,
      logsPre: el.querySelector('#se-logs') as HTMLElement | null,
      codePre: el.querySelector('#se-code-pre') as HTMLElement | null,
      stepsSimOl: el.querySelector('#se-steps-sim') as HTMLOListElement | null,
      btnLogsClear: el.querySelector('#se-logs-clear') as HTMLButtonElement | null,
      btnSimJs: el.querySelector('#se-sim-js') as HTMLButtonElement | null,
      inputScenarioId: el.querySelector('#se-scenario-id') as HTMLInputElement | null,
      inputGoal: el.querySelector('#se-goal-name') as HTMLInputElement | null,
      selDbScenario: el.querySelector('#se-db-scn') as HTMLSelectElement | null,
      selDbGoal: el.querySelector('#se-db-goal') as HTMLSelectElement | null,
      stateBody: el.querySelector('#se-state-body') as HTMLTableSectionElement | null,
      btnStateRefresh: el.querySelector('#se-state-refresh') as HTMLButtonElement | null,
      stateUpdated: el.querySelector('#se-state-updated') as HTMLElement | null,
    };
  }

  private static createPrintln(logsPre: HTMLElement | null) {
    return (msg: string) => {
      if (!logsPre) return;
      logsPre.textContent += (msg + '\n');
      logsPre.scrollTop = logsPre.scrollHeight;
    };
  }

  private static writeUrlParams(scenario?: string, goal?: string) {
    try {
      const url = new URL(globalThis.location.href);
      if (scenario?.trim()) url.searchParams.set('scenario', scenario.trim());
      else url.searchParams.delete('scenario');
      if (goal?.trim()) url.searchParams.set('goal', goal.trim());
      else url.searchParams.delete('goal');
      history.replaceState({}, '', url.toString());
    } catch { /* Non-blocking */ }
  }

  private static scenarioContentToDsl(row: { id: string; title: string; content?: any }, goalName?: string): string {
    const title = (row?.title || row?.id || 'scenario').toString();
    const content = (row && typeof row.content === 'object') ? row.content : null;
    const base = dslFromScenarioContent(content, title);
    if (!goalName) return base;
    try {
      const dsl = getDslEngine();
      const res = dsl.parse(normalizeDsl(base, title));
      if (res.ok) {
        const g = res.ast.goals.find((x: any) => (x?.name || '').trim() === goalName.trim());
        if (g) {
          const parts: string[] = [`SCENARIO: ${title}`, `GOAL: ${g.name}`];
          if (Array.isArray((g as any).steps)) {
            for (const s of (g as any).steps as any[]) {
              if (s?.type === 'task') {
                parts.push(...renderLegacyTaskAsDslLines(s, '  '));
              } else if (s?.type === 'if') {
                const unit = (s?.unit || '').trim();
                const val = String(s?.value ?? '').trim();
                parts.push(`  IF ${q(s.parameter)} ${s.operator} ${q(`${val}${unit ? ` ${unit}` : ''}`)}`);
              } else if (s?.type === 'else') {
                parts.push(`  ELSE ${s.actionType} ${q(s.actionMessage || '')}`);
              }
            }
          }
          return parts.join('\n');
        }
      }
    } catch { /* Fallback to full DSL */ }
    return base;
  }

  private static fillGoalSelect(selDbGoal: HTMLSelectElement | null, row: { id: string; title: string; content?: any }) {
    if (!selDbGoal) return;
    const content = (row && typeof row.content === 'object') ? row.content : null;
    try {
      const title = (row?.title || row?.id || 'scenario').toString();
      const dslStr = dslFromScenarioContent(content, title);
      const dsl = getDslEngine();
      const res = dsl.parse(normalizeDsl(dslStr, title));
      const goals = res.ok ? res.ast.goals : [];
      const opts = goals.map((g: any) => `<option value="${escapeHtml(String(g?.name || ''))}">${escapeHtml(String(g?.name || ''))}</option>`).join('');
      selDbGoal.innerHTML = `<option value="">— wybierz —</option>${opts}`;
    } catch {
      const goals = (content && Array.isArray(content.goals)) ? content.goals : [];
      const opts = goals.map((g: any) => `<option value="${escapeHtml(String(g?.name || ''))}">${escapeHtml(String(g?.name || ''))}</option>`).join('');
      selDbGoal.innerHTML = `<option value="">— wybierz —</option>${opts}`;
    }
  }

  private static closeStreams() {
    try { this.execStream?.close(); } catch { /* Stale stream */ }
    try { this.logsStream?.close(); } catch { /* Stale stream */ }
    this.execStream = null;
    this.logsStream = null;
  }

  private static refreshState(stateBody: HTMLTableSectionElement | null, stateUpdated: HTMLElement | null, dslInput: HTMLTextAreaElement | null, _println: (msg: string) => void, stepsSimOl: HTMLOListElement | null): void {
    void (async () => {
      try {
        const [defs, runtime] = await Promise.all([fetchDefinitions(), fetchRuntimeState()]);
        if (stateBody) stateBody.innerHTML = renderStateRows(defs, runtime);
        if (stateUpdated) stateUpdated.textContent = new Date().toLocaleTimeString();
        if (dslInput) { void this.renderSimulation(dslInput.value || '', stepsSimOl); }
      } catch {
        if (stateBody) stateBody.innerHTML = '<tr><td colspan="4"><em>Brak danych</em></td></tr>';
      }
    })();
  }

  private static startAutoRefresh(dslInput: HTMLTextAreaElement | null, stateBody: HTMLTableSectionElement | null, stateUpdated: HTMLElement | null, println: (msg: string) => void, stepsSimOl: HTMLOListElement | null): () => void {
    let autoTimer: any = null;
    let refreshBackoffMs = 2500;
    let refreshFailures = 0;
    const REFRESH_MIN_MS = 2500;
    const REFRESH_MAX_MS = 20000;

    const stop = () => {
      if (autoTimer) {
        try { clearTimeout(autoTimer); } catch { /* Non-blocking */ }
        autoTimer = null;
      }
    };

    const schedule = () => {
      autoTimer = setTimeout(async () => {
        let ok = false;
        try {
          const FirmwareCQRS = await getFirmware();
          const base = String(FirmwareCQRS.baseUrl || '').trim();
          if (base) {
            this.refreshState(stateBody, stateUpdated, dslInput, println, stepsSimOl);
            ok = true;
          }
        } catch { ok = false; }
        if (ok) { refreshFailures = 0; refreshBackoffMs = REFRESH_MIN_MS; }
        else { refreshFailures++; refreshBackoffMs = Math.min(Math.floor(refreshBackoffMs * 1.7) + 50, REFRESH_MAX_MS); }
        schedule();
      }, refreshBackoffMs);
    };

    refreshBackoffMs = REFRESH_MIN_MS;
    schedule();
    return stop;
  }

  private static validateDsl(text: string, validateBox: HTMLElement | null, stepsOl: HTMLOListElement | null): void {
    try {
      const dsl = getDslEngine();
      const res = dsl.parse(text);
      if (res.ok) {
        if (validateBox) validateBox.className = 'se-validate ok';
        if (validateBox) validateBox.innerHTML = `<div class="text-success">✅ DSL poprawny. GOALS: ${res.ast.goals.length}</div>`;
      } else {
        if (validateBox) validateBox.className = 'se-validate err';
        if (validateBox) validateBox.innerHTML = `<div class="text-danger">❌ Błędy:</div><ul class="text-xs">${res.errors.map((e: string) => `<li>${escapeHtml(e)}</li>`).join('')}</ul>`;
      }
      if (stepsOl) {
        const lines: string[] = [];
        if (res.ok) {
          for (const g of res.ast.goals) {
            lines.push(`GOAL: ${g.name}`);
            const hasSteps = Array.isArray((g as any).steps) && (g as any).steps.length;
            if (hasSteps) {
              for (const s of (g as any).steps as any[]) {
                if (s?.type === 'task') {
                  lines.push(...renderLegacyTaskAsDslLines(s, '  '));
                } else if (s?.type === 'if') {
                  lines.push(`  IF ${q(s.parameter)} ${s.operator} ${q(s.value)}`);
                } else if (s?.type === 'else') {
                  lines.push(`  ELSE ${s.actionType} ${q(s.actionMessage || '')}`);
                }
              }
            } else {
              for (const t of (g.tasks || [])) {
                lines.push(...renderLegacyTaskAsDslLines(t, '  '));
              }
              for (const c of (g.conditions || [])) {
                if (c.type === 'if') lines.push(`  IF ${q(c.parameter)} ${c.operator} ${q(c.value)}`);
                else if (c.type === 'else') lines.push(`  ELSE ${c.actionType} ${q(c.actionMessage || '')}`);
              }
            }
            const fallbackAction = g.tasks.map((t: any) => String(t?.content || '')).join(' ').trim();
            if (fallbackAction) lines.push(`  SET ${q(fallbackAction)} ${q('1')}`);
          }
        }
        const dsl = getDslEngine();
        stepsOl.innerHTML = lines.map((l) => `<li>${dsl.highlight(l)}</li>`).join('');
      }
    } catch (e: any) {
      if (validateBox) { validateBox.className = 'se-validate err'; validateBox.textContent = `❌ Błąd walidacji: ${String(e)}`; }
    }
  }

  private static renderPreview(text: string, codePre: HTMLElement | null): void {
    try {
      if (codePre) {
        const dsl = getDslEngine();
        codePre.innerHTML = dsl.highlight(text);
      }
    } catch { /* Non-blocking */ }
  }

  private static async renderSimulation(text: string, stepsSimOl: HTMLOListElement | null): Promise<void> {
    try {
      const runtime = await fetchRuntimeState();
      const dsl = getDslEngine();
      const res = dsl.execute(text, { getParamValue: (name: string) => runtime[name] });
      if (!stepsSimOl) return;
      const html = res.plan.map((p: any) => {
        if (p.kind === 'goal') {
          return `<li class="sim-goal">${escapeHtml('GOAL: ' + String(p.name || ''))}</li>`;
        }
        if (p.kind === 'condition') {
          const c = p.condition;
          const line = `IF ${q(c.parameter)} ${c.operator} ${q(c.value)}`;
          const dslEngine = getDslEngine();
          const hl = dslEngine.highlight(line);
          const cls = p.passed ? 'pass' : 'fail';
          const badge = `<span class="badge ${cls}">${p.passed ? 'PASS' : 'FAIL'}</span>`;
          return `<li class="${cls}">${hl} ${badge}</li>`;
        }
        if (p.kind === 'task') {
          const t = p.task as any;
          const line = renderLegacyTaskAsDslLines(t, '  ').join('\n');
          const dslEngine = getDslEngine();
          return `<li>${dslEngine.highlight(line)}</li>`;
        }
        if (p.kind === 'else') {
          const e = p.else;
          const line = `ELSE ${e.actionType} ${q(e.actionMessage || '')}`;
          const dslEngine = getDslEngine();
          return `<li>${dslEngine.highlight(line)}</li>`;
        }
        return '';
      }).join('');
      stepsSimOl.innerHTML = html;
    } catch { /* Non-blocking */ }
  }

  private static async runDsl(text: string, inputScenarioId: HTMLInputElement | null, inputGoal: HTMLInputElement | null, println: (msg: string) => void, statusEl: HTMLElement | null, progressFill: HTMLElement | null, stepsOl: HTMLOListElement | null): Promise<void> {
    const scenarioId = (inputScenarioId?.value || 'dsl-editor').trim();
    const goalName = (inputGoal?.value || 'GOAL').trim();
    try {
      const FirmwareCQRS = await getFirmware();
      await FirmwareCQRS.stop();
    } catch { /* Non-blocking */ }
    try {
      const FirmwareCQRS = await getFirmware();
      println(`▶️ Start: scenariusz=${scenarioId} goal="${goalName}"`);
      println(`ℹ️ fw baseUrl: ${FirmwareCQRS.baseUrl}`);
    } catch { /* Non-blocking */ }
    try {
      const FirmwareCQRS = await getFirmware();
      const res = await FirmwareCQRS.startExecution({
        scenarioId,
        goals: [goalName],
        mode: 'auto',
        speed: 1.0,
        content: { dsl: text, goals: [goalName] }
      });
      try { println(`ℹ️ startExecution: HTTP ${res?.status}`); } catch { /* Non-blocking */ }
      let execId = '';
      try {
        const copy = res?.clone?.();
        const js = copy ? await copy.json().catch(() => null) : null;
        execId = String(js?.executionId || js?.id || js?.execution_id || js?.execId || '');
      } catch { /* Non-blocking */ }
      void this.connectStreams(scenarioId, execId, println, statusEl, progressFill, stepsOl);
    } catch (e: any) {
      println(`❌ StartExecution error: ${String(e)}`);
    }
  }

  private static async connectStreams(scenarioId?: string, executionId?: string, println?: (msg: string) => void, statusEl?: HTMLElement | null, progressFill?: HTMLElement | null, stepsOl?: HTMLOListElement | null): Promise<void> {
    this.closeStreams();
    try {
      const FirmwareCQRS = await getFirmware();
      const es = FirmwareCQRS.getEventStream(scenarioId, executionId);
      this.execStream = es;
      if (es && println) {
        try {
          const url = new URL(`${FirmwareCQRS.baseUrl}/api/v1/execution/stream`);
          if (scenarioId) url.searchParams.set('scenario', scenarioId);
          if (executionId) { url.searchParams.set('executionId', executionId); url.searchParams.set('id', executionId); }
          println(`ℹ️ events-sse: ${url.toString()}`);
        } catch { /* Non-blocking */ }
        es.onmessage = (ev: MessageEvent) => {
          try {
            const js = JSON.parse(ev.data || '{}');
            if (js?.type === 'projection_update') {
              const data = js.data || {};
              if (statusEl) statusEl.textContent = String(data.status || 'idle');
              const rawProg = Number(data.progress ?? 0);
              const prog = rawProg <= 1 ? rawProg * 100 : rawProg;
              if (progressFill) progressFill.style.width = `${Math.max(0, Math.min(100, prog))}%`;
              const steps = Array.isArray(data.steps) ? data.steps : [];
              if (stepsOl) {
                const hasExisting = stepsOl.children && stepsOl.children.length > 0;
                const curIdx = (data.currentIndex ?? -1) as number;
                if (hasExisting) {
                  Array.from(stepsOl.querySelectorAll('li')).forEach((li, idx) => {
                    li.classList.toggle('step-current', idx === curIdx);
                    if (idx < curIdx) li.classList.add('step-done');
                  });
                } else {
                  stepsOl.innerHTML = steps.map((s: any, idx: number) => {
                    const label = typeof s === 'string' ? s : (s?.label || `${s?.action || ''}${s?.peripheral ? ` [${s.peripheral}]` : ''}`);
                    const cls = (idx === curIdx) ? 'step-current' : (idx < curIdx ? 'step-done' : '');
                    return `<li class="${cls}" data-step-idx="${idx}">${escapeHtml(label)}</li>`;
                  }).join('');
                }
              }
            } else if (js?.type === 'connection') {
              if (statusEl) statusEl.textContent = 'connected';
            }
          } catch { /* Non-blocking */ }
        };
      }
    } catch { /* Non-blocking */ }
    // Logs stream setup
    try {
      const FirmwareCQRS = await getFirmware();
      const url = new URL(`${FirmwareCQRS.baseUrl}/api/v1/execution/logs/stream`);
      if (scenarioId) url.searchParams.set('scenario', scenarioId);
      if (executionId) { url.searchParams.set('executionId', executionId); url.searchParams.set('id', executionId); }
      if (println) println(`ℹ️ logs-sse: ${url.toString()}`);
      const ls: EventSource = new EventSource(url.toString());
      this.logsStream = ls;
      ls.onmessage = (ev: MessageEvent) => {
        try {
          if (typeof ev.data === 'string' && println) {
            try {
              const js = JSON.parse(ev.data);
              if (js && js.message) { println(js.message); return; }
            } catch { /* Non-blocking */ }
            println(String(ev.data));
          }
        } catch { /* Non-blocking */ }
      };
      ls.onerror = () => {
        try { ls.close(); } catch { /* Non-blocking */ }
        this.logsStream = null;
        if (println) println('ℹ️ logs-sse closed; switching to polling');
        this.startPolling(scenarioId, executionId, println);
      };
    } catch { /* Non-blocking */ }
  }

  private static buildPollingUrl(baseUrl: string, path: string, executionId?: string): string {
    return `${baseUrl}${path}${executionId ? `?executionId=${encodeURIComponent(executionId)}` : ''}`;
  }

  private static async pollExecutionLogs(
    logsUrl: string,
    last: number,
    logsFailCount: number,
    logsDisabledUntil: number,
    println?: (msg: string) => void,
  ): Promise<{ gotAnyOk: boolean; last: number; logsFailCount: number; logsDisabledUntil: number }> {
    const now = Date.now();
    if (now < logsDisabledUntil) {
      return { gotAnyOk: false, last, logsFailCount, logsDisabledUntil };
    }

    try {
      const resp = await fetchWithAuth(logsUrl, { credentials: 'same-origin' });
      if (resp.ok) {
        const js = await resp.json().catch(() => ({} as any));
        const logs = Array.isArray((js as any)?.logs) ? (js as any).logs : [];
        if (logs.length && println) {
          for (let i = last; i < logs.length; i++) println(String(logs[i]));
          last = logs.length;
        }
        return { gotAnyOk: true, last, logsFailCount: 0, logsDisabledUntil };
      }
      if (resp.status === 404) {
        const nextFailCount = logsFailCount + 1;
        if (nextFailCount >= 3) {
          if (println) println('ℹ️ logs endpoint unavailable (404). Re-trying in ~60s, continuing with status polling.');
          return { gotAnyOk: false, last, logsFailCount: 0, logsDisabledUntil: now + 60000 };
        }
        return { gotAnyOk: false, last, logsFailCount: nextFailCount, logsDisabledUntil };
      }
      return { gotAnyOk: false, last, logsFailCount, logsDisabledUntil };
    } catch {
      return { gotAnyOk: false, last, logsFailCount: Math.min(logsFailCount + 1, 3), logsDisabledUntil };
    }
  }

  private static async pollExecutionStatus(statusUrl: string): Promise<boolean> {
    try {
      const resp = await fetchWithAuth(statusUrl, { credentials: 'same-origin' });
      return resp.ok;
    } catch {
      return false;
    }
  }

  private static nextPollingBackoff(currentBackoffMs: number, gotAnyOk: boolean): number {
    if (gotAnyOk) return 1000;
    return Math.min(Math.floor(currentBackoffMs * 1.8) + 50, 10000);
  }

  private static async startPolling(_scenarioId?: string, executionId?: string, println?: (msg: string) => void): Promise<void> {
    const FirmwareCQRS = await getFirmware();
    let last = 0;
    let announced = false;
    let logsFailCount = 0;
    let logsBackoffMs = 1000;
    let logsDisabledUntil = 0;
    const poll = async () => {
      try {
        const logsUrl = this.buildPollingUrl(FirmwareCQRS.baseUrl, '/api/v1/execution/logs', executionId);
        const statusUrl = this.buildPollingUrl(FirmwareCQRS.baseUrl, '/api/v1/execution/status', executionId);
        if (!announced && println) { println(`ℹ️ logs-poll: ${logsUrl} | ${statusUrl}`); announced = true; }
        const logsResult = await this.pollExecutionLogs(logsUrl, last, logsFailCount, logsDisabledUntil, println);
        last = logsResult.last;
        logsFailCount = logsResult.logsFailCount;
        logsDisabledUntil = logsResult.logsDisabledUntil;
        const statusOk = await this.pollExecutionStatus(statusUrl);
        const gotAnyOk = logsResult.gotAnyOk || statusOk;
        logsBackoffMs = this.nextPollingBackoff(logsBackoffMs, gotAnyOk);
      } catch { /* Non-blocking */ }
    };
    const schedule = () => { setTimeout(async () => { await poll(); schedule(); }, logsBackoffMs); };
    await poll();
    schedule();
  }

  private static createActionSet(elements: ScenarioEditorElements, println: (msg: string) => void): ScenarioEditorActionSet {
    return {
      refreshStateFn: () => this.refreshState(elements.stateBody, elements.stateUpdated, elements.dslInput, println, elements.stepsSimOl),
      startAutoRefreshFn: () => this.startAutoRefresh(elements.dslInput, elements.stateBody, elements.stateUpdated, println, elements.stepsSimOl),
      validateDslFn: (text: string) => this.validateDsl(text, elements.validateBox, elements.stepsOl),
      renderPreviewFn: (text: string) => this.renderPreview(text, elements.codePre),
      renderSimulationFn: (text: string) => this.renderSimulation(text, elements.stepsSimOl),
      runDslFn: (text: string) => this.runDsl(text, elements.inputScenarioId, elements.inputGoal, println, elements.statusEl, elements.progressFill, elements.stepsOl),
    };
  }

  private static inferTargetGoal(row: { id: string; title: string; content?: any }, goal?: string): string {
    let targetGoal = (goal && goal.trim()) || '';
    if (targetGoal) return targetGoal;

    try {
      const content = (row && typeof row.content === 'object') ? row.content : null;
      const title = String((row as any)?.title || (row as any)?.id || 'scenario');
      const raw = String((content as any)?.dsl || '').trim();
      if (raw) {
        const dslStr = /^\s*SCENARIO\s*:/i.test(raw) ? raw : `SCENARIO: ${title}\n${raw}`;
        const dsl = getDslEngine();
        const res = dsl.parse(dslStr);
        if (res.ok && Array.isArray(res.ast.goals) && res.ast.goals.length) {
          targetGoal = String(res.ast.goals[0]?.name || '');
        }
      } else if (content && Array.isArray(content.goals) && content.goals.length) {
        targetGoal = String(content.goals[0]?.name || '');
      }
    } catch {
      // Non-blocking: keep default goal selection when auto-detection fails.
    }

    return targetGoal;
  }

  private static applyLoadedScenarioToEditor(
    row: { id: string; title: string; content?: any },
    targetGoal: string,
    elements: ScenarioEditorElements,
    actions: ScenarioEditorActionSet,
  ): void {
    if (elements.selDbGoal) elements.selDbGoal.value = targetGoal || '';

    const dsl = this.scenarioContentToDsl(row as any, targetGoal || undefined);
    if (elements.dslInput) {
      elements.dslInput.value = dsl;
      actions.validateDslFn(dsl);
      actions.renderPreviewFn(dsl);
      void actions.renderSimulationFn(dsl);
      if (elements.cbAuto?.checked) {
        void actions.runDslFn(dsl);
      }
    }

    if (elements.inputScenarioId) elements.inputScenarioId.value = String((row as any).id || '');
    if (elements.inputGoal && targetGoal) elements.inputGoal.value = targetGoal;
  }

  private static createScenarioLoader(elements: ScenarioEditorElements, actions: ScenarioEditorActionSet): ScenarioLoadHandler {
    return async (id: string, goal?: string) => {
      if (!id) return;
      const row = await ScenariosService.fetchScenarioById(id).catch(() => null);
      if (!row) return;

      this.fillGoalSelect(elements.selDbGoal, row as any);
      const targetGoal = this.inferTargetGoal(row as any, goal);
      this.applyLoadedScenarioToEditor(row as any, targetGoal, elements, actions);
    };
  }

  private static async populateScenarioList(
    selDbScenario: HTMLSelectElement | null,
    selDbGoal: HTMLSelectElement | null,
    loadScenarioByIdToEditor: ScenarioLoadHandler,
  ): Promise<void> {
    if (!selDbScenario) return;

    let list: Array<{ id: string; name: string }>;
    try { list = await ScenariosService.listScenarios(''); }
    catch { list = []; }

    selDbScenario.innerHTML = `<option value="">— wybierz —</option>` + list.map(s => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name)}</option>`).join('');

    try {
      const url = new URL(globalThis.location.href);
      const sid = (url.searchParams.get('scenario') || '').trim();
      const gname = (url.searchParams.get('goal') || '').replace(/\+/g, ' ').trim();
      if (sid) {
        selDbScenario.value = sid;
        await loadScenarioByIdToEditor(sid, gname || undefined);
        if (gname && selDbGoal) selDbGoal.value = gname;
        return;
      }
    } catch {
      // Non-blocking: URL preselect failure should not block initial scenario load.
    }

    if (!selDbScenario.value && list.length) {
      const first = list[0];
      selDbScenario.value = first.id;
      this.writeUrlParams(first.id, '');
      await loadScenarioByIdToEditor(first.id);
      const autoGoal = selDbGoal?.value || '';
      if (autoGoal) this.writeUrlParams(first.id, autoGoal);
    }
  }

  private static createInputChangeHandler(elements: ScenarioEditorElements, actions: ScenarioEditorActionSet): () => void {
    return () => {
      if (!elements.dslInput) return;
      const text = elements.dslInput.value || '';
      actions.validateDslFn(text);
      actions.renderPreviewFn(text);
      void actions.renderSimulationFn(text);
      if (elements.cbAuto?.checked) {
        clearTimeout(this.debounceHandle);
        this.debounceHandle = setTimeout(() => actions.runDslFn(text), 550);
      }
    };
  }

  private static bindEditorInput(elements: ScenarioEditorElements, actions: ScenarioEditorActionSet, onInputChanged: () => void): void {
    if (!elements.dslInput) return;

    elements.dslInput.addEventListener('input', onInputChanged);
    if (!elements.dslInput.value.trim()) {
      elements.dslInput.value = getScenarioEditorDefault();
    }

    actions.validateDslFn(elements.dslInput.value);
    actions.renderPreviewFn(elements.dslInput.value);
    void actions.renderSimulationFn(elements.dslInput.value);
  }

  private static bindRuntimeButtons(
    elements: ScenarioEditorElements,
    actions: ScenarioEditorActionSet,
    println: (msg: string) => void,
  ): void {
    const sandboxDeps = { fetchDslFunctions, fetchRuntimeState, println };

    if (elements.btnRun) {
      elements.btnRun.addEventListener('click', () => {
        if (elements.dslInput) void actions.runDslFn(elements.dslInput.value || '');
      });
    }

    if (elements.btnStop) {
      elements.btnStop.addEventListener('click', async () => {
        try {
          const FirmwareCQRS = await getFirmware();
          await FirmwareCQRS.stop();
          println('⏹️ Stop');
        } catch {
          // Non-blocking: stop action failure should not break editor interactions.
        }
      });
    }

    if (elements.btnLogsClear) {
      elements.btnLogsClear.addEventListener('click', () => {
        if (elements.logsPre) elements.logsPre.textContent = '';
      });
    }

    if (elements.btnSimJs) {
      elements.btnSimJs.addEventListener('click', () => {
        if (elements.dslInput) void runDslSandbox(elements.dslInput.value || '', sandboxDeps);
      });
    }

    if (elements.btnStateRefresh) {
      elements.btnStateRefresh.addEventListener('click', () => {
        void actions.refreshStateFn();
      });
    }
  }

  private static bindScenarioSelectors(
    selDbScenario: HTMLSelectElement | null,
    selDbGoal: HTMLSelectElement | null,
    loadScenarioByIdToEditor: ScenarioLoadHandler,
  ): void {
    if (selDbScenario) {
      selDbScenario.addEventListener('change', async () => {
        const id = selDbScenario.value || '';
        if (!id) {
          this.writeUrlParams('', '');
          return;
        }
        if (selDbGoal) selDbGoal.value = '';
        this.writeUrlParams(id, '');
        await loadScenarioByIdToEditor(id);
      });
    }

    if (selDbGoal) {
      selDbGoal.addEventListener('change', async () => {
        const id = selDbScenario?.value || '';
        const goal = (selDbGoal.value || '').trim();
        if (!id) return;
        if (goal) {
          this.writeUrlParams(id, goal);
          await loadScenarioByIdToEditor(id, goal);
        } else {
          this.writeUrlParams(id, '');
          await loadScenarioByIdToEditor(id);
        }
      });
    }
  }

  private static bindPopstateSync(
    selDbScenario: HTMLSelectElement | null,
    selDbGoal: HTMLSelectElement | null,
    loadScenarioByIdToEditor: ScenarioLoadHandler,
  ): void {
    try {
      window.addEventListener('popstate', async () => {
        try {
          const url = new URL(globalThis.location.href);
          const sid = (url.searchParams.get('scenario') || '').trim();
          const gname = (url.searchParams.get('goal') || '').replace(/\+/g, ' ').trim();
          if (selDbScenario) selDbScenario.value = sid;
          if (sid) {
            await loadScenarioByIdToEditor(sid, gname || undefined);
            if (selDbGoal) selDbGoal.value = gname;
          }
        } catch {
          // Non-blocking: ignore malformed URL state during popstate sync.
        }
      });
    } catch {
      // Non-blocking: missing popstate hook should not prevent normal editor usage.
    }
  }

  // ==================== MAIN ATTACH METHOD ====================

  static attachEventListeners(root?: HTMLElement): void {
    const container = root || document.getElementById('connect-manager-content') || document.getElementById('connect-test-content') || document.querySelector('.module-main-content');
    if (!container) return;

    const el = container as HTMLElement;
    const bindScope = (el.querySelector('.scenario-editor') as HTMLElement) || el;
    if (bindScope.getAttribute('data-se-bound') === '1') return;
    bindScope.setAttribute('data-se-bound', '1');

    try {
      ModuleStyleHelper.forPage('scenario-editor', 'connect-manager', this.getStyles());
    } catch {
      // Non-blocking: page logic should continue even if scoped style injection fails.
    }

    const elements = this.getElements(el);
    const println = this.createPrintln(elements.logsPre);
    const actions = this.createActionSet(elements, println);
    const loadScenarioByIdToEditor = this.createScenarioLoader(elements, actions);
    const onInputChanged = this.createInputChangeHandler(elements, actions);

    this.bindEditorInput(elements, actions, onInputChanged);
    this.bindRuntimeButtons(elements, actions, println);

    void actions.refreshStateFn();
    actions.startAutoRefreshFn();

    void this.populateScenarioList(elements.selDbScenario, elements.selDbGoal, loadScenarioByIdToEditor);
    this.bindScenarioSelectors(elements.selDbScenario, elements.selDbGoal, loadScenarioByIdToEditor);
    this.bindPopstateSync(elements.selDbScenario, elements.selDbGoal, loadScenarioByIdToEditor);
  }
}
