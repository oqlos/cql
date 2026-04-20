// def-editor.render.ts
// Rendering logic extracted from def-editor.page.ts

import { escapeHtml } from '../../../modules/shared/generic-grid/utils';

export interface FuncDefinition {
  name: string;
  code: string;
}

export interface GoalDefinition {
  name: string;
  code: string;
}

export interface GoalOrderEntry {
  name: string;
  enabled: boolean;
}

export interface OptEntry {
  name: string;
  value: string;
  description?: string;
}

export interface GoalOptConfig {
  goalName: string;
  opts: OptEntry[];
}

/** Unified GOAL configuration - combines order, enabled state, and OPT values */
export interface GoalConfig {
  name: string;
  enabled: boolean;
  order: number;
  opts: OptEntry[];
}

/** Default variable entry for OPT/SET */
export interface DefaultVarEntry {
  name: string;
  value: string;
  description?: string;
  type: 'opt' | 'set';
}

/** Library stored in database - now uses JSON column */
export interface DefLibrary {
  objects: string[];
  functions: string[];
  params: string[];
  units: string[];
  actions?: string[];
  logs?: string[];
  alarms?: string[];
  errors?: string[];
  funcs?: FuncDefinition[];
  goals?: GoalDefinition[];
  goalsOrder?: GoalOrderEntry[];
  defaults?: DefaultVarEntry[];
  objectFunctionMap?: Record<string, { functions: string[] }>;
  paramUnitMap?: Record<string, { units: string[] }>;
}

/** Combined DEF data for editor */
export interface DefData {
  systemVars: Record<string, number | string>;
  optDefaults?: Record<string, string>;
  goalOpts?: GoalOptConfig[];
  goalsConfig?: GoalConfig[];
  library: DefLibrary;
}

/** Create empty library */
export function createEmptyLibrary(): DefLibrary {
  return {
    objects: [],
    functions: [],
    params: [],
    units: [],
    logs: [],
    alarms: [],
    errors: [],
    funcs: [],
    goals: []
  };
}

/**
 * Render a list of items (objects, functions, params, units)
 */
export function renderList(type: string, items: string[]): void {
  const list = document.getElementById(`${type}-list`);
  if (!list) return;
  
  list.innerHTML = items.map((item, idx) => `
    <div class="def-item" data-type="${type}" data-index="${idx}">
      <span class="def-item-name">${escapeHtml(item)}</span>
      <div class="def-item-actions">
        <button class="btn btn-secondary btn-xs" data-action="edit-item" title="Edytuj">✏️</button>
        <button class="btn btn-danger btn-xs" data-action="delete-item" title="Usuń">🗑️</button>
      </div>
    </div>
  `).join('') || '<p class="text-sm text-muted">Brak elementów</p>';
}

/**
 * Render system variables list
 */
export function renderVars(systemVars: Record<string, number | string>): void {
  const list = document.getElementById('vars-list');
  if (!list) return;
  
  const vars = Object.entries(systemVars);
  list.innerHTML = vars.map(([name, value]) => `
    <div class="def-item" data-type="vars" data-name="${escapeHtml(name)}">
      <span class="def-item-name">${escapeHtml(name)}</span>
      <span class="def-item-value">= ${escapeHtml(String(value))}</span>
      <div class="def-item-actions">
        <button class="btn btn-secondary btn-xs" data-action="edit-var" title="Edytuj">✏️</button>
        <button class="btn btn-danger btn-xs" data-action="delete-var" title="Usuń">🗑️</button>
      </div>
    </div>
  `).join('') || '<p class="text-sm text-muted">Brak zmiennych</p>';
}

/**
 * Render object-function and param-unit mappings
 */
export function renderMappings(library: DefLibrary): void {
  renderObjectFunctionMappings(library);
  renderParamUnitMappings(library);
}

function renderObjectFunctionMappings(library: DefLibrary): void {
  const container = document.getElementById('object-function-mappings');
  if (!container) return;
  
  const map = library.objectFunctionMap || {};
  container.innerHTML = library.objects.map(obj => {
    const fns = map[obj]?.functions || [];
    return `
      <div class="mapping-row" data-object="${escapeHtml(obj)}">
        <span class="mapping-label">${escapeHtml(obj)}</span>
        <div class="mapping-values">
          ${fns.map(fn => `
            <span class="mapping-tag" data-fn="${escapeHtml(fn)}">
              ${escapeHtml(fn)}
              <span class="remove-tag" data-action="remove-of-mapping">✕</span>
            </span>
          `).join('')}
          <button class="mapping-add-btn" data-action="add-of-mapping" data-object="${escapeHtml(obj)}">+ funkcja</button>
        </div>
      </div>
    `;
  }).join('');
}

function renderParamUnitMappings(library: DefLibrary): void {
  const container = document.getElementById('param-unit-mappings');
  if (!container) return;
  
  const map = library.paramUnitMap || {};
  container.innerHTML = library.params.map(param => {
    const units = map[param]?.units || [];
    return `
      <div class="mapping-row" data-param="${escapeHtml(param)}">
        <span class="mapping-label">${escapeHtml(param)}</span>
        <div class="mapping-values">
          ${units.map(unit => `
            <span class="mapping-tag" data-unit="${escapeHtml(unit)}">
              ${escapeHtml(unit)}
              <span class="remove-tag" data-action="remove-pu-mapping">✕</span>
            </span>
          `).join('')}
          <button class="mapping-add-btn" data-action="add-pu-mapping" data-param="${escapeHtml(param)}">+ jednostka</button>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Render FUNC definitions with textarea for code editing
 */
export function renderFuncs(funcs: FuncDefinition[]): void {
  const list = document.getElementById('funcs-list');
  if (!list) return;
  
  if (!funcs || funcs.length === 0) {
    list.innerHTML = '<p class="text-sm text-muted">Brak procedur FUNC</p>';
    return;
  }
  
  list.innerHTML = funcs.map((func, idx) => `
    <div class="def-func-item" data-type="funcs" data-index="${idx}">
      <div class="def-func-header">
        <input type="text" class="def-func-name" value="${escapeHtml(func.name)}" 
               placeholder="Nazwa procedury" data-field="name" />
        <div class="def-func-actions">
          <button class="btn btn-primary btn-xs" data-action="convert-func-to-goal" title="Konwertuj do GOAL">🔄</button>
          <button class="btn btn-danger btn-xs" data-action="delete-func" title="Usuń">🗑️</button>
        </div>
      </div>
      <textarea class="def-func-code mono" rows="6" placeholder="TASK 'Włącz' 'pompa 1'&#10;SET 'czas' '10 s'&#10;..."
                data-field="code">${escapeHtml(func.code)}</textarea>
    </div>
  `).join('');
}

/**
 * Render GOAL definitions with textarea for code editing (similar to FUNC)
 */
export function renderGoals(goals: GoalDefinition[]): void {
  const list = document.getElementById('goals-list');
  if (!list) return;
  
  if (!goals || goals.length === 0) {
    list.innerHTML = '<p class="text-sm text-muted">Brak czynności GOAL</p>';
    return;
  }
  
  list.innerHTML = goals.map((goal, idx) => `
    <div class="def-goal-item" data-type="goals" data-index="${idx}" draggable="true">
      <div class="def-goal-header">
        <span class="drag-handle" title="Przeciągnij aby zmienić kolejność">⋮⋮</span>
        <span class="goal-order">#${idx + 1}</span>
        <input type="text" class="def-goal-name" value="${escapeHtml(goal.name)}" 
               placeholder="Nazwa czynności GOAL" data-field="name" />
        <div class="def-goal-actions">
          <button class="btn btn-primary btn-xs" data-action="add-func-to-goal" title="Dodaj FUNC do GOAL">➕</button>
          <button class="btn btn-primary btn-xs" data-action="convert-goal-to-func" title="Konwertuj do FUNC">🔄</button>
          <button class="btn btn-secondary btn-xs" data-action="move-goal-up" title="Przesuń w górę" ${idx === 0 ? 'disabled' : ''}>⬆️</button>
          <button class="btn btn-secondary btn-xs" data-action="move-goal-down" title="Przesuń w dół" ${idx === goals.length - 1 ? 'disabled' : ''}>⬇️</button>
          <button class="btn btn-danger btn-xs" data-action="delete-goal" title="Usuń">🗑️</button>
        </div>
      </div>
      <textarea class="def-goal-code mono" rows="8" placeholder="SET 'parametr' 'wartość'&#10;OPT 'opcja' 'opis'&#10;TASK 'Włącz' 'obiekt'&#10;..."
                data-field="code">${escapeHtml(goal.code)}</textarea>
    </div>
  `).join('');
}

/**
 * Render OPT/SET defaults list
 */
export function renderDefaults(defaults: DefaultVarEntry[]): void {
  const list = document.getElementById('defaults-list');
  if (!list) return;
  
  if (!defaults || defaults.length === 0) {
    list.innerHTML = '<p class="text-sm text-muted">Brak zmiennych. Kliknij "Skanuj DSL" aby pobrać OPT/SET z GOALi.</p>';
    return;
  }
  
  list.innerHTML = defaults.map((def, idx) => `
    <div class="def-default-item" data-type="defaults" data-index="${idx}">
      <div class="def-default-row">
        <span class="def-default-type ${def.type}">${def.type.toUpperCase()}</span>
        <input type="text" class="def-default-name" value="${escapeHtml(def.name)}" 
               placeholder="Nazwa zmiennej" data-field="name" />
        <span class="def-default-eq">=</span>
        <input type="text" class="def-default-value" value="${escapeHtml(def.value)}" 
               placeholder="Wartość domyślna" data-field="value" />
        <input type="text" class="def-default-desc" value="${escapeHtml(def.description || '')}" 
               placeholder="Opis (opcjonalnie)" data-field="description" />
        <select class="def-default-type-select" data-field="type">
          <option value="opt" ${def.type === 'opt' ? 'selected' : ''}>OPT</option>
          <option value="set" ${def.type === 'set' ? 'selected' : ''}>SET</option>
        </select>
        <button class="btn btn-danger btn-xs" data-action="delete-default" title="Usuń">🗑️</button>
      </div>
    </div>
  `).join('');
}

/**
 * Render all DEF sections
 */
export function renderAll(defData: DefData): void {
  renderList('objects', defData.library.objects);
  renderList('functions', defData.library.functions);
  renderList('params', defData.library.params);
  renderList('units', defData.library.units);
  renderList('logs', defData.library.logs || []);
  renderList('alarms', defData.library.alarms || []);
  renderList('errors', defData.library.errors || []);
  renderFuncs(defData.library.funcs || []);
  renderGoals(defData.library.goals || []);
  renderDefaults(defData.library.defaults || []);
  renderVars(defData.systemVars);
  renderMappings(defData.library);
}

/**
 * Render scenarios list
 */
export function renderScenariosList(
  scenarios: Array<{ id: string; name: string }>,
  currentId: string,
  filter: string
): void {
  const tbody = document.getElementById('def-scenario-list-body');
  if (!tbody) return;
  
  const q = filter.toLowerCase();
  const filtered = q
    ? scenarios.filter(s => (s.name || s.id).toLowerCase().includes(q))
    : scenarios;
  
  tbody.innerHTML = filtered.map(s => {
    const isActive = s.id === currentId;
    const name = s.name || s.id;
    return `
      <tr class="${isActive ? 'active' : ''}" data-scenario-id="${escapeHtml(s.id)}">
        <td>
          <span class="scenario-name">${escapeHtml(name)}</span>
        </td>
      </tr>
    `;
  }).join('') || '<tr><td class="text-muted">Brak scenariuszy</td></tr>';
}

/**
 * Render goals order list with drag-and-drop support
 */
export function renderGoalsOrder(goals: GoalOrderEntry[]): void {
  const list = document.getElementById('goals-order-list');
  if (!list) return;
  
  if (!goals || goals.length === 0) {
    list.innerHTML = '<p class="text-sm text-muted">Brak czynności GOAL. Kliknij "Synchronizuj z DSL" aby pobrać listę.</p>';
    return;
  }
  
  list.innerHTML = goals.map((goal, idx) => `
    <div class="def-item goal-order-item ${goal.enabled ? '' : 'disabled'}" 
         data-type="goals" data-index="${idx}" data-goal-name="${escapeHtml(goal.name)}"
         draggable="true">
      <span class="drag-handle" title="Przeciągnij aby zmienić kolejność">☰</span>
      <span class="goal-order-index">${idx + 1}.</span>
      <label class="goal-order-checkbox">
        <input type="checkbox" ${goal.enabled ? 'checked' : ''} data-action="toggle-goal">
        <span class="def-item-name">${escapeHtml(goal.name)}</span>
      </label>
      <div class="def-item-actions">
        <button class="btn btn-secondary btn-xs" data-action="goal-up" title="Przesuń w górę" ${idx === 0 ? 'disabled' : ''}>⬆️</button>
        <button class="btn btn-secondary btn-xs" data-action="goal-down" title="Przesuń w dół" ${idx === goals.length - 1 ? 'disabled' : ''}>⬇️</button>
      </div>
    </div>
  `).join('');
  
  // Add drag-and-drop event listeners
  setupGoalsOrderDragDrop(list);
}

function setupGoalsOrderDragDrop(container: HTMLElement): void {
  let draggedItem: HTMLElement | null = null;
  
  container.querySelectorAll('.goal-order-item').forEach(item => {
    const el = item as HTMLElement;
    
    el.addEventListener('dragstart', (e) => {
      draggedItem = el;
      el.classList.add('dragging');
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
      }
    });
    
    el.addEventListener('dragend', () => {
      el.classList.remove('dragging');
      draggedItem = null;
      // Dispatch event to notify parent of reorder
      container.dispatchEvent(new CustomEvent('goals-reordered'));
    });
    
    el.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (!draggedItem || draggedItem === el) return;
      
      const rect = el.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      const mouseY = (e as DragEvent).clientY;
      
      if (mouseY < midY) {
        container.insertBefore(draggedItem, el);
      } else {
        container.insertBefore(draggedItem, el.nextSibling);
      }
    });
  });
}

/**
 * Render unified goals config list (order, enabled, OPTs)
 */
export function renderGoalsConfig(goals: GoalConfig[]): void {
  const container = document.getElementById('goals-config-list');
  if (!container) return;
  
  if (!goals || goals.length === 0) {
    container.innerHTML = '<p class="text-sm text-muted">Brak czynności GOAL. Dane zostaną załadowane automatycznie z DSL.</p>';
    return;
  }
  
  container.innerHTML = goals.map((goal, idx) => `
    <div class="goal-config-section ${goal.enabled ? '' : 'disabled'}" data-goal-index="${idx}" data-goal-name="${escapeHtml(goal.name)}">
      <div class="goal-config-header" draggable="true">
        <span class="drag-handle" title="Przeciągnij aby zmienić kolejność">☰</span>
        <span class="goal-config-index">${idx + 1}.</span>
        <label class="goal-config-checkbox">
          <input type="checkbox" ${goal.enabled ? 'checked' : ''} data-action="toggle-goal-config">
          <span class="goal-config-name">🎯 ${escapeHtml(goal.name)}</span>
        </label>
        <span class="goal-opts-badge">${goal.opts.length} OPT</span>
        <div class="goal-config-actions">
          <button class="btn btn-secondary btn-xs" data-action="goal-config-up" title="Przesuń w górę" ${idx === 0 ? 'disabled' : ''}>⬆️</button>
          <button class="btn btn-secondary btn-xs" data-action="goal-config-down" title="Przesuń w dół" ${idx === goals.length - 1 ? 'disabled' : ''}>⬇️</button>
        </div>
      </div>
      ${goal.opts.length > 0 ? `
        <div class="goal-config-opts">
          ${goal.opts.map(opt => `
            <div class="goal-opt-item" data-goal-name="${escapeHtml(goal.name)}" data-opt-name="${escapeHtml(opt.name)}">
              <span class="opt-name">[${escapeHtml(opt.name)}]</span>
              <span class="opt-value">"${escapeHtml(opt.value)}"</span>
              ${opt.description ? `<span class="opt-desc text-muted">${escapeHtml(opt.description)}</span>` : ''}
              <button class="btn btn-secondary btn-xs" data-action="edit-goal-opt" title="Edytuj wartość">✏️</button>
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `).join('');
  
  // Add drag-and-drop event listeners
  setupGoalsConfigDragDrop(container);
}

function setupGoalsConfigDragDrop(container: HTMLElement): void {
  let draggedItem: HTMLElement | null = null;
  
  container.querySelectorAll('.goal-config-section').forEach(item => {
    const el = item as HTMLElement;
    const header = el.querySelector('.goal-config-header') as HTMLElement;
    if (!header) return;
    
    header.addEventListener('dragstart', (e) => {
      draggedItem = el;
      el.classList.add('dragging');
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
      }
    });
    
    header.addEventListener('dragend', () => {
      el.classList.remove('dragging');
      draggedItem = null;
      container.dispatchEvent(new CustomEvent('goals-config-reordered'));
    });
    
    el.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (!draggedItem || draggedItem === el) return;
      
      const rect = el.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      const mouseY = (e as DragEvent).clientY;
      
      if (mouseY < midY) {
        el.before(draggedItem);
      } else {
        el.after(draggedItem);
      }
    });
  });
}

/**
 * Update source code editor with generated DEF
 */
export function updateSourceEditor(defCode: string): void {
  const editor = document.getElementById('def-source-editor') as HTMLTextAreaElement | null;
  if (editor) {
    editor.value = defCode;
  }
}
