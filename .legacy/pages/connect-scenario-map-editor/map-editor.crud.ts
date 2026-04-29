// map-editor.crud.ts
// Extracted from connect-scenario-map-editor.page.ts — CRUD editing operations for map data

import { FIRMWARE_URL } from '../../config/api.config';

interface MapData {
  objectActionMap: Record<string, Record<string, any>>;
  paramSensorMap: Record<string, any>;
  actions: Record<string, any>;
  funcImplementations: Record<string, any>;
}

export interface MapCrudContext {
  getMapData: () => MapData;
  syncToJsonEditor: () => void;
}

// ===== Top-level Add =====

export function addObject(ctx: MapCrudContext): void {
  const name = prompt('Nazwa obiektu:');
  if (!name) return;
  const map = ctx.getMapData();
  if (!map.objectActionMap) map.objectActionMap = {};
  map.objectActionMap[name] = {
    'Włącz': { kind: 'api', url: `${FIRMWARE_URL}/api/v1/peripherals/${name.replace(/\s+/g, '-').toLowerCase()}`, method: 'PUT' },
    'Wyłącz': { kind: 'api', url: `${FIRMWARE_URL}/api/v1/peripherals/${name.replace(/\s+/g, '-').toLowerCase()}`, method: 'PUT' }
  };
  ctx.syncToJsonEditor();
}

export function addParam(ctx: MapCrudContext): void {
  const name = prompt('Nazwa parametru:');
  if (!name) return;
  const map = ctx.getMapData();
  if (!map.paramSensorMap) map.paramSensorMap = {};
  map.paramSensorMap[name] = { sensor: 'AI01', url: `${FIRMWARE_URL}/api/v1/state`, unit: 'mbar' };
  ctx.syncToJsonEditor();
}

export function addAction(ctx: MapCrudContext): void {
  const name = prompt('Nazwa akcji:');
  if (!name) return;
  const map = ctx.getMapData();
  if (!map.actions) map.actions = {};
  map.actions[name] = { kind: 'api', url: `${FIRMWARE_URL}/api/v1/peripherals/${name.replace(/\s+/g, '-').toLowerCase()}`, method: 'POST' };
  ctx.syncToJsonEditor();
}

export function addFunc(ctx: MapCrudContext): void {
  const name = prompt('Nazwa FUNC:');
  if (!name) return;
  const map = ctx.getMapData();
  if (!map.funcImplementations) map.funcImplementations = {};
  map.funcImplementations[name] = { kind: 'sequence', steps: [{ action: 'Włącz', object: 'pompa 1' }] };
  ctx.syncToJsonEditor();
}

export function deleteItem(ctx: MapCrudContext, mapKey: keyof MapData, name: string): void {
  if (!confirm(`Usunąć "${name}"?`)) return;
  const m = ctx.getMapData()[mapKey] as Record<string, any>;
  if (m && m[name]) {
    delete m[name];
    ctx.syncToJsonEditor();
  }
}

// ===== Object Dialogs =====

export function editObjectDialog(ctx: MapCrudContext, name: string): void {
  const newName = prompt('Nowa nazwa obiektu:', name);
  if (!newName || newName === name) return;
  const map = ctx.getMapData();
  const data = map.objectActionMap[name];
  delete map.objectActionMap[name];
  map.objectActionMap[newName] = data;
  ctx.syncToJsonEditor();
}

export function addObjectAction(ctx: MapCrudContext, objName: string): void {
  const actionName = prompt('Nazwa akcji:');
  if (!actionName) return;
  const kind = prompt('Typ (api/ui/backend/sequence):', 'api') || 'api';
  const url = prompt('URL lub ścieżka:', `${FIRMWARE_URL}/api/v1/peripherals/${objName.replace(/\s+/g, '-').toLowerCase()}`);
  const map = ctx.getMapData();
  if (!map.objectActionMap[objName]) map.objectActionMap[objName] = {};
  map.objectActionMap[objName][actionName] = { kind, url, method: 'POST' };
  ctx.syncToJsonEditor();
}

