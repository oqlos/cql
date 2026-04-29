// library-editor.data-loader.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { DefData } from '../../modules/connect-scenario/helpers/def-editor.render';
import { extractSetVarsFromGoals, parseGoalVariableLine, replaceGoalVariableLineValue } from './library-editor.dsl';

// Mock ScenariosLibrary
vi.mock('../../modules/connect-scenario/helpers/scenarios.library', () => ({
  ScenariosLibrary: {
    load: vi.fn((key: string) => {
      const seeds: Record<string, string[]> = {
        objects: ['seed-obj-1'],
        functions: ['seed-fn-1'],
        params: ['seed-param-1'],
        units: ['seed-unit-1'],
        logs: [], alarms: [], errors: [], funcs: [],
      };
      return seeds[key] || [];
    }),
  },
}));

// Mock parseFuncDefinitions
vi.mock('../../components/dsl/dsl-func.parser', () => ({
  parseFuncDefinitions: vi.fn((code: string) => {
    if (code.includes('FUNC: TestProc')) {
      return {
        TestProc: { name: 'TestProc', steps: [{ raw: "SET 'x' '1'" }] },
      };
    }
    return {};
  }),
}));

import {
  extractOptsFromCode,
  parseDefFromCode,
  loadDefFromCurrentScenario,
  loadFromJsonColumns,
  loadScenarioData,
  autoSyncFromDsl,
} from './library-editor.data-loader';

function makeEmptyDefData(): DefData {
  return {
    systemVars: {},
    goalOpts: [],
    goalsConfig: [],
    library: {
      objects: [],
      functions: [],
      params: [],
      units: [],
      logs: [],
      alarms: [],
      errors: [],
      funcs: [],
      goals: [],
      objectFunctionMap: {},
      paramUnitMap: {},
    },
  };
}

// ─── extractOptsFromCode ────────────────────────────────────────────────────

describe('extractOptsFromCode', () => {
  it('returns empty array for empty code', () => {
    expect(extractOptsFromCode('')).toEqual([]);
  });

  it('extracts SET variables', () => {
    const code = "SET 'pressure' '100'\nSET 'time' '30'";
    const result = extractOptsFromCode(code);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ name: 'pressure', value: '100' });
    expect(result[1]).toEqual({ name: 'time', value: '30' });
  });

  it('extracts OPT variables', () => {
    const code = "OPT 'mode' 'Tryb pracy'";
    const result = extractOptsFromCode(code);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ name: 'mode', value: '', description: 'Tryb pracy' });
  });

  it('merges SET and OPT with same name', () => {
    const code = "SET 'temp' '25'\nOPT 'temp' 'Temperatura'";
    const result = extractOptsFromCode(code);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ name: 'temp', value: '25', description: 'Temperatura' });
  });

  it('handles multiple SET and OPT entries', () => {
    const code = "SET 'a' '1'\nSET 'b' '2'\nOPT 'c' 'desc C'\nOPT 'a' 'desc A'";
    const result = extractOptsFromCode(code);
    expect(result).toHaveLength(3);
    expect(result.find(o => o.name === 'a')).toEqual({ name: 'a', value: '1', description: 'desc A' });
    expect(result.find(o => o.name === 'b')).toEqual({ name: 'b', value: '2' });
    expect(result.find(o => o.name === 'c')).toEqual({ name: 'c', value: '', description: 'desc C' });
  });

  it('supports legacy bracket syntax for backward compatibility', () => {
    const code = 'SET [pressure] "100"\nOPT [pressure] "Ciśnienie docelowe"';
    const result = extractOptsFromCode(code);
    expect(result).toEqual([{ name: 'pressure', value: '100', description: 'Ciśnienie docelowe' }]);
  });
});

// ─── parseDefFromCode ───────────────────────────────────────────────────────

