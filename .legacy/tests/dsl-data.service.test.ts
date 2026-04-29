import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchWithAuth = vi.fn(async (url: string) => {
  if (String(url).includes('/api/v3/dsl/')) {
    return { ok: false, json: async () => ({}) };
  }

  if (String(url).includes('/api/v1/schema')) {
    return {
      ok: true,
      json: async () => ({
        objects: [
          { id: 'pump', name: 'pompa', functions: ['IGNORED'] },
          { id: 'sensor', name: 'sensor', functions: ['VAL', 'MIN'] },
        ],
        functions: [
          { id: 'set', name: 'SET' },
          { id: 'wait', name: 'WAIT' },
          { id: 'val', name: 'VAL' },
          { id: 'min', name: 'MIN' },
        ],
        params: [
          { id: 'pressure', name: 'ciśnienie', units: ['IGNORED'] },
        ],
        units: [
          { id: 'mbar', name: 'mbar', symbol: 'mbar' },
          { id: 'bar', name: 'bar', symbol: 'bar' },
        ],
        objectFunctionMap: {
          pompa: { functions: ['SET', 'WAIT'] },
        },
        paramUnitMap: {
          'ciśnienie': { units: ['mbar', 'bar'] },
        },
      }),
    };
  }

  throw new Error(`Unexpected URL: ${url}`);
});

vi.mock('../utils/fetch.utils', () => ({
  fetchWithAuth,
}));

vi.mock('../utils/logger', () => ({
  logger: {
    warn: vi.fn(),
  },
}));

describe('dsl-data.service shared schema fallback', () => {
  beforeEach(() => {
    vi.resetModules();
    fetchWithAuth.mockClear();
    (globalThis as any).__scenarioDefLibrary = null;
    (globalThis as any).__dslSchemaUrlOverride = '';
  });

  it('loads data from shared schema endpoint when v3 DSL endpoints are unavailable', async () => {
    const { dslDataService } = await import('../components/dsl/dsl-data.service');
    dslDataService.clearCache();

    const data = await dslDataService.loadAll();

    expect(data.objects.map((item) => item.name)).toContain('pompa');
    expect(dslDataService.getFunctionsForObject('pompa')).toEqual(['SET', 'WAIT']);
    expect(dslDataService.getUnitsForParam('ciśnienie')).toEqual(['mbar', 'bar']);
    expect(fetchWithAuth).toHaveBeenCalledWith('/api/v1/schema');
  });
});