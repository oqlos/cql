import { describe, expect, it } from 'vitest';

import { parseDsl } from '../components/dsl/dsl.parser';
import { astToDslText } from '../components/dsl/dsl.serialize.text';
import { validateDslFormat } from '../components/dsl/dsl.validator';

describe('DSL single-quote support', () => {
  it('parses single-quoted SET and IF lines', () => {
    const result = parseDsl([
      'SCENARIO: single-quote',
      'GOAL: Demo',
      "  SET 'pompa 1' '1'",
      "  IF 'Czujnik Ciśnienia 1' > '1 mbar'",
    ].join('\n'));

    expect(result.ok).toBe(true);
    expect(result.ast.goals[0]?.steps).toEqual([
      { type: 'set', parameter: 'pompa 1', value: '1' },
      { type: 'if', parameter: 'Czujnik Ciśnienia 1', operator: '>', value: '1 mbar' },
    ]);
  });

  it('serializes AST using canonical single quotes', () => {
    const parsed = parseDsl([
      'SCENARIO: serializer',
      'GOAL: Demo',
      '  SET "zawór 1" "1"',
      '  IF "ciśnienie" > "0.5 bar"',
    ].join('\n'));

    expect(parsed.ok).toBe(true);
    expect(astToDslText(parsed.ast)).toContain("SET 'zawór 1' '1'");
    expect(astToDslText(parsed.ast)).toContain("IF 'ciśnienie' > '0.5 bar'");
  });

  it('autofixes deprecated IF operator brackets to canonical single quotes', () => {
    const result = validateDslFormat([
      'GOAL: Demo',
      "  IF 'ciśnienie' [>] '0.5 bar'",
    ].join('\n'));

    expect(result.warnings).not.toHaveLength(0);
    expect(result.fixedText).toContain("IF 'ciśnienie' > '0.5 bar'");
  });
});