import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bindContainerUiEvents } from './scenarios.ui-container';
import { addGoal as addLibraryGoal } from '../../../pages/connect-scenario-library-editor/library-editor.crud';

describe('connect-scenario dialog interactions', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.stubGlobal('prompt', vi.fn(() => { throw new Error('prompt() is not supported.'); }));
    vi.stubGlobal('confirm', vi.fn(() => { throw new Error('confirm() is not supported.'); }));
    (globalThis as any).DialogService = {
      prompt: vi.fn().mockResolvedValue('Nowy GOAL'),
      confirm: vi.fn().mockResolvedValue(true),
    };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete (globalThis as any).DialogService;
  });

  it('adds a builder goal through DialogService when native prompt is unavailable', async () => {
    document.body.innerHTML = `
      <div id="container">
        <div class="goal-header">
          <select class="goal-select rounded-4">
            <option value="Istniejący">Istniejący</option>
          </select>
          <button type="button" class="btn btn-outline-primary btn-add-goal">+ Dodaj GOAL</button>
        </div>
      </div>
    `;

    const container = document.getElementById('container') as HTMLElement;
    bindContainerUiEvents(container, {
      updatePreview: vi.fn(),
      refreshBuilderOptions: vi.fn(),
      readScenarioIdFromUrl: vi.fn(() => 'ts-demo'),
    } as any);

    (container.querySelector('.btn-add-goal') as HTMLButtonElement).click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const select = container.querySelector('select.goal-select') as HTMLSelectElement;
    expect(Array.from(select.options).some((option) => option.value === 'Nowy GOAL')).toBe(true);
    expect(select.value).toBe('Nowy GOAL');
    expect((globalThis as any).DialogService.prompt).toHaveBeenCalled();
  });

  it('adds a library goal through DialogService when native prompt is unavailable', async () => {
    const renderGoals = vi.fn();
    const ctx = {
      defData: { library: { goals: [] } },
      renderList: vi.fn(),
      renderMappings: vi.fn(),
      renderFuncs: vi.fn(),
      renderGoals,
      scheduleAutosave: vi.fn(),
    } as any;

    await addLibraryGoal(ctx);

    expect(ctx.defData.library.goals).toEqual([{ name: 'Nowy GOAL', code: '' }]);
    expect(renderGoals).toHaveBeenCalledTimes(1);
    expect((globalThis as any).DialogService.prompt).toHaveBeenCalled();
  });
});
