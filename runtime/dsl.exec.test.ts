import { describe, expect, it } from 'vitest';

import { executeAst } from './dsl.exec';
import type { DslAst, DslStep } from './dsl.types';

function buildAst(steps: Array<DslStep | any>): DslAst {
  return {
    scenario: 'execution-helpers',
    goals: [{ name: 'Exercise helpers', tasks: [], conditions: [], steps }],
  };
}

describe('dsl.exec executeAst', () => {
  it('applies unit-aware comparisons and numeric transforms through execution helpers', () => {
    const exec = executeAst(buildAst([
      { type: 'set', parameter: 'pressure', value: '500', unit: 'mbar' },
      { type: 'max', parameter: 'pressure', value: '1000', unit: 'mbar' },
      { type: 'min', parameter: 'pressure', value: '200', unit: 'mbar' },
      { type: 'if', parameter: 'pressure', operator: '=', value: '0.2', unit: 'bar' },
      { type: 'fun', result: 'computed', expression: 'ABS([pressure] - 50) + POW(2, 3)', variables: ['pressure'] },
      { type: 'calc', result: 'avgPressure', function: 'AVG', input: 'pressure' },
    ] as any));

    expect(exec.ok).toBe(true);
    expect(exec.plan).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'var', action: 'MAX', parameter: 'pressure', value: 1000 }),
      expect.objectContaining({ kind: 'var', action: 'MIN', parameter: 'pressure', value: 200 }),
      expect.objectContaining({ kind: 'condition', passed: true }),
      expect.objectContaining({ kind: 'fun', result: 'computed', value: 158 }),
      expect.objectContaining({ kind: 'calc', result: 'avgPressure', value: 200 }),
    ]));
  });

  it('uses context-backed state for named literals, expressions, and aggregate fallbacks', () => {
    const exec = executeAst(
      buildAst([
        { type: 'val', parameter: 'pressure', unit: 'mbar' },
        { type: 'set', parameter: 'baseline', value: '750', unit: 'mbar' },
        { type: 'if', parameter: 'pressure', operator: '=', value: 'baseline' },
        { type: 'fun', result: 'rounded', expression: 'ROUND([pressure] / 10)', variables: ['pressure'] },
        { type: 'calc', result: 'pressureCount', function: 'COUNT', input: 'pressure' },
      ]),
      {
        getParamValue: (name: string) => (name === 'pressure' ? '750 mbar' : null),
      },
    );

    expect(exec.ok).toBe(true);
    expect(exec.plan).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'var', action: 'VAL', parameter: 'pressure', value: 750, unit: 'mbar' }),
      expect.objectContaining({ kind: 'condition', passed: true }),
      expect.objectContaining({ kind: 'fun', result: 'rounded', value: 75 }),
      expect.objectContaining({ kind: 'calc', result: 'pressureCount', value: 1 }),
    ]));
  });
});