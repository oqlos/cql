/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DslAst } from './dsl.types';

const LEGACY_REPORT_XML = `
  <data>
    <var id="dt#name">Device A</var>
    <var id="dt#tr#1#name">Leak Test</var>
    <var id="dt#tr#1#op#1#name">Open Valve</var>
    <var id="dt#tr#2#name">Vacuum Test</var>
    <var id="dt#tr#2#op#1#name">Check Pressure</var>
  </data>
`;

const LEGACY_DEVICE_ONLY_XML = `
  <data>
    <var id="dt#name">Device Solo</var>
  </data>
`;

const mocks = vi.hoisted(() => ({
  xmlToAst: vi.fn(),
  astToDslText: vi.fn((ast: DslAst) => `SCENARIO: ${ast.scenario}\nGOALS: ${(ast.goals || []).map((goal) => goal.name).join(',')}`),
  normalizeDslText: vi.fn((text: string) => text),
  createScenario: vi.fn(),
  updateScenario: vi.fn(),
  deleteScenario: vi.fn(),
}));

vi.mock('./dsl.xml', () => ({
  xmlToAst: mocks.xmlToAst,
}));

vi.mock('./dsl.serialize.text', () => ({
  astToDslText: mocks.astToDslText,
  normalizeDslText: mocks.normalizeDslText,
}));

vi.mock('../../modules/shared/scenarios-api.helper', () => ({
  ScenariosApiHelper: {
    createScenario: mocks.createScenario,
    updateScenario: mocks.updateScenario,
    deleteScenario: mocks.deleteScenario,
  },
}));

describe('dsl.migrate.xml migrateFilesToDb', () => {
  let migrateFilesToDb: typeof import('./dsl.migrate.xml').migrateFilesToDb;

  function makeFile(name: string, text: string): File {
    return {
      name,
      text: vi.fn().mockResolvedValue(text),
    } as unknown as File;
  }

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    mocks.xmlToAst.mockReturnValue({ ok: false, errors: ['native parse failed'] });
    mocks.astToDslText.mockImplementation((ast: DslAst) => `SCENARIO: ${ast.scenario}\nGOALS: ${(ast.goals || []).map((goal) => goal.name).join(',')}`);
    mocks.normalizeDslText.mockImplementation((text: string) => text);
    mocks.createScenario.mockResolvedValue('scenario-id');
    mocks.updateScenario.mockResolvedValue(undefined);
    mocks.deleteScenario.mockResolvedValue(undefined);
    ({ migrateFilesToDb } = await import('./dsl.migrate.xml'));
  });

  it('posts native DSL files using the file stem as scenario name by default', async () => {
    mocks.xmlToAst.mockReturnValue({ ok: true, ast: { scenario: 'Native Scenario', goals: [] } });

    const results = await migrateFilesToDb([
      makeFile('native.xml', '<dsl />'),
    ]);

    expect(mocks.createScenario).toHaveBeenCalledWith('native');
    expect(mocks.updateScenario).toHaveBeenCalledWith('scenario-id', {
      title: 'native',
      content: { dsl: 'SCENARIO: Native Scenario\nGOALS: ' },
      dsl: 'SCENARIO: Native Scenario\nGOALS: ',
    });
    expect(results).toEqual([
      { file: 'native.xml', ok: true, id: 'scenario-id', errors: [] },
    ]);
  });

  it('posts each legacy transaction separately and keeps later transactions running after a failed post', async () => {
    mocks.createScenario
      .mockResolvedValueOnce('legacy-1')
      .mockResolvedValueOnce('legacy-2');
    mocks.updateScenario
      .mockRejectedValueOnce(new Error('update failed'))
      .mockResolvedValueOnce(undefined);

    const results = await migrateFilesToDb([
      makeFile('legacy.xml', LEGACY_REPORT_XML),
    ]);

    expect(mocks.createScenario.mock.calls).toEqual([
      ['Device A Leak Test'],
      ['Device A Vacuum Test'],
    ]);
    expect(mocks.deleteScenario).toHaveBeenCalledWith('legacy-1');
    expect(results).toEqual([
      { file: 'legacy.xml (Device A Leak Test)', ok: false, id: undefined, errors: ['POST failed'] },
      { file: 'legacy.xml (Device A Vacuum Test)', ok: true, id: 'legacy-2', errors: [] },
    ]);
  });

  it('falls back to a single legacy scenario when the report has no transaction entries', async () => {
    const results = await migrateFilesToDb([
      makeFile('device-only.xml', LEGACY_DEVICE_ONLY_XML),
    ], false);

    expect(mocks.createScenario).toHaveBeenCalledWith('Device Solo');
    expect(mocks.updateScenario).toHaveBeenCalledWith('scenario-id', {
      title: 'Device Solo',
      content: { dsl: 'SCENARIO: Device Solo\nGOALS: ' },
      dsl: 'SCENARIO: Device Solo\nGOALS: ',
    });
    expect(results).toEqual([
      { file: 'device-only.xml', ok: true, id: 'scenario-id', errors: [] },
    ]);
  });
});