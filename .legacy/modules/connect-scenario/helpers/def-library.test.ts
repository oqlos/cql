/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../utils/logger', () => ({
  logger: { warn: vi.fn() },
}));

import {
  buildObjectFunctionMap,
  buildParamUnitMap,
  extractCurrentFunctions,
  getUnitFromUi,
  updateDefLibraryFromCode,
} from './def-library';

describe('def-library helpers', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    delete (globalThis as any).__scenarioDefLibrary;
    delete (globalThis as any).__dslLibrarySourceOverride;
  });

  it('extracts unique function names from DOM and falls back to defaults when empty', () => {
    document.body.innerHTML = `
      <select class="function-select">
        <option value=" Ustaw ">Ustaw</option>
        <option value="Sprawdź">Sprawdź</option>
        <option value="Ustaw">Ustaw</option>
      </select>
    `;

    expect(extractCurrentFunctions()).toEqual(['Sprawdź', 'Ustaw']);

    document.body.innerHTML = '';

    const fallback = extractCurrentFunctions();
    expect(fallback).toContain('Włącz');
    expect(fallback).toContain('Odczytaj');
    expect(fallback).toHaveLength(7);
  });

  it('preserves explicit object-function mappings while inferring missing objects', () => {
    const mapping = buildObjectFunctionMap({
      library: {
        objectFunctionMap: {
          'pompa 1': { functions: ['Włącz', 'Wyłącz'] },
        },
        objects: ['pompa 1', 'zawór 1'],
        functions: ['Włącz', 'Wyłącz', 'Ustaw'],
      },
    });

    expect(mapping).toEqual({
      'pompa 1': ['Włącz', 'Wyłącz'],
      'zawór 1': ['Włącz', 'Wyłącz', 'Ustaw'],
    });
  });

  it('preserves explicit param-unit mappings while inferring missing params', () => {
    const mapping = buildParamUnitMap({
      library: {
        paramUnitMap: {
          ciśnienie: { units: ['mbar'], defaultUnit: 'mbar' },
        },
        params: ['ciśnienie', 'temperatura'],
        units: [{ code: 'mbar' }, { code: '°C' }],
      },
    });

    expect(mapping).toEqual({
      ciśnienie: { units: ['mbar'], defaultUnit: 'mbar' },
      temperatura: { units: ['mbar', '°C'] },
    });
  });

  it('updates the global DEF library from JS code and keeps explicit mappings intact', () => {
    const onRefresh = vi.fn();

    updateDefLibraryFromCode(`
      module.exports = {
        library: {
          objects: ['pompa 1', 'zawór 1'],
          functions: ['Włącz', 'Ustaw'],
          params: ['ciśnienie', 'temperatura'],
          units: ['mbar', '°C'],
          objectFunctionMap: {
            'pompa 1': { functions: ['Włącz'] }
          },
          paramUnitMap: {
            ciśnienie: { units: ['mbar'], defaultUnit: 'mbar' }
          }
        }
      };
    `, onRefresh);

    expect((globalThis as any).__dslLibrarySourceOverride).toBe('DEF');
    expect((globalThis as any).__scenarioDefLibrary.objectFunctionMap).toEqual({
      'pompa 1': ['Włącz'],
      'zawór 1': ['Włącz', 'Ustaw'],
    });
    expect((globalThis as any).__scenarioDefLibrary.paramUnitMap).toEqual({
      ciśnienie: { units: ['mbar'], defaultUnit: 'mbar' },
      temperatura: { units: ['mbar', '°C'] },
    });
    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it('reads units from rows, then conditions, then DEF fallback', () => {
    document.body.innerHTML = `
      <div class="var-row">
        <select class="param-select"><option value="ciśnienie" selected>ciśnienie</option></select>
        <select class="unit-select"><option value="bar" selected>bar</option></select>
      </div>
    `;
    expect(getUnitFromUi('ciśnienie')).toBe('bar');

    document.body.innerHTML = `
      <div class="condition-group">
        <select class="param-select"><option value="temperatura" selected>temperatura</option></select>
        <select class="unit-select"><option value="°C" selected>°C</option></select>
      </div>
    `;
    expect(getUnitFromUi('temperatura')).toBe('°C');

    document.body.innerHTML = '';
    (globalThis as any).__scenarioDefLibrary = {
      paramUnitMap: {
        przepływ: { units: ['l/min'] },
      },
    };
    expect(getUnitFromUi('przepływ')).toBe('l/min');
  });
});