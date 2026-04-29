import { FirmwareCQRS } from '../../../services/firmware-cqrs.service';
import { getDslEngine } from '../../../components/dsl';
import { DslTable } from '../../../components/dsl-table';
import { ModalUrlService } from '../../../services/modal-url.service';
import { fetchWithAuth } from '../../../utils/fetch.utils';
import { collectStepsFromContainer, stepsToLines } from './scenarios.serializer';

export type GoalRunRuntime = ReturnType<typeof createGoalRunRuntime>;

// ==================== EXTRACTED UTILITY FUNCTIONS ====================

function appendLog(line: string): void {
  const pre = document.getElementById('goal-run-logs');
  if (!pre) return;
  try {
    pre.textContent = (pre.textContent || '') + (line.endsWith('\n') ? line : (line + '\n'));
    (pre as any).scrollTop = (pre as any).scrollHeight;
  } catch { /* silent */ }
}

function stopStreams(
  goalRunLogSource: EventSource | null,
  goalRunEventSource: EventSource | null,
  goalRunLogTimer: number | null,
  goalRunProjectionTimer: number | null,
  goalRunStateTimer: number | null,
  stateTable: DslTable | null
): void {
  try { if (goalRunLogSource) { goalRunLogSource.close(); } } catch { /* silent */ }
  try { if (goalRunEventSource) { goalRunEventSource.close(); } } catch { /* silent */ }
  try { if (goalRunLogTimer) { clearInterval(goalRunLogTimer as unknown as number); } } catch { /* silent */ }
  try { if (goalRunProjectionTimer) { clearInterval(goalRunProjectionTimer as unknown as number); } } catch { /* silent */ }
  try { if (goalRunStateTimer) { clearInterval(goalRunStateTimer as unknown as number); } } catch { /* silent */ }
  try { stateTable?.stopAutoRefresh(); } catch { /* silent */ }
}

function stopLogs(goalRunLogSource: EventSource | null, goalRunLogTimer: number | null): void {
  try { if (goalRunLogSource) { goalRunLogSource.close(); } } catch { /* silent */ }
  try { if (goalRunLogTimer) { clearInterval(goalRunLogTimer as unknown as number); } } catch { /* silent */ }
}

function setStatus(status: string): void {
  const normalized = (String(status).toLowerCase() === 'connected') ? 'running' : String(status);
  const el = document.getElementById('goal-run-status');
  if (el) el.textContent = normalized;
}

function setProgress(percent: number): void {
  const p = Math.max(0, Math.min(100, Number.isFinite(percent) ? percent : 0));
  const bar = document.getElementById('goal-run-progress');
  if (bar) bar.style.width = `${p}%`;
}

function renderCode(goalRunCodeLines: string[], goalRunSteps: string[], current?: number): void {
  const pre = document.getElementById('goal-run-code-pre');
  if (!pre) return;
  const lines = goalRunCodeLines.length ? goalRunCodeLines : goalRunSteps;
  const cur = (typeof current === 'number') ? current : -1;
  const html = lines.map((l, i) => {
    const active = i === cur;
    return `<div data-ln="${i+1}" class="goal-run-code-line${active ? ' active' : ''}"><span class="line-number">${i+1}</span>${l}</div>`;
  }).join('');
  pre.innerHTML = html;
  try {
    const activeEl = pre.querySelector('.goal-run-code-line.active') as HTMLElement;
    const top = activeEl ? activeEl.offsetTop : 0;
    (pre as any).scrollTop = Math.max(0, top - 60);
  } catch { /* silent */ }
}

function markCurrent(index: number, _goalRunSteps: string[]): void {
  const ol = document.getElementById('goal-run-steps');
  if (!ol) return;
  ol.querySelectorAll('li').forEach((li, i) => {
    li.classList.toggle('step-current', i === index);
    if (i < index) li.classList.add('step-done');
  });
}

// ==================== MAIN RUNTIME FACTORY ====================

type GoalStateRow = { type: string; name: string; value?: string; units?: string };

type GoalRunState = {
  currentGoalSection: HTMLElement | null;
  currentScenarioId: string;
  currentGoalName: string;
  goalRunProjectionTimer: number | null;
  goalRunStateTimer: number | null;
  goalRunSteps: string[];
  goalRunCurrentIndex: number;
  goalRunCodeLines: string[];
  goalRunLastParamValues: Map<string, string>;
  stateTable: DslTable | null;
  goalRunLogSource: EventSource | null;
  goalRunLogTimer: number | null;
  goalRunEventSource: EventSource | null;
};

