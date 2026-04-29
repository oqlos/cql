/**
 * library-editor.data-loader.ts
 * Data loading, parsing, and sync logic extracted from connect-scenario-library-editor.page.ts
 */

import { ScenariosLibrary } from '../../modules/connect-scenario/helpers/scenarios.library';
import { parseFuncDefinitions } from '../../components/dsl/dsl-func.parser';
import type { DefData } from '../../modules/connect-scenario/helpers/def-editor.render';
import { parseGoalVariableLine } from './library-editor.dsl';

/** Extract OPT entries from goal code */
export function extractOptsFromCode(code: string): Array<{ name: string; value: string; description?: string }> {
  const opts: Array<{ name: string; value: string; description?: string }> = [];
  if (!code) return opts;

  for (const line of code.split(/\r?\n/)) {
    const parsed = parseGoalVariableLine(line);
    if (!parsed) continue;

    if (parsed.type === 'set') {
      opts.push({ name: parsed.varName, value: parsed.value });
      continue;
    }

    const existing = opts.find(o => o.name === parsed.varName);
    if (existing) {
      existing.description = parsed.value;
    } else {
      opts.push({ name: parsed.varName, value: '', description: parsed.value });
    }
  }

  return opts;
}

/** Parse DEF from code string (JSON or regex-based), mutates defData in place */
export function parseDefFromCode(defData: DefData, defCode: string): void {
  try {
    // First try to parse as pure JSON (from source editor)
    try {
      const parsed = JSON.parse(defCode);
      if (parsed && typeof parsed === 'object') {
        // Direct JSON object - update library data
        if (Array.isArray(parsed.objects)) defData.library.objects = parsed.objects;
        if (Array.isArray(parsed.functions)) defData.library.functions = parsed.functions;
        if (Array.isArray(parsed.params)) defData.library.params = parsed.params;
        if (Array.isArray(parsed.units)) defData.library.units = parsed.units;
        if (Array.isArray(parsed.logs)) defData.library.logs = parsed.logs;
        if (Array.isArray(parsed.alarms)) defData.library.alarms = parsed.alarms;
        if (Array.isArray(parsed.errors)) defData.library.errors = parsed.errors;
        if (Array.isArray(parsed.goals)) defData.library.goals = parsed.goals;
        if (Array.isArray(parsed.funcs)) defData.library.funcs = parsed.funcs;
        if (parsed.objectFunctionMap) defData.library.objectFunctionMap = parsed.objectFunctionMap;
        if (parsed.paramUnitMap) defData.library.paramUnitMap = parsed.paramUnitMap;
        if (parsed.varRoles) (defData.library as any).varRoles = parsed.varRoles;
        return; // Successfully parsed JSON
      }
    } catch { /* Not valid JSON, try regex parsing below */ }
    
    // Fallback: Try to extract library data from DEF code
    // Look for patterns like: library = {...} or "objects": [...]
    
    // Extract objects
    const objectsMatch = defCode.match(/["']objects["']\s*:\s*\[([^\]]+)\]/s);
    if (objectsMatch) {
      const items = objectsMatch[1].match(/["']([^"']+)["']/g);
      if (items) defData.library.objects = items.map(s => s.replace(/["']/g, ''));
    }
    
    // Extract functions
    const functionsMatch = defCode.match(/["']functions["']\s*:\s*\[([^\]]+)\]/s);
    if (functionsMatch) {
      const items = functionsMatch[1].match(/["']([^"']+)["']/g);
      if (items) defData.library.functions = items.map(s => s.replace(/["']/g, ''));
    }
    
    // Extract params
    const paramsMatch = defCode.match(/["']params["']\s*:\s*\[([^\]]+)\]/s);
    if (paramsMatch) {
      const items = paramsMatch[1].match(/["']([^"']+)["']/g);
      if (items) defData.library.params = items.map(s => s.replace(/["']/g, ''));
    }
    
    // Extract units
    const unitsMatch = defCode.match(/["']units["']\s*:\s*\[([^\]]+)\]/s);
    if (unitsMatch) {
      const items = unitsMatch[1].match(/["']([^"']+)["']/g);
      if (items) defData.library.units = items.map(s => s.replace(/["']/g, ''));
    }
    
    // Extract logs
    const logsMatch = defCode.match(/["']logs["']\s*:\s*\[([^\]]+)\]/s);
    if (logsMatch) {
      const items = logsMatch[1].match(/["']([^"']+)["']/g);
      if (items) defData.library.logs = items.map(s => s.replace(/["']/g, ''));
    }

    // Extract alarms
    const alarmsMatch = defCode.match(/["']alarms["']\s*:\s*\[([^\]]+)\]/s);
    if (alarmsMatch) {
      const items = alarmsMatch[1].match(/["']([^"']+)["']/g);
      if (items) defData.library.alarms = items.map(s => s.replace(/["']/g, ''));
    }

    // Extract errors
    const errorsMatch = defCode.match(/["']errors["']\s*:\s*\[([^\]]+)\]/s);
    if (errorsMatch) {
      const items = errorsMatch[1].match(/["']([^"']+)["']/g);
      if (items) defData.library.errors = items.map(s => s.replace(/["']/g, ''));
    }

    // Extract funcs - ONLY if not already loaded from scenario.funcs or scenario.func
    // This prevents overwriting actual FUNC definitions with just names
    if (!defData.library.funcs || defData.library.funcs.length === 0) {
      const funcsMatch = defCode.match(/["']funcs["']\s*:\s*\[([^\]]+)\]/s);
      if (funcsMatch) {
        const items = funcsMatch[1].match(/["']([^"']+)["']/g);
        if (items) {
          const names = items
            .map(s => s.replace(/["']/g, '').trim())
            .filter((s: string) => !!s);

          defData.library.funcs = names.map(name => ({ name, code: '' }));
        }
      }
    }

    // Extract systemVars
    const varsMatch = defCode.match(/systemVars\s*=\s*\{([^}]+)\}/s);
    if (varsMatch) {
      const content = varsMatch[1];
      const varPairs = content.matchAll(/["']?(\w+)["']?\s*:\s*([\d.]+|["'][^"']*["'])/g);
      for (const match of varPairs) {
        const key = match[1];
        const val = match[2].replace(/["']/g, '');
        defData.systemVars[key] = isNaN(Number(val)) ? val : Number(val);
      }
    }

    // Extract optDefaults
    const optDefaultsMatch = defCode.match(/optDefaults\s*=\s*\{([^}]*)\}/s);
    if (optDefaultsMatch) {
      const content = optDefaultsMatch[1];
      const optPairs = content.matchAll(/["']([^"']+)["']\s*:\s*["']([^"']*)["']/g);
      if (!defData.optDefaults) defData.optDefaults = {};
      for (const match of optPairs) {
        defData.optDefaults[match[1]] = match[2];
      }
    }
  } catch {
    // Fallback to global library
    loadDefFromCurrentScenario(defData);
  }
}

/** Load DEF data from current scenario globals, mutates defData in place */
export function loadDefFromCurrentScenario(defData: DefData): void {
  try {
    const defLib = (globalThis as any).__scenarioDefLibrary;
    if (defLib && typeof defLib === 'object') {
      defData.library.objects = Array.isArray(defLib.objects) ? [...defLib.objects] : ScenariosLibrary.load('objects');
      defData.library.functions = Array.isArray(defLib.functions) ? [...defLib.functions] : ScenariosLibrary.load('functions');
      defData.library.params = Array.isArray(defLib.params) ? [...defLib.params] : ScenariosLibrary.load('params');
      defData.library.units = Array.isArray(defLib.units) ? [...defLib.units] : ScenariosLibrary.load('units');
      defData.library.logs = Array.isArray(defLib.logs) ? [...defLib.logs] : ScenariosLibrary.load('logs');
      defData.library.alarms = Array.isArray(defLib.alarms) ? [...defLib.alarms] : ScenariosLibrary.load('alarms');
      defData.library.errors = Array.isArray(defLib.errors) ? [...defLib.errors] : ScenariosLibrary.load('errors');
      const rawFuncs = Array.isArray(defLib.funcs) ? defLib.funcs : ScenariosLibrary.load('funcs');
      defData.library.funcs = (Array.isArray(rawFuncs) ? rawFuncs : []).flatMap((f: any) => {
        if (typeof f === 'string') {
          const name = String(f || '').trim();
          return name ? [{ name, code: '' }] : [];
        }
        const name = String(f?.name || '').trim();
        if (!name) return [];
        const code = typeof f?.code === 'string'
          ? f.code
          : (Array.isArray(f?.steps) ? f.steps.join('\n') : '');
        return [{ name, code: String(code || '') }];
      });
      defData.library.objectFunctionMap = defLib.objectFunctionMap || {};
      defData.library.paramUnitMap = defLib.paramUnitMap || {};
    } else {
      defData.library.objects = ScenariosLibrary.load('objects');
      defData.library.functions = ScenariosLibrary.load('functions');
      defData.library.params = ScenariosLibrary.load('params');
      defData.library.units = ScenariosLibrary.load('units');
      defData.library.logs = ScenariosLibrary.load('logs');
      defData.library.alarms = ScenariosLibrary.load('alarms');
      defData.library.errors = ScenariosLibrary.load('errors');
      defData.library.funcs = ScenariosLibrary.load('funcs')
        .map(name => ({ name: String(name || '').trim(), code: '' }))
        .filter(f => f && f.name && f.name.trim());
    }
    
    const execCtx = (globalThis as any).__currentExecContext;
    if (execCtx && execCtx.systemVars) {
      defData.systemVars = { ...execCtx.systemVars };
    }
  } catch { /* silent */ }
  
  // Fallback to seeds if empty
  if (!defData.library.objects.length) {
    defData.library.objects = [
      'pompa 1',
      'pompa 2',
      ...Array.from({ length: 14 }, (_, index) => `zawór ${index + 1}`),
      'sprężarka',
      'regulator',
      'czujnik',
    ];
  }
  if (!defData.library.functions.length) {
    defData.library.functions = ['Włącz', 'Wyłącz', 'Ustaw', 'Zmierz', 'Sprawdź', 'Porównaj', 'Kalibruj', 'Otwórz', 'Zamknij'];
  }
  if (!defData.library.params.length) {
    defData.library.params = ['ciśnienie', 'temperatura', 'przepływ', 'czas', 'objętość', 'wilgotność'];
  }
  if (!defData.library.units.length) {
    defData.library.units = ['s', 'mbar', 'bar', '°C', 'l/min'];
  }
}

/** Load DEF data from new JSON columns, mutates defData in place */
export function loadFromJsonColumns(defData: DefData, libraryJson: string | object, configJson?: string | object): void {
  try {
    const library = typeof libraryJson === 'string' ? JSON.parse(libraryJson) : libraryJson;
    defData.library = {
      objects: library.objects || [],
      functions: library.functions || [],
      params: library.params || [],
      units: library.units || [],
      actions: library.actions || [],
      logs: library.logs || [],
      alarms: library.alarms || [],
      errors: library.errors || [],
      funcs: library.funcs || [],
      goals: library.goals || [],
      objectFunctionMap: {},
      paramUnitMap: {}
    };
    
    // Load varRoles if present
    if (library.varRoles) {
      (defData.library as any).varRoles = library.varRoles;
    }
    
    // Convert goals to goalsConfig format for UI
    if (library.goals && Array.isArray(library.goals)) {
      defData.goalsConfig = library.goals.map((g: { name: string; code: string }, idx: number) => ({
        name: g.name,
        enabled: true,
        order: idx,
        opts: extractOptsFromCode(g.code)
      }));
    }
    
    if (configJson) {
      const config = typeof configJson === 'string' ? JSON.parse(configJson) : configJson;
      defData.systemVars = config.systemVars || {};
      defData.optDefaults = config.optDefaults || {};
      if (config.objectFunctionMap) {
        defData.library.objectFunctionMap = config.objectFunctionMap;
      }
      if (config.paramUnitMap) {
        defData.library.paramUnitMap = config.paramUnitMap;
      }
    }
  } catch (e) {

  }
}

/** Load scenario data into defData from a scenario object */
export function loadScenarioData(defData: DefData, scenario: any): void {
  // Priority 1: Load from new JSON library column
  if (scenario.library) {
    loadFromJsonColumns(defData, scenario.library, scenario.config);
    return;
  }
  
  // Priority 2: Load funcs from scenario.funcs or scenario.func
  if (scenario.funcs && Array.isArray(scenario.funcs) && scenario.funcs.length > 0) {
    defData.library.funcs = scenario.funcs.map((f: any) => {
      if (typeof f === 'string') return { name: f, code: '' };
      if (f.code !== undefined) return { name: f.name || '', code: f.code || '' };
      if (f.steps) return { name: f.name || '', code: (f.steps || []).join('\n') };
      return { name: f.name || '', code: '' };
    });
  } else if (scenario.func && typeof scenario.func === 'string' && scenario.func.trim()) {
    try {
      const funcLibrary = parseFuncDefinitions(scenario.func);
      const funcsArray = Object.values(funcLibrary).map(f => ({
        name: f.name,
        code: f.steps.map(s => s.raw).join('\n')
      }));
      if (funcsArray.length > 0) {
        defData.library.funcs = funcsArray;
      }
    } catch { /* ignore parse errors */ }
  }
  
  // Priority 3: Parse DEF from scenario.def
  if (scenario.def) {
    parseDefFromCode(defData, scenario.def);
  } else {
    loadDefFromCurrentScenario(defData);
  }
  
  // Auto-sync GOALs and OPTs from DSL
  if (scenario.dsl) {
    autoSyncFromDsl(defData, scenario.dsl);
  }
}

/** Auto-sync GOALs config from DSL content (called on scenario load), mutates defData in place */
export function autoSyncFromDsl(defData: DefData, dsl: string): void {
  if (!dsl) return;
  
  // Parse GOALs and their OPTs from DSL into unified goalsConfig
  const goalSections = dsl.split(/^GOAL:\s*/gm).filter(Boolean);
  const existingConfig = defData.goalsConfig || [];
  const existingMap = new Map(existingConfig.map(g => [g.name, g]));
  
  const newGoalsConfig: Array<{ name: string; enabled: boolean; order: number; opts: Array<{ name: string; value: string; description?: string }> }> = [];
  
  for (let idx = 0; idx < goalSections.length; idx++) {
    const section = goalSections[idx];
    const lines = section.split('\n');
    const goalName = lines[0]?.trim() || '';
    if (!goalName) continue;
    
    const opts: Array<{ name: string; value: string; description?: string }> = [];
    
    // Find SET and OPT commands in this GOAL
    for (const line of lines) {
      const parsed = parseGoalVariableLine(line);
      if (!parsed) continue;

      if (parsed.type === 'set') {
        opts.push({ name: parsed.varName, value: parsed.value });
        continue;
      }

      const existing = opts.find(o => o.name === parsed.varName);
      if (existing) {
        existing.description = parsed.value;
      } else {
        opts.push({ name: parsed.varName, value: '', description: parsed.value });
      }
    }
    
    // Merge with existing config, preserving user edits
    const existingGoal = existingMap.get(goalName);
    if (existingGoal) {
      // Preserve enabled state and merge opts
      const mergedOpts = [...existingGoal.opts];
      for (const newOpt of opts) {
        const existingOpt = mergedOpts.find(o => o.name === newOpt.name);
        if (!existingOpt) {
          mergedOpts.push(newOpt);
        } else if (!existingOpt.description && newOpt.description) {
          existingOpt.description = newOpt.description;
        }
      }
      newGoalsConfig.push({
        name: goalName,
        enabled: existingGoal.enabled,
        order: idx,
        opts: mergedOpts
      });
    } else {
      newGoalsConfig.push({
        name: goalName,
        enabled: true,
        order: idx,
        opts
      });
    }
  }
  
  defData.goalsConfig = newGoalsConfig;
}