export function editObjectAction(ctx: MapCrudContext, objName: string, actionName: string): void {
  const config = ctx.getMapData().objectActionMap[objName]?.[actionName];
  if (!config) return;
  const newActionName = prompt('Nazwa akcji:', actionName);
  if (!newActionName) return;
  const kind = prompt('Typ (api/ui/backend/sequence):', config.kind || 'api') || 'api';
  const url = prompt('URL lub ścieżka:', config.url || config.py || '');
  const method = prompt('Metoda HTTP (GET/POST/PUT):', config.method || 'POST') || 'POST';
  if (newActionName !== actionName) {
    delete ctx.getMapData().objectActionMap[objName][actionName];
  }
  ctx.getMapData().objectActionMap[objName][newActionName] = { kind, url, method };
  ctx.syncToJsonEditor();
}

export function deleteObjectAction(ctx: MapCrudContext, objName: string, actionName: string): void {
  if (!confirm(`Usunąć akcję "${actionName}" z obiektu "${objName}"?`)) return;
  if (ctx.getMapData().objectActionMap[objName]) {
    delete ctx.getMapData().objectActionMap[objName][actionName];
    ctx.syncToJsonEditor();
  }
}

// ===== Object Action Field Editing =====

export function editObjectActionName(ctx: MapCrudContext, objName: string, oldActionName: string): void {
  const config = ctx.getMapData().objectActionMap[objName]?.[oldActionName];
  if (!config) return;
  const newActionName = prompt('Nowa nazwa akcji:', oldActionName);
  if (!newActionName || newActionName === oldActionName) return;
  delete ctx.getMapData().objectActionMap[objName][oldActionName];
  ctx.getMapData().objectActionMap[objName][newActionName] = config;
  ctx.syncToJsonEditor();
}

export function editObjectActionField(ctx: MapCrudContext, objName: string, actionName: string, fieldName: string): void {
  const config = ctx.getMapData().objectActionMap[objName]?.[actionName];
  if (!config) return;
  const labels: Record<string, string> = {
    kind: 'Typ (api/ui/backend/sequence)',
    url: 'URL lub ścieżka API',
    method: 'Metoda HTTP (GET/POST/PUT/DELETE)'
  };
  const currentValue = config[fieldName] || '';
  const newValue = prompt(labels[fieldName] || fieldName + ':', currentValue);
  if (newValue === null) return;
  config[fieldName] = newValue;
  ctx.syncToJsonEditor();
}

export function addObjectActionField(ctx: MapCrudContext, objName: string, actionName: string): void {
  const config = ctx.getMapData().objectActionMap[objName]?.[actionName];
  if (!config) return;
  const fieldKey = prompt('Nazwa pola (key):');
  if (!fieldKey || !fieldKey.trim()) return;
  const fieldValue = prompt(`Wartość dla "${fieldKey}":`);
  if (fieldValue === null) return;
  config[fieldKey.trim()] = fieldValue;
  ctx.syncToJsonEditor();
}

export function deleteObjectActionField(ctx: MapCrudContext, objName: string, actionName: string, fieldName: string): void {
  const config = ctx.getMapData().objectActionMap[objName]?.[actionName];
  if (!config) return;
  if (!confirm(`Usunąć pole "${fieldName}"?`)) return;
  delete config[fieldName];
  ctx.syncToJsonEditor();
}

// ===== Param Dialogs =====

export function editParamDialog(ctx: MapCrudContext, name: string): void {
  const config = ctx.getMapData().paramSensorMap[name];
  if (!config) return;
  const newName = prompt('Nazwa parametru:', name);
  if (!newName) return;
  const sensor = prompt('Sensor ID:', config.sensor || 'AI01') || 'AI01';
  const unit = prompt('Jednostka:', config.unit || 'mbar') || 'mbar';
  const url = prompt('URL odczytu:', config.url || `${FIRMWARE_URL}/api/v1/state`);
  if (newName !== name) {
    delete ctx.getMapData().paramSensorMap[name];
  }
  ctx.getMapData().paramSensorMap[newName] = { sensor, unit, url };
  ctx.syncToJsonEditor();
}

export function editParamFieldDirect(ctx: MapCrudContext, paramName: string, fieldName: string): void {
  const config = ctx.getMapData().paramSensorMap?.[paramName];
  if (!config) return;
  const labels: Record<string, string> = { sensor: 'Sensor ID', unit: 'Jednostka', url: 'URL odczytu' };
  const newValue = prompt(labels[fieldName] || fieldName + ':', config[fieldName] || '');
  if (newValue === null) return;
  config[fieldName] = newValue;
  ctx.syncToJsonEditor();
}

export function addParamField(ctx: MapCrudContext, paramName: string): void {
  const config = ctx.getMapData().paramSensorMap?.[paramName];
  if (!config) return;
  const fieldKey = prompt('Nazwa pola (key):');
  if (!fieldKey || !fieldKey.trim()) return;
  const fieldValue = prompt(`Wartość dla "${fieldKey}":`);
  if (fieldValue === null) return;
  config[fieldKey.trim()] = fieldValue;
  ctx.syncToJsonEditor();
}

export function deleteParamField(ctx: MapCrudContext, paramName: string, fieldName: string): void {
  const config = ctx.getMapData().paramSensorMap?.[paramName];
  if (!config) return;
  if (!confirm(`Usunąć pole "${fieldName}"?`)) return;
  delete config[fieldName];
  ctx.syncToJsonEditor();
}

// ===== Action Dialogs =====

export function editActionDialog(ctx: MapCrudContext, name: string): void {
  const config = ctx.getMapData().actions[name];
  if (!config) return;
  const newName = prompt('Nazwa akcji:', name);
  if (!newName) return;
  const kind = prompt('Typ (api/ui/backend):', config.kind || 'api') || 'api';
  const url = prompt('URL:', config.url || '');
  const method = prompt('Metoda HTTP:', config.method || 'POST') || 'POST';
  if (newName !== name) {
    delete ctx.getMapData().actions[name];
  }
  ctx.getMapData().actions[newName] = { kind, url, method };
  ctx.syncToJsonEditor();
}

export function editGlobalActionField(ctx: MapCrudContext, actionName: string, fieldName: string): void {
  const config = ctx.getMapData().actions?.[actionName];
  if (!config) return;
  const labels: Record<string, string> = { kind: 'Typ (api/ui/backend)', url: 'URL', method: 'Metoda HTTP' };
  const newValue = prompt(labels[fieldName] || fieldName + ':', config[fieldName] || '');
  if (newValue === null) return;
  config[fieldName] = newValue;
  ctx.syncToJsonEditor();
}

export function addGlobalActionField(ctx: MapCrudContext, actionName: string): void {
  const config = ctx.getMapData().actions?.[actionName];
  if (!config) return;
  const fieldKey = prompt('Nazwa pola (key):');
  if (!fieldKey || !fieldKey.trim()) return;
  const fieldValue = prompt(`Wartość dla "${fieldKey}":`);
  if (fieldValue === null) return;
  config[fieldKey.trim()] = fieldValue;
  ctx.syncToJsonEditor();
}

export function deleteGlobalActionField(ctx: MapCrudContext, actionName: string, fieldName: string): void {
  const config = ctx.getMapData().actions?.[actionName];
  if (!config) return;
  if (!confirm(`Usunąć pole "${fieldName}"?`)) return;
  delete config[fieldName];
  ctx.syncToJsonEditor();
}

// ===== Func Dialogs =====

export function editFuncDialog(ctx: MapCrudContext, name: string): void {
  const config = ctx.getMapData().funcImplementations[name];
  if (!config) return;
  const newName = prompt('Nazwa FUNC:', name);
  if (!newName) return;
  const stepsJson = prompt('Kroki (JSON):', JSON.stringify(config.steps || []));
  if (stepsJson === null) return;
  try {
    const steps = JSON.parse(stepsJson);
    if (newName !== name) {
      delete ctx.getMapData().funcImplementations[name];
    }
    ctx.getMapData().funcImplementations[newName] = { kind: 'sequence', steps };
    ctx.syncToJsonEditor();
  } catch {
    alert('Nieprawidłowy JSON!');
  }
}

export function editFuncStep(ctx: MapCrudContext, funcName: string, stepIndex: number): void {
  const func = ctx.getMapData().funcImplementations?.[funcName];
  if (!func || !func.steps || !func.steps[stepIndex]) return;
  const step = func.steps[stepIndex];
  const action = prompt('Akcja (np. Włącz, Wyłącz, Otwórz):', step.action || '');
  if (action === null) return;
  const object = prompt('Obiekt (np. pompa 1, zawór BO04):', step.object || '');
  if (object === null) return;
  if (!action.trim()) { alert('Akcja nie może być pusta!'); return; }
  func.steps[stepIndex] = { action: action.trim(), object: object.trim() };
  ctx.syncToJsonEditor();
}

export function deleteFuncStep(ctx: MapCrudContext, funcName: string, stepIndex: number): void {
  const func = ctx.getMapData().funcImplementations?.[funcName];
  if (!func || !func.steps) return;
  if (!confirm(`Usunąć krok ${stepIndex + 1}?`)) return;
  func.steps.splice(stepIndex, 1);
  ctx.syncToJsonEditor();
}

export function addFuncStep(ctx: MapCrudContext, funcName: string): void {
  const func = ctx.getMapData().funcImplementations?.[funcName];
  if (!func) return;
  if (!func.steps) func.steps = [];
  const action = prompt('Akcja (np. Włącz, Wyłącz, Otwórz):');
  if (!action) return;
  const object = prompt('Obiekt (np. pompa 1, zawór BO04):');
  if (object === null) return;
  if (!action.trim()) { alert('Akcja nie może być pusta!'); return; }
  func.steps.push({ action: action.trim(), object: object.trim() });
  ctx.syncToJsonEditor();
}

// ===== Visual Block Dispatchers =====

export function editVisualBlock(ctx: MapCrudContext, type: string, name: string): void {
  switch (type) {
    case 'object': editObjectDialog(ctx, name); break;
    case 'param': editParamDialog(ctx, name); break;
    case 'action': editActionDialog(ctx, name); break;
    case 'func': editFuncDialog(ctx, name); break;
  }
}

export function deleteVisualBlock(ctx: MapCrudContext, type: string, name: string): void {
  const mapKey: Record<string, keyof MapData> = {
    'object': 'objectActionMap',
    'param': 'paramSensorMap',
    'action': 'actions',
    'func': 'funcImplementations'
  };
  if (mapKey[type]) {
    deleteItem(ctx, mapKey[type], name);
  }
}

// ===== JSON Syntax Highlighting =====

export function highlightJson(code: string): string {
  let html = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  html = html.replace(/("([^"\\]|\\.)*")(\s*:)/g, '<span class="tok-property">$1</span>$3');
  html = html.replace(/(:\s*)("([^"\\]|\\.)*")/g, '$1<span class="tok-string">$2</span>');
  html = html.replace(/(:\s*)(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g, '$1<span class="tok-number">$2</span>');
  html = html.replace(/(:\s*)(true|false)/g, '$1<span class="tok-boolean">$2</span>');
  html = html.replace(/(:\s*)(null)/g, '$1<span class="tok-null">$2</span>');
  html = html.replace(/([{}\[\]])/g, '<span class="tok-bracket">$1</span>');
  return html;
}