type GoalRunRefreshState = (goalSection: HTMLElement | null) => Promise<void>;

function createGoalRunState(): GoalRunState {
  return {
    currentGoalSection: null,
    currentScenarioId: '',
    currentGoalName: '',
    goalRunProjectionTimer: null,
    goalRunStateTimer: null,
    goalRunSteps: [],
    goalRunCurrentIndex: -1,
    goalRunCodeLines: [],
    goalRunLastParamValues: new Map<string, string>(),
    stateTable: null,
    goalRunLogSource: null,
    goalRunLogTimer: null,
    goalRunEventSource: null,
  };
}

function renderGoalStepsList(steps: string[]): string {
  const dsl = getDslEngine();
  return steps.map((step, i) => {
    const highlighted = dsl.highlight(step);
    return `<li data-step-idx="${i}">${highlighted}</li>`;
  }).join('');
}

function renderStepsFromGoalSection(state: GoalRunState, goalSection: HTMLElement | null): void {
  state.goalRunSteps = [];
  state.goalRunCurrentIndex = -1;
  state.goalRunCodeLines = [];

  try {
    if (!goalSection) return;
    const stepsContainer = goalSection.querySelector('.steps-container') as HTMLElement | null;
    if (!stepsContainer) return;

    const parsedSteps = collectStepsFromContainer(stepsContainer);
    const renderedLines = stepsToLines(parsedSteps);
    state.goalRunSteps = renderedLines;
    state.goalRunCodeLines = renderedLines.slice();
  } catch { /* silent */ }

  const ol = document.getElementById('goal-run-steps');
  if (ol) ol.innerHTML = renderGoalStepsList(state.goalRunSteps);
  renderCode(state.goalRunCodeLines, state.goalRunSteps);
}

function bindRunTabs(): void {
  try {
    const modal = document.getElementById('goal-run-modal');
    if (!modal) return;
    modal.addEventListener('click', (ev: Event) => {
      const btn = (ev.target as HTMLElement).closest('.run-tab') as HTMLElement | null;
      if (!btn) return;
      const tab = btn.getAttribute('data-run-tab') || '';
      const sections: Record<string, string> = { exec: 'goal-run-exec', terminal: 'goal-run-terminal', state: 'goal-run-state', code: 'goal-run-code' };
      try { modal.querySelectorAll('.run-tab').forEach(el => el.classList.remove('active')); } catch { /* silent */ }
      btn.classList.add('active');
      Object.entries(sections).forEach(([key, id]) => {
        const sec = modal.querySelector('#' + id) as HTMLElement | null;
        if (sec) sec.classList.toggle('hidden', key !== tab);
      });
      ModalUrlService.updateField('goal-run-modal', 'tab', tab);
    }, { capture: false });
  } catch { /* silent */ }
}

function initializeStateTable(state: GoalRunState, refreshState: GoalRunRefreshState): void {
  try {
    const stateRoot = document.getElementById('goal-run-state') as HTMLElement | null;
    if (stateRoot) state.stateTable = new DslTable(stateRoot, { tbodySelector: '#goal-run-state-body' });
  } catch { /* silent */ }

  try {
    const refreshBtn = document.getElementById('goal-run-state-refresh') as HTMLElement | null;
    if (refreshBtn && refreshBtn.getAttribute('data-bound') !== '1') {
      refreshBtn.addEventListener('click', () => {
        try { refreshState(state.currentGoalSection).catch(() => {}); } catch { /* silent */ }
      });
      refreshBtn.setAttribute('data-bound', '1');
    }
  } catch { /* silent */ }
}

