/** @vitest-environment jsdom */

import { describe, expect, it } from 'vitest';

import {
  DSL_CONSOLE_CLEARED_HTML,
  DSL_NO_RESULT_HTML,
  DSL_RUNTIME_INIT_HTML,
  DSL_TOOLS_LOAD_ERROR_HTML,
  renderRuntimeErrorStatus,
  renderRuntimeSuccessStatus,
  resolveDslResultHtml,
  resolveExecutionErrorHtml,
  setElementHtml,
  shouldSkipRuntimeRefresh,
} from './def-integration.runtime';

describe('def-integration.runtime', () => {
  it('skips runtime refresh only when DSL content is unchanged and output is already initialized', () => {
    expect(shouldSkipRuntimeRefresh('GOAL: A', 'GOAL: A', '<div>ready</div>')).toBe(true);
    expect(shouldSkipRuntimeRefresh('GOAL: A', 'GOAL: A', DSL_RUNTIME_INIT_HTML)).toBe(false);
    expect(shouldSkipRuntimeRefresh('GOAL: A', 'GOAL: B', '<div>ready</div>')).toBe(false);
  });

  it('resolves default result and execution error HTML', () => {
    expect(resolveDslResultHtml('')).toBe(DSL_NO_RESULT_HTML);
    expect(resolveDslResultHtml('ok')).toBe('ok');
    expect(resolveExecutionErrorHtml('boom')).toBe('<div class="text-danger">❌ Błąd: boom</div>');
    expect(DSL_TOOLS_LOAD_ERROR_HTML).toContain('❌ Błąd ładowania DSL Tools');
    expect(DSL_CONSOLE_CLEARED_HTML).toContain('📄 Konsola wyczyszczona');
  });

  it('updates element HTML and runtime success/error status styles', () => {
    const output = document.createElement('div');
    const status = document.createElement('div');

    setElementHtml(output, 'rendered');
    expect(output.innerHTML).toBe('rendered');

    renderRuntimeSuccessStatus(status, '12:00:00');
    expect(status.innerHTML).toBe('Status: ✅ Aktualny | Ostatnia aktualizacja: 12:00:00');
    expect(status.style.background).toBe('var(--badge-green-bg)');
    expect(status.style.color).toBe('var(--badge-green-text)');

    renderRuntimeErrorStatus(status, 'failure');
    expect(status.innerHTML).toBe('Status: ❌ Błąd | failure');
    expect(status.style.background).toBe('color-mix(in srgb, var(--danger) 15%, transparent)');
    expect(status.style.color).toBe('var(--danger)');
  });
});