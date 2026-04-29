import { describe, expect, it } from 'vitest';

import { buildDefaultDefTemplate } from './def-integration.default-def';

describe('def-integration.default-def', () => {
  it('merges the current DEF library with the UI snapshot before generating the template', () => {
    const template = buildDefaultDefTemplate({
      scenarioId: 'sc-42',
      currentLibrary: {
        objects: ['pump'],
        functions: ['Start'],
        params: ['pressure'],
        units: ['bar'],
      },
      uiLibrarySnapshot: {
        objects: ['valve'],
        functions: ['Stop'],
        params: ['time'],
        units: ['s'],
      },
    });

    expect(template).toContain('// DSL Definition for scenario: sc-42');
    expect(template).toContain('"pump"');
    expect(template).toContain('"valve"');
    expect(template).toContain('"Start"');
    expect(template).toContain('"Stop"');
    expect(template).toContain('"pressure"');
    expect(template).toContain('"time"');
    expect(template).toContain('"bar"');
    expect(template).toContain('"s"');
  });

  it('preserves explicit object-function and param-unit mappings from the library', () => {
    const template = buildDefaultDefTemplate({
      scenarioId: 'sc-99',
      currentLibrary: {
        objects: ['pump'],
        params: ['pressure'],
        objectFunctionMap: {
          pump: { functions: ['Prime', 'Start'] },
        },
        paramUnitMap: {
          pressure: { units: ['mbar', 'bar'] },
        },
      },
      uiLibrarySnapshot: {
        objects: [],
        functions: [],
        params: [],
        units: [],
      },
    });

    expect(template).toContain('"pump": [');
    expect(template).toContain('"Prime"');
    expect(template).toContain('"Start"');
    expect(template).toContain('"pressure": [');
    expect(template).toContain('"mbar"');
    expect(template).toContain('"bar"');
  });

  it('falls back to the default object functions and param units when mappings are absent', () => {
    const template = buildDefaultDefTemplate({
      scenarioId: 'sc-default',
      currentLibrary: {},
      uiLibrarySnapshot: {
        objects: ['pump'],
        functions: ['Start'],
        params: ['timer'],
        units: ['s'],
      },
    });

    expect(template).toContain('"pump": [');
    expect(template).toContain('"Włącz"');
    expect(template).toContain('"Wyłącz"');
    expect(template).toContain('"timer": [');
    expect(template).toContain('"s"');
    expect(template).toContain('"min"');
  });
});