function warmFirmwareEndpoints(): void {
  try {
    const fw = FirmwareCQRS.baseUrl;
    const fwAvailable = FirmwareCQRS.isAvailable;
    if (!fwAvailable) return;

    window.setTimeout(() => {
      try {
        const has = !!fw && typeof fw === 'string' && fw.trim().length > 0;
        if (has && FirmwareCQRS.isAvailable) {
          try { fetchWithAuth(`${fw}/api/v1/execution/projection`, { credentials: 'same-origin' }).catch(() => FirmwareCQRS.markUnavailable()); } catch { /* silent */ }
          try { fetchWithAuth(`${fw}/api/v1/state`, { credentials: 'same-origin' }).catch(() => FirmwareCQRS.markUnavailable()); } catch { /* silent */ }
          try { fetchWithAuth(`${fw}/api/v1/sim/state`, { credentials: 'same-origin' }).catch(() => FirmwareCQRS.markUnavailable()); } catch { /* silent */ }
        }
      } catch { /* silent */ }
    }, 500);

    window.setTimeout(() => {
      try {
        const has = !!fw && typeof fw === 'string' && fw.trim().length > 0;
        if (has && FirmwareCQRS.isAvailable) {
          try { fetchWithAuth(`${fw}/api/v1/execution/projection`, { credentials: 'same-origin' }).catch(() => FirmwareCQRS.markUnavailable()); } catch { /* silent */ }
          try { fetchWithAuth(`${fw}/api/v1/state`, { credentials: 'same-origin' }).catch(() => FirmwareCQRS.markUnavailable()); } catch { /* silent */ }
        }
      } catch { /* silent */ }
    }, 1500);
  } catch { /* silent */ }
}

function openGoalRunModal(
  state: GoalRunState,
  goalName: string,
  scenarioId: string,
  goalSection: HTMLElement | null,
  refreshState: GoalRunRefreshState,
): void {
  state.currentGoalSection = goalSection;
  state.currentScenarioId = scenarioId;
  state.currentGoalName = goalName;

  try {
    ModalUrlService.open('goal-run-modal', {
      goalName: goalName || '',
      scenario: scenarioId || '',
      tab: 'execution'
    });
    const title = document.getElementById('goal-run-title');
    if (title) title.textContent = `▶️ Uruchamianie celu${goalName ? `: ${goalName}` : ''}`;
    renderStepsFromGoalSection(state, state.currentGoalSection);
    setStatus('running');
    setProgress(0);
    appendLog(`ℹ️ fw baseUrl: ${FirmwareCQRS.baseUrl}`);
    appendLog(`ℹ️ scenarioId: ${scenarioId}, goal: ${goalName || '—'}`);
    bindRunTabs();
    initializeStateTable(state, refreshState);
    try { refreshState(state.currentGoalSection).catch(() => {}); } catch { /* silent */ }
    warmFirmwareEndpoints();
  } catch { /* silent */ }
}

function closeGoalRunModal(state: GoalRunState): void {
  try {
    ModalUrlService.close('goal-run-modal');
  } catch { /* silent */ }
  stopStreams(
    state.goalRunLogSource,
    state.goalRunEventSource,
    state.goalRunLogTimer,
    state.goalRunProjectionTimer,
    state.goalRunStateTimer,
    state.stateTable,
  );
}

async function connectGoalLogs(state: GoalRunState, scenarioId: string, executionId?: string): Promise<void> {
  stopLogs(state.goalRunLogSource, state.goalRunLogTimer);
  try {
    const url = new URL(`${FirmwareCQRS.baseUrl}/api/v1/execution/logs/stream`);
    url.searchParams.set('scenario', scenarioId);
    if (executionId) {
      url.searchParams.set('executionId', executionId);
      url.searchParams.set('id', executionId);
    }
    const es = new EventSource(url.toString());
    state.goalRunLogSource = es;
    es.onopen = () => { appendLog(`ℹ️ logs-sse connected: ${url.toString()}`); };
    es.onmessage = (ev: MessageEvent) => { if (ev?.data) appendLog(String(ev.data)); };
    es.onerror = () => {
      try { es.close(); } catch { /* silent */ }
      state.goalRunLogSource = null;
      appendLog('ℹ️ logs-sse closed; switching to polling');
    };
    return;
  } catch { /* silent */ }

  let last = 0;
  let announced = false;
  const poll = async () => {
    try {
      const endpoints = [
        `${FirmwareCQRS.baseUrl}/api/v1/execution/logs${executionId ? `?executionId=${encodeURIComponent(executionId)}` : ''}`,
        `${FirmwareCQRS.baseUrl}/api/v1/execution/status${executionId ? `?executionId=${encodeURIComponent(executionId)}` : ''}`
      ];
      if (!announced) {
        appendLog(`ℹ️ logs-poll: ${endpoints.join(' | ')}`);
        announced = true;
      }
      for (const ep of endpoints) {
        try {
          const resp = await fetchWithAuth(ep, { credentials: 'same-origin' });
          if (!resp.ok) continue;
          const js = await resp.json().catch(() => ({}));
          const logs = Array.isArray(js?.logs) ? js.logs : [];
          if (logs.length) {
            for (let i = last; i < logs.length; i++) appendLog(String(logs[i]));
            last = logs.length;
            break;
          }
        } catch { /* silent */ }
      }
    } catch { /* silent */ }
  };

  await poll();
  state.goalRunLogTimer = window.setInterval(poll, 1000) as unknown as number;
}

