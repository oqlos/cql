// frontend/src/components/dsl/dsl.runtime.helpers.ts
// Helper functions for DSL runtime - extracted from dsl.runtime.ts

/** Convert value to number */
export function toNumber(v: any): number | null {
  if (typeof v === 'number' && isFinite(v)) return v;
  if (typeof v === 'string') {
    const m = v.trim().match(/^(-?\d+(?:[\.,]\d+)?)/);
    if (m) {
      const n = Number(m[1].replace(',', '.'));
      if (isFinite(n)) return n;
    }
  }
  return null;
}

/** Normalize value to number, string, or null */
export function normalize(v: any): number | string | null {
  const n = toNumber(v);
  if (n !== null) return n;
  if (typeof v === 'string') return v;
  try { return JSON.parse(JSON.stringify(v)); } catch { return null; }
}

/** Convert array to list of strings with key extraction */
export function toList(arr: any, keys: string[] = ['name']): string[] {
  try {
    if (Array.isArray(arr)) {
      if (arr.every(v => typeof v === 'string')) {
        return Array.from(new Set(arr.map(s => String(s).trim()).filter(Boolean)));
      }
      if (arr.every(v => v && typeof v === 'object')) {
        for (const k of keys) {
          const vals = arr.map((o: any) => String((o && o[k]) || '')).map(s => s.trim()).filter(Boolean);
          if (vals.length) return Array.from(new Set(vals));
        }
      }
    }
  } catch { /* silent */ }
  return [];
}

/** Build object function map from classes */
export function buildObjectFunctionMap(cls: any): Record<string, any> | undefined {
  if (!cls || typeof cls !== 'object' || !Array.isArray(cls.objects)) return undefined;
  const map: any = {};
  try {
    cls.objects.forEach((o: any) => {
      const on = String((o && (o.name || o.id || o.code)) || '').trim();
      if (!on) return;
      const fl = toList(o.functions || [], ['name']);
      if (fl.length) {
        const defFn = String((o && (o.default || o.defaultFunction)) || '').trim();
        map[on] = defFn ? { functions: fl, default: defFn } : { functions: fl };
      }
    });
  } catch { /* silent */ }
  return Object.keys(map).length ? map : undefined;
}

/** Build param unit map from classes */
export function buildParamUnitMap(cls: any): Record<string, any> | undefined {
  if (!cls || typeof cls !== 'object' || !Array.isArray(cls.params)) return undefined;
  const map: any = {};
  try {
    cls.params.forEach((p: any) => {
      const pn = String((p && (p.name || p.id || p.code)) || '').trim();
      if (!pn) return;
      const ul = toList(p.units || [], ['code', 'name']);
      if (ul.length) map[pn] = { units: ul };
    });
  } catch { /* silent */ }
  return Object.keys(map).length ? map : undefined;
}

function getClassLibrarySource(runtime: any): any | null {
  const cls = runtime && (runtime.dsl || runtime.DSL || runtime.classes || runtime.Library || runtime.libraryModel);
  return cls && typeof cls === 'object' ? cls : null;
}

function deriveLibraryList(primary: any, fallback: any, keys: string[]): string[] {
  return toList(primary || fallback, keys);
}

function deriveSystemParamNames(runtime: any): string[] {
  try {
    return Array.from(new Set(Object.keys(runtime?.systemVars || {}).map(name => String(name).trim()).filter(Boolean)));
  } catch { /* silent */ }
  return [];
}

function buildDerivedLibrary(cls: any, runtime: any): any {
  const lib: any = {
    objects: deriveLibraryList(cls.objects, runtime?.objects, ['name']),
    functions: deriveLibraryList(cls.functions, runtime?.functions, ['name']),
    params: deriveLibraryList(cls.params, runtime?.params, ['name']),
    units: deriveLibraryList(cls.units, runtime?.units, ['code', 'name']),
  };

  if (!lib.params.length) {
    const systemParams = deriveSystemParamNames(runtime);
    if (systemParams.length) lib.params = systemParams;
  }

  return lib;
}

function assignDerivedMap(
  lib: any,
  cls: any,
  key: 'objectFunctionMap' | 'paramUnitMap',
  deriveMap: (value: any) => Record<string, any> | undefined,
): void {
  const explicitMap = cls?.[key];
  if (explicitMap && typeof explicitMap === 'object') {
    lib[key] = explicitMap;
    return;
  }

  const derivedMap = deriveMap(cls);
  if (derivedMap) lib[key] = derivedMap;
}

function hasDerivedLibraryEntries(lib: any): boolean {
  return Boolean(
    (lib.objects && lib.objects.length)
    || (lib.functions && lib.functions.length)
    || (lib.params && lib.params.length)
    || (lib.units && lib.units.length),
  );
}

function getExplicitLibrary(runtime: any): any | null {
  return (runtime && (runtime.library || (runtime.dsl && runtime.dsl.library))) || null;
}

function buildHeuristicLibrary(runtime: any): any {
  return {
    objects: Array.isArray((runtime?.objects || [])) ? runtime.objects : [],
    functions: Array.isArray((runtime?.functions || [])) ? runtime.functions : [],
    params: deriveSystemParamNames(runtime),
    units: Array.isArray((runtime?.units || [])) ? runtime.units : [],
  };
}

/** Derive library from runtime classes */
export function deriveFromClasses(runtime: any): any | null {
  try {
    const cls = getClassLibrarySource(runtime);
    if (!cls) return null;

    const lib = buildDerivedLibrary(cls, runtime);
    assignDerivedMap(lib, cls, 'objectFunctionMap', buildObjectFunctionMap);
    assignDerivedMap(lib, cls, 'paramUnitMap', buildParamUnitMap);

    if (hasDerivedLibraryEntries(lib)) return lib;
  } catch { /* silent */ }
  return null;
}

/** Extract library from runtime - tries explicit, class-derived, then fallback */
export function extractLibrary(runtime: any): any {
  try {
    const explicitLib = getExplicitLibrary(runtime);
    const classLib = deriveFromClasses(runtime);
    if (explicitLib && typeof explicitLib === 'object') {
      return explicitLib;
    } else if (classLib) {
      return classLib;
    } else {
      return buildHeuristicLibrary(runtime);
    }
  } catch { /* silent */ }
  return { objects: [], functions: [], params: [], units: [] };
}

/** Create console shim for capturing logs */
export function createConsoleShim(logs: string[]): Console {
  const push = (prefix: string, args: any[]) => {
    try { logs.push(prefix + args.map(String).join(' ')); } catch { /* silent */ }
  };
  return {
    log: (...a: any[]) => push('', a),
    warn: (...a: any[]) => push('[warn] ', a),
    error: (...a: any[]) => push('[error] ', a),
    info: (...a: any[]) => push('[info] ', a),
    debug: () => {},
    trace: () => {},
    assert: () => {},
    clear: () => {},
    count: () => {},
    countReset: () => {},
    dir: () => {},
    dirxml: () => {},
    group: () => {},
    groupCollapsed: () => {},
    groupEnd: () => {},
    table: () => {},
    time: () => {},
    timeEnd: () => {},
    timeLog: () => {},
    timeStamp: () => {},
    profile: () => {},
    profileEnd: () => {},
  } as Console;
}
