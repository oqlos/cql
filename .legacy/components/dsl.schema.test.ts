import { describe, expect, it } from 'vitest';

import { getJsonSchema, validateAst } from './dsl.schema';

describe('dsl.schema', () => {
  it('accepts the expanded DSL step surface used by the parser and serializers', () => {
    const result = validateAst({
      scenario: 'Schema Coverage',
      goals: [
        {
          name: 'Goal',
          tasks: [],
          conditions: [],
          steps: [
            { type: 'task', function: 'Wlacz', object: 'pompa 1', ands: [{ function: 'Ustaw', object: 'zawor 1' }] },
            { type: 'if', parameter: 'P1', operator: '!=', value: '0', unit: 'bar', connector: 'AND', incomingConnector: 'OR' },
            { type: 'else' },
            { type: 'get', parameter: 'P1', unit: 'bar' },
            { type: 'val', parameter: 'P1', unit: 'bar' },
            { type: 'set', parameter: 'P1', value: '1', unit: 'bar' },
            { type: 'max', parameter: 'P1', value: '2', unit: 'bar' },
            { type: 'min', parameter: 'P1', value: '0.5', unit: 'bar' },
            { type: 'delta_max', parameter: 'P1', value: '0.2', unit: 'bar', per: 's' },
            { type: 'delta_min', parameter: 'P1', value: '0.1', unit: 'bar', per: 's' },
            { type: 'wait', duration: '5', unit: 's' },
            { type: 'pump', value: '1', unit: 'bar', raw: '1 bar' },
            { type: 'sample', parameter: 'P1', state: 'START', interval: '100 ms' },
            { type: 'calc', result: 'AVG_P1', function: 'AVG', input: 'P1' },
            { type: 'fun', result: 'FLOW', expression: '[P1] + [P2]', variables: ['P1', 'P2'] },
            { type: 'log', message: 'Log entry' },
            { type: 'alarm', message: 'Alarm entry' },
            { type: 'error', message: 'Error entry' },
            { type: 'save', parameter: 'P1' },
            { type: 'user', action: 'CONFIRM', message: 'Potwierdz' },
            { type: 'result', status: 'OK' },
            { type: 'opt', parameter: 'MODE', description: 'Tryb testu' },
            { type: 'info', level: 'INFO', message: 'Informacja' },
            { type: 'repeat' },
            { type: 'dialog', parameter: 'P1', message: 'Kontynuowac?' },
            { type: 'out', outType: 'RESULT', value: 'OK' },
            { type: 'end' },
            { type: 'func_call', name: 'Setup', arguments: ['P1', 'P2'] },
          ],
        },
      ],
      funcs: [
        {
          name: 'Setup',
          tasks: [],
          steps: [
            { type: 'log', message: 'Preparing' },
          ],
        },
      ],
    });

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('accepts funcs-only asts and rejects empty scenarios', () => {
    const funcsOnly = validateAst({
      scenario: 'Func Only',
      goals: [],
      funcs: [
        {
          name: 'Helper',
          tasks: [],
          steps: [{ type: 'func_call', name: 'Setup' }],
        },
      ],
    });
    const empty = validateAst({ scenario: 'Empty', goals: [] });

    expect(funcsOnly.ok).toBe(true);
    expect(empty.ok).toBe(false);
    expect(empty.errors).toContain('goals: At least one goal or func is required');
  });

  it('exports json schema with funcs support and updated operators', () => {
    const schema = getJsonSchema() as {
      properties: Record<string, any>;
      anyOf: Array<Record<string, any>>;
    };

    expect(schema.properties.funcs).toBeDefined();
    expect(schema.anyOf[1].required).toContain('funcs');
    expect(JSON.stringify(schema)).toContain('!=');
    expect(JSON.stringify(schema)).toContain('func_call');
  });
});