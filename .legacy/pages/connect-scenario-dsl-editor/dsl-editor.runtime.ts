// dsl-editor.runtime.ts
// Extracted from connect-scenario-dsl-editor.page.ts — scenario run/execution operations

import { escapeHtml } from '../../utils/html.utils';
import { notifyBottomLine } from '../../modules/shared/generic-grid/utils';
import { FirmwareCQRS } from '../../services/firmware-cqrs.service';
import { DslTools } from '../../components/dsl/dsl-tools';

export interface DslRuntimeContext {
  getDslCode: () => string;
  getCurrentScenarioId: () => string;
  getCurrentScenarioTitle: () => string;
  renderRunModal: () => string;
  extractStepsFromDsl: (dsl: string) => string[];
}

export interface SingleLineRunRequest {
  lineNumber: number;
  lineText: string;
  runtimeDsl: string;
  goalName?: string;
}

// ===== Polling state (module-level to avoid class coupling) =====
let pollingInterval: any = null;

async function readRuntimeError(response: Response): Promise<string> {
  try {
    const payload = await response.clone().json();
    if (typeof payload?.detail === 'string' && payload.detail) return payload.detail;
    if (typeof payload?.error === 'string' && payload.error) return payload.error;
  } catch { /* silent */ }
  try {
    const text = (await response.clone().text()).trim();
    if (text) return text;
  } catch { /* silent */ }
  return `${response.status} ${response.statusText || 'Runtime Error'}`;
}

function isRuntimeValidationError(response: Response): boolean {
  return response.status >= 400 && response.status < 500 && response.status !== 503;
}

export async function runScenario(ctx: DslRuntimeContext): Promise<void> {
  const dslCode = ctx.getDslCode();
  if (!dslCode.trim()) {
    notifyBottomLine('⚠️ Brak kodu do uruchomienia', 'warning', 2500);
    return;
  }
  
  // Show modal - ensure it's visible
  let modal = document.getElementById('dsl-run-modal');

  if (!modal) {
    // Modal not found - create it dynamically
    const modalHtml = ctx.renderRunModal();
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = modalHtml;
    modal = tempDiv.firstElementChild as HTMLElement;
    if (modal) {
      document.body.appendChild(modal);
    }
  }
  
  if (modal) {
    modal.classList.remove('hidden');
    // Ensure modal is visible by setting inline styles as backup
    modal.style.display = 'flex';
  } else {
    notifyBottomLine('❌ Błąd: Nie można utworzyć okna', 'error', 3000);
    return;
  }
  
  const titleEl = document.getElementById('dsl-run-title');
  if (titleEl) titleEl.textContent = `▶️ Uruchamianie: ${ctx.getCurrentScenarioTitle() || 'Scenariusz'}`;
  
  // Update status
  updateRunStatus('Uruchamianie...');
  clearLogs();
  addLog('🚀 Rozpoczynanie wykonania scenariusza...');
  addLog(`📋 Scenariusz: ${ctx.getCurrentScenarioTitle() || ctx.getCurrentScenarioId()}`);
  
  // Extract steps from DSL
  const steps = ctx.extractStepsFromDsl(dslCode);
  renderSteps(steps);
  
  try {
    // Start execution via FirmwareCQRS
    const scenarioId = ctx.getCurrentScenarioId() || `dsl-runtime-${Date.now()}`;
    const result = await FirmwareCQRS.startExecution({
      scenarioId,
      scenario_id: scenarioId,
      mode: 'dsl',
      speed: 1,
      content: { dsl: dslCode },
      dsl: dslCode,
      dsl_code: dslCode,
    });
    if (result && result.ok) {
      addLog('✅ Wykonanie rozpoczęte');
      updateRunStatus('W trakcie');
      startPolling();
    } else if (result && isRuntimeValidationError(result)) {
      const reason = await readRuntimeError(result);
      updateRunStatus('Błąd runtime');
      addLog(`❌ Runtime odrzucił scenariusz: ${reason}`);
      notifyBottomLine(`❌ ${reason}`, 'error', 3500);
    } else {
      addLog('⚠️ Symulacja lokalna (brak połączenia z firmware)');
      await simulateExecution(steps);
    }
  } catch {
    addLog('⚠️ Symulacja lokalna');
    await simulateExecution(steps);
  }
}

export function renderSteps(steps: string[]): void {
  const list = document.getElementById('dsl-run-steps');
  if (list) {
    list.innerHTML = steps.map((s, i) => 
      `<li id="dsl-step-${i}" class="text-muted">${escapeHtml(s)}</li>`
    ).join('');
  }
}

