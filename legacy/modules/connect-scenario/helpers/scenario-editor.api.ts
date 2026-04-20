/**
 * scenario-editor.api.ts
 * API and data fetching functions for scenario editor
 */
import { escapeHtml } from '../../../utils/html.utils';

/** Cached definitions */
let defsCache: Array<{ type: string; name: string; units?: string }> | null = null;

/** Cached functions */
let funcsCache: Array<any> | null = null;

/** Lazy-loaded FirmwareCQRS singleton */
let fwSingleton: Promise<any> | null = null;

/**
 * Get FirmwareCQRS service (lazy import)
 */
export async function getFirmware(): Promise<any> {
  if (!fwSingleton) {
    fwSingleton = import('../../../services/firmware-cqrs.service').then(m => m.FirmwareCQRS);
  }
  return fwSingleton;
}

/**
 * Fetch DSL functions from data service
 */
export async function fetchDslFunctions(): Promise<any[]> {
  if (funcsCache) return funcsCache || [];
  try {
    const { dslDataService } = await import('../../../components/dsl');
    const data = await dslDataService.loadAll();
    funcsCache = data.functions.map((f: any) => f.raw || f);
    return funcsCache || [];
  } catch {
    funcsCache = [];
    return funcsCache || [];
  }
}

/**
 * Fetch DSL definitions (objects, functions, params)
 */
export async function fetchDefinitions(): Promise<Array<{ type: string; name: string; units?: string }>> {
  if (defsCache) return defsCache;
  try {
    const { dslDataService } = await import('../../../components/dsl');
    const data = await dslDataService.loadAll();
    
    const defs: Array<{ type: string; name: string; units?: string }> = [];
    for (const obj of data.objects) defs.push({ type: 'object', name: obj.name, units: '' });
    for (const fn of data.functions) defs.push({ type: 'function', name: fn.name, units: '' });
    for (const param of data.params) defs.push({ type: 'param', name: param.name, units: param.units || '' });
    
    defsCache = defs.filter(v => v.type && v.name);
    return defsCache || [];
  } catch {
    defsCache = [];
    return defsCache || [];
  }
}

/**
 * Fetch current runtime state from firmware
 */
export async function fetchRuntimeState(): Promise<Record<string, any>> {
  // 1) Try projection (live execution state)
  try {
    const FirmwareCQRS = await getFirmware();
    const proj = await FirmwareCQRS.getProjection();
    if (proj && typeof proj === 'object') {
      // common shapes: { variables: [{name,value}], state: {...} }
      if (Array.isArray((proj as any).variables)) {
        const map: Record<string, any> = {};
        for (const it of (proj as any).variables) {
          const k = (it?.name || it?.id || '').toString();
          if (k) map[k] = (it?.value ?? it?.current ?? it?.state ?? '');
        }
        if (Object.keys(map).length) return map;
      }
      if (proj && typeof (proj as any).state === 'object') {
        return (proj as any).state as Record<string, any>;
      }
    }
  } catch { /* silent */ }
  
  // 2) Fallback to generic state candidates endpoints
  try {
    const FirmwareCQRS = await getFirmware();
    const data = await FirmwareCQRS.getStateCandidates();
    if (!data) return {};
    if (Array.isArray(data)) {
      const map: Record<string, any> = {};
      for (const it of data) {
        const k = (it?.name || it?.id || '').toString();
        if (k) map[k] = (it?.value ?? it?.current ?? it?.state ?? '');
      }
      return map;
    }
    if (typeof data === 'object') {
      return data as Record<string, any>;
    }
  } catch { /* silent */ }
  
  return {};
}

/**
 * Render state rows as HTML table rows
 */
export function renderStateRows(
  defs: Array<{ type: string; name: string; units?: string }>, 
  runtime: Record<string, any>
): string {
  const rows = (defs.length ? defs : Object.keys(runtime).map(k => ({ type: '', name: k, units: '' })))
    .filter(v => String(v?.type || '').toLowerCase() !== 'function');
  
  return rows.map(v => {
    const key = v.name;
    const val = runtime[key];
    const valueStr = (val === undefined || val === null || val === '') ? '—' : String(val);
    return `<tr><td>${escapeHtml(v.type)}</td><td>${escapeHtml(v.name)}</td><td>${escapeHtml(valueStr)}</td><td>${escapeHtml(v.units || '')}</td></tr>`;
  }).join('');
}
