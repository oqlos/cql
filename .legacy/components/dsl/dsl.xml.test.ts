/** @vitest-environment jsdom */

import { describe, expect, it } from 'vitest';

import { astToXml, xmlToAst } from './dsl.xml';
import type { DslAst } from './dsl.types';

describe('dsl.xml', () => {
  it('round-trips structured goals and funcs through XML', () => {
    const ast: DslAst = {
      scenario: `Scenario & "XML"`,
      goals: [{
        name: 'Goal A',
        tasks: [],
        conditions: [],
        steps: [
          { type: 'task', function: 'Open', object: 'valve 1', ands: [{ function: 'Close', object: 'valve 2' }] },
          { type: 'if', parameter: 'ciśnienie', operator: '!=', value: '3', unit: 'mbar' },
          { type: 'else', actionType: 'INFO', actionMessage: 'fallback' },
          { type: 'get', parameter: 'ciśnienie', unit: 'mbar' },
          { type: 'val', parameter: 'temperatura', unit: '°C' },
          { type: 'set', parameter: 'czas', value: '5', unit: 's' },
          { type: 'max', parameter: 'ciśnienie', value: '25', unit: 'mbar' },
          { type: 'min', parameter: 'ciśnienie', value: '3', unit: 'mbar' },
          { type: 'delta_max', parameter: 'ciśnienie', value: '2', unit: 'mbar', per: '1 s' },
          { type: 'delta_min', parameter: 'ciśnienie', value: '1', unit: 'mbar', per: '1 s' },
          { type: 'wait', duration: '1.5', unit: 's' },
          { type: 'pump', value: '5', unit: 'bar', raw: '5 bar' },
          { type: 'sample', parameter: 'ciśnienie', state: 'START', interval: '100 ms' },
          { type: 'calc', result: 'średnia', function: 'AVG', input: 'ciśnienie' },
          { type: 'fun', result: 'wynik', expression: '"ciśnienie" + 2', variables: ['ciśnienie'] },
          { type: 'log', message: 'Start' },
          { type: 'alarm', message: 'Alarm' },
          { type: 'error', message: 'Błąd' },
          { type: 'save', parameter: 'ciśnienie' },
          { type: 'func_call', name: 'helper', arguments: ['zawór 14', 'tryb auto'] },
          { type: 'user', action: 'confirm', message: 'Kontynuować' },
          { type: 'result', status: 'OK' },
          { type: 'opt', parameter: 'tryb', description: 'Auto' },
          { type: 'info', level: 'INFO', message: 'Informacja' },
          { type: 'repeat' },
          { type: 'dialog', parameter: 'tryb', message: 'Wybierz opcję' },
          { type: 'out', outType: 'RESULT', value: 'OK' },
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

    const xml = astToXml(ast);

    expect(xml).toContain('<func name="helper">');
    expect(xml).toContain('<func_call name="helper">');
    expect(xml).toContain('<wait duration="1.5" unit="s"/>');
    expect(xml).toContain('<pump value="5" unit="bar" raw="5 bar"/>');

    const parsed = xmlToAst(xml);

    expect(parsed).toEqual({ ok: true, ast });
  });

  it('rejects malformed xml documents', () => {
    expect(xmlToAst('<dsl><goal></dsl>')).toEqual({
      ok: false,
      errors: ['Invalid XML document'],
    });
  });
});