// frontend/src/modules/connect-scenario/helpers/scenarios.library.ts
import { getScenarioCQRS } from '../cqrs/singleton';
import { getDataCQRS } from '../../connect-data/cqrs/singleton';
import { ScenariosService } from './scenarios.service';

export type LibraryDataset = 'objects'|'functions'|'params'|'units'|'actions'|'results'|'operators'|'logs'|'alarms'|'errors'|'funcs';

export const DEFAULT_SCENARIO_OBJECTS = [
  'pompa 1',
  'pompa 2',
  ...Array.from({ length: 14 }, (_, index) => `zawór ${index + 1}`),
  'sprężarka',
  'regulator',
  'czujnik',
];

export const DEFAULT_SCENARIO_FUNCTIONS = [
  'Włącz',
  'Wyłącz',
  'Ustaw',
  'Zmierz',
  'Sprawdź',
  'Porównaj',
  'Kalibruj',
  'Otwórz',
  'Zamknij',
];

const DEF_LIBRARY_DATASET_KEYS: Partial<Record<LibraryDataset, string>> = {
  objects: 'objects',
  functions: 'functions',
  params: 'params',
  units: 'units',
  actions: 'actions',
  results: 'results',
  logs: 'logs',
  alarms: 'alarms',
  errors: 'errors',
  funcs: 'funcs',
};

const FIXED_LIBRARY_DATASETS: Partial<Record<LibraryDataset, string[]>> = {
  results: ['OK', 'ERROR'],
};

const SEEDED_LIBRARY_DATASETS: Partial<Record<LibraryDataset, string[]>> = {
  objects: DEFAULT_SCENARIO_OBJECTS,
  functions: DEFAULT_SCENARIO_FUNCTIONS,
  params: ['ciśnienie', 'temperatura', 'przepływ', 'czas', 'objętość', 'wilgotność'],
  units: ['s', 'mbar', 'bar', '°C', 'l/min'],
  actions: DEFAULT_SCENARIO_FUNCTIONS,
  operators: ['>', '<', '=', '>=', '<='],
  logs: ['Rozpoczynam test', 'Zakończono test', 'Oczekiwanie na stabilizację'],
  alarms: ['Przekroczono czas', 'Zbyt niskie ciśnienie', 'Awaria pompy'],
  errors: ['Błąd krytyczny', 'Brak zasilania', 'Nieznany błąd'],
};

export class ScenariosLibrary {
  static async fetchActivitiesFromDB(): Promise<void> {
    try {
      const cqrs = getDataCQRS();
      const p = new URLSearchParams({ skip: '0', limit: '1000', sort: 'id', dir: 'asc' });
      await cqrs.dispatch({ type: 'LoadRows', tableName: 'activities', params: p } as any);
      const st = cqrs.getState() as any;
      const rows = Array.isArray(st?.rows?.activities) ? st.rows.activities : [];
      (globalThis as any).__activitiesCache = rows;
    } catch { /* silent */ }
  }

  static load(dataset: LibraryDataset): string[] {
    try {
      const defItems = this.loadFromDefLibrary(dataset);
      if (defItems.length) return defItems;

      const fixedItems = this.loadFixedDataset(dataset);
      if (fixedItems.length) return fixedItems;

      const cqrsItems = this.loadFromCqrsLibrary(dataset);
      if (cqrsItems.length) return cqrsItems;

      const variableItems = this.loadFromVariablesCache(dataset);
      if (variableItems.length) return variableItems;

      const cachedItems = this.loadFromLibraryCache(dataset);
      if (cachedItems.length) return cachedItems;

      return this.loadSeedDataset(dataset);
    } catch { return []; }
  }

  private static loadFromDefLibrary(dataset: LibraryDataset): string[] {
    try {
      if (this.readLibrarySourceOverride() === 'DB') return [];
      const defLib = this.getScenarioDefLibrary();
      if (!defLib) return [];
      return this.normalizeDefDataset(dataset, this.getDefDatasetValues(defLib, dataset));
    } catch { /* silent */ }
    return [];
  }

  private static readLibrarySourceOverride(): string {
    return String(((globalThis as any).__dslLibrarySourceOverride || '')).toUpperCase();
  }

  private static getScenarioDefLibrary(): any | null {
    const defLib = (globalThis as any).__scenarioDefLibrary;
    return defLib && typeof defLib === 'object' ? defLib : null;
  }

  private static getDefDatasetValues(defLib: any, dataset: LibraryDataset): any[] {
    const key = DEF_LIBRARY_DATASET_KEYS[dataset];
    const values = key ? defLib[key] : undefined;
    return Array.isArray(values) ? values : [];
  }

  private static normalizeDefDataset(dataset: LibraryDataset, values: any[]): string[] {
    if (!Array.isArray(values) || !values.length) return [];
    return values
      .map((value: any) => dataset === 'funcs'
        ? String(value?.name ?? value ?? '').trim()
        : String(value || '').trim())
      .filter(Boolean);
  }

