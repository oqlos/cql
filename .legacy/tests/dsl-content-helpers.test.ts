import { describe, expect, it } from 'vitest';

import { dslFromScenarioContent, renderLegacyTaskAsDslLines } from '../components/dsl/dsl-content-helpers';

describe('renderLegacyTaskAsDslLines', () => {
  it('normalizes valve aliases and preserves off actions across chained tasks', () => {
    const lines = renderLegacyTaskAsDslLines({
      function: 'Włącz',
      object: 'bo 07',
      ands: [
        { function: 'Wyłącz', object: 'zawor 8' },
      ],
    });

    expect(lines).toEqual([
      "  SET 'zawór 7' '1'",
      "  SET 'zawór 8' '0'",
    ]);
  });

  it('renders timing aliases when the keyword appears in either slot', () => {
    expect(renderLegacyTaskAsDslLines({ function: 'WAIT', object: '1.5 s' })).toEqual([
      "  SET 'wait' '1.5 s'",
    ]);
    expect(renderLegacyTaskAsDslLines({ function: '750 ms', object: 'DELAY' })).toEqual([
      "  SET 'delay' '750 ms'",
    ]);
  });
});

describe('dslFromScenarioContent', () => {
  it('prefers embedded dsl and normalizes scenario header', () => {
    const text = dslFromScenarioContent({
      dsl: [
        'GOAL: Demo',
        "  SET 'pompa 1' '1'",
      ].join('\n'),
    }, 'Embedded');

    expect(text).toContain('SCENARIO: Embedded');
    expect(text).toContain("SET 'pompa 1' '1'");
  });

  it('keeps legacy ordering around the first off task', () => {
    const text = dslFromScenarioContent({
      goals: [{
        name: 'Demo',
        tasks: [
          { function: 'Włącz', object: 'pompa 1' },
          { function: 'Wyłącz', object: 'pompa 1' },
        ],
        variables: [{
          variables: [
            { action: 'GET', parameter: 'NC', unit: 'mbar' },
          ],
        }],
        conditions: [
          { type: 'if', parameter: 'NC', operator: '>', value: '1', unit: 'mbar' },
        ],
      }],
    }, 'Legacy');

    const lines = text.split('\n');
    const onIndex = lines.findIndex((line) => line.includes("SET 'pompa 1' '1'"));
    const getIndex = lines.findIndex((line) => line.includes("GET 'NC' 'mbar'"));
    const ifIndex = lines.findIndex((line) => line.includes("IF 'NC' > '1 mbar'"));
    const offIndex = lines.findIndex((line) => line.includes("SET 'pompa 1' '0'"));

    expect(onIndex).toBeGreaterThan(-1);
    expect(getIndex).toBeGreaterThan(onIndex);
    expect(ifIndex).toBeGreaterThan(getIndex);
    expect(offIndex).toBeGreaterThan(ifIndex);
  });
});