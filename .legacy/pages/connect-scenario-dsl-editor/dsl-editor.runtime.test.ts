import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../modules/shared/generic-grid/utils', () => ({
  notifyBottomLine: vi.fn(),
}));

vi.mock('../../services/firmware-cqrs.service', () => ({
  FirmwareCQRS: {},
}));

vi.mock('../../components/dsl/dsl-tools', () => ({
  DslTools: {},
}));

import { updateFromProjection } from './dsl-editor.runtime';

function buildDom(): void {
  document.body.innerHTML = `
    <div id="dsl-run-status"></div>
    <div id="dsl-inline-run-status"></div>
    <div id="dsl-run-progress" style="width:0%"></div>
    <pre id="dsl-run-logs"></pre>
    <pre id="dsl-inline-terminal"></pre>
  `;
}

describe('updateFromProjection', () => {
  beforeEach(() => {
    buildDom();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('updates progress using the current firmware camelCase payload', () => {
    updateFromProjection({
      status: 'completed',
      progress: 100,
      steps: [
        "SET 'zawor 1' 'ON'",
        "SET 'PUMP' '5l'",
        "SET 'WAIT' '1s'",
      ],
      currentIndex: 2,
      scenarioId: 'ts-b346fa9d',
    });

    expect(document.getElementById('dsl-run-status')?.textContent).toBe('completed');
    expect(document.getElementById('dsl-inline-run-status')?.textContent).toBe('completed');
    expect((document.getElementById('dsl-run-progress') as HTMLElement).style.width).toBe('100%');
    expect(document.getElementById('dsl-run-logs')?.textContent).toContain('Zakończono: completed');
  });

  it('keeps supporting the legacy snake_case projection payload', () => {
    updateFromProjection({
      status: 'running',
      current_index: 1,
      total_steps: 4,
    });

    expect(document.getElementById('dsl-run-status')?.textContent).toBe('running');
    expect(parseFloat((document.getElementById('dsl-run-progress') as HTMLElement).style.width)).toBeCloseTo(50, 5);
  });
});