  private static loadFixedDataset(dataset: LibraryDataset): string[] {
    const values = FIXED_LIBRARY_DATASETS[dataset];
    return values ? [...values] : [];
  }

  private static loadFromCqrsLibrary(dataset: LibraryDataset): string[] {
    try {
      const cqrs = getScenarioCQRS();
      const lib = (cqrs as any)?.readModel?.getState()?.library;
      const values = lib && Array.isArray(lib[dataset]) ? lib[dataset] : [];
      return this.normalizeNamedItems(values);
    } catch { /* silent */ }
    return [];
  }

  private static normalizeNamedItems(values: any[]): string[] {
    if (!Array.isArray(values) || !values.length) return [];
    return values.map((value: any) => String(value?.name ?? value ?? '').trim()).filter(Boolean);
  }

  private static loadFromVariablesCache(dataset: LibraryDataset): string[] {
    if (dataset !== 'objects' && dataset !== 'functions' && dataset !== 'params') {
      return [];
    }
    try {
      const vars = (globalThis as any).__variablesCache as Array<{ type: string; name: string }>;
      if (!Array.isArray(vars) || !vars.length) return [];
      const list = vars
        .filter((value) => value && String(value.type) === dataset)
        .map((value) => String(value.name || '').trim())
        .filter(Boolean);
      return Array.from(new Set(list));
    } catch { /* silent */ }
    return [];
  }

  private static loadFromLibraryCache(dataset: LibraryDataset): string[] {
    try {
      const lib = (globalThis as any).__libraryCache;
      if (!lib || typeof lib !== 'object') return [];
      let values = this.normalizeNamedItems(Array.isArray(lib[dataset]) ? lib[dataset] : []);
      if (dataset === 'units') {
        values = values.filter((value) => value && !/^\[\s*\]$/.test(value));
      }
      return values;
    } catch { /* silent */ }
    return [];
  }

  private static loadSeedDataset(dataset: LibraryDataset): string[] {
    const values = SEEDED_LIBRARY_DATASETS[dataset];
    return values ? [...values] : [];
  }

  static save(_dataset: LibraryDataset, _items: string[]): void {
    // Persist to per-scenario OBJ column (JS code)
    void this.persistLibraryToDB();
  }

  static async persistLibraryToDB(): Promise<void> {
    try {
      const snapshot = this.snapshot();
      (globalThis as any).__libraryCache = snapshot;
      // obj column is deprecated - save to library JSON column instead
      const scenarioId = (ScenariosService.getCurrentScenarioId && ScenariosService.getCurrentScenarioId()) || '';
      if (scenarioId) {
        await ScenariosService.updateScenario(scenarioId, { library: JSON.stringify(snapshot) });
      }
    } catch { /* silent */ }
  }

  static async fetchLibraryFromDB(): Promise<void> {
    try {
      const { getConfigCQRS } = await import('../../connect-config/cqrs/singleton');
      const cqrs = getConfigCQRS();
      await cqrs.dispatch({ type: 'LoadSystemSettings' } as any);
      const st = cqrs.getState() as any;
      const section = st?.settings?.['connect-manager-library'] || null;
      if (section && typeof section === 'object') {
        (globalThis as any).__libraryCache = section;
      }
    } catch { /* silent */ }
  }

  static async fetchVariablesFromDB(): Promise<void> {
    try {
      // Use shared DSL data service instead of direct fetch calls
      const { dslDataService } = await import('../../../components/dsl');
      const data = await dslDataService.loadAll();
      
      // Maintain backward compatibility with existing cache format
      const normObjs = data.objects.map(r => ({ type: 'objects', name: r.name, units: '', raw: r.raw }));
      const normFns = data.functions.map(r => ({ type: 'functions', name: r.name, units: '', raw: r.raw }));
      const normPars = data.params.map(r => ({ type: 'params', name: r.name, units: r.units, raw: r.raw }));
      
      (globalThis as any).__variablesCache = [...normObjs, ...normFns, ...normPars];
      
      // Also expose dedicated caches for backward compatibility
      (globalThis as any).__dslObjects = data.objects.map(o => o.raw);
      (globalThis as any).__dslFunctions = data.functions.map(f => f.raw);
      (globalThis as any).__dslParams = data.params.map(p => p.raw);
      (globalThis as any).__dslObjectFunctions = data.objectFunctions.map(of => of.raw);
      (globalThis as any).__dslUnits = data.units.map(u => u.raw);
      (globalThis as any).__dslParamUnits = data.paramUnits.map(pu => pu.raw);
    } catch { /* silent */ }
  }

