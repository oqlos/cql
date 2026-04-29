import { describe, expect, it } from 'vitest';

import { parseFuncDefinitions } from './dsl-func.parser';

describe('dsl-func.parser', () => {
  it('parses supported FUNC step forms into typed steps', () => {
    const library = parseFuncDefinitions(`
FUNC: Mixed
  TASK [Włącz] [pompa 1]
  SET [czas] = [10 s]
  MIN [ciśnienie] = [1]
  MAX [ciśnienie] = [3]
  VAL [ciśnienie] [bar]
  IF [ciśnienie] >= [2]
  WAIT [ciśnienie] = [2]
  SAVE [ciśnienie]
  ERROR [Błąd testowy]
  ALARM [Alarm testowy]
  LOG [Log testowy]
  STOP [Zatrzymane]
  PAUSE [Potwierdź]
  WAIT [500 ms]
`);

    const steps = library.Mixed?.steps || [];

    expect(steps.map((step) => step.type)).toEqual([
      'TASK', 'SET', 'MIN', 'MAX', 'VAL', 'IF', 'WAIT', 'SAVE', 'ERROR', 'ALARM', 'LOG', 'STOP', 'PAUSE', 'WAIT',
    ]);
    expect(steps[0]).toEqual({
      type: 'TASK',
      raw: 'TASK [Włącz] [pompa 1]',
      parsed: { action: 'Włącz', object: 'pompa 1' },
    });
    expect(steps[1].parsed).toEqual({ variable: 'czas', value: '10', unit: 's' });
    expect(steps[4].parsed).toEqual({ variable: 'ciśnienie', unit: 'bar' });
    expect(steps[5].parsed).toEqual({ condition: 'ciśnienie >= 2' });
    expect(steps[6].parsed).toEqual({ variable: 'ciśnienie', value: '2' });
    expect(steps[11].parsed).toEqual({ message: 'Zatrzymane' });
    expect(steps[12].parsed).toEqual({ message: 'Potwierdź' });
    expect(steps[13].parsed).toEqual({ value: '500 ms' });
  });

  it('skips comments and unsupported lines while preserving default STOP and PAUSE messages', () => {
    const library = parseFuncDefinitions(`
# comment
FUNC: Control
  UNKNOWN [ignored]
  STOP
  PAUSE
  WAIT [2 s]
`);

    expect(library.Control?.steps).toEqual([
      { type: 'STOP', raw: 'STOP', parsed: { message: 'Stopped' } },
      { type: 'PAUSE', raw: 'PAUSE', parsed: { message: '' } },
      { type: 'WAIT', raw: 'WAIT [2 s]', parsed: { value: '2 s' } },
    ]);
  });

  it('stores multiple FUNC definitions independently', () => {
    const library = parseFuncDefinitions(`
FUNC: First
  LOG [One]

FUNC: Second
  SAVE [wynik]
`);

    expect(Object.keys(library)).toEqual(['First', 'Second']);
    expect(library.First.steps).toEqual([
      { type: 'LOG', raw: 'LOG [One]', parsed: { message: 'One' } },
    ]);
    expect(library.Second.steps).toEqual([
      { type: 'SAVE', raw: 'SAVE [wynik]', parsed: { variable: 'wynik' } },
    ]);
  });
});