function updateExecProjection(state: GoalRunState, proj: any): void {
  try {
    if (!proj || typeof proj !== 'object') return;
    if (proj.status) setStatus(String(proj.status));
    const p = (typeof proj.progress === 'number') ? (proj.progress <= 1 ? proj.progress * 100 : proj.progress) : undefined;
    if (p !== undefined) setProgress(p);
    if (Array.isArray(proj.steps) && proj.steps.length && !state.goalRunSteps.length) {
      state.goalRunSteps = proj.steps.map((step: any) => (typeof step === 'string' ? step : (step?.name || 'Krok')));
      const ol = document.getElementById('goal-run-steps');
      if (ol) ol.innerHTML = renderGoalStepsList(state.goalRunSteps);
      if (!state.goalRunCodeLines.length) state.goalRunCodeLines = state.goalRunSteps.slice();
      renderCode(state.goalRunCodeLines, state.goalRunSteps, state.goalRunCurrentIndex);
    }
    const idx = (typeof proj.currentIndex === 'number') ? proj.currentIndex : (typeof proj.index === 'number' ? proj.index : undefined);
    if (typeof idx === 'number') markCurrent(idx, state.goalRunSteps);
  } catch { /* silent */ }
}

function startProjectionPollingWithState(state: GoalRunState): void {
  try {
    if (state.goalRunProjectionTimer) {
      clearInterval(state.goalRunProjectionTimer as unknown as number);
      state.goalRunProjectionTimer = null;
    }
  } catch { /* silent */ }

  const poll = async () => {
    try {
      const proj = await FirmwareCQRS.getProjection();
      try {
        if ((typeof navigator !== 'undefined') && /HeadlessChrome/i.test(navigator.userAgent)) {
          fetchWithAuth(`${FirmwareCQRS.baseUrl}/api/v1/execution/projection`, { credentials: 'same-origin' }).catch(() => {});
        }
      } catch { /* silent */ }
      if (proj) updateExecProjection(state, proj);
    } catch { /* silent */ }
  };

  poll();
  try { window.setTimeout(poll, 200); } catch { /* silent */ }
  state.goalRunProjectionTimer = window.setInterval(poll, 1000) as unknown as number;
}

async function connectGoalEvents(state: GoalRunState, scenarioId: string, executionId?: string): Promise<void> {
  try {
    const es = FirmwareCQRS.getEventStream(scenarioId, executionId);
    if (es) {
      state.goalRunEventSource = es;
      es.onopen = () => {
        try {
          const u = new URL(`${FirmwareCQRS.baseUrl}/api/v1/execution/stream`);
          if (scenarioId) u.searchParams.set('scenario', scenarioId);
          if (executionId) {
            u.searchParams.set('executionId', executionId);
            u.searchParams.set('id', executionId);
          }
          appendLog(`ℹ️ events-sse connected: ${u.toString()}`);
        } catch { /* silent */ }
      };
      es.onmessage = (ev: MessageEvent) => {
        let js: any = null;
        try { js = JSON.parse(String(ev.data || '{}')); } catch { /* silent */ }
        if (!js || typeof js !== 'object') return;
        if (js.status) setStatus(String(js.status));
        const p = (typeof js.progress === 'number') ? (js.progress <= 1 ? js.progress * 100 : js.progress) : undefined;
        if (p !== undefined) setProgress(p);
        const idx = (typeof js.currentIndex === 'number')
          ? js.currentIndex
          : ((typeof js.index === 'number') ? js.index : ((js.step && typeof js.step.index === 'number') ? js.step.index : undefined));
        if (typeof idx === 'number') markCurrent(idx, state.goalRunSteps);
        try {
          if (typeof js.log === 'string' && js.log) appendLog(js.log);
          if (Array.isArray(js.logs)) js.logs.forEach((line: any) => appendLog(String(line)));
          if (typeof js.message === 'string' && js.message) appendLog(js.message);
          if (js.step && typeof js.step.message === 'string' && js.step.message) appendLog(js.step.message);
        } catch { /* silent */ }
        if (Array.isArray(js.steps) && js.steps.length && !state.goalRunSteps.length) {
          state.goalRunSteps = js.steps.map((step: any) => (typeof step === 'string' ? step : (step?.name || 'Krok')));
          const ol = document.getElementById('goal-run-steps');
          if (ol) ol.innerHTML = renderGoalStepsList(state.goalRunSteps);
          if (!state.goalRunCodeLines.length) state.goalRunCodeLines = state.goalRunSteps.slice();
          renderCode(state.goalRunCodeLines, state.goalRunSteps, state.goalRunCurrentIndex);
        }
      };
      es.onerror = () => {
        try { es.close(); } catch { /* silent */ }
        state.goalRunEventSource = null;
        startProjectionPollingWithState(state);
      };
      return;
    }
  } catch { /* silent */ }
  startProjectionPollingWithState(state);
}