describe('parseDefFromCode', () => {
  it('parses valid JSON into defData', () => {
    const defData = makeEmptyDefData();
    const json = JSON.stringify({
      objects: ['pump', 'valve'],
      functions: ['Start', 'Stop'],
      params: ['pressure'],
      units: ['bar'],
    });
    parseDefFromCode(defData, json);
    expect(defData.library.objects).toEqual(['pump', 'valve']);
    expect(defData.library.functions).toEqual(['Start', 'Stop']);
    expect(defData.library.params).toEqual(['pressure']);
    expect(defData.library.units).toEqual(['bar']);
  });

  it('parses JSON with goals and funcs', () => {
    const defData = makeEmptyDefData();
    const json = JSON.stringify({
      objects: [],
      functions: [],
      params: [],
      units: [],
      goals: [{ name: 'G1', code: "SET 'x' '1'" }],
      funcs: [{ name: 'F1', code: 'DO something' }],
    });
    parseDefFromCode(defData, json);
    expect(defData.library.goals).toEqual([{ name: 'G1', code: "SET 'x' '1'" }]);
    expect(defData.library.funcs).toEqual([{ name: 'F1', code: 'DO something' }]);
  });

  it('extracts objects from regex patterns when not valid JSON', () => {
    const defData = makeEmptyDefData();
    const code = `const lib = { "objects": ["pump", "valve"], "functions": ["Start"] }`;
    parseDefFromCode(defData, code);
    expect(defData.library.objects).toEqual(['pump', 'valve']);
    expect(defData.library.functions).toEqual(['Start']);
  });

  it('extracts systemVars from code', () => {
    const defData = makeEmptyDefData();
    const code = `systemVars = { pressure: 100, name: 'test' }`;
    parseDefFromCode(defData, code);
    expect(defData.systemVars.pressure).toBe(100);
    expect(defData.systemVars.name).toBe('test');
  });

  it('extracts optDefaults from code', () => {
    const defData = makeEmptyDefData();
    const code = `optDefaults = { 'mode': 'auto', 'speed': 'fast' }`;
    parseDefFromCode(defData, code);
    expect(defData.optDefaults).toEqual({ mode: 'auto', speed: 'fast' });
  });

  it('does not overwrite existing funcs from regex when already loaded', () => {
    const defData = makeEmptyDefData();
    defData.library.funcs = [{ name: 'ExistingFunc', code: 'existing code' }];
    const code = `const lib = { "funcs": ["OverwriteMe"] }`;
    parseDefFromCode(defData, code);
    // Should keep existing funcs
    expect(defData.library.funcs).toEqual([{ name: 'ExistingFunc', code: 'existing code' }]);
  });
});

// ─── loadFromJsonColumns ────────────────────────────────────────────────────

describe('loadFromJsonColumns', () => {
  it('loads library from JSON string', () => {
    const defData = makeEmptyDefData();
    const libraryJson = JSON.stringify({
      objects: ['o1'], functions: ['f1'], params: ['p1'], units: ['u1'],
    });
    loadFromJsonColumns(defData, libraryJson);
    expect(defData.library.objects).toEqual(['o1']);
    expect(defData.library.functions).toEqual(['f1']);
  });

  it('loads library from object directly', () => {
    const defData = makeEmptyDefData();
    loadFromJsonColumns(defData, { objects: ['a'], functions: ['b'], params: [], units: [] });
    expect(defData.library.objects).toEqual(['a']);
    expect(defData.library.functions).toEqual(['b']);
  });

  it('converts goals to goalsConfig', () => {
    const defData = makeEmptyDefData();
    const libraryJson = {
      objects: [], functions: [], params: [], units: [],
      goals: [
        { name: 'Goal1', code: "SET 'x' '10'\nOPT 'x' 'desc'" },
        { name: 'Goal2', code: '' },
      ],
    };
    loadFromJsonColumns(defData, libraryJson);
    expect(defData.goalsConfig).toHaveLength(2);
    expect(defData.goalsConfig![0].name).toBe('Goal1');
    expect(defData.goalsConfig![0].opts).toHaveLength(1);
    expect(defData.goalsConfig![0].opts[0].name).toBe('x');
    expect(defData.goalsConfig![1].name).toBe('Goal2');
  });

  it('loads configJson with systemVars and optDefaults', () => {
    const defData = makeEmptyDefData();
    loadFromJsonColumns(
      defData,
      { objects: [], functions: [], params: [], units: [] },
      JSON.stringify({ systemVars: { p: 10 }, optDefaults: { mode: 'auto' } })
    );
    expect(defData.systemVars).toEqual({ p: 10 });
    expect(defData.optDefaults).toEqual({ mode: 'auto' });
  });

  it('loads varRoles from library', () => {
    const defData = makeEmptyDefData();
    loadFromJsonColumns(defData, {
      objects: [], functions: [], params: [], units: [],
      varRoles: { '0:x': 'operator' },
    });
    expect((defData.library as any).varRoles).toEqual({ '0:x': 'operator' });
  });
});

// ─── autoSyncFromDsl ────────────────────────────────────────────────────────

describe('autoSyncFromDsl', () => {
  it('returns immediately for empty DSL', () => {
    const defData = makeEmptyDefData();
    autoSyncFromDsl(defData, '');
    expect(defData.goalsConfig).toEqual([]);
  });

  it('parses GOALs from DSL', () => {
    const defData = makeEmptyDefData();
    const dsl = `GOAL: Napełnianie
SET 'pressure' '100'
OPT 'pressure' 'Ciśnienie docelowe'
GOAL: Opróżnianie
SET 'time' '30'`;
    autoSyncFromDsl(defData, dsl);
    expect(defData.goalsConfig).toHaveLength(2);
    expect(defData.goalsConfig![0].name).toBe('Napełnianie');
    expect(defData.goalsConfig![0].enabled).toBe(true);
    expect(defData.goalsConfig![0].opts).toHaveLength(1);
    expect(defData.goalsConfig![0].opts[0]).toEqual({ name: 'pressure', value: '100', description: 'Ciśnienie docelowe' });
    expect(defData.goalsConfig![1].name).toBe('Opróżnianie');
    expect(defData.goalsConfig![1].opts[0]).toEqual({ name: 'time', value: '30' });
  });

  it('preserves existing enabled state on re-sync', () => {
    const defData = makeEmptyDefData();
    defData.goalsConfig = [
      { name: 'Goal1', enabled: false, order: 0, opts: [{ name: 'x', value: '5' }] },
    ];
    const dsl = `GOAL: Goal1\nSET 'x' '10'\nSET 'y' '20'`;
    autoSyncFromDsl(defData, dsl);
    expect(defData.goalsConfig).toHaveLength(1);
    expect(defData.goalsConfig![0].enabled).toBe(false); // preserved
    expect(defData.goalsConfig![0].opts).toHaveLength(2); // x preserved + y added
    expect(defData.goalsConfig![0].opts.find(o => o.name === 'x')!.value).toBe('5'); // original value preserved
    expect(defData.goalsConfig![0].opts.find(o => o.name === 'y')!.value).toBe('20');
  });

  it('adds description to existing opts without one', () => {
    const defData = makeEmptyDefData();
    defData.goalsConfig = [
      { name: 'G', enabled: true, order: 0, opts: [{ name: 'p', value: '10' }] },
    ];
    const dsl = `GOAL: G\nSET 'p' '10'\nOPT 'p' 'Pressure'`;
    autoSyncFromDsl(defData, dsl);
    expect(defData.goalsConfig![0].opts[0].description).toBe('Pressure');
  });

  it('accepts legacy bracket syntax during sync', () => {
    const defData = makeEmptyDefData();
    const dsl = `GOAL: G\nSET [p] "10"\nOPT [p] "Pressure"`;
    autoSyncFromDsl(defData, dsl);
    expect(defData.goalsConfig![0].opts[0]).toEqual({ name: 'p', value: '10', description: 'Pressure' });
  });
});

// ─── loadDefFromCurrentScenario ─────────────────────────────────────────────

describe('loadDefFromCurrentScenario', () => {
  beforeEach(() => {
    delete (globalThis as any).__scenarioDefLibrary;
    delete (globalThis as any).__currentExecContext;
  });

  it('loads from globalThis.__scenarioDefLibrary when available', () => {
    (globalThis as any).__scenarioDefLibrary = {
      objects: ['pump'], functions: ['Start'], params: ['p'], units: ['bar'],
      logs: ['log1'], alarms: ['alarm1'], errors: ['err1'],
      funcs: [{ name: 'F1', code: 'code1' }],
      objectFunctionMap: { pump: { functions: ['Start'] } },
      paramUnitMap: {},
    };
    const defData = makeEmptyDefData();
    loadDefFromCurrentScenario(defData);
    expect(defData.library.objects).toEqual(['pump']);
    expect(defData.library.functions).toEqual(['Start']);
    expect(defData.library.funcs).toEqual([{ name: 'F1', code: 'code1' }]);
  });

  it('normalizes string funcs to { name, code } objects', () => {
    (globalThis as any).__scenarioDefLibrary = {
      objects: [], functions: [], params: [], units: [],
      funcs: ['FuncA', 'FuncB'],
    };
    const defData = makeEmptyDefData();
    loadDefFromCurrentScenario(defData);
    expect(defData.library.funcs).toEqual([
      { name: 'FuncA', code: '' },
      { name: 'FuncB', code: '' },
    ]);
  });

  it('falls back to seed data when no global and ScenariosLibrary returns empty', async () => {
    const { ScenariosLibrary } = vi.mocked(await import('../../modules/connect-scenario/helpers/scenarios.library'));
    ScenariosLibrary.load.mockReturnValue([]);
    const defData = makeEmptyDefData();
    loadDefFromCurrentScenario(defData);
    // Should get seed fallbacks
    expect(defData.library.objects.length).toBeGreaterThan(0);
    expect(defData.library.objects).toContain('zawór 14');
    expect(defData.library.functions.length).toBeGreaterThan(0);
    expect(defData.library.params.length).toBeGreaterThan(0);
    expect(defData.library.units.length).toBeGreaterThan(0);
  });

  it('loads systemVars from __currentExecContext', () => {
    (globalThis as any).__scenarioDefLibrary = {
      objects: ['x'], functions: ['y'], params: ['z'], units: ['w'],
    };
    (globalThis as any).__currentExecContext = { systemVars: { p: 100 } };
    const defData = makeEmptyDefData();
    loadDefFromCurrentScenario(defData);
    expect(defData.systemVars).toEqual({ p: 100 });
  });
});

