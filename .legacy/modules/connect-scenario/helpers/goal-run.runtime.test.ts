import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const runtimeMocks = vi.hoisted(() => {
  const pause = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
  const resume = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
  const stop = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
  const getProjection = vi.fn().mockResolvedValue(null);
  const getStateCandidates = vi.fn().mockResolvedValue({
    objects: { 'pompa 1': 'active' },
    functions: { Włącz: 'ready' },
    params: { pressure: '1 mbar' }
  });
  const getEventStream = vi.fn(() => null);
  const markUnavailable = vi.fn();

  const modalOpen = vi.fn();
  const modalClose = vi.fn();
  const modalUpdateField = vi.fn();

  const render = vi.fn();
  const stopAutoRefresh = vi.fn();
  const DslTable = vi.fn().mockImplementation(() => ({ render, stopAutoRefresh }));

  const highlight = vi.fn((text: string) => `<mark>${text}</mark>`);
  const fetchWithAuth = vi.fn().mockResolvedValue(new Response(JSON.stringify({ logs: [] }), { status: 200 }));

  return {
    firmware: {
      baseUrl: 'http://firmware.test',
      isAvailable: false,
      pause,
      resume,
      stop,
      getProjection,
      getStateCandidates,
      getEventStream,
      markUnavailable,
    },
    modal: {
      open: modalOpen,
      close: modalClose,
      updateField: modalUpdateField,
    },
    dslTable: {
      DslTable,
      render,
      stopAutoRefresh,
    },
    dsl: {
      highlight,
    },
    fetchWithAuth,
  };
});

vi.mock('../../../services/firmware-cqrs.service', () => ({
  FirmwareCQRS: runtimeMocks.firmware,
}));

vi.mock('../../../components/dsl', () => ({
  getDslEngine: () => runtimeMocks.dsl,
}));

vi.mock('../../../components/dsl-table', () => ({
  DslTable: runtimeMocks.dslTable.DslTable,
}));

vi.mock('../../../services/modal-url.service', () => ({
  ModalUrlService: runtimeMocks.modal,
}));

vi.mock('../../../utils/fetch.utils', () => ({
  fetchWithAuth: runtimeMocks.fetchWithAuth,
}));

import { createGoalRunRuntime } from './goal-run.runtime';

function buildRuntimeDom(): HTMLElement {
  const root = document.createElement('div');
  root.innerHTML = `
    <div id="goal-run-modal" class="hidden">
      <button class="run-tab active" data-run-tab="exec">Exec</button>
      <button class="run-tab" data-run-tab="terminal">Terminal</button>
      <button class="run-tab" data-run-tab="state">State</button>
      <button class="run-tab" data-run-tab="code">Code</button>
      <div id="goal-run-exec"></div>
      <div id="goal-run-terminal" class="hidden"></div>
      <div id="goal-run-state" class="hidden"></div>
      <div id="goal-run-code" class="hidden"></div>
    </div>
    <div id="goal-run-title"></div>
    <div id="goal-run-status"></div>
    <div id="goal-run-progress"></div>
    <ol id="goal-run-steps"></ol>
    <pre id="goal-run-logs">seed log</pre>
    <pre id="goal-run-code-pre"></pre>
    <table><tbody id="goal-run-state-body"></tbody></table>
    <button id="goal-run-logs-clear">clear</button>
    <button id="goal-run-state-refresh">refresh</button>
    <button id="goal-run-pause">pause</button>
    <button id="goal-run-resume">resume</button>
    <button id="goal-run-stop">stop</button>
  `;
  document.body.appendChild(root);
  return root;
}

function buildGoalSection(): HTMLElement {
  const goalSection = document.createElement('section');
  goalSection.innerHTML = `
    <div class="steps-container">
      <div class="task-container">
        <div class="sentence-builder">
          <div class="sentence-part">
            <select class="function-select">
              <option value="Włącz" selected>Włącz</option>
            </select>
            <select class="object-select">
              <option value="pompa 1" selected>pompa 1</option>
            </select>
          </div>
        </div>
      </div>
      <div class="condition-group" data-condition-type="if">
        <select class="param-select">
          <option value="pressure" selected>pressure</option>
        </select>
        <select class="operator-select">
          <option value=">" selected>&gt;</option>
        </select>
        <input class="value-input" value="1" />
        <select class="unit-select">
          <option value="mbar" selected>mbar</option>
        </select>
      </div>
    </div>
  `;
  return goalSection;
}

describe('createGoalRunRuntime', () => {
  let root: HTMLElement;

  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
    root = buildRuntimeDom();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('opens the modal and renders steps from the selected goal section', () => {
    const runtime = createGoalRunRuntime();
    const goalSection = buildGoalSection();

    runtime.openModal('Goal A', 'scenario-1', goalSection);

    expect(runtimeMocks.modal.open).toHaveBeenCalledWith('goal-run-modal', {
      goalName: 'Goal A',
      scenario: 'scenario-1',
      tab: 'execution',
    });
    expect(document.getElementById('goal-run-title')?.textContent).toContain('Goal A');
    expect(document.getElementById('goal-run-status')?.textContent).toBe('running');
    expect((document.getElementById('goal-run-progress') as HTMLElement).style.width).toBe('0%');
    expect(document.querySelectorAll('#goal-run-steps li')).toHaveLength(2);
    expect(document.getElementById('goal-run-code-pre')?.innerHTML).toContain("SET 'pompa 1' '1'");
  });

  it('binds runtime control buttons and updates the visible status', () => {
    const runtime = createGoalRunRuntime();
    runtime.bindUi(root);

    (document.getElementById('goal-run-logs-clear') as HTMLButtonElement).click();
    (document.getElementById('goal-run-pause') as HTMLButtonElement).click();
    (document.getElementById('goal-run-resume') as HTMLButtonElement).click();
    (document.getElementById('goal-run-stop') as HTMLButtonElement).click();

    expect(document.getElementById('goal-run-logs')?.textContent).toBe('');
    expect(runtimeMocks.firmware.pause).toHaveBeenCalledTimes(1);
    expect(runtimeMocks.firmware.resume).toHaveBeenCalledTimes(1);
    expect(runtimeMocks.firmware.stop).toHaveBeenCalledTimes(1);
    expect(document.getElementById('goal-run-status')?.textContent).toBe('stopped');
    expect((window as any).__goalRunClose).toBeTypeOf('function');
  });

  it('refreshes the state table using the active goal context', async () => {
    const runtime = createGoalRunRuntime();
    const goalSection = buildGoalSection();

    runtime.setContext(goalSection, 'scenario-1', 'Goal A');
    await runtime.refreshState(goalSection);

    expect(runtimeMocks.firmware.getStateCandidates).toHaveBeenCalledTimes(1);
    expect(document.getElementById('goal-run-state-body')?.innerHTML).toContain('pressure');
    expect(document.getElementById('goal-run-state-body')?.innerHTML).toContain('1 mbar');
  });
});