  static getFunctionsForObject(objectName: string): string[] {
    try {
      const override = String(((globalThis as any).__dslLibrarySourceOverride || '')).toUpperCase();
      const defLib = (globalThis as any).__scenarioDefLibrary as any;
      if (override === 'DEF' || (override !== 'DB' && defLib && typeof defLib === 'object')) {
        // DEF source preferred: if mapping exists for object, honor it strictly (even if empty)
        const map = (defLib && defLib.objectFunctionMap) || {};
        if (map && typeof map === 'object' && Object.prototype.hasOwnProperty.call(map, String(objectName || '').trim())) {
          const entry = (map as any)[String(objectName || '').trim()];
          const list = Array.isArray(entry?.functions) ? entry.functions : (Array.isArray(entry) ? entry : []);
          return Array.from(new Set(list.map((s: any) => String(s || '').trim()).filter(Boolean)));
        }
        // No mapping at all for this object → fall back to full functions list
        return this.load('functions');
      }
      const objs = (globalThis as any).__dslObjects as Array<{ id: string; name: string }>;
      const fns = (globalThis as any).__dslFunctions as Array<{ id: string; name: string }>;
      const piv = (globalThis as any).__dslObjectFunctions as Array<{ object_id: string; function_id: string }>;
      const obj = Array.isArray(objs) ? objs.find(o => String(o?.name || '').trim() === String(objectName || '').trim()) : null;
      if (!obj || !Array.isArray(piv) || !Array.isArray(fns)) return this.load('functions');
      const ids = new Set(piv.filter(p => String(p.object_id) === String(obj.id)).map(p => String(p.function_id)));
      const names = fns.filter(fn => ids.has(String(fn.id))).map(fn => String(fn.name || '').trim()).filter(Boolean);
      if (names.length) return Array.from(new Set(names));
    } catch { /* silent */ }
    return this.load('functions');
  }

  static getDefaultFunctionForObject(objectName: string): string {
    try {
      const override = String(((globalThis as any).__dslLibrarySourceOverride || '')).toUpperCase();
      const defLib = (globalThis as any).__scenarioDefLibrary as any;
      if (override === 'DEF' || (override !== 'DB' && defLib && typeof defLib === 'object')) {
        const map = (defLib && defLib.objectFunctionMap) || {};
        if (map && typeof map === 'object') {
          const entry = map[String(objectName || '').trim()];
          const dv = entry?.default;
          if (typeof dv === 'string' && dv.trim()) return dv.trim();
        }
        return '';
      }
      const objs = (globalThis as any).__dslObjects as Array<{ id: string; name: string }>;
      const fns = (globalThis as any).__dslFunctions as Array<{ id: string; name: string }>;
      const piv = (globalThis as any).__dslObjectFunctions as Array<{ object_id: string; function_id: string; is_default?: string }>;
      const obj = Array.isArray(objs) ? objs.find(o => String(o?.name || '').trim() === String(objectName || '').trim()) : null;
      if (!obj || !Array.isArray(piv) || !Array.isArray(fns)) return '';
      const def = piv.find(p => String(p.object_id) === String(obj.id) && String(p.is_default || '').trim() === '1');
      if (!def) return '';
      const fn = fns.find(x => String(x.id) === String(def.function_id));
      return fn ? String(fn.name || '').trim() : '';
    } catch { return ''; }
  }

