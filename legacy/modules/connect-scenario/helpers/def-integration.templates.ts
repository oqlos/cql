/**
 * def-integration.templates.ts
 * DEF code templates extracted from def-integration.ts
 */

export interface DefTemplateParams {
  scenarioId: string;
  objects: string[];
  functions: string[];
  params: string[];
  units: string[];
  objectFunctionMap: Record<string, string[]>;
  paramUnitsMap: Record<string, string[]>;
}

export function generateDefTemplate(p: DefTemplateParams): string {
  const { scenarioId, objects, functions, params, units, objectFunctionMap, paramUnitsMap } = p;
  
  // Build default object function map if empty
  const objFnMap = Object.keys(objectFunctionMap).length
    ? objectFunctionMap
    : objects.reduce((acc: Record<string, string[]>, o: string) => { 
        acc[o] = ["Włącz","Wyłącz","Ustaw","Sprawdź"]; 
        return acc; 
      }, {});
  
  // Build default param units map if empty
  const pUnitsMap = Object.keys(paramUnitsMap).length
    ? paramUnitsMap
    : { "ciśnienie": ["bar","mbar","Pa"], "czas": ["s","min","h"], "timer": ["s","min"] };

  return `// DSL Definition for scenario: ${scenarioId}
// Generated automatically from scenario content

const systemVars = {
  "czas": 10,
  "timer": 12,
  "ciśnienie": 1.5
};

const library = {
  objects: ${JSON.stringify(objects, null, 2)},
  functions: ${JSON.stringify(functions, null, 2)},
  params: ${JSON.stringify(params, null, 2)},
  units: ${JSON.stringify(units, null, 2)}
};

// Get parameter value with fallback to default
const getParamValue = (paramName) => {
  if (paramName in systemVars) return systemVars[paramName];
  const defaults = { czas: 0, timer: 0, ciśnienie: 0 };
  return defaults[paramName] || null;
};

// Set parameter value
const setParamValue = (paramName, value) => {
  systemVars[paramName] = value;
};

// Get functions for object
const getFunctionsForObject = (objectName) => {
  const objectFunctions = ${JSON.stringify(objFnMap, null, 2)};
  return objectFunctions[objectName] || [];
};

// Get units for parameter
const getUnitsForParam = (paramName) => {
  const paramUnits = ${JSON.stringify(pUnitsMap, null, 2)};
  return paramUnits[paramName] || [];
};

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { systemVars, library, getParamValue, setParamValue, getFunctionsForObject, getUnitsForParam };
} else if (typeof exports !== 'undefined') {
  Object.assign(exports, { systemVars, library, getParamValue, setParamValue, getFunctionsForObject, getUnitsForParam });
} else {
  (typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this)).dslDefinition = { systemVars, library, getParamValue, setParamValue, getFunctionsForObject, getUnitsForParam };
}`;
}

export function buildObjectFunctionMapFromLib(
  objects: string[],
  curLib: any
): Record<string, string[]> {
  const objFnMapRaw = (curLib && typeof curLib === 'object' && curLib.objectFunctionMap) || {};
  const objectFunctionMap: Record<string, string[]> = {};
  
  if (objFnMapRaw && typeof objFnMapRaw === 'object') {
    for (const o of objects) {
      try {
        const entry = objFnMapRaw[o];
        const listRaw: any[] = Array.isArray(entry?.functions) ? entry.functions : [];
        const seen: Record<string, boolean> = {};
        const uniqList: string[] = [];
        for (const s of listRaw) {
          const v = String(s || '').trim();
          if (v && !seen[v]) { seen[v] = true; uniqList.push(v); }
        }
        if (uniqList.length) objectFunctionMap[o] = uniqList;
      } catch { /* silent */ }
    }
  }
  
  return objectFunctionMap;
}

export function buildParamUnitsMapFromLib(
  params: string[],
  curLib: any
): Record<string, string[]> {
  const paramUnitMapRaw = (curLib && typeof curLib === 'object' && curLib.paramUnitMap) || {};
  const paramUnitsMap: Record<string, string[]> = {};
  
  if (paramUnitMapRaw && typeof paramUnitMapRaw === 'object') {
    for (const p of params) {
      try {
        const entry = paramUnitMapRaw[p];
        const listRaw: any[] = Array.isArray(entry?.units) ? entry.units : [];
        const seen: Record<string, boolean> = {};
        const cleaned: string[] = [];
        for (const s of listRaw) {
          const v = String(s || '').trim();
          if (v && !/^\[\s*\]$/.test(v) && !seen[v]) { seen[v] = true; cleaned.push(v); }
        }
        if (cleaned.length) paramUnitsMap[p] = cleaned;
      } catch { /* silent */ }
    }
  }
  
  return paramUnitsMap;
}