export async function simulateExecution(steps: string[]): Promise<void> {
  updateRunStatus('Symulacja');
  const progress = document.getElementById('dsl-run-progress');
  
  for (let i = 0; i < steps.length; i++) {
    const stepEl = document.getElementById(`dsl-step-${i}`);
    if (stepEl) {
      stepEl.classList.remove('text-muted');
      stepEl.style.color = '#0969da';
      stepEl.style.fontWeight = '600';
    }
    
    addLog(`▶️ Krok ${i + 1}: ${steps[i]}`);
    
    if (progress) {
      progress.style.width = `${((i + 1) / steps.length) * 100}%`;
    }
    
    await delay(800);
    
    if (stepEl) {
      stepEl.style.color = '#1a7f37';
      stepEl.textContent = `✅ ${steps[i]}`;
    }
  }
  
  updateRunStatus('Zakończono');
  addLog('✅ Symulacja zakończona pomyślnie');
}

export function startPolling(): void {
  pollingInterval = setInterval(async () => {
    try {
      const projection = await FirmwareCQRS.getProjection();
      if (projection) {
        updateFromProjection(projection);
      }
    } catch { /* silent */ }
  }, 1000);
}

export function stopPolling(): void {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}

function readProjectionNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function clampProgress(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function getProjectionProgress(projection: any): number | null {
  const directProgress = readProjectionNumber(
    projection?.progress ?? projection?.progress_percent ?? projection?.progressPercent,
  );
  if (directProgress !== null) return clampProgress(directProgress);

  const totalSteps =
    readProjectionNumber(projection?.total_steps ?? projection?.totalSteps) ??
    (Array.isArray(projection?.steps) ? projection.steps.length : null);
  const currentIndex = readProjectionNumber(projection?.current_index ?? projection?.currentIndex);

  if (totalSteps && totalSteps > 0 && currentIndex !== null) {
    return clampProgress(((currentIndex + 1) / totalSteps) * 100);
  }

  if ((projection?.status || '').toLowerCase() === 'completed') return 100;
  return null;
}

export function updateFromProjection(projection: any): void {
  const status = projection?.status || 'W trakcie';
  
  updateRunStatus(status);
  
  const progress = document.getElementById('dsl-run-progress');
  const progressPercent = getProjectionProgress(projection);
  if (progress && progressPercent !== null) {
    progress.style.width = `${progressPercent}%`;
  }
  
  if (status === 'completed' || status === 'failed' || status === 'stopped') {
    stopPolling();
    addLog(`📊 Zakończono: ${status}`);
  }
}

export function switchRunTab(tabId: string): void {
  // Update tab buttons
  document.querySelectorAll('.run-tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`[data-run-tab="${tabId}"]`)?.classList.add('active');
  
  // Update panels
  ['exec', 'terminal', 'state', 'firmware'].forEach(id => {
    const panel = document.getElementById(`dsl-run-${id}`);
    if (panel) panel.classList.toggle('hidden', id !== tabId);
  });

  if (tabId === 'firmware') void fetchHardwareIdentity();
}

export function updateRunStatus(status: string): void {
  const ids = ['dsl-run-status', 'dsl-inline-run-status'];
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.textContent = status;
  });
}

function updateInlineMeta(message: string): void {
  const el = document.getElementById('dsl-inline-run-meta');
  if (el) el.innerHTML = message;
}

function updateInlinePreview(html: string): void {
  const el = document.getElementById('dsl-inline-runtime-preview');
  if (el) el.innerHTML = html;
}

export function addLog(message: string): void {
  const time = new Date().toLocaleTimeString();
  ['dsl-run-logs', 'dsl-inline-terminal'].forEach((id) => {
    const logs = document.getElementById(id) as HTMLPreElement | null;
    if (!logs) return;
    logs.textContent += `[${time}] ${message}\n`;
    logs.scrollTop = logs.scrollHeight;
  });
}

export function clearLogs(): void {
  ['dsl-run-logs', 'dsl-inline-terminal'].forEach((id) => {
    const logs = document.getElementById(id) as HTMLPreElement | null;
    if (logs) logs.textContent = '';
  });
  updateInlineMeta('Kliknij linię z komendą `SET` / `PUMP` / `GET` / `IF` / `WAIT`, aby uruchomić ją w runtime.');
  updateInlinePreview('');
}

export async function refreshState(): Promise<void> {
  try {
    const state = await FirmwareCQRS.getStateCandidates();
    const body = document.getElementById('dsl-run-state-body');
    if (body && state) {
      const peripherals = state.peripherals || {};
      body.innerHTML = Object.entries(peripherals).map(([name, data]: [string, any]) => `
        <tr>
          <td style="padding:8px;border-bottom:1px solid var(--border);">${escapeHtml(name)}</td>
          <td style="padding:8px;border-bottom:1px solid var(--border);">${data.state || '—'}</td>
          <td style="padding:8px;border-bottom:1px solid var(--border);">${data.value ?? '—'}</td>
        </tr>
      `).join('') || '<tr><td colspan="3" class="text-muted text-center">Brak danych</td></tr>';
    }
  } catch {
    notifyBottomLine('⚠️ Nie można pobrać stanu', 'warning', 2000);
  }
}

export async function pauseExecution(): Promise<void> {
  try {
    await FirmwareCQRS.pause();
    updateRunStatus('Pauza');
    addLog('⏸️ Wstrzymano wykonanie');
  } catch { notifyBottomLine('⚠️ Błąd pauzy', 'warning', 2000); }
}

export async function resumeExecution(): Promise<void> {
  try {
    await FirmwareCQRS.resume();
    updateRunStatus('W trakcie');
    addLog('▶️ Wznowiono wykonanie');
  } catch { notifyBottomLine('⚠️ Błąd wznowienia', 'warning', 2000); }
}

export async function stopExecution(): Promise<void> {
  try {
    await FirmwareCQRS.stop();
    stopPolling();
    updateRunStatus('Zatrzymano');
    addLog('⏹️ Zatrzymano wykonanie');
  } catch { notifyBottomLine('⚠️ Błąd zatrzymania', 'warning', 2000); }
}

export async function runSingleLine(ctx: DslRuntimeContext, request: SingleLineRunRequest): Promise<void> {
  const trimmed = String(request.lineText || '').trim();
  const lineLabel = `linia ${request.lineNumber}`;

  if (!trimmed) {
    updateRunStatus('Pominięto');
    updateInlineMeta(`ℹ️ ${lineLabel} jest pusta — nic nie zostało wysłane do runtime.`);
    updateInlinePreview('<div class="text-muted">Wybierz linię z komendą, aby zobaczyć wynik symulacji.</div>');
    addLog(`ℹ️ ${lineLabel} jest pusta.`);
    return;
  }

  updateRunStatus(`Uruchamianie ${lineLabel}`);
  updateInlineMeta(`▶️ Kliknięto <strong>${lineLabel}</strong>${request.goalName ? ` • GOAL: <code>${escapeHtml(request.goalName)}</code>` : ''}<br><code>${escapeHtml(trimmed)}</code>`);
  addLog(`▶️ Kliknięto ${lineLabel}: ${trimmed}`);

  if (!request.runtimeDsl) {
    updateInlinePreview('<div class="text-warning">ℹ️ Ta linia jest komentarzem albo kontekstem i nie została uruchomiona.</div>');
    addLog('ℹ️ Linia nie zawiera wykonywalnej komendy runtime.');
    return;
  }

  const previewHtml = DslTools.runDslConsole(request.runtimeDsl);
  updateInlinePreview(previewHtml);

  const steps = ctx.extractStepsFromDsl(request.runtimeDsl);
  if (steps.length > 0) {
    addLog(`📋 Runtime DSL: ${steps.join('  →  ')}`);
  }

  try {
    const scenarioId = ctx.getCurrentScenarioId() || `dsl-line-${Date.now()}`;
    const response = await FirmwareCQRS.startExecution({
      scenarioId,
      scenario_id: scenarioId,
      mode: 'dsl-line',
      speed: 1,
      content: { dsl: request.runtimeDsl },
      dsl: request.runtimeDsl,
      dsl_code: request.runtimeDsl,
      command: trimmed,
      line_number: request.lineNumber,
      goal: request.goalName || ctx.getCurrentScenarioTitle(),
      scenario_context_id: ctx.getCurrentScenarioId(),
    });

    if (response?.ok) {
      updateRunStatus(`Wysłano ${lineLabel}`);
      addLog('✅ Pojedyncza linia została wysłana do runtime firmware.');
      notifyBottomLine(`▶️ Uruchomiono ${lineLabel}`, 'info', 1500);
      return;
    }

    if (response && isRuntimeValidationError(response)) {
      const reason = await readRuntimeError(response);
      updateRunStatus(`Błąd ${lineLabel}`);
      addLog(`❌ Runtime odrzucił ${lineLabel}: ${reason}`);
      notifyBottomLine(`❌ ${reason}`, 'error', 3500);
      return;
    }

    updateRunStatus(`Symulacja ${lineLabel}`);
    addLog(`⚠️ Runtime odpowiedział statusem ${response?.status || 'unknown'} — pokazano symulację lokalną.`);
  } catch {
    updateRunStatus(`Symulacja ${lineLabel}`);
    addLog('⚠️ Firmware runtime niedostępny — pokazano symulację lokalną.');
  }
}

export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function fetchHardwareIdentity(): Promise<void> {
  const statusEl = document.getElementById('dsl-run-fw-status');
  const bodyEl = document.getElementById('dsl-run-fw-body');
  if (!bodyEl) return;

  if (statusEl) statusEl.textContent = 'Łączenie z firmware…';
  bodyEl.innerHTML = '';

  const data = await FirmwareCQRS.getHardwareIdentity();
  if (!data) {
    if (statusEl) statusEl.textContent = '⚠️ Firmware niedostępny — nie można pobrać identyfikacji sprzętu';
    bodyEl.innerHTML = `<div style="grid-column:1/-1" class="text-muted text-sm">Brak połączenia z firmware runtime.</div>`;
    return;
  }

  const mode = data.mode || 'unknown';
  const detected = data.detected ?? '?';
  const total = data.total ?? '?';
  const modeLabel = mode === 'mock' ? '🟡 mock (symulacja)' : mode === 'real' ? '🟢 real (sprzęt)' : mode;
  if (statusEl) statusEl.innerHTML = `Tryb: <strong>${modeLabel}</strong> &nbsp;|&nbsp; Wykryte: <strong>${detected}/${total}</strong>`;

  const adapters: any[] = data.adapters || [];
  bodyEl.innerHTML = adapters.map((a: any) => {
    const st = a.status || 'unknown';
    const icon = st === 'ok' ? '🟢' : st === 'mock' ? '🟡' : st === 'no-access' ? '🟠' : st === 'adapter-only' ? '🟡' : '🔴';
    const statusText = st === 'ok' ? 'connected' : st === 'adapter-only' ? 'adapter USB ✓ / moduł ✗' : st === 'no-access' ? 'brak uprawnień' : st === 'mock' ? 'mock' : 'offline';
    const details: string[] = [];
    if (a.protocol) details.push(`<div class="text-xs text-muted">Protokół: ${escapeHtml(a.protocol)}</div>`);
    if (a.version && a.version !== '—') details.push(`<div class="text-xs text-muted">Wersja: ${escapeHtml(a.version)}</div>`);
    if (a.channels) {
      const ch = Object.entries(a.channels).map(([k, v]) => `ch${k}: ${v}`).join(', ');
      details.push(`<div class="text-xs text-muted">Kanały: ${escapeHtml(ch)}</div>`);
    }
    if (a.capabilities) details.push(`<div class="text-xs text-muted">Możliwości: ${escapeHtml((a.capabilities as string[]).join(', '))}</div>`);
    if (a.valves) details.push(`<div class="text-xs text-muted">Zawory: ${escapeHtml(String(a.valves))}</div>`);
    if (a.registers) details.push(`<div class="text-xs text-muted">Rejestry: ${escapeHtml((a.registers as string[]).join(', '))}</div>`);
    if (a.digital_outputs) details.push(`<div class="text-xs text-muted">DO: ${escapeHtml(String(a.digital_outputs))}</div>`);
    if (a.digital_inputs) details.push(`<div class="text-xs text-muted">DI: ${escapeHtml(String(a.digital_inputs))}</div>`);
    if (a.interface) details.push(`<div class="text-xs text-muted">Interfejs: ${escapeHtml(String(a.interface))}</div>`);

    // Probe details
    const probe = a.probe;
    if (probe) {
      const probeLines: string[] = [];
      if (probe.adapter) probeLines.push(probe.adapter);
      if (probe.usb_product) probeLines.push(`USB: ${probe.usb_product}`);
      if (probe.usb_serial) probeLines.push(`S/N: ${probe.usb_serial}`);
      if (probe.serial_port) probeLines.push(`Port: ${probe.serial_port}`);
      if (probe.baudrate) probeLines.push(`Baud: ${probe.baudrate}`);
      if (probe.parity) probeLines.push(`Parity: ${probe.parity}`);
      if (probe.bus !== undefined) probeLines.push(`I2C bus: ${probe.bus}, addr: ${probe.address}`);
      if (probe.host) probeLines.push(`TCP: ${probe.host}:${probe.port}`);
      if (probe.reason) probeLines.push(probe.reason);
      if (probe.note) probeLines.push(probe.note);
      if (probeLines.length) {
        details.push(`<div class="text-xs" style="color:var(--text-secondary);margin-top:4px;font-family:monospace;opacity:0.8;">${escapeHtml(probeLines.join(' | '))}</div>`);
      }
    }

    return `
      <div style="background:var(--bg-muted);border-radius:6px;padding:10px;${st === 'ok' ? 'border-left:3px solid var(--color-success,#4caf50);' : ''}">
        <div class="d-flex items-center gap-xs mb-xs">
          <span>${icon}</span>
          <strong class="text-sm">${escapeHtml(a.name || a.id)}</strong>
          <span class="text-xs" style="opacity:0.6;margin-left:auto;">${statusText}</span>
        </div>
        <div class="text-xs" style="color:var(--text-secondary);">${escapeHtml(a.description || '')}</div>
        ${details.join('')}
        <div class="text-xs mt-xs" style="opacity:0.6;">repo: ${escapeHtml(a.repo || '—')}</div>
      </div>`;
  }).join('');
}
