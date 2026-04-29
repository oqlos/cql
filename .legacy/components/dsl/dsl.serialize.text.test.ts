import { describe, expect, it } from 'vitest';

import { astToDslText } from './dsl.serialize.text';
import type { DslAst } from './dsl.types';

describe('dsl.serialize.text', () => {
  it('serializes structured goals and funcs with canonical DSL forms', () => {
    const ast: DslAst = {
      scenario: 'Serializer Coverage',
      goals: [{
        name: 'Goal A',
        tasks: [],
        conditions: [],
        steps: [
          { type: 'func_call', name: 'helper', arguments: ['zawór 14'] },
          { type: 'get', parameter: 'ciśnienie', unit: 'mbar' },
          { type: 'if', parameter: 'ciśnienie', operator: '!=', value: '3', unit: 'mbar' },
          { type: 'set', parameter: 'czas', value: '5', unit: 's' },
          { type: 'max', parameter: 'ciśnienie', value: '25', unit: 'mbar' },
          { type: 'min', parameter: 'ciśnienie', value: '3', unit: 'mbar' },
          { type: 'delta_max', parameter: 'ciśnienie', value: '2', unit: 'mbar', per: '1 s' },
          { type: 'delta_min', parameter: 'ciśnienie', value: '1', unit: 'mbar', per: '1 s' },
          { type: 'val', parameter: 'temperatura', unit: '°C' },
          { type: 'wait', duration: '1.5', unit: 's' },
          { type: 'pump', value: '5', unit: 'bar', raw: '5 bar' },
          { type: 'sample', parameter: 'ciśnienie', state: 'START', interval: '100 ms' },
          { type: 'calc', result: 'średnia', function: 'AVG', input: 'ciśnienie' },
          { type: 'fun', result: 'wynik', expression: '"ciśnienie" + 2', variables: ['ciśnienie'] },
          { type: 'log', message: `O'Brien` },
          { type: 'save', parameter: 'ciśnienie' },
          { type: 'user', action: 'confirm', message: 'Kontynuować' },
          { type: 'result', status: 'OK' },
          { type: 'opt', parameter: 'tryb', description: 'Auto' },
          { type: 'info', level: 'INFO', message: 'Informacja' },
          { type: 'repeat' },
          { type: 'dialog', parameter: 'tryb', message: `Don't continue` },
          { type: 'out', outType: 'RESULT', value: 'OK' },
          { type: 'else', actionType: 'INFO', actionMessage: 'fallback' },
          { type: 'end' },
        ],
      }],
      funcs: [{
        name: 'helper',
        tasks: [],
        steps: [
          { type: 'set', parameter: 'pompa 1', value: '1' },
          { type: 'wait', duration: '1', unit: 's' },
        ],
      }],
    };

    const text = astToDslText(ast);

    expect(text).toContain('SCENARIO: Serializer Coverage');
    expect(text).toContain(`FUNC 'helper' 'zawór 14'`);
    expect(text).toContain(`GET 'ciśnienie' 'mbar'`);
    expect(text).toContain(`IF 'ciśnienie' != '3 mbar'`);
    expect(text).toContain(`SET 'WAIT' '1.5 s'`);
    expect(text).toContain(`SET 'POMPA' '5 bar'`);
    expect(text).toContain(`SAMPLE 'ciśnienie' 'START' '100 ms'`);
    expect(text).toContain(`CALC 'średnia' = 'AVG' 'ciśnienie'`);
    expect(text).toContain(`FUN 'wynik' = 'ciśnienie' + 2`);
    expect(text).toContain(`LOG "O'Brien"`);
    expect(text).toContain(`DIALOG 'tryb' "Don't continue"`);
    expect(text).toContain('FUNC: helper');
    expect(text).toContain(`SET 'pompa 1' '1'`);
  });

  it('falls back to legacy task and condition serialization when steps are absent', () => {
    const text = astToDslText({
      scenario: 'Legacy',
      goals: [{
        name: 'Goal A',
        tasks: [{ function: 'Włącz', object: 'pompa 1' }],
        conditions: [{ type: 'if', parameter: 'ciśnienie', operator: '>', value: '1', unit: 'mbar' }],
      } as any],
    });

    expect(text).toContain(`SET 'pompa 1' '1'`);
    expect(text).toContain(`IF 'ciśnienie' > '1 mbar'`);
  });
});