import { beforeEach, describe, expect, it, vi } from 'vitest';

const updateScenario = vi.fn().mockResolvedValue(undefined);
const dispatch = vi.fn();
const renderScenarioList = vi.fn().mockResolvedValue(undefined);
const loadScenarioById = vi.fn().mockResolvedValue(undefined);
const notifyBottomLine = vi.fn();

vi.mock('../../../utils/logger', () => ({
  logger: { debug: vi.fn() },
}));

vi.mock('../../shared/generic-grid/utils', () => ({
  notifyBottomLine,
}));

vi.mock('./scenarios.service', () => ({
  ScenariosService: {
    getCurrentScenarioId: vi.fn(() => 'ts-demo'),
    createScenario: vi.fn(),
    updateScenario,
  },
}));

vi.mock('./scenarios.library', () => ({
  ScenariosLibrary: {
    snapshot: vi.fn(() => ({ objects: [], functions: [], params: [], units: [], logs: [], alarms: [], errors: [] })),
  },
}));

vi.mock('../cqrs/singleton', () => ({
  getScenarioCQRS: vi.fn(() => ({ dispatch })),
}));

vi.mock('../../../components/dsl', () => ({
  createExecContextFromDef: vi.fn(() => ({ ok: true })),
}));

describe('saveScenario', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = `
      <input id="scenario-name" value="ddd" />
      <textarea id="scenario-func-editor">FUNC: Nowa procedura\n  LOG [Procedura wykonana]\n</textarea>
      <textarea id="scenario-def-editor"></textarea>
      <div id="goals-container">
        <div class="goal-section" data-goal-id="goal-1">
          <select class="goal-select"><option selected>dsadas</option></select>
          <div class="steps-container">
            <div class="step-block func-call-block" data-step-id="func-1">
              <select class="func-call-select"><option selected>Nowa procedura</option></select>
              <div class="func-args-container"></div>
            </div>
          </div>
        </div>
      </div>
    `;
  });

  it('persists DSL, func source, and library.goals when saving builder changes', async () => {
    const { saveScenario } = await import('./scenarios.save');

    await saveScenario({
      setLastScenarioName: vi.fn(),
      setCurrentExecCtx: vi.fn(),
      writeScenarioIdToUrl: vi.fn(),
      ensureGoalsInActivities: vi.fn(),
      refreshBuilderOptions: vi.fn(),
      dispatch,
      renderScenarioList,
      loadScenarioById,
    });

    expect(updateScenario).toHaveBeenCalledWith(
      'ts-demo',
      expect.objectContaining({
        dsl: expect.stringContaining("FUNC 'Nowa procedura'"),
        func: expect.stringContaining('FUNC: Nowa procedura'),
        library: expect.stringContaining('"goals":[{"name":"dsadas","code":"FUNC \'Nowa procedura\'"}]'),
      }),
    );
  });
});
