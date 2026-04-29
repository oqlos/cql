/**
 * def-library.ts
 * DEF library extraction and mapping utilities.
 * Extracted from def-integration.ts
 */

import { logger } from '../../../utils/logger';

const DEFAULT_FUNCTIONS = ['Włącz', 'Wyłącz', 'Ustaw', 'Sprawdź', 'Otwórz', 'Zamknij', 'Odczytaj'];
const DEFAULT_PARAMS = ['ciśnienie', 'czas', 'timer', 'temperatura', 'przepływ'];
const DEFAULT_UNITS = ['bar', 'mbar', 's', 'min', 'h', '°C', 'l/min', '%'];

function readOptionValues(selector: string, fallbackValues: string[] = []): string[] {
  const values = new Set<string>();

  document.querySelectorAll(`${selector} option`).forEach((option: any) => {
    const value = String(option?.value || '').trim();
    if (value) values.add(value);
  });

  if (!values.size) {
    fallbackValues.forEach((value) => values.add(value));
  }

  return Array.from(values).sort();
}

function normalizeStringList(values: any[]): string[] {
  return Array.from(new Set(values.map((value: any) => String(value || '').trim()).filter(Boolean)));
}

function mergeObjectMappings(
  fallbackMapping: Record<string, string[]>,
  staticMapping: Record<string, string[]>,
): Record<string, string[]> {
  return { ...fallbackMapping, ...staticMapping };
}

function mergeParamMappings(
  fallbackMapping: Record<string, { units: string[]; defaultUnit?: string }>,
  staticMapping: Record<string, { units: string[]; defaultUnit?: string }>,
): Record<string, { units: string[]; defaultUnit?: string }> {
  return { ...fallbackMapping, ...staticMapping };
}

function findUnitInContainers(containerSelector: string, param: string): string {
  const normalizedParam = String(param || '').trim();
  const containers = Array.from(document.querySelectorAll(containerSelector)) as HTMLElement[];

  for (const container of containers) {
    const selectedParam = String((container.querySelector('.param-select') as HTMLSelectElement | null)?.value || '').trim();
    if (selectedParam !== normalizedParam) continue;

    const unit = String((container.querySelector('.unit-select') as HTMLSelectElement | null)?.value || '').trim();
    if (unit) return unit;
  }

  return '';
}

function getFirstLibraryUnit(param: string): string {
  try {
    const lib: any = (globalThis as any).__scenarioDefLibrary;
    const units = Array.isArray(lib?.paramUnitMap?.[param]?.units) ? lib.paramUnitMap[param].units : [];
    return units.length ? String(units[0]) : '';
  } catch {
    return '';
  }
}

/**
 * Extract current objects from DOM selects.
 */
export function extractCurrentObjects(): string[] {
  return readOptionValues('.object-select');
}

/**
 * Extract current functions from DOM selects.
 */
export function extractCurrentFunctions(): string[] {
  return readOptionValues('.function-select', DEFAULT_FUNCTIONS);
}

/**
 * Extract current params from DOM selects.
 */
export function extractCurrentParams(): string[] {
  return readOptionValues('.param-select', DEFAULT_PARAMS);
}

/**
 * Extract current units from DOM selects.
 */
export function extractCurrentUnits(): string[] {
  return readOptionValues('.unit-select', DEFAULT_UNITS);
}

/**
 * Build object->functions mapping from exported DEF library.
 */
function parseStaticObjectFunctionMap(staticMap: any): Record<string, string[]> {
  const mapping: Record<string, string[]> = {};
  if (!staticMap || typeof staticMap !== 'object') return mapping;
  for (const k of Object.keys(staticMap)) {
    try {
      const entry = (staticMap as any)[k];
      const arr = Array.isArray(entry?.functions)
        ? (entry.functions as any[])
        : (Array.isArray(entry) ? entry : []);
      mapping[k] = normalizeStringList(arr);
    } catch { /* silent */ }
  }
  return mapping;
}

function inferObjectFunctionFallback(lib: any): Record<string, string[]> {
  const mapping: Record<string, string[]> = {};
  const objects: string[] = Array.isArray(lib?.objects)
    ? normalizeStringList(lib.objects.map((o: any) => o?.name || o))
    : [];
  const functions: string[] = Array.isArray(lib?.functions)
    ? normalizeStringList(lib.functions.map((f: any) => f?.name || f))
    : [];
  if (objects.length && functions.length) {
    for (const obj of objects) {
      if (!mapping[obj]) mapping[obj] = [...functions];
    }
  }
  return mapping;
}