// ─── loadScenarioData ───────────────────────────────────────────────────────

describe('loadScenarioData', () => {
  beforeEach(() => {
    delete (globalThis as any).__scenarioDefLibrary;
  });

  it('prioritizes scenario.library JSON column', () => {
    const defData = makeEmptyDefData();
    const scenario = {
      library: JSON.stringify({ objects: ['from-lib'], functions: [], params: [], units: [] }),
    };
    loadScenarioData(defData, scenario);
    expect(defData.library.objects).toEqual(['from-lib']);
  });

  it('loads funcs from scenario.funcs array', () => {
    const defData = makeEmptyDefData();
    const scenario = {
      funcs: [
        { name: 'F1', code: 'code1' },
        'F2',
        { name: 'F3', steps: ['step1', 'step2'] },
      ],
      def: JSON.stringify({ objects: ['a'], functions: ['b'], params: ['c'], units: ['d'] }),
    };
    loadScenarioData(defData, scenario);
    expect(defData.library.funcs).toEqual([
      { name: 'F1', code: 'code1' },
      { name: 'F2', code: '' },
      { name: 'F3', code: 'step1\nstep2' },
    ]);
  });

  it('auto-syncs goalsConfig from scenario.dsl', () => {
    (globalThis as any).__scenarioDefLibrary = {
      objects: [], functions: [], params: [], units: [],
    };
    const defData = makeEmptyDefData();
    const scenario = {
      dsl: "GOAL: TestGoal\nSET 'x' '1'",
    };
    loadScenarioData(defData, scenario);
    expect(defData.goalsConfig).toHaveLength(1);
    expect(defData.goalsConfig![0].name).toBe('TestGoal');
  });
});

describe('goal variable line helpers', () => {
  it('parses canonical and legacy SET or OPT lines', () => {
    expect(parseGoalVariableLine("  SET 'pressure' '100'"))
      .toEqual({ indent: '  ', type: 'set', varName: 'pressure', value: '100' });
    expect(parseGoalVariableLine('OPT [mode] "Tryb pracy"'))
      .toEqual({ indent: '', type: 'opt', varName: 'mode', value: 'Tryb pracy' });
  });

  it('canonicalizes updated goal variable lines', () => {
    expect(replaceGoalVariableLineValue('  SET [x] "1"', 'x', '2')).toBe("  SET 'x' '2'");
    expect(replaceGoalVariableLineValue('OPT [mode] "Auto"', 'mode', 'Manual')).toBe("OPT 'mode' 'Manual'");
  });

  it('extracts canonical SET and OPT lines from goals', () => {
    const defData = makeEmptyDefData();
    defData.library.goals = [{ name: 'Goal1', code: "SET 'x' '10'\nOPT 'x' 'Pressure'" }];
    expect(extractSetVarsFromGoals(defData)).toEqual([
      { goalName: 'Goal1', goalIdx: 0, varName: 'x', value: '10', type: 'set', lineIdx: 0 },
      { goalName: 'Goal1', goalIdx: 0, varName: 'x', value: 'Pressure', type: 'opt', lineIdx: 1 },
    ]);
  });
});