  static getUnitsForParam(paramName: string): string[] {
    try {
      const pname = String(paramName || '').trim();
      const override = String(((globalThis as any).__dslLibrarySourceOverride || '')).toUpperCase();
      const defLib = (globalThis as any).__scenarioDefLibrary as any;
      if (override === 'DEF' || (override !== 'DB' && defLib && typeof defLib === 'object')) {
        const map = (defLib && defLib.paramUnitMap) || {};
        if (map && typeof map === 'object') {
          const entry = map[pname] || map[pname.replace(/\s*\[[^\]]*]\s*$/, '').trim()];
          const list: any[] = Array.isArray(entry?.units) ? (entry.units as any[]) : [];
          const uniq = Array.from(new Set(list.map((s: any) => String(s || '').trim()).filter(Boolean)));
          if (uniq.length) return uniq;
        }
      }
      const params = (globalThis as any).__dslParams as Array<{ id: string; name: string }>;
      const pu = (globalThis as any).__dslParamUnits as Array<{ param_id: string; unit_id: string; is_default?: string }>;
      const units = (globalThis as any).__dslUnits as Array<{ id: string; code?: string; name?: string }>;
      // Try exact match first; if not found, try name without trailing bracketed unit e.g. "Czas [s]" -> "Czas"
      const p = Array.isArray(params)
        ? (params.find(r => String(r?.name || '').trim() === pname)
           || params.find(r => {
                const base = pname.replace(/\s*\[[^\]]*]\s*$/, '').trim();
                return base && String(r?.name || '').trim() === base;
              }))
        : null;
      if (p && Array.isArray(pu) && Array.isArray(units)) {
        const linked = pu.filter(x => String(x.param_id) === String(p.id));
        if (linked.length) {
          // Default-first ordering
          linked.sort((a, b) => (String(b.is_default || '') === '1' ? 1 : 0) - (String(a.is_default || '') === '1' ? 1 : 0));
          const names = linked.map(x => {
            const u = units.find(u => String(u.id) === String(x.unit_id));
            const nm = (u?.name || u?.code || '').toString().trim();
            return nm;
          }).filter(nm => nm && !/^\[\s*\]$/.test(nm));
          if (names.length) return Array.from(new Set(names));
        }
      }
      // Fallback to legacy units in dsl_params.units
      const vars = (globalThis as any).__variablesCache as Array<{ type: string; name: string; units?: string }>;
      const lc = pname.toLowerCase();
      const row = Array.isArray(vars) ? vars.find(v => v && v.type === 'params' && String(v.name || '').trim().toLowerCase() === lc) : null;
      if (row) {
        try {
          const parsed = row.units ? JSON.parse(row.units) : [];
          if (Array.isArray(parsed) && parsed.length) return parsed
            .map((s: any) => String(s || '').trim())
            .filter(s => s && !/^\[\s*\]$/.test(s));
        } catch { /* silent */ }
        const list = String(row.units || '').split(',')
          .map(s => s.trim())
          .filter(s => s && !/^\[\s*\]$/.test(s));
        if (list.length) return list;
      }
    } catch { /* silent */ }
    return this.load('units');
  }

  static loadActivityNames(): string[] {
    const set = new Set<string>();
    try {
      const rows = (globalThis as any).__activitiesCache as Array<{ id: string; name: string }>;
      if (Array.isArray(rows) && rows.length) {
        for (const r of rows) { const nm = String(r?.name || '').trim(); if (nm) set.add(nm); }
      }
    } catch { /* silent */ }
    try {
      const cqrs = getScenarioCQRS();
      const acts = (cqrs as any)?.readModel?.getState()?.activities || {};
      if (acts && typeof acts === 'object') {
        Object.keys(acts).forEach((k) => {
          const nm = acts[k]?.name;
          if (typeof nm === 'string' && nm.trim()) set.add(nm.trim());
        });
      }
    } catch { /* silent */ }
    let out = Array.from(set);
    if (!out.length) {
      out = ['🔋 Sprawdzenie ciśnienia','💨 Test przepływu','🔍 Test szczelności','👁️ Kontrola wizualna','📊 Analiza wyników','📝 Dokumentacja','⚙️ Konfiguracja parametrów'];
    }
    return out;
  }

  static snapshot(): any {
    try {
      const base: any = {
        objects: this.load('objects'),
        functions: this.load('functions'),
        params: this.load('params'),
        units: this.load('units'),
        logs: this.load('logs'),
        alarms: this.load('alarms'),
        errors: this.load('errors')
      };
      const defLib = (globalThis as any).__scenarioDefLibrary as any;
      if (defLib && typeof defLib === 'object') {
        if (defLib.objectFunctionMap && typeof defLib.objectFunctionMap === 'object') base.objectFunctionMap = defLib.objectFunctionMap;
        if (defLib.paramUnitMap && typeof defLib.paramUnitMap === 'object') base.paramUnitMap = defLib.paramUnitMap;
      }
      return base;
    } catch { return { objects: [], functions: [], params: [], units: [], logs: [], alarms: [], errors: [] }; }
  }

  static serializeAsClassJs(lib?: any): string {
    try {
      const L = lib && typeof lib === 'object' ? lib : this.snapshot();
      const j = (v: any) => JSON.stringify(v ?? (Array.isArray(v) ? [] : {}));
      const code = `\n(function(){\nclass DSL {}\nDSL.objects=${j(L.objects)};\nDSL.functions=${j(L.functions)};\nDSL.params=${j(L.params)};\nDSL.units=${j(L.units)};\nDSL.logs=${j(L.logs)};\nDSL.alarms=${j(L.alarms)};\nDSL.errors=${j(L.errors)};\nDSL.objectFunctionMap=${j(L.objectFunctionMap||{})};\nDSL.paramUnitMap=${j(L.paramUnitMap||{})};\nvar __m=(typeof module!=='undefined'&&module.exports?module.exports:(typeof exports!=='undefined'?exports:{}));\n__m.dsl=DSL;\n__m.library={objects:DSL.objects,functions:DSL.functions,params:DSL.params,units:DSL.units,logs:DSL.logs,alarms:DSL.alarms,errors:DSL.errors,objectFunctionMap:DSL.objectFunctionMap,paramUnitMap:DSL.paramUnitMap};\nmodule.exports=__m;\n})();\n`;
      return code;
    } catch { return ''; }
  }
}
