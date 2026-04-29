import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  listScenarioRows: vi.fn(),
  normalizeDslText: vi.fn((text: string) => text),
  validateDslFormat: vi.fn((text: string) => ({ ok: true, errors: [], warnings: [], fixedText: text })),
  parseDsl: vi.fn(() => ({ ok: true, errors: [], ast: { scenario: 'Test', goals: [] } })),
  validateAst: vi.fn(() => ({ ok: true, errors: [] })),
  dslToXml: vi.fn(() => ({ ok: true, xml: '<dsl />' })),
}));

vi.mock('../../modules/shared/scenarios-api.helper', () => ({
  ScenariosApiHelper: {
    listScenarioRows: mocks.listScenarioRows,
  },
}));

vi.mock('./dsl.serialize.text', () => ({
  normalizeDslText: mocks.normalizeDslText,
}));

vi.mock('./dsl.validator', () => ({
  validateDslFormat: mocks.validateDslFormat,
}));

vi.mock('./dsl.parser', () => ({
  parseDsl: mocks.parseDsl,
}));

vi.mock('./dsl.schema', () => ({
  validateAst: mocks.validateAst,
  getJsonSchema: vi.fn(() => ({})),
}));

vi.mock('./dsl.xml', () => ({
  dslToXml: mocks.dslToXml,
}));

import { validateAllTestScenarios, validateDslText } from './dsl.validate.db';

describe('dsl.validate.db', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.normalizeDslText.mockImplementation((text: string) => text);
    mocks.validateDslFormat.mockImplementation((text: string) => ({ ok: true, errors: [], warnings: [], fixedText: text }));
    mocks.parseDsl.mockImplementation(() => ({ ok: true, errors: [], ast: { scenario: 'Test', goals: [] } }));
    mocks.validateAst.mockImplementation(() => ({ ok: true, errors: [] }));
    mocks.dslToXml.mockImplementation(() => ({ ok: true, xml: '<dsl />' }));
  });

  it('uses fixed text and deduplicates validation errors and warnings', () => {
    mocks.normalizeDslText.mockReturnValue('normalized-dsl');
    mocks.validateDslFormat.mockReturnValue({
      ok: false,
      errors: ['fmt', 'fmt'],
      warnings: ['warn', 'warn'],
      fixedText: 'fixed-dsl',
    });
    mocks.validateAst.mockReturnValue({ ok: false, errors: ['ast', 'fmt'] });
    mocks.dslToXml.mockReturnValue({ ok: false, errors: ['xml', 'ast'] });

    const result = validateDslText('raw-dsl');

    expect(mocks.parseDsl).toHaveBeenCalledWith('fixed-dsl');
    expect(mocks.dslToXml).toHaveBeenCalledWith('fixed-dsl');
    expect(result).toEqual(expect.objectContaining({
      ok: false,
      errors: ['fmt', 'ast', 'xml'],
      warnings: ['warn'],
      dsl: 'fixed-dsl',
      fixedText: 'fixed-dsl',
    }));
  });

  it('extracts DSL from row variants and injects scenario headers only when missing', async () => {
    mocks.listScenarioRows.mockResolvedValue([
      { id: '1', name: 'Script Row', script: "GOAL: Script" },
      { id: '2', title: 'Library Row', library: JSON.stringify({ goals: [{ name: 'Pump', code: "SET 'pompa 1' '1'" }] }) },
      { id: '3', name: 'Content Row', content: JSON.stringify({ dsl: "SCENARIO: Existing\n\nGOAL: Embedded" }) },
      { id: '4', name: 'Raw Content', content: "GOAL: Raw" },
    ]);

    const reports = await validateAllTestScenarios();

    expect(mocks.parseDsl.mock.calls.map(([text]) => text)).toEqual([
      "SCENARIO: Script Row\n\nGOAL: Script",
      "SCENARIO: Library Row\n\nGOAL: Pump\n  SET 'pompa 1' '1'",
      "SCENARIO: Existing\n\nGOAL: Embedded",
      "SCENARIO: Raw Content\n\nGOAL: Raw",
    ]);
    expect(reports).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: '1', name: 'Script Row', ok: true, dsl: "SCENARIO: Script Row\n\nGOAL: Script" }),
      expect.objectContaining({ id: '2', name: 'Library Row', ok: true, dsl: "SCENARIO: Library Row\n\nGOAL: Pump\n  SET 'pompa 1' '1'" }),
      expect.objectContaining({ id: '3', name: 'Content Row', ok: true, dsl: "SCENARIO: Existing\n\nGOAL: Embedded" }),
      expect.objectContaining({ id: '4', name: 'Raw Content', ok: true, dsl: "SCENARIO: Raw Content\n\nGOAL: Raw" }),
    ]));
  });

  it('reports rows without DSL content', async () => {
    mocks.listScenarioRows.mockResolvedValue([{ id: 'missing', name: 'Missing DSL' }]);

    const reports = await validateAllTestScenarios();

    expect(mocks.parseDsl).not.toHaveBeenCalled();
    expect(reports).toEqual([
      { id: 'missing', name: 'Missing DSL', ok: false, errors: ['Brak DSL w rekordzie'], warnings: [] },
    ]);
  });
});