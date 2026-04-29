import { beforeEach, describe, expect, it, vi } from 'vitest';

const dispatch = vi.fn().mockResolvedValue(undefined);
const getState = vi.fn();
const listScenariosApi = vi.fn();

vi.mock('../cqrs/singleton', () => ({
  getScenarioCQRS: vi.fn(() => ({ dispatch, getState })),
}));

vi.mock('../../shared/scenarios-api.helper', () => ({
  ScenariosApiHelper: {
    listScenarios: (...args: any[]) => listScenariosApi(...args),
    createScenario: vi.fn(),
    deleteScenario: vi.fn(),
    fetchScenarioById: vi.fn(),
    updateScenario: vi.fn(),
  },
}));

describe('ScenariosService.listScenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('prefers the API list and keeps stable scenario ids for row actions', async () => {
    getState.mockReturnValue({
      scenarios: {
        stale: { scenario_id: 'ts-stale', title: 'Stale cache row', updated_at: '2026-04-10T10:00:00Z' },
      },
    });
    listScenariosApi.mockResolvedValue([
      { id: 'ts-live', name: 'Live scenario', updatedAt: '2026-04-10T12:00:00Z' },
    ]);

    const { ScenariosService } = await import('./scenarios.service');
    const rows = await ScenariosService.listScenarios('');

    expect(rows).toEqual([
      { id: 'ts-live', name: 'Live scenario', updatedAt: '2026-04-10T12:00:00Z' },
    ]);
  });

  it('falls back to CQRS state and maps scenario_id when API is unavailable', async () => {
    getState.mockReturnValue({
      scenarios: {
        local: { scenario_id: 'ts-local', title: 'Local scenario', updated_at: '2026-04-10T09:00:00Z' },
      },
    });
    listScenariosApi.mockRejectedValue(new Error('backend offline'));

    const { ScenariosService } = await import('./scenarios.service');
    const rows = await ScenariosService.listScenarios('');

    expect(rows).toEqual([
      { id: 'ts-local', name: 'Local scenario', updatedAt: '2026-04-10T09:00:00Z', summary: '' },
    ]);
  });
});
