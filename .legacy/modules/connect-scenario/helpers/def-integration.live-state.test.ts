/** @vitest-environment jsdom */

import { describe, expect, it, vi } from 'vitest';

import {
  buildLiveStateDefinitions,
  refreshDefIntegrationLiveState,
} from './def-integration.live-state';

describe('def-integration.live-state', () => {
  it('builds live state definitions from objects and params with UI units', () => {
    expect(
      buildLiveStateDefinitions(
        {
          objects: ['pump'],
          params: ['pressure', 'temperature'],
        },
        (paramName) => (paramName === 'pressure' ? 'bar' : 'C'),
      ),
    ).toEqual([
      { type: 'object', name: 'pump' },
      { type: 'param', name: 'pressure', units: 'bar' },
      { type: 'param', name: 'temperature', units: 'C' },
    ]);
  });

  it('creates the live table, renders definitions, and resets firmware errors on successful fetch', async () => {
    const container = document.createElement('div');
    const body = document.createElement('tbody');
    const render = vi.fn();
    const createLiveTable = vi.fn(() => ({ render }));

    const result = await refreshDefIntegrationLiveState({
      firmwareDisabled: false,
      firmwareErrorCount: 3,
      liveTable: null,
      container,
      body,
      buildUiLibrarySnapshot: () => ({
        objects: ['pump'],
        functions: [],
        params: ['pressure'],
        units: ['bar'],
      }),
      getUnitFromUi: () => 'bar',
      getFirmwareBaseUrl: () => 'http://fw',
      fetchStateCandidates: vi.fn().mockResolvedValue({ params: { pressure: 2.1 } }),
      createLiveTable,
    });

    expect(createLiveTable).toHaveBeenCalledWith(container);
    expect(render).toHaveBeenCalledWith(
      [
        { type: 'object', name: 'pump' },
        { type: 'param', name: 'pressure', units: 'bar' },
      ],
      { params: { pressure: 2.1 } },
    );
    expect(result.firmwareErrorCount).toBe(0);
    expect(result.firmwareDisabled).toBe(false);
    expect(result.liveTable).not.toBeNull();
  });

  it('renders an empty runtime payload when firmware base url is missing', async () => {
    const render = vi.fn();
    const liveTable = { render };

    const result = await refreshDefIntegrationLiveState({
      firmwareDisabled: false,
      firmwareErrorCount: 1,
      liveTable,
      container: document.createElement('div'),
      body: document.createElement('tbody'),
      buildUiLibrarySnapshot: () => ({
        objects: [],
        functions: [],
        params: ['pressure'],
        units: ['bar'],
      }),
      getUnitFromUi: () => 'bar',
      getFirmwareBaseUrl: () => '',
      fetchStateCandidates: vi.fn(),
      createLiveTable: vi.fn(),
    });

    expect(render).toHaveBeenCalledWith([{ type: 'param', name: 'pressure', units: 'bar' }], {});
    expect(result.firmwareErrorCount).toBe(1);
    expect(result.firmwareDisabled).toBe(false);
  });

  it('increments firmware errors and disables polling after repeated failures', async () => {
    const render = vi.fn();

    const result = await refreshDefIntegrationLiveState({
      firmwareDisabled: false,
      firmwareErrorCount: 4,
      liveTable: { render },
      container: document.createElement('div'),
      body: document.createElement('tbody'),
      buildUiLibrarySnapshot: () => ({
        objects: ['pump'],
        functions: [],
        params: [],
        units: [],
      }),
      getUnitFromUi: () => '',
      getFirmwareBaseUrl: () => 'http://fw',
      fetchStateCandidates: vi.fn().mockRejectedValue(new Error('offline')),
      createLiveTable: vi.fn(),
    });

    expect(render).toHaveBeenCalledWith([{ type: 'object', name: 'pump' }], {});
    expect(result.firmwareErrorCount).toBe(5);
    expect(result.firmwareDisabled).toBe(true);
  });

  it('returns the original state when firmware polling is already disabled or the DOM is missing', async () => {
    const disabledResult = await refreshDefIntegrationLiveState({
      firmwareDisabled: true,
      firmwareErrorCount: 5,
      liveTable: null,
      container: document.createElement('div'),
      body: document.createElement('tbody'),
      buildUiLibrarySnapshot: () => ({ objects: [], functions: [], params: [], units: [] }),
      getUnitFromUi: () => '',
      getFirmwareBaseUrl: () => 'http://fw',
      fetchStateCandidates: vi.fn(),
      createLiveTable: vi.fn(),
    });

    expect(disabledResult).toEqual({
      liveTable: null,
      firmwareErrorCount: 5,
      firmwareDisabled: true,
    });

    const missingDomResult = await refreshDefIntegrationLiveState({
      firmwareDisabled: false,
      firmwareErrorCount: 2,
      liveTable: null,
      container: null,
      body: null,
      buildUiLibrarySnapshot: () => ({ objects: [], functions: [], params: [], units: [] }),
      getUnitFromUi: () => '',
      getFirmwareBaseUrl: () => 'http://fw',
      fetchStateCandidates: vi.fn(),
      createLiveTable: vi.fn(),
    });

    expect(missingDomResult).toEqual({
      liveTable: null,
      firmwareErrorCount: 2,
      firmwareDisabled: false,
    });
  });
});