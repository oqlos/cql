import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getCurrentDslExecContext, runDslConsoleWithLoader } from './def-integration.dsl-runner';

describe('def-integration.dsl-runner', () => {
  beforeEach(() => {
    delete (globalThis as any).__currentExecCtx;
  });

  it('reads the current DSL execution context from global state', () => {
    expect(getCurrentDslExecContext()).toBeUndefined();

    (globalThis as any).__currentExecCtx = { scenarioId: 'sc-1' };

    expect(getCurrentDslExecContext()).toEqual({ scenarioId: 'sc-1' });
  });

  it('loads DslTools through the provided loader and passes the current context', async () => {
    const runDslConsole = vi.fn().mockReturnValue('<div>ok</div>');
    const loader = vi.fn().mockResolvedValue({
      DslTools: { runDslConsole },
    });
    (globalThis as any).__currentExecCtx = { deviceId: 'dev-1' };

    const result = await runDslConsoleWithLoader('GOAL: Test', loader);

    expect(result).toBe('<div>ok</div>');
    expect(loader).toHaveBeenCalledOnce();
    expect(runDslConsole).toHaveBeenCalledWith('GOAL: Test', { deviceId: 'dev-1' });
  });
});