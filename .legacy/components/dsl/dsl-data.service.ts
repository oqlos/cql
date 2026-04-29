import { MAX_PAGE_SIZE } from '../../config/api.config';
import { fetchWithAuth } from '../../utils/fetch.utils';
import { logger } from '../../utils/logger';
// frontend/src/components/dsl/dsl-data.service.ts
// Shared service for loading DSL data from API endpoints
// Replaces duplicate fetch calls in connect-manager and connect-test modules


export interface DslObject {
  id: string;
  name: string;
  raw?: any;
}

export interface DslFunction {
  id: string;
  name: string;
  runtime?: string;
  handler?: string;
  raw?: any;
}

export interface DslParam {
  id: string;
  name: string;
  units?: string;
  raw?: any;
}

export interface DslUnit {
  id: string;
  code: string;
  name: string;
  raw?: any;
}

export interface DslObjectFunction {
  id: string;
  object_id: string;
  function_id: string;
  raw?: any;
}

export interface DslParamUnit {
  id: string;
  param_id: string;
  unit_id: string;
  is_default?: string;
  raw?: any;
}

export interface DslData {
  objects: DslObject[];
  functions: DslFunction[];
  params: DslParam[];
  units: DslUnit[];
  objectFunctions: DslObjectFunction[];
  paramUnits: DslParamUnit[];
}

interface SharedSchemaBinding {
  functions?: string[];
  units?: string[];
}

interface SharedSchemaEntry {
  id: string;
  name: string;
  type?: string;
  symbol?: string;
  functions?: string[];
  units?: string[];
  raw?: any;
}

interface SharedSchemaResponse {
  objects: SharedSchemaEntry[];
  functions: SharedSchemaEntry[];
  params: SharedSchemaEntry[];
  units: SharedSchemaEntry[];
  variables?: SharedSchemaEntry[];
  objectFunctionMap?: Record<string, SharedSchemaBinding>;
  paramUnitMap?: Record<string, SharedSchemaBinding>;
}

class DslDataService {
  private cache: DslData | null = null;
  private loading: Promise<DslData> | null = null;

  private normalizeList(values: unknown): string[] {
    const seen = new Set<string>();
    const normalized: string[] = [];
    for (const value of Array.isArray(values) ? values : []) {
      const text = String(value || '').trim();
      if (!text || seen.has(text)) continue;
      seen.add(text);
      normalized.push(text);
    }
    return normalized;
  }

  private getSharedSchemaUrls(): string[] {
    const urls: string[] = [];
    const seen = new Set<string>();
    const push = (value: string) => {
      const normalized = String(value || '').trim();
      if (!normalized || seen.has(normalized)) return;
      seen.add(normalized);
      urls.push(normalized);
    };

    push(String((globalThis as any).__dslSchemaUrlOverride || ''));
    push('/api/v1/schema');

    try {
      const currentUrl = new URL(String(globalThis.location?.href || globalThis.location?.origin || 'http://localhost/'));
      push(`${currentUrl.protocol}//${currentUrl.hostname}:8203/api/v1/schema`);
    } catch {
      // Ignore invalid location state and keep relative fallback only.
    }

    return urls;
  }

  private buildObjectFunctionsFromBindings(
    bindings: Record<string, SharedSchemaBinding> | undefined,
    objects: DslObject[],
    functions: DslFunction[],
    idPrefix: string,
  ): DslObjectFunction[] {
    const objectByName = new Map(objects.map((item) => [item.name.trim(), item]));
    const functionByName = new Map(functions.map((item) => [item.name.trim(), item]));
    const relations: DslObjectFunction[] = [];

    for (const [objectName, binding] of Object.entries(bindings || {})) {
      const objectRef = objectByName.get(objectName.trim());
      if (!objectRef) continue;

      for (const functionName of this.normalizeList(binding?.functions)) {
        const functionRef = functionByName.get(functionName);
        if (!functionRef) continue;
        relations.push({
          id: `${idPrefix}-${objectRef.id}-${functionRef.id}`,
          object_id: objectRef.id,
          function_id: functionRef.id,
          raw: { source: idPrefix }
        });
      }
    }

    return relations;
  }

  private buildParamUnitsFromBindings(
    bindings: Record<string, SharedSchemaBinding> | undefined,
    params: DslParam[],
    units: DslUnit[],
    idPrefix: string,
  ): DslParamUnit[] {
    const paramByName = new Map(params.map((item) => [item.name.trim(), item]));
    const unitByName = new Map<string, DslUnit>();
    for (const item of units) {
      if (item.name.trim()) unitByName.set(item.name.trim(), item);
      if (item.code.trim()) unitByName.set(item.code.trim(), item);
    }

    const relations: DslParamUnit[] = [];
    for (const [paramName, binding] of Object.entries(bindings || {})) {
      const paramRef = paramByName.get(paramName.trim());
      if (!paramRef) continue;

      for (const unitName of this.normalizeList(binding?.units)) {
        const unitRef = unitByName.get(unitName);
        if (!unitRef) continue;
        relations.push({
          id: `${idPrefix}-${paramRef.id}-${unitRef.id}`,
          param_id: paramRef.id,
          unit_id: unitRef.id,
          raw: { source: idPrefix }
        });
      }
    }

    return relations;
  }

  private buildSharedObjectBindings(schema: SharedSchemaResponse): Record<string, SharedSchemaBinding> {
    const bindings = new Map<string, SharedSchemaBinding>();

    for (const item of schema.objects || []) {
      const functions = this.normalizeList(item.functions);
      if (functions.length) {
        bindings.set(item.name.trim(), { functions });
      }
    }

    for (const [name, binding] of Object.entries(schema.objectFunctionMap || {})) {
      const functions = this.normalizeList(binding?.functions);
      if (functions.length) {
        bindings.set(name.trim(), { functions });
      }
    }

    return Object.fromEntries(bindings.entries());
  }

  private buildSharedParamBindings(schema: SharedSchemaResponse): Record<string, SharedSchemaBinding> {
    const bindings = new Map<string, SharedSchemaBinding>();

    for (const item of schema.params || []) {
      const units = this.normalizeList(item.units);
      if (units.length) {
        bindings.set(item.name.trim(), { units });
      }
    }

    for (const [name, binding] of Object.entries(schema.paramUnitMap || {})) {
      const units = this.normalizeList(binding?.units);
      if (units.length) {
        bindings.set(name.trim(), { units });
      }
    }

    return Object.fromEntries(bindings.entries());
  }

  private async fetchSharedSchema(): Promise<DslData | null> {
    for (const url of this.getSharedSchemaUrls()) {
      try {
        const response = await fetchWithAuth(url);
        if (!response.ok) continue;

        const schema = await response.json() as SharedSchemaResponse;
        const objects = (schema.objects || []).map((item, index) => ({
          id: String(item.id || `schema-obj-${index}`),
          name: String(item.name || ''),
          raw: item,
        }));
        const functions = (schema.functions || []).map((item, index) => ({
          id: String(item.id || `schema-fn-${index}`),
          name: String(item.name || ''),
          runtime: String(item.type || ''),
          handler: String(item.type || ''),
          raw: item,
        }));
        const params = (schema.params || []).map((item, index) => ({
          id: String(item.id || `schema-param-${index}`),
          name: String(item.name || ''),
          units: this.normalizeList(item.units).join(','),
          raw: item,
        }));
        const units = (schema.units || []).map((item, index) => ({
          id: String(item.id || `schema-unit-${index}`),
          code: String(item.symbol || item.name || ''),
          name: String(item.name || item.symbol || ''),
          raw: item,
        }));

        return {
          objects,
          functions,
          params,
          units,
          objectFunctions: this.buildObjectFunctionsFromBindings(
            this.buildSharedObjectBindings(schema),
            objects,
            functions,
            'shared-schema-of'
          ),
          paramUnits: this.buildParamUnitsFromBindings(
            this.buildSharedParamBindings(schema),
            params,
            units,
            'shared-schema-pu'
          )
        };
      } catch {
        // Try the next fallback URL.
      }
    }

    return null;
  }

  async loadAll(): Promise<DslData> {
    if (this.cache) {
      return this.cache;
    }

    if (this.loading) {
      return this.loading;
    }

    this.loading = this.fetchAll();
    try {
      this.cache = await this.loading;
      return this.cache;
    } finally {
      this.loading = null;
    }
  }

  /**
   * Try to load DSL data from DEF library first (JavaScript config),
   * only fall back to API if DEF is not available.
   */
  private async fetchAll(): Promise<DslData> {
    // 1. Try DEF library first
    const defData = await this.tryFetchFromDefLibrary();
    if (defData) return defData;

    // 2. Fall back to API calls
    try {
      const apiData = await this.fetchFromApi();
      if (apiData) return apiData;
    } catch {
      // API failed, will try shared schema below
    }

    // 3. Try shared schema as last resort
    const sharedSchema = await this.fetchSharedSchema();
    if (sharedSchema) return sharedSchema;

    // 4. Return empty data if all sources failed
    logger.warn('DSL data sources not available, using empty data');
    return this.getEmptyDslData();
  }

  // Helper methods for backward compatibility
  getFunctionsForObject(objectName: string): string[] {
    if (!this.cache) return [];
    
    const obj = this.cache.objects.find(o => o.name.trim() === objectName.trim());
    if (!obj) return [];
    
    const functionIds = new Set(
      this.cache.objectFunctions
        .filter(of => of.object_id === obj.id)
        .map(of => of.function_id)
    );
    
    return this.cache.functions
      .filter(f => functionIds.has(f.id))
      .map(f => f.name);
  }

  getUnitsForParam(paramName: string): string[] {
    if (!this.cache) return [];
    
    const param = this.cache.params.find(p => p.name.trim() === paramName.trim());
    if (!param) return [];
    
    const unitIds = new Set(
      this.cache.paramUnits
        .filter(pu => pu.param_id === param.id)
        .map(pu => pu.unit_id)
    );
    
    return this.cache.units
      .filter(u => unitIds.has(u.id))
      .map(u => u.code);
  }

  clearCache(): void {
    this.cache = null;
    this.loading = null;
  }

  // Data transformation helpers - extracted from fetchAll to reduce CC
  private transformDslObjects(objs: any[]): DslObject[] {
    return (objs || []).map((r: any) => ({
      id: String(r?.id || ''),
      name: String(r?.name || ''),
      raw: r
    }));
  }

  private transformDslFunctions(fns: any[]): DslFunction[] {
    return (fns || []).map((r: any) => ({
      id: String(r?.id || ''),
      name: String(r?.name || ''),
      runtime: String(r?.runtime || ''),
      handler: String(r?.handler || ''),
      raw: r
    }));
  }

  private transformDslParams(prs: any[]): DslParam[] {
    return (prs || []).map((r: any) => ({
      id: String(r?.id || ''),
      name: String(r?.name || ''),
      units: Array.isArray(r?.units) ? r.units.join(',') : String(r?.units || ''),
      raw: r
    }));
  }

  private transformDslUnits(units: any[]): DslUnit[] {
    return (units || []).map((r: any) => ({
      id: String(r?.id || ''),
      code: String(r?.symbol || r?.code || r?.name || ''),
      name: String(r?.name || r?.code || ''),
      raw: r
    }));
  }

  private async tryFetchFromDefLibrary(): Promise<DslData | null> {
    try {
      const defLib = (globalThis as any).__scenarioDefLibrary;
      if (!defLib || typeof defLib !== 'object') return null;

      const arr = (v: any): string[] => Array.isArray(v) ? v.map((s) => String(s || '').trim()).filter(Boolean) : [];
      const objects = arr(defLib.objects);
      const functions = arr(defLib.functions);
      const params = arr(defLib.params);
      const units = arr(defLib.units);

      if (!objects.length && !functions.length && !params.length && !units.length) return null;

      const objectRows = objects.map((name, i) => ({ id: `def-obj-${i}`, name, raw: { name } }));
      const functionRows = functions.map((name, i) => ({ id: `def-fn-${i}`, name, raw: { name } }));
      const paramRows = params.map((name, i) => ({ id: `def-param-${i}`, name, units: '', raw: { name } }));
      const unitRows = units.map((code, i) => ({ id: `def-unit-${i}`, code, name: code, raw: { code, name: code } }));

      return {
        objects: objectRows,
        functions: functionRows,
        params: paramRows,
        units: unitRows,
        objectFunctions: this.buildObjectFunctionsFromBindings(defLib.objectFunctionMap, objectRows, functionRows, 'def-of'),
        paramUnits: this.buildParamUnitsFromBindings(defLib.paramUnitMap, paramRows, unitRows, 'def-pu')
      };
    } catch {
      return null;
    }
  }

  private async fetchFromApi(): Promise<DslData | null> {
    const p = new URLSearchParams({ skip: '0', limit: String(MAX_PAGE_SIZE) });
    const [objsRes, fnsRes, paramsRes, unitsRes] = await Promise.all([
      fetchWithAuth(`/api/v3/dsl/objects?${p.toString()}`),
      fetchWithAuth(`/api/v3/dsl/functions?${p.toString()}`),
      fetchWithAuth(`/api/v3/dsl/params?${p.toString()}`),
      fetchWithAuth(`/api/v3/dsl/units?${p.toString()}`),
    ]);

    if (![objsRes, fnsRes, paramsRes, unitsRes].every((r) => r.ok)) {
      return null;
    }

    const [objsJson, fnsJson, paramsJson, unitsJson] = await Promise.all([
      objsRes.json(),
      fnsRes.json(),
      paramsRes.json(),
      unitsRes.json(),
    ]);

    const objs = Array.isArray(objsJson?.data) ? objsJson.data : [];
    const fns = Array.isArray(fnsJson?.data) ? fnsJson.data : [];
    const prs = Array.isArray(paramsJson?.data) ? paramsJson.data : [];
    const units = Array.isArray(unitsJson?.data) ? unitsJson.data : [];

    return {
      objects: this.transformDslObjects(objs),
      functions: this.transformDslFunctions(fns),
      params: this.transformDslParams(prs),
      units: this.transformDslUnits(units),
      objectFunctions: [],
      paramUnits: []
    };
  }

  private getEmptyDslData(): DslData {
    return {
      objects: [],
      functions: [],
      params: [],
      units: [],
      objectFunctions: [],
      paramUnits: []
    };
  }
}

export const dslDataService = new DslDataService();
