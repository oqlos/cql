import { describe, expect, it } from 'vitest';

import { executeDsl } from './dsl.exec';
import { parseDsl } from './dsl.parser';

describe('dsl.parser motor move', () => {
  it('parses motor2 left/right shorthand', () => {
    const text = [
      'SCENARIO: Motor',
      'GOAL: Move',
      '  motor2 left 1000',
      '  wait 1s',
      '  motor2 right 100',
    ].join('\n');

    const parsed = parseDsl(text);
    expect(parsed.ok).toBe(true);
    expect(parsed.errors).toEqual([]);
    const steps = parsed.ast?.goals?.[0]?.steps ?? [];
    expect(steps).toEqual([
      { type: 'task', function: 'left', object: 'motor2', ands: [], args: { steps: 1000, direction: 'left' } },
      { type: 'wait', duration: '1', unit: 's' },
      { type: 'task', function: 'right', object: 'motor2', ands: [], args: { steps: 100, direction: 'right' } },
    ]);
  });

  it('executes motor2 sequence into hardware task plan', () => {
    const text = [
      'SCENARIO: Motor',
      'GOAL: Move',
      '  motor2 left 1000',
      '  wait 1s',
      '  motor2 right 100',
    ].join('\n');

    const result = executeDsl(text);
    expect(result.ok).toBe(true);
    expect(result.plan?.map((p) => p.kind)).toEqual(['goal', 'task', 'wait', 'task']);
    const firstTask = (result.plan?.[1] as { task?: Record<string, unknown> })?.task;
    expect(firstTask).toMatchObject({
      object: 'motor2',
      function: 'left',
      args: { steps: 1000, direction: 'left' },
    });
  });
});
