// frontend/src/components/dsl/dsl.runtime.task-builder.ts
// runTask builder for DSL runtime - extracted from dsl.runtime.ts

import { logger } from '../../utils/logger';

export type RunTaskFn = (fn: string, object?: string) => Promise<void>;

/** Build runTask executor using DEF mappings */
export function buildRunTask(runtime: any): RunTaskFn | null {
  try {
    const lib = (runtime && (runtime.library || runtime.dsl?.library)) || {};
    const baseObjMap = (lib && lib.objectActionMap) || {};
    const baseFnMap = (lib && lib.actions) || {};
    const gmap = (typeof globalThis !== 'undefined' && (globalThis as any).__scenarioMap) || {};
    const mapObjMap = (gmap && gmap.objectActionMap) || {};
    const mapFnMap = (gmap && gmap.actions) || {};

    // Top-level merge with MAP having priority
    const objMap = { ...baseObjMap, ...mapObjMap } as Record<string, any>;
    const fnMap = { ...baseFnMap, ...mapFnMap } as Record<string, any>;
    const fetchImpl: typeof fetch | null = (typeof fetch !== 'undefined') ? fetch.bind(globalThis) : null;

    return async (fn: string, object?: string) => {
      try {
        const o = String(object || '').trim();
        const f = String(fn || '').trim();
        if (!f) return;

        const objEntry = objMap && o ? objMap[o] : undefined;
        const byObj = objEntry ? (objEntry[f] || (objEntry[f?.toLowerCase?.()] as any)) : undefined;
        const byFn = (fnMap && (fnMap[f] || (fnMap[f?.toLowerCase?.()] as any)));
        const act: any = byObj || byFn;

        if (!act || !act.kind) return;

        if (act.kind === 'api' && fetchImpl) {
          await executeApiAction(act, o, f, fetchImpl);
          return;
        }

        if (act.kind === 'script') {
          logScriptAction(act, o, f);
          return;
        }

        // Custom kinds can be handled by host app using runtime.dslFunctions?.RUN
        if (runtime?.dslFunctions && typeof runtime.dslFunctions.RUN === 'function') {
          try { await runtime.dslFunctions.RUN({ fn: f, object: o, act }); } catch { /* silent */ }
        }
      } catch (e) {
        try { logger.warn('runTask failed', e); } catch { /* silent */ }
      }
    };
  } catch { return null; }
}

/** Execute API action via fetch */
async function executeApiAction(act: any, object: string, fn: string, fetchImpl: typeof fetch): Promise<void> {
  let url = String(act.url || '').trim();
  const method = String(act.method || 'POST').toUpperCase();
  const headers = (act.headers && typeof act.headers === 'object')
    ? act.headers
    : { 'Content-Type': 'application/json' };
  const body = (act.body !== undefined && act.body !== null) ? JSON.stringify(act.body) : undefined;

  // Placeholder substitution
  const repl = (s: string) => s.replace(/\{object\}/g, object).replace(/\{function\}/g, fn);
  if (url) url = repl(url);
  const b = body ? repl(body) : undefined;

  const res = await fetchImpl(url, { method, headers, body: b } as RequestInit);
  if (!res.ok) {
    try { logger.warn('runTask API error', res.status, await res.text()); } catch { /* silent */ }
  }
}

/** Log script action (frontend cannot execute OS scripts) */
function logScriptAction(act: any, object: string, fn: string): void {
  try {
    console.info('runTask(script)', { fn, object, path: act.path, args: act.args });
  } catch { /* silent */ }
}

/** Build getParamValue getter from runtime */
export function buildGetter(runtime: any): ((name: string) => number | string | null) | null {
  try {
    if (typeof runtime.getParamValue === 'function') {
      return (name: string) => normalize(runtime.getParamValue(name));
    } else if (runtime.dslFunctions && typeof runtime.dslFunctions.GET === 'function') {
      return (name: string) => {
        try { return normalize(runtime.dslFunctions.GET(name)); } catch { return null; }
      };
    } else if (runtime.systemVars && typeof runtime.systemVars === 'object') {
      return (name: string) => normalize(runtime.systemVars[name]);
    }
  } catch { /* silent */ }
  return null;
}

/** Normalize value (imported from helpers to avoid circular dep) */
function normalize(v: any): number | string | null {
  const n = toNumber(v);
  if (n !== null) return n;
  if (typeof v === 'string') return v;
  try { return JSON.parse(JSON.stringify(v)); } catch { return null; }
}

/** Convert value to number */
function toNumber(v: any): number | null {
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