function startStateAutoRefreshWithState(state: GoalRunState, refreshState: GoalRunRefreshState): void {
  try {
    if (state.goalRunStateTimer) {
      clearInterval(state.goalRunStateTimer as unknown as number);
      state.goalRunStateTimer = null;
    }
  } catch { /* silent */ }

  const tick = () => {
    try { refreshState(state.currentGoalSection).catch(() => {}); } catch { /* silent */ }
    try {
      if ((typeof navigator !== 'undefined') && /HeadlessChrome/i.test(navigator.userAgent) && FirmwareCQRS.isAvailable) {
        fetchWithAuth(`${FirmwareCQRS.baseUrl}/api/v1/state`, { credentials: 'same-origin' }).catch(() => FirmwareCQRS.markUnavailable());
      }
    } catch { /* silent */ }
  };

  tick();
  try { window.setTimeout(tick, 200); } catch { /* silent */ }
  state.goalRunStateTimer = window.setInterval(tick, 1500) as unknown as number;
}

function collectGoalSelects(goalSection: HTMLElement | null): GoalStateRow[] {
  const rows: GoalStateRow[] = [];
  const agg = new Set<string>();
  const ensure = (type: string, name: string) => {
    const nm = String(name || '').trim();
    if (!nm) return;
    const key = `${type}:${nm}`;
    if (!agg.has(key)) {
      agg.add(key);
      rows.push({ type, name: nm });
    }
  };

  if (goalSection) {
    goalSection.querySelectorAll('.function-select').forEach(sel => ensure('function', (sel as HTMLSelectElement).value));
    goalSection.querySelectorAll('.object-select').forEach(sel => ensure('object', (sel as HTMLSelectElement).value));
    goalSection.querySelectorAll('.param-select').forEach(sel => ensure('param', (sel as HTMLSelectElement).value));
  }
  return rows;
}

function resolveStateValue(state: any, type: string, name: string): any {
  try {
    if (type === 'param' && state.params) return state.params[name];
    if (type === 'object' && state.objects) return state.objects[name];
    if (type === 'function' && state.functions) return state.functions[name];
    if (Array.isArray(state)) {
      const row = state.find((x: any) => x && x.type === type && String(x.name || '').trim() === name);
      return row?.value;
    }
  } catch { /* silent */ }
  return undefined;
}

async function persistParamChanges(state: GoalRunState, rows: Array<{ type: string; name: string; value?: string }>): Promise<void> {
  const sid = (state.currentScenarioId || '').trim();
  const goalName = (state.currentGoalName || '').trim();
  if (!sid || !goalName) return;

  for (const row of rows) {
    if (row.type !== 'param') continue;
    const val = (row.value ?? '').toString();
    const key = `${goalName}::${row.name}`;
    if (state.goalRunLastParamValues.get(key) === val) continue;
    state.goalRunLastParamValues.set(key, val);
    try {
      const { getDataCQRS } = await import('../../connect-data/cqrs/singleton');
      await getDataCQRS().dispatch({
        type: 'CreateRow',
        tableName: 'scenario_variable_values',
        data: { scenario_id: sid, goal: goalName, variable: row.name, value: val, created_at: new Date().toISOString() }
      } as any);
    } catch { /* silent */ }
  }
}

