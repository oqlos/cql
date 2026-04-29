import { describe, expect, it, vi } from 'vitest';

import {
  extractScenarioDefCode,
  importDefFromDatabase,
  loadScenarioDef,
  saveScenarioDef,
} from './def-integration.persistence';

describe('def-integration.persistence', () => {
  it('extracts DEF code from the first populated scenario location', () => {
    expect(extractScenarioDefCode({ def: 'top-level' })).toBe('top-level');
    expect(extractScenarioDefCode({ def: '', content: { def: 'content-def' } })).toBe('content-def');
    expect(extractScenarioDefCode({ data: { def: 'data-def' } })).toBe('data-def');
    expect(extractScenarioDefCode({ def: '   ', content: { def: 'content-def' } })).toBe('   ');
    expect(extractScenarioDefCode(null)).toBe('');
  });

  it('loads scenario DEF into the editor and updates the DEF library cache', async () => {
    const fetchScenario = vi.fn().mockResolvedValue({ content: { def: 'DEF: loaded' } });
    const applyDefSourceUiState = vi.fn();
    const setDefCode = vi.fn();
    const updateDefLibraryFromCode = vi.fn();
    const generateDefaultDef = vi.fn();

    await loadScenarioDef({
      scenarioId: 'sc-1',
      hasEditor: true,
      fetchScenario,
      applyDefSourceUiState,
      setDefCode,
      updateDefLibraryFromCode,
      generateDefaultDef,
    });

    expect(fetchScenario).toHaveBeenCalledWith('sc-1');
    expect(applyDefSourceUiState).toHaveBeenCalledWith(true);
    expect(setDefCode).toHaveBeenCalledWith('DEF: loaded');
    expect(updateDefLibraryFromCode).toHaveBeenCalledWith('DEF: loaded');
    expect(generateDefaultDef).not.toHaveBeenCalled();
  });

  it('falls back to generating the default DEF when the scenario has no DEF', async () => {
    const applyDefSourceUiState = vi.fn();
    const generateDefaultDef = vi.fn();

    await loadScenarioDef({
      scenarioId: 'sc-1',
      hasEditor: true,
      fetchScenario: vi.fn().mockResolvedValue({ content: { def: '' } }),
      applyDefSourceUiState,
      setDefCode: vi.fn(),
      updateDefLibraryFromCode: vi.fn(),
      generateDefaultDef,
    });

    expect(applyDefSourceUiState).toHaveBeenCalledWith(false);
    expect(generateDefaultDef).toHaveBeenCalledOnce();
  });

  it('generates the default DEF when scenario loading fails', async () => {
    const onError = vi.fn();
    const generateDefaultDef = vi.fn();
    const error = new Error('boom');

    await loadScenarioDef({
      scenarioId: 'sc-1',
      hasEditor: true,
      fetchScenario: vi.fn().mockRejectedValue(error),
      applyDefSourceUiState: vi.fn(),
      setDefCode: vi.fn(),
      updateDefLibraryFromCode: vi.fn(),
      generateDefaultDef,
      onError,
    });

    expect(onError).toHaveBeenCalledWith(error);
    expect(generateDefaultDef).toHaveBeenCalledOnce();
  });

  it('saves DEF, dispatches CQRS update, refreshes the builder, and notifies success', async () => {
    const updateScenario = vi.fn().mockResolvedValue(undefined);
    const notify = vi.fn();
    const dispatchScenarioDefUpdate = vi.fn();
    const updateDefLibraryFromCode = vi.fn();
    const refreshSelectlists = vi.fn();
    const createExecContextFromDef = vi.fn();
    const loadDslModule = vi.fn().mockResolvedValue({ createExecContextFromDef });

    await saveScenarioDef({
      scenarioId: 'sc-1',
      defCode: 'DEF: saved',
      updateScenario,
      notify,
      dispatchScenarioDefUpdate,
      updateDefLibraryFromCode,
      refreshSelectlists,
      loadDslModule,
    });

    expect(updateScenario).toHaveBeenCalledWith('sc-1', { def: 'DEF: saved' });
    expect(dispatchScenarioDefUpdate).toHaveBeenCalledWith({
      type: 'UpdateScenarioDEF',
      scenarioId: 'sc-1',
      def: 'DEF: saved',
    });
    expect(updateDefLibraryFromCode).toHaveBeenCalledWith('DEF: saved');
    expect(loadDslModule).toHaveBeenCalledOnce();
    expect(createExecContextFromDef).toHaveBeenCalledWith('DEF: saved');
    expect(refreshSelectlists).toHaveBeenCalledOnce();
    expect(notify).toHaveBeenNthCalledWith(1, '✅ DEF zapisany do scenariusza', 'success');
    expect(notify).toHaveBeenNthCalledWith(2, '🔄 Builder odświeżony z nowymi opcjami DEF', 'success');
  });

  it('reports missing scenario id before attempting save', async () => {
    const notify = vi.fn();

    await saveScenarioDef({
      scenarioId: '',
      defCode: 'DEF: saved',
      updateScenario: vi.fn(),
      notify,
      updateDefLibraryFromCode: vi.fn(),
      refreshSelectlists: vi.fn(),
    });

    expect(notify).toHaveBeenCalledWith('❌ Brak ID scenariusza', 'error');
  });

  it('keeps the save successful even when the builder refresh step fails', async () => {
    const notify = vi.fn();
    const refreshError = new Error('refresh failed');
    const onRefreshError = vi.fn();

    await saveScenarioDef({
      scenarioId: 'sc-1',
      defCode: 'DEF: saved',
      updateScenario: vi.fn().mockResolvedValue(undefined),
      notify,
      updateDefLibraryFromCode: vi.fn(),
      refreshSelectlists: vi.fn(),
      loadDslModule: vi.fn().mockRejectedValue(refreshError),
      onRefreshError,
    });

    expect(onRefreshError).toHaveBeenCalledWith(refreshError);
    expect(notify).toHaveBeenCalledWith('✅ DEF zapisany do scenariusza', 'success');
    expect(notify).not.toHaveBeenCalledWith('❌ Błąd podczas zapisywania DEF', 'error');
  });

  it('notifies about save errors', async () => {
    const notify = vi.fn();
    const onError = vi.fn();
    const error = new Error('save failed');

    await saveScenarioDef({
      scenarioId: 'sc-1',
      defCode: 'DEF: saved',
      updateScenario: vi.fn().mockRejectedValue(error),
      notify,
      updateDefLibraryFromCode: vi.fn(),
      refreshSelectlists: vi.fn(),
      onError,
    });

    expect(onError).toHaveBeenCalledWith(error);
    expect(notify).toHaveBeenCalledWith('❌ Błąd podczas zapisywania DEF', 'error');
  });

  it('switches to DB source, refreshes selectlists, and schedules DEF regeneration on import', () => {
    const setSourceOverride = vi.fn();
    const refreshSelectlists = vi.fn();
    const generateDefaultDef = vi.fn();
    const notify = vi.fn();
    const schedule = vi.fn((callback: () => void) => {
      callback();
      return 1;
    });

    importDefFromDatabase({
      hasEditor: true,
      setSourceOverride,
      refreshSelectlists,
      generateDefaultDef,
      notify,
      schedule,
    });

    expect(setSourceOverride).toHaveBeenCalledWith('DB');
    expect(refreshSelectlists).toHaveBeenCalledOnce();
    expect(schedule).toHaveBeenCalledWith(expect.any(Function), 500);
    expect(generateDefaultDef).toHaveBeenCalledOnce();
    expect(notify).toHaveBeenCalledWith('📥 Zaimportowano dane z bazy', 'success');
  });

  it('reports import failures', () => {
    const notify = vi.fn();
    const onError = vi.fn();
    const error = new Error('refresh failed');

    importDefFromDatabase({
      hasEditor: true,
      setSourceOverride: vi.fn(() => {
        throw error;
      }),
      refreshSelectlists: vi.fn(),
      generateDefaultDef: vi.fn(),
      notify,
      onError,
    });

    expect(onError).toHaveBeenCalledWith(error);
    expect(notify).toHaveBeenCalledWith('❌ Błąd podczas importu z bazy', 'error');
  });
});