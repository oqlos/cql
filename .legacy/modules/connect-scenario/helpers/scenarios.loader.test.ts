import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../cqrs/helpers', () => ({
  loadScenario: vi.fn().mockResolvedValue(null),
}));

vi.mock('../cqrs/singleton', () => ({
  getScenarioCQRS: vi.fn(() => ({ getState: vi.fn(() => ({})) })),
}));

vi.mock('../../../components/dsl', () => ({
  createExecContextFromDef: vi.fn(() => ({ ok: true })),
}));

vi.mock('./scenarios.service', () => ({
  ScenariosService: {
    setCurrentScenarioId: vi.fn(),
  },
}));

describe('loadScenarioById library goal parsing', () => {
  beforeEach(() => {
    document.body.innerHTML = '<input id="scenario-name" /><div id="scenario-preview"></div><textarea id="scenario-func-editor"></textarea><div id="def-source-badge"></div><textarea id="scenario-def-editor"></textarea><textarea id="scenario-map-editor"></textarea>';
  });

  it('preserves structured library.goals steps when loading a saved scenario', async () => {
    const { loadScenarioById } = await import('./scenarios.loader');
    const renderBuilderFromData = vi.fn();

    await loadScenarioById('ts-demo', {
      parseDsl: vi.fn((text: string) => {
        if (text.includes('FUNC: Nowa procedura')) {
          return {
            ok: true,
            errors: [],
            ast: { funcs: [{ name: 'Nowa procedura', steps: [{ type: 'log', message: 'Procedura wykonana' }] }] },
          };
        }
        if (text.includes("FUNC 'Nowa procedura'")) {
          return { ok: true, errors: [], ast: { goals: [{ name: 'dsadas', steps: [{ type: 'func_call', name: 'Nowa procedura', arguments: [] }] }] } };
        }
        return { ok: true, errors: [], ast: { goals: [{ name: 'dsadas', steps: [] }] } };
      }),
      highlightDsl: vi.fn((text: string) => text),
      renderBuilderFromData,
      validateDsl: vi.fn(),
      updatePreview: vi.fn(),
      initializeDragAndDrop: vi.fn(),
      refreshBuilderOptions: vi.fn(),
      fetchScenarioFromDBById: vi.fn().mockResolvedValue({
        id: 'ts-demo',
        title: 'ddd',
        func: 'FUNC: Nowa procedura\n  LOG [Procedura wykonana]\n',
        library: JSON.stringify({
          goals: [
            { name: 'dsadas', steps: [{ type: 'func_call', name: 'Nowa procedura', arguments: [] }] },
          ],
        }),
      }),
      writeScenarioIdToUrl: vi.fn(),
      setLastScenarioName: vi.fn(),
      setAllowTitlePatch: vi.fn(),
      setCurrentExecCtx: vi.fn(),
      clearRenameTimer: vi.fn(),
    });

    expect(renderBuilderFromData).toHaveBeenCalledWith({
      name: 'ddd',
      goals: [
        expect.objectContaining({ name: 'dsadas', steps: [{ type: 'func_call', name: 'Nowa procedura', arguments: [] }] }),
      ],
      funcs: [expect.objectContaining({ name: 'Nowa procedura' })],
    });
  });
});