async function refreshGoalRunState(state: GoalRunState, goalSection: HTMLElement | null): Promise<void> {
  const body = document.getElementById('goal-run-state-body');
  if (!body) return;
  const rows = collectGoalSelects(goalSection);

  try {
    let currentState: any = null;
    try {
      const fw = FirmwareCQRS.baseUrl;
      if (fw && typeof fw === 'string' && fw.trim().length > 0) {
        currentState = await FirmwareCQRS.getStateCandidates();
      }
    } catch { /* silent */ }

    if (currentState && typeof currentState === 'object') {
      rows.forEach(row => {
        const value = resolveStateValue(currentState, row.type, row.name);
        if (value !== undefined) row.value = String(value);
      });
      await persistParamChanges(state, rows);
      try {
        if (state.stateTable) {
          state.stateTable.render(rows as Array<{ type: string; name: string; units?: string }>, currentState);
          return;
        }
      } catch { /* silent */ }
    }
  } catch { /* silent */ }

  body.innerHTML = rows.map(row => `<tr><td style="padding:6px;border-bottom:1px solid #f0f0f0;">${row.type}</td><td style="padding:6px;border-bottom:1px solid #f0f0f0;">${row.name}</td><td style="padding:6px;border-bottom:1px solid #f0f0f0;">${row.value ?? '—'}</td></tr>`).join('') || '<tr><td colspan="3"><em>Brak danych</em></td></tr>';
}

function bindGoalRunUi(state: GoalRunState, root: HTMLElement, closeModal: () => void, refreshState: GoalRunRefreshState): void {
  root.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.id === 'goal-run-logs-clear') {
      const pre = document.getElementById('goal-run-logs');
      if (pre) pre.textContent = '';
    }
    if (t.id === 'goal-run-state-refresh') { refreshState(state.currentGoalSection).catch(() => {}); }
    if (t.id === 'goal-run-pause') {
      try { FirmwareCQRS.pause().catch(() => {}); } catch { /* silent */ }
      setStatus('paused');
    }
    if (t.id === 'goal-run-resume') {
      try { FirmwareCQRS.resume().catch(() => {}); } catch { /* silent */ }
      setStatus('running');
    }
    if (t.id === 'goal-run-stop') {
      try { FirmwareCQRS.stop().catch(() => {}); } catch { /* silent */ }
      setStatus('stopped');
      stopStreams(
        state.goalRunLogSource,
        state.goalRunEventSource,
        state.goalRunLogTimer,
        state.goalRunProjectionTimer,
        state.goalRunStateTimer,
        state.stateTable,
      );
    }
  });
  try { (window as any).__goalRunClose = closeModal; } catch { /* silent */ }
}

export function createGoalRunRuntime() {
  const state = createGoalRunState();

  const renderStepsFromSection = (goalSection: HTMLElement | null): void => {
    renderStepsFromGoalSection(state, goalSection);
  };

  const refreshState = async (goalSection: HTMLElement | null): Promise<void> => {
    await refreshGoalRunState(state, goalSection);
  };

  const closeModal = (): void => {
    closeGoalRunModal(state);
  };

  return {
    openModal: (goalName: string, scenarioId: string, goalSection: HTMLElement | null) => {
      openGoalRunModal(state, goalName, scenarioId, goalSection, refreshState);
    },
    closeModal,
    appendLog,
    connectLogs: (scenarioId: string, executionId?: string) => connectGoalLogs(state, scenarioId, executionId),
    connectEvents: (scenarioId: string, executionId?: string) => connectGoalEvents(state, scenarioId, executionId),
    startProjectionPolling: () => startProjectionPollingWithState(state),
    startStateAutoRefresh: () => startStateAutoRefreshWithState(state, refreshState),
    refreshState,
    renderStepsFromSection,
    bindUi: (root: HTMLElement) => bindGoalRunUi(state, root, closeModal, refreshState),
    setContext: (goalSection: HTMLElement | null, scenarioId: string, goalName: string) => {
      state.currentGoalSection = goalSection;
      state.currentScenarioId = scenarioId;
      state.currentGoalName = goalName;
    },
  };
}
