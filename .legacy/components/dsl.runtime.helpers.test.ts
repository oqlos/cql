import { describe, expect, it } from 'vitest';

import { deriveFromClasses, extractLibrary } from './dsl.runtime.helpers';

describe('dsl.runtime.helpers', () => {
  it('returns null when no class-style runtime library is available', () => {
    expect(deriveFromClasses({})).toBeNull();
  });

  it('derives lists and optional maps from class-based runtime definitions', () => {
    const runtime = {
      classes: {
        objects: [{ name: 'pompa', functions: ['Włącz', 'Wyłącz'], default: 'Włącz' }],
        functions: [{ name: 'Włącz' }, { name: 'Wyłącz' }],
        params: [{ name: 'ciśnienie', units: [{ code: 'bar' }, { code: 'mbar' }] }],
        units: [{ code: 'bar' }, { code: 'mbar' }],
      },
    };

    expect(deriveFromClasses(runtime)).toEqual({
      objects: ['pompa'],
      functions: ['Włącz', 'Wyłącz'],
      params: ['ciśnienie'],
      units: ['bar', 'mbar'],
      objectFunctionMap: { pompa: { functions: ['Włącz', 'Wyłącz'], default: 'Włącz' } },
      paramUnitMap: { ciśnienie: { units: ['bar', 'mbar'] } },
    });
  });

  it('falls back to system variables when class params are missing', () => {
    const runtime = {
      classes: {
        objects: [{ name: 'pompa' }],
      },
      systemVars: {
        pressure: 1,
        duration: 2,
      },
    };

    expect(deriveFromClasses(runtime)).toEqual({
      objects: ['pompa'],
      functions: [],
      params: ['pressure', 'duration'],
      units: [],
    });
  });

  it('prefers explicit maps and explicit libraries when available', () => {
    const explicitLibrary = { objects: ['explicit'] };
    const runtime = {
      library: explicitLibrary,
      classes: {
        objects: [{ name: 'pompa', functions: ['Włącz'] }],
        objectFunctionMap: { pompa: { functions: ['Zatrzymaj'] } },
        paramUnitMap: { ciśnienie: { units: ['bar'] } },
      },
    };

    expect(deriveFromClasses(runtime)).toEqual({
      objects: ['pompa'],
      functions: [],
      params: [],
      units: [],
      objectFunctionMap: { pompa: { functions: ['Zatrzymaj'] } },
      paramUnitMap: { ciśnienie: { units: ['bar'] } },
    });
    expect(extractLibrary(runtime)).toBe(explicitLibrary);
  });

  it('falls back to heuristic extraction when no explicit or class-derived library exists', () => {
    expect(extractLibrary({
      objects: ['pompa'],
      functions: ['Włącz'],
      units: ['bar'],
      systemVars: { pressure: 1 },
    })).toEqual({
      objects: ['pompa'],
      functions: ['Włącz'],
      params: ['pressure'],
      units: ['bar'],
    });
  });
});