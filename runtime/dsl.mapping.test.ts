import { describe, expect, it } from 'vitest';

import { executeMappedDsl, resolveBuiltinMotorTask, resolveFuncSteps, resolveTaskMapping } from './dsl.mapping';

const MOTOR_MAP = {
  runtimeConfig: {
    motor2: {
      peripheralId: 'motor-tic249',
      maxStepsPerSecond: 1000,
      defaultSpeedStepsPerSecond: 1000,
      speedUnit: 'steps/s',
      accelerationPercentPerSecond: 50,
      accelerationUnit: '%/s',
    },
  },
  objectActionMap: {
    motor2: {
      left: {
        kind: 'api',
        environment: 'lab',
        usageMode: 'diagnostic',
        body: { peripheral_id: 'motor-tic249', command: 'move_relative' },
        args: { direction: 'left', steps: 1000, offset: -1000 },
      },
    },
  },
  actions: {},
  funcImplementations: {
    'test-func': {
      steps: [{ object: 'motor2', action: 'left' }],
    },
  },
  paramSensorMap: {},
};

describe('dsl.mapping', () => {
  it('resolves motor2 left from objectActionMap', () => {
    const result = resolveTaskMapping(
      MOTOR_MAP,
      { function: 'left', object: 'motor2', args: { steps: 500, direction: 'left' } },
      { environment: 'lab', usageMode: 'diagnostic' },
    );
    expect(result.ok).toBe(true);
    expect(result.mapping?.body).toMatchObject({ command: 'move_relative' });
    expect(result.mapping?.args).toMatchObject({ steps: 500, offset: -500 });
  });

  it('falls back to builtin motor mapping when MAP entry missing', () => {
    const builtin = resolveBuiltinMotorTask('motor2', 'right', { args: { steps: 200 } });
    expect(builtin?.body).toMatchObject({ command: 'move_relative' });
    expect(builtin?.args).toMatchObject({ steps: 200, offset: 200, direction: 'right' });
  });

  it('resolves FUNC steps like map-editor resolve-func API', () => {
    const result = resolveFuncSteps(MOTOR_MAP, 'test-func', { environment: 'lab', usageMode: 'diagnostic' });
    expect(result.ok).toBe(true);
    const steps = result.steps as Array<{ resolved: boolean; binding: Record<string, unknown> | null }>;
    expect(steps).toHaveLength(1);
    expect(steps[0].resolved).toBe(true);
    expect(steps[0].binding?.body).toMatchObject({ command: 'move_relative' });
  });

  it('exec-mapped enriches DSL plan with hardware bindings', () => {
    const dsl = ['SCENARIO: Motor', 'GOAL: Move', '  motor2 left 1000'].join('\n');
    const result = executeMappedDsl(dsl, MOTOR_MAP, { environment: 'lab', usageMode: 'diagnostic' });
    expect(result.ok).toBe(true);
    const mapped = result.mappedPlan ?? [];
    expect(mapped.some((s) => s.kind === 'task' && s.mapping?.body)).toBe(true);
  });
});
