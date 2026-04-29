/** @vitest-environment jsdom */

import { describe, expect, it } from 'vitest';

import { migrateLegacyXmlToDsl, splitLegacyXmlToScenarios } from './dsl.migrate.xml';

const LEGACY_REPORT_XML = `
  <data>
    <var id="dt#name">Device A</var>
    <var id="dt#tr#1#name">Leak Test</var>
    <var id="dt#tr#1#op#1#name">Open Valve</var>
    <var id="dt#tr#1#op#1#dspl#1">Włącz pompę</var>
    <var id="dt#tr#1#op#1#dspl#2">Otwórz zawór</var>
    <var id="dt#tr#1#op#2#name">Wait Stage</var>
    <var id="dt#tr#2#name">Vacuum Test</var>
    <var id="dt#tr#2#op#1#name">Check Pressure</var>
    <var id="dt#tr#2#op#1#dspl#1">Sprawdź ciśnienie</var>
  </data>
`;

const LEGACY_REPORT_XML_WITHOUT_DEVICE = `
  <data>
    <var id="dt#tr#1#name">Leak Test</var>
    <var id="dt#tr#1#op#1#name">Open Valve</var>
  </data>
`;

describe('dsl.migrate.xml legacy report migration', () => {
  it('splits legacy report XML into one scenario per transaction', () => {
    const scenarios = splitLegacyXmlToScenarios(LEGACY_REPORT_XML);

    expect(scenarios).toHaveLength(2);
    expect(scenarios[0].name).toBe('Device A Leak Test');
    expect(scenarios[0].ast.goals.map((goal) => goal.name)).toEqual(['Open Valve', 'Wait Stage']);
    expect(scenarios[0].ast.goals[0].steps).toEqual([
      { type: 'task', function: 'Włącz pompę', ands: [] },
      { type: 'task', function: 'Otwórz zawór', ands: [] },
    ]);
    expect(scenarios[0].ast.goals[1].steps).toEqual([
      { type: 'task', function: 'Wait Stage', ands: [] },
    ]);
    expect(scenarios[1].name).toBe('Device A Vacuum Test');
    expect(scenarios[1].ast.goals.map((goal) => goal.name)).toEqual(['Check Pressure']);
    expect(scenarios[1].dsl).toContain('SCENARIO: Device A Vacuum Test');
    expect(scenarios[1].dsl).toContain('GOAL: Check Pressure');
  });

  it('migrates legacy report XML preview from the first transaction only', () => {
    const migrated = migrateLegacyXmlToDsl(LEGACY_REPORT_XML, 'Fallback');

    expect(migrated.ok).toBe(true);
    expect(migrated.name).toBe('Fallback');
    expect(migrated.ast?.scenario).toBe('Device A Leak Test');
    expect(migrated.ast?.goals.map((goal) => goal.name)).toEqual(['Open Valve', 'Wait Stage']);
    expect(migrated.dsl).toContain('SCENARIO: Device A Leak Test');
    expect(migrated.dsl).toContain('GOAL: Open Valve');
    expect(migrated.dsl).not.toContain('Vacuum Test');
  });

  it('uses the name hint as device fallback for multi-scenario splitting', () => {
    const scenarios = splitLegacyXmlToScenarios(LEGACY_REPORT_XML_WITHOUT_DEVICE, 'Fallback Device');
    const migrated = migrateLegacyXmlToDsl(LEGACY_REPORT_XML_WITHOUT_DEVICE, 'Fallback Device');

    expect(scenarios).toHaveLength(1);
    expect(scenarios[0].name).toBe('Fallback Device Leak Test');
    expect(migrated.ok).toBe(true);
    expect(migrated.ast?.scenario).toBe('Leak Test');
  });
});