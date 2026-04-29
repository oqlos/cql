import { beforeEach, describe, expect, it, vi } from 'vitest';

let scenarioLibraryState: any = {};

vi.mock('../cqrs/singleton', () => ({
  getScenarioCQRS: vi.fn(() => ({
    readModel: {
      getState: () => scenarioLibraryState,
    },
  })),
}));

vi.mock('../../connect-data/cqrs/singleton', () => ({
  getDataCQRS: vi.fn(() => ({
    dispatch: vi.fn(),
    getState: vi.fn(() => ({ rows: {} })),
  })),
}));

vi.mock('./scenarios.service', () => ({
  ScenariosService: {
    getCurrentScenarioId: vi.fn(() => ''),
    updateScenario: vi.fn(),
  },
}));

import { ScenariosLibrary } from './scenarios.library';

describe('ScenariosLibrary.load', () => {
  beforeEach(() => {
    scenarioLibraryState = {};
    delete (globalThis as any).__scenarioDefLibrary;
    delete (globalThis as any).__dslLibrarySourceOverride;
    delete (globalThis as any).__variablesCache;
    delete (globalThis as any).__libraryCache;
  });

  it('prefers DEF datasets when DB override is not enabled', () => {
    (globalThis as any).__scenarioDefLibrary = {
      objects: ['pompa 1'],
      funcs: [{ name: 'Func A', code: 'return true;' }],
    };

    expect(ScenariosLibrary.load('objects')).toEqual(['pompa 1']);
    expect(ScenariosLibrary.load('funcs')).toEqual(['Func A']);
  });

  it('skips DEF datasets when DB override is enabled', () => {
    (globalThis as any).__dslLibrarySourceOverride = 'DB';
    (globalThis as any).__scenarioDefLibrary = {
      objects: ['from-def'],
    };
    (globalThis as any).__libraryCache = {
      objects: ['from-cache'],
    };

    expect(ScenariosLibrary.load('objects')).toEqual(['from-cache']);
  });

  it('uses fixed defaults for results instead of CQRS or cache data', () => {
    scenarioLibraryState = {
      library: {
        results: ['FROM-CQRS'],
      },
    };
    (globalThis as any).__libraryCache = {
      results: ['FROM-CACHE'],
    };

    expect(ScenariosLibrary.load('results')).toEqual(['OK', 'ERROR']);
  });

  it('falls back from missing DEF dataset to CQRS and variable cache sources', () => {
    (globalThis as any).__scenarioDefLibrary = {
      objects: ['from-def'],
    };
    scenarioLibraryState = {
      library: {
        logs: ['from-cqrs'],
      },
    };
    (globalThis as any).__variablesCache = [
      { type: 'params', name: 'ciśnienie' },
      { type: 'params', name: 'ciśnienie' },
      { type: 'objects', name: 'pompa 1' },
    ];

    expect(ScenariosLibrary.load('logs')).toEqual(['from-cqrs']);
    expect(ScenariosLibrary.load('params')).toEqual(['ciśnienie']);
  });

  it('filters placeholder unit entries from library cache and falls back to seeds', () => {
    (globalThis as any).__libraryCache = {
      units: ['[]', 'bar', ' '],
    };
    expect(ScenariosLibrary.load('units')).toEqual(['bar']);

    (globalThis as any).__libraryCache = {
      units: ['[]'],
    };
    expect(ScenariosLibrary.load('units')).toEqual(['s', 'mbar', 'bar', '°C', 'l/min']);
  });

  it('maps DEF action datasets and keeps seed-only operators available', () => {
    (globalThis as any).__scenarioDefLibrary = {
      actions: ['Ustaw', 'Sprawdź'],
    };

    expect(ScenariosLibrary.load('actions')).toEqual(['Ustaw', 'Sprawdź']);
    expect(ScenariosLibrary.load('operators')).toEqual(['>', '<', '=', '>=', '<=']);
  });
});