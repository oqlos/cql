import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const renderFuncCallBlock = vi.fn((selected: string) => `<div class="func-call">${selected}</div>`);
const updateScenario = vi.fn().mockResolvedValue(undefined);
const fetchScenarioById = vi.fn().mockResolvedValue({ content: { func: '' } });
const notifyBottomLine = vi.fn();

vi.mock('./scenarios.service', () => ({
  ScenariosService: {
    getCurrentScenarioId: vi.fn(() => 'ts-demo'),
    fetchScenarioById,
    updateScenario,
  },
}));

vi.mock('../../../components/dsl-editor', () => ({
  blockRenderers: {
    renderFuncCallBlock,
  },
  renderGoalActionsButtons: vi.fn(() => ''),
}));

vi.mock('../../../components/dsl', () => ({
  getGlobalFuncLibrary: vi.fn(() => ({})),
}));

vi.mock('./scenario-dialogs', () => ({
  promptText: vi.fn().mockResolvedValue('Nowa procedura'),
  showInfoDialog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../shared/generic-grid/utils', () => ({
  escapeHtml: (value: string) => value,
  notifyBottomLine,
}));

describe('scenarios builder func creation fallback', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a default FUNC and inserts a call block when none exist yet', async () => {
    const { addFuncCall } = await import('./scenarios.builder-ops');

    const goalSection = document.createElement('div');
    goalSection.innerHTML = '<div class="steps-container"></div>';

    const setCurrentFuncSrc = vi.fn();
    const ctx = {
      dispatch: vi.fn(),
      renderGoalSelect: vi.fn(() => ''),
      libraryLoad: vi.fn(() => []),
      initializeDragAndDrop: vi.fn(),
      refreshBuilderOptions: vi.fn(),
      updatePreview: vi.fn(),
      renumberTaskLabels: vi.fn(),
      getCurrentFuncSrc: vi.fn(() => ''),
      setCurrentFuncSrc,
    } as any;

    await addFuncCall(ctx, goalSection);

    expect(setCurrentFuncSrc).toHaveBeenCalledWith(expect.stringContaining('FUNC: Nowa procedura'));
    expect(updateScenario).toHaveBeenCalledWith('ts-demo', { func: expect.stringContaining('FUNC: Nowa procedura') });
    expect(goalSection.querySelector('.func-call')?.textContent).toBe('Nowa procedura');
  });
});