export function buildObjectFunctionMap(exported: any): Record<string, string[]> {
  let staticMapping: Record<string, string[]> = {};
  let fallbackMapping: Record<string, string[]> = {};
  try { staticMapping = parseStaticObjectFunctionMap(exported?.library?.objectFunctionMap); } catch { /* silent */ }
  try { fallbackMapping = inferObjectFunctionFallback(exported?.library); } catch { /* silent */ }
  return mergeObjectMappings(fallbackMapping, staticMapping);
}

/**
 * Build param->units mapping from exported DEF library.
 */
function parseStaticParamUnitMap(staticMap: any): Record<string, { units: string[]; defaultUnit?: string }> {
  const mapping: Record<string, { units: string[]; defaultUnit?: string }> = {};
  if (!staticMap || typeof staticMap !== 'object') return mapping;
  for (const k of Object.keys(staticMap)) {
    const entry = staticMap[k];
    if (entry) {
      mapping[k] = {
        units: normalizeStringList(Array.isArray(entry.units) ? entry.units : (Array.isArray(entry) ? entry : [])),
        defaultUnit: typeof entry.defaultUnit === 'string' ? entry.defaultUnit : undefined,
      };
    }
  }
  return mapping;
}

function inferParamUnitFallback(lib: any): Record<string, { units: string[]; defaultUnit?: string }> {
  const mapping: Record<string, { units: string[]; defaultUnit?: string }> = {};
  const params: string[] = Array.isArray(lib?.params)
    ? normalizeStringList(lib.params.map((p: any) => p?.name || p))
    : [];
  const units: string[] = Array.isArray(lib?.units)
    ? normalizeStringList(lib.units.map((u: any) => u?.code || u?.name || u))
    : [];
  if (params.length && units.length) {
    for (const param of params) {
      if (!mapping[param]) mapping[param] = { units: [...units] };
    }
  }
  return mapping;
}

export function buildParamUnitMap(exported: any): Record<string, { units: string[]; defaultUnit?: string }> {
  let staticMapping: Record<string, { units: string[]; defaultUnit?: string }> = {};
  let fallbackMapping: Record<string, { units: string[]; defaultUnit?: string }> = {};
  try { staticMapping = parseStaticParamUnitMap(exported?.library?.paramUnitMap); } catch { /* silent */ }
  try { fallbackMapping = inferParamUnitFallback(exported?.library); } catch { /* silent */ }
  return mergeParamMappings(fallbackMapping, staticMapping);
}

/**
 * Update global DEF library from DEF code string.
 * Only accepts JavaScript module code, not DSL text.
 */
const DSL_KEYWORDS = /^(GOAL:|FUNC:|SET\s|TASK\s|IF\s|ELSE|OUT\s|DIALOG|WAIT|INFO|REPEAT|GET\s)/im;

function isDslCode(code: string): boolean {
  return DSL_KEYWORDS.test(code);
}

function isJsModuleCode(code: string): boolean {
  return code.includes('module.exports') || code.includes('exports.') || code.includes('library');
}

function executeDefCode(code: string): any {
  const safeGlobal = {
    module: { exports: {} },
    exports: {},
    console: { log: () => {}, warn: () => {}, error: () => {} }
  };
  const func = new Function('module', 'exports', 'console', code);
  func(safeGlobal.module, safeGlobal.exports, safeGlobal.console);
  return safeGlobal.module.exports || safeGlobal.exports;
}

export function updateDefLibraryFromCode(defCode: string, onRefresh?: () => void): void {
  try {
    const code = (defCode || '').trim();
    if (!code) return;
    if (isDslCode(code)) return;
    if (!isJsModuleCode(code)) return;

    const exported = executeDefCode(code);
    if (exported?.library) {
      (globalThis as any).__scenarioDefLibrary = {
        ...exported.library,
        objectFunctionMap: buildObjectFunctionMap(exported),
        paramUnitMap: buildParamUnitMap(exported)
      };
      (globalThis as any).__dslLibrarySourceOverride = 'DEF';
      if (onRefresh) onRefresh();
    }
  } catch (error) {
    logger.warn('Failed to update DEF library from code:', error);
  }
}

/**
 * Get unit from UI for a given parameter.
 */
export function getUnitFromUi(param: string): string {
  try {
    const rowUnit = findUnitInContainers('.var-row', param);
    if (rowUnit) return rowUnit;

    const conditionUnit = findUnitInContainers('.condition-group', param);
    if (conditionUnit) return conditionUnit;
  } catch { /* silent */ }

  // Fallback to library
  return getFirstLibraryUnit(param);
}
