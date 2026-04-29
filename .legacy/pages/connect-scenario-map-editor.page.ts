// frontend/src/pages/connect-scenario-map-editor.page.ts
// MAP Editor - edytor mapowania DSL → funkcje JS/PY

import { ScenariosService } from '../modules/connect-scenario/helpers/scenarios.service';
import { getMapEditorStyles } from '../modules/connect-scenario/helpers/map-editor.styles';
import { escapeHtml } from '../utils/html.utils';

// CQRS-style extracted modules
import { getMapEditorContent } from './connect-scenario-map-editor/map-editor.templates';
import { renderObjectsListHtml, renderParamsListHtml, renderActionsListHtml, renderFuncsListHtml, renderVisualEditorHtml } from './connect-scenario-map-editor/map-editor.renderers';
import {
  addObject as _addObjectFn, addParam as _addParamFn, addAction as _addActionFn, addFunc as _addFuncFn,
  deleteItem as _deleteItemFn, editObjectDialog as _editObjectDialogFn,
  addObjectAction as _addObjectActionFn, editObjectAction as _editObjectActionFn, deleteObjectAction as _deleteObjectActionFn,
  editObjectActionName as _editObjActNameFn, editObjectActionField as _editObjActFieldFn,
  addObjectActionField as _addObjActFieldFn, deleteObjectActionField as _delObjActFieldFn,
  editParamDialog as _editParamDialogFn, editParamFieldDirect as _editParamFieldFn,
  addParamField as _addParamFieldFn, deleteParamField as _delParamFieldFn,
  editActionDialog as _editActionDialogFn, editGlobalActionField as _editGlobalActFieldFn,
  addGlobalActionField as _addGlobalActFieldFn, deleteGlobalActionField as _delGlobalActFieldFn,
  editFuncDialog as _editFuncDialogFn, editFuncStep as _editFuncStepFn,
  deleteFuncStep as _delFuncStepFn, addFuncStep as _addFuncStepFn,
  editVisualBlock as _editVisualBlockFn, deleteVisualBlock as _delVisualBlockFn,
  highlightJson as _highlightJsonFn,
  type MapCrudContext,
} from './connect-scenario-map-editor/map-editor.crud';

interface MapData {
  objectActionMap: Record<string, Record<string, any>>;
  paramSensorMap: Record<string, any>;
  actions: Record<string, any>;
  funcImplementations: Record<string, any>;
}

export class MapEditorPage {

  /** Page discovery compatible render method */
  render(): string {
    return MapEditorPage.getContent();
  }
  private static currentScenarioId: string = '';
  private static currentScenarioTitle: string = '';
  private static originalMap: string = '';
  private static isDirty: boolean = false;
  private static scenariosList: Array<{ id: string; name: string }> = [];
  private static scenarioFilter: string = '';
  private static mapData: MapData = {
    objectActionMap: {},
    paramSensorMap: {},
    actions: {},
    funcImplementations: {}
  };

  static getContent(): string {
    return getMapEditorContent();
  }

  static getStyles(): string {
    return getMapEditorStyles();
  }

  // Styles extracted to: modules/connect-scenario/helpers/map-editor.styles.ts
  // Original styles were ~530 lines, now in separate file
  

  static attachEventListeners(): void {
    const container = document.querySelector('.map-editor-page');
    if (!container) return;

    const jsonEditor = document.getElementById('map-json-editor') as HTMLTextAreaElement;
    const saveBtn = document.getElementById('map-save-btn') as HTMLButtonElement;
    const reloadBtn = document.getElementById('map-reload-btn') as HTMLButtonElement;
    const formatBtn = document.getElementById('map-format-json') as HTMLButtonElement;
    const status = document.getElementById('map-status') as HTMLElement;
    const stats = document.getElementById('map-stats') as HTMLElement;

    // Tab switching
    document.querySelectorAll('.map-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const tabName = tab.getAttribute('data-tab');
        if (tabName) this.switchTab(tabName);
      });
    });

    // Read tab from URL
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');
    if (tabParam && ['objects', 'params', 'actions', 'funcs', 'json'].includes(tabParam)) {
      this.switchTab(tabParam, false); // Don't update URL on init
    }

    const listBody = document.getElementById('map-scenario-list-body') as HTMLElement;
    const filterInput = document.getElementById('map-scenario-filter') as HTMLInputElement;
    const sortSelect = document.getElementById('scenario-sort') as HTMLSelectElement | null;
    const titleEl = document.getElementById('map-scenario-title') as HTMLElement;

    // Load scenario list
    this.loadScenarioList(listBody);

    // Scenario filter
    filterInput?.addEventListener('input', () => {
      this.scenarioFilter = filterInput.value.toLowerCase();
      this.renderScenarioList(listBody);
    });

    sortSelect?.addEventListener('change', () => {
      this.renderScenarioList(listBody);
    });

    // Scenario list click
    listBody?.addEventListener('click', async (e) => {
      const row = (e.target as HTMLElement).closest('tr');
      if (!row) return;
      const id = row.getAttribute('data-id');
      if (id && id !== this.currentScenarioId) {
        await this.loadScenario(id, jsonEditor, status, stats, titleEl, listBody);
      }
    });

    // JSON editor changes
    jsonEditor?.addEventListener('input', () => {
      try {
        this.mapData = JSON.parse(jsonEditor.value);
        this.isDirty = jsonEditor.value !== this.originalMap;
        saveBtn.disabled = !this.isDirty;
        this.updateStats(stats);
        this.renderAllTabs();
        this.setStatus(status, this.isDirty ? '● Niezapisane zmiany' : '', 'warning');
      } catch (e) {
        this.setStatus(status, '❌ Nieprawidłowy JSON', 'error');
      }
    });

    // Save
    saveBtn?.addEventListener('click', async () => {
      if (!this.currentScenarioId) return;
      try {
        const mapJson = JSON.stringify(this.mapData, null, 2);
        await ScenariosService.updateScenario(this.currentScenarioId, { map: mapJson });
        this.originalMap = mapJson;
        this.isDirty = false;
        saveBtn.disabled = true;
        this.setStatus(status, '✅ Zapisano', 'success');
        setTimeout(() => this.setStatus(status, '', ''), 2000);
      } catch (e) {
        this.setStatus(status, '❌ Błąd zapisu', 'error');
      }
    });

    // Reload
    reloadBtn?.addEventListener('click', async () => {
      if (this.currentScenarioId) {
        await this.loadScenario(this.currentScenarioId, jsonEditor, status, stats);
      }
    });

    // Format JSON
    formatBtn?.addEventListener('click', () => {
      try {
        const data = JSON.parse(jsonEditor.value);
        jsonEditor.value = JSON.stringify(data, null, 2);
        this.updateJsonHighlight();
        this.setStatus(status, '📐 Sformatowano', 'success');
      } catch {
        this.setStatus(status, '❌ Nieprawidłowy JSON', 'error');
      }
    });

    // Validate JSON
    document.getElementById('map-validate-json')?.addEventListener('click', () => {
      try {
        JSON.parse(jsonEditor.value);
        this.setStatus(status, '✅ JSON poprawny', 'success');
        setTimeout(() => this.setStatus(status, '', ''), 2000);
      } catch (e: any) {
        this.setStatus(status, `❌ Błąd: ${e.message}`, 'error');
      }
    });

    // JSON syntax highlighting on input
    jsonEditor?.addEventListener('input', () => {
      this.updateJsonHighlight();
    });

    // Sync scroll between textarea and highlight overlay
    jsonEditor?.addEventListener('scroll', () => {
      const overlay = document.querySelector('.json-highlight-overlay') as HTMLElement;
      if (overlay) {
        overlay.scrollTop = jsonEditor.scrollTop;
        overlay.scrollLeft = jsonEditor.scrollLeft;
      }
    });

    // View toggle (Code / Visual)
    document.querySelectorAll('.json-view-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.getAttribute('data-view');
        document.querySelectorAll('.json-view-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.json-view').forEach(v => v.classList.remove('active'));
        btn.classList.add('active');
        document.querySelector(`.json-${view}-view`)?.classList.add('active');
        
        if (view === 'visual') {
          this.renderVisualEditor();
        }
      });
    });

    // Visual editor actions - delegated to helper method
    document.addEventListener('click', (e) => this.handleVisualEditorClick(e));

    // Add buttons
    document.getElementById('map-add-object')?.addEventListener('click', () => this.addObject());
    document.getElementById('map-add-param')?.addEventListener('click', () => this.addParam());
    document.getElementById('map-add-action')?.addEventListener('click', () => this.addAction());
    document.getElementById('map-add-func')?.addEventListener('click', () => this.addFunc());

    // Load from URL
    const scenarioId = urlParams.get('scenario');
    if (scenarioId) {
      setTimeout(async () => {
        await this.loadScenario(scenarioId, jsonEditor, status, stats, titleEl, listBody);
      }, 100);
    }

    // Item edit/delete handlers via delegation - delegated to helper method
    document.addEventListener('click', (e) => this.handleItemActionClick(e));
  }

  // ==================== PRIVATE STATIC HELPERS ====================

  private static handleVisualEditorClick(e: Event): void {
    const target = e.target as HTMLElement;
    let visualAction = target.dataset.visualAction;
    let actionTarget = target;
    if (!visualAction) {
      const parent = target.closest('[data-visual-action]') as HTMLElement;
      if (parent) {
        visualAction = parent.dataset.visualAction;
        actionTarget = parent;
      }
    }
    if (!visualAction) return;

    switch (visualAction) {
      case 'add-object': this.addObject(); this.renderVisualEditor(); break;
      case 'add-param': this.addParam(); this.renderVisualEditor(); break;
      case 'add-action': this.addAction(); this.renderVisualEditor(); break;
      case 'add-func': this.addFunc(); this.renderVisualEditor(); break;
      case 'toggle-block': {
        const block = target.closest('.visual-block');
        block?.classList.toggle('expanded');
        break;
      }
      case 'edit-block': {
        const blockType = actionTarget.dataset.blockType;
        const blockName = actionTarget.dataset.blockName;
        if (blockType && blockName) this.editVisualBlock(blockType, blockName);
        break;
      }
      case 'delete-block': {
        const blockType = actionTarget.dataset.blockType;
        const blockName = actionTarget.dataset.blockName;
        if (blockType && blockName) this.deleteVisualBlock(blockType, blockName);
        break;
      }
      case 'edit-sub': {
        const blockType = actionTarget.dataset.blockType;
        const blockName = actionTarget.dataset.blockName;
        const subName = actionTarget.dataset.subName;
        if (blockType === 'object' && blockName && subName) {
          this.editObjectAction(blockName, subName);
          this.renderVisualEditor();
        }
        break;
      }
      case 'delete-sub': {
        const blockType = actionTarget.dataset.blockType;
        const blockName = actionTarget.dataset.blockName;
        const subName = actionTarget.dataset.subName;
        if (blockType === 'object' && blockName && subName) {
          this.deleteObjectAction(blockName, subName);
          this.renderVisualEditor();
        }
        break;
      }
      case 'add-sub': {
        const blockType = actionTarget.dataset.blockType;
        const blockName = actionTarget.dataset.blockName;
        if (blockType === 'object' && blockName) {
          this.addObjectAction(blockName);
          this.renderVisualEditor();
        }
        break;
      }
      case 'edit-obj-action-name': {
        const blockName = actionTarget.dataset.blockName;
        const subName = actionTarget.dataset.subName;
        if (blockName && subName) {
          this.editObjectActionName(blockName, subName);
          this.renderVisualEditor();
        }
        break;
      }
      case 'edit-obj-action-field': {
        const blockName = actionTarget.dataset.blockName;
        const subName = actionTarget.dataset.subName;
        const field = actionTarget.dataset.field;
        if (blockName && subName && field) {
          this.editObjectActionField(blockName, subName, field);
          this.renderVisualEditor();
        }
        break;
      }
      case 'edit-param-field': {
        const blockName = actionTarget.dataset.blockName;
        const field = actionTarget.dataset.field;
        if (blockName && field) {
          this.editParamFieldDirect(blockName, field);
          this.renderVisualEditor();
        }
        break;
      }
      case 'edit-action-field': {
        const blockName = actionTarget.dataset.blockName;
        const field = actionTarget.dataset.field;
        if (blockName && field) {
          this.editGlobalActionField(blockName, field);
          this.renderVisualEditor();
        }
        break;
      }
      case 'edit-func-step': {
        const blockName = actionTarget.dataset.blockName;
        const stepIdx = parseInt(actionTarget.dataset.step || '0');
        if (blockName) {
          this.editFuncStep(blockName, stepIdx);
          this.renderVisualEditor();
        }
        break;
      }
      case 'delete-func-step': {
        const blockName = actionTarget.dataset.blockName;
        const stepIdx = parseInt(actionTarget.dataset.step || '0');
        if (blockName) {
          this.deleteFuncStep(blockName, stepIdx);
          this.renderVisualEditor();
        }
        break;
      }
      case 'add-func-step': {
        const blockName = actionTarget.dataset.blockName;
        if (blockName) {
          this.addFuncStep(blockName);
          this.renderVisualEditor();
        }
        break;
      }
      case 'add-visual-param-field': {
        const blockName = actionTarget.dataset.blockName;
        if (blockName) {
          this.addParamField(blockName);
          this.renderVisualEditor();
        }
        break;
      }
      case 'delete-visual-param-field': {
        const blockName = actionTarget.dataset.blockName;
        const field = actionTarget.dataset.field;
        if (blockName && field) {
          this.deleteParamField(blockName, field);
          this.renderVisualEditor();
        }
        break;
      }
      case 'add-visual-action-field': {
        const blockName = actionTarget.dataset.blockName;
        if (blockName) {
          this.addGlobalActionField(blockName);
          this.renderVisualEditor();
        }
        break;
      }
      case 'delete-visual-action-field': {
        const blockName = actionTarget.dataset.blockName;
        const field = actionTarget.dataset.field;
        if (blockName && field) {
          this.deleteGlobalActionField(blockName, field);
          this.renderVisualEditor();
        }
        break;
      }
      case 'add-obj-action-field': {
        const blockName = actionTarget.dataset.blockName;
        const subName = actionTarget.dataset.subName;
        if (blockName && subName) {
          this.addObjectActionField(blockName, subName);
          this.renderVisualEditor();
        }
        break;
      }
      case 'delete-obj-action-field': {
        const blockName = actionTarget.dataset.blockName;
        const subName = actionTarget.dataset.subName;
        const field = actionTarget.dataset.field;
        if (blockName && subName && field) {
          this.deleteObjectActionField(blockName, subName, field);
          this.renderVisualEditor();
        }
        break;
      }
    }
  }

  private static handleItemActionClick(e: Event): void {
    const target = e.target as HTMLElement;
    const action = target.dataset.action;
    if (!action) return;

    const itemName = target.dataset.name;
    const subName = target.dataset.sub;
    const funcName = target.dataset.func;
    const stepIdx = target.dataset.step;
    const objNameFromData = target.dataset.obj;
    const fieldName = target.dataset.field;

    switch (action) {
      case 'edit-object': this.editObjectDialog(itemName!); break;
      case 'delete-object': this.deleteItem('objectActionMap', itemName!); break;
      case 'add-object-action': this.addObjectAction(itemName!); break;
      case 'edit-object-action': this.editObjectAction(itemName!, subName!); break;
      case 'delete-object-action': this.deleteObjectAction(itemName!, subName!); break;
      case 'edit-param': this.editParamDialog(itemName!); break;
      case 'delete-param': this.deleteItem('paramSensorMap', itemName!); break;
      case 'edit-action': this.editActionDialog(itemName!); break;
      case 'delete-action': this.deleteItem('actions', itemName!); break;
      case 'edit-func': this.editFuncDialog(itemName!); break;
      case 'delete-func': this.deleteItem('funcImplementations', itemName!); break;
      case 'edit-func-step': if (funcName) this.editFuncStep(funcName, parseInt(stepIdx || '0')); break;
      case 'delete-func-step': if (funcName) this.deleteFuncStep(funcName, parseInt(stepIdx || '0')); break;
      case 'add-func-step': if (funcName) this.addFuncStep(funcName); break;
      case 'edit-action-name': if (objNameFromData && subName) this.editObjectActionName(objNameFromData, subName); break;
      case 'edit-action-field': if (objNameFromData && subName && fieldName) this.editObjectActionField(objNameFromData, subName, fieldName); break;
      case 'add-action-field': if (objNameFromData && subName) this.addObjectActionField(objNameFromData, subName); break;
      case 'delete-action-field': if (objNameFromData && subName && fieldName) this.deleteObjectActionField(objNameFromData, subName, fieldName); break;
      case 'edit-param-field': if (itemName && fieldName) this.editParamFieldDirect(itemName, fieldName); break;
      case 'add-param-field': if (itemName) this.addParamField(itemName); break;
      case 'delete-param-field': if (itemName && fieldName) this.deleteParamField(itemName, fieldName); break;
      case 'edit-global-action-field': if (itemName && fieldName) this.editGlobalActionField(itemName, fieldName); break;
      case 'add-global-action-field': if (itemName) this.addGlobalActionField(itemName); break;
      case 'delete-global-action-field': if (itemName && fieldName) this.deleteGlobalActionField(itemName, fieldName); break;
    }
  }

  private static switchTab(tabName: string, updateUrl: boolean = true): void {
    document.querySelectorAll('.map-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.map-tab-content').forEach(c => c.classList.remove('active'));
    document.querySelector(`.map-tab[data-tab="${tabName}"]`)?.classList.add('active');
    document.querySelector(`.map-tab-content[data-tab-content="${tabName}"]`)?.classList.add('active');

    if (updateUrl) {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tabName);
      history.replaceState({}, '', url.toString());
    }
  }

  private static async loadScenarioList(listBody: HTMLElement): Promise<void> {
    try {
      this.scenariosList = await ScenariosService.listScenarios('');
      this.renderScenarioList(listBody);
    } catch { /* silent */ }
  }

  private static renderScenarioList(listBody: HTMLElement): void {
    if (!listBody) return;

    const sortMode = (document.getElementById('scenario-sort') as HTMLSelectElement | null)?.value || 'date_desc';
    const filtered = this.scenariosList.filter(s =>
      !this.scenarioFilter ||
      (s.name || s.id).toLowerCase().includes(this.scenarioFilter)
    ).slice();

    const toTs = (s: any): number => {
      const raw = String(s || '').trim();
      if (!raw) return 0;
      const t = Date.parse(raw);
      return Number.isFinite(t) ? t : 0;
    };
    const byName = (a: string, b: string): number => a.localeCompare(b, 'pl', { sensitivity: 'base' });

    filtered.sort((a: any, b: any) => {
      const an = String(a?.name || a?.id || '').toLowerCase();
      const bn = String(b?.name || b?.id || '').toLowerCase();
      const at = toTs(a?.updatedAt || a?.updated_at || a?.updated_at_iso);
      const bt = toTs(b?.updatedAt || b?.updated_at || b?.updated_at_iso);
      switch (sortMode) {
        case 'name_asc': return byName(an, bn);
        case 'name_desc': return byName(bn, an);
        case 'date_asc': return at - bt;
        case 'date_desc':
        default: return bt - at;
      }
    });
    
    listBody.innerHTML = filtered.map(s => `
      <tr data-id="${s.id}" class="${s.id === this.currentScenarioId ? 'active' : ''}">
        <td>${escapeHtml(s.name || s.id)}</td>
      </tr>
    `).join('');
  }

  private static async loadScenario(
    id: string,
    jsonEditor: HTMLTextAreaElement,
    status: HTMLElement,
    stats: HTMLElement,
    titleEl?: HTMLElement,
    listBody?: HTMLElement
  ): Promise<void> {
    try {
      const row = await ScenariosService.fetchScenarioById(id);
      if (!row) return;

      this.currentScenarioId = id;
      this.currentScenarioTitle = row.title || id;
      
      // Update title
      if (titleEl) titleEl.textContent = this.currentScenarioTitle;
      
      // Update list active state
      if (listBody) this.renderScenarioList(listBody);
      
      const mapText = (row as any).map || '{}';
      this.originalMap = mapText;
      this.isDirty = false;

      try {
        this.mapData = JSON.parse(mapText);
      } catch {
        this.mapData = { objectActionMap: {}, paramSensorMap: {}, actions: {}, funcImplementations: {} };
      }

      jsonEditor.value = JSON.stringify(this.mapData, null, 2);
      this.updateJsonHighlight();
      this.updateStats(stats);
      this.renderAllTabs();
      
      const saveBtn = document.getElementById('map-save-btn') as HTMLButtonElement;
      if (saveBtn) saveBtn.disabled = true;
      this.setStatus(status, '', '');

      // Update URL
      const url = new URL(window.location.href);
      url.searchParams.set('scenario', id);
      history.replaceState({}, '', url.toString());
    } catch (e) {
      this.setStatus(status, '❌ Błąd ładowania', 'error');
    }
  }

  private static updateStats(stats: HTMLElement): void {
    if (!stats) return;
    const objCount = Object.keys(this.mapData.objectActionMap || {}).length;
    const paramCount = Object.keys(this.mapData.paramSensorMap || {}).length;
    const actionCount = Object.keys(this.mapData.actions || {}).length;
    const funcCount = Object.keys(this.mapData.funcImplementations || {}).length;
    
    stats.innerHTML = `
      <div>📦 Obiekty: <strong>${objCount}</strong></div>
      <div>📊 Parametry: <strong>${paramCount}</strong></div>
      <div>⚡ Akcje: <strong>${actionCount}</strong></div>
      <div>🔧 FUNC: <strong>${funcCount}</strong></div>
    `;
  }

  private static renderAllTabs(): void {
    this.renderObjectsList();
    this.renderParamsList();
    this.renderActionsList();
    this.renderFuncsList();
  }

  private static renderObjectsList(): void {
    const list = document.getElementById('map-objects-list');
    if (list) list.innerHTML = renderObjectsListHtml(this.mapData);
  }

  private static renderParamsList(): void {
    const list = document.getElementById('map-params-list');
    if (list) list.innerHTML = renderParamsListHtml(this.mapData);
  }

  private static renderActionsList(): void {
    const list = document.getElementById('map-actions-list');
    if (list) list.innerHTML = renderActionsListHtml(this.mapData);
  }

  private static renderFuncsList(): void {
    const list = document.getElementById('map-funcs-list');
    if (list) list.innerHTML = renderFuncsListHtml(this.mapData);
  }

  // ===== CRUD ops (delegated to map-editor.crud.ts) =====

  private static getCrudContext(): MapCrudContext {
    return {
      getMapData: () => this.mapData,
      syncToJsonEditor: () => this.syncToJsonEditor(),
    };
  }

  private static addObject(): void { _addObjectFn(this.getCrudContext()); }
  private static addParam(): void { _addParamFn(this.getCrudContext()); }
  private static addAction(): void { _addActionFn(this.getCrudContext()); }
  private static addFunc(): void { _addFuncFn(this.getCrudContext()); }

  private static syncToJsonEditor(): void {
    const jsonEditor = document.getElementById('map-json-editor') as HTMLTextAreaElement;
    if (jsonEditor) {
      jsonEditor.value = JSON.stringify(this.mapData, null, 2);
      jsonEditor.dispatchEvent(new Event('input'));
      this.updateJsonHighlight();
    }
    this.renderAllTabs();
  }

  private static setStatus(el: HTMLElement, message: string, type: string): void {
    if (!el) return;
    el.textContent = message;
    el.className = `map-status ${type}`;
  }

  private static deleteItem(mapKey: keyof MapData, name: string): void { _deleteItemFn(this.getCrudContext(), mapKey, name); }
  private static editObjectDialog(name: string): void { _editObjectDialogFn(this.getCrudContext(), name); }
  private static addObjectAction(objName: string): void { _addObjectActionFn(this.getCrudContext(), objName); }
  private static editObjectAction(objName: string, actionName: string): void { _editObjectActionFn(this.getCrudContext(), objName, actionName); }
  private static deleteObjectAction(objName: string, actionName: string): void { _deleteObjectActionFn(this.getCrudContext(), objName, actionName); }
  private static editObjectActionName(objName: string, oldActionName: string): void { _editObjActNameFn(this.getCrudContext(), objName, oldActionName); }
  private static editObjectActionField(objName: string, actionName: string, fieldName: string): void { _editObjActFieldFn(this.getCrudContext(), objName, actionName, fieldName); }
  private static addObjectActionField(objName: string, actionName: string): void { _addObjActFieldFn(this.getCrudContext(), objName, actionName); }
  private static deleteObjectActionField(objName: string, actionName: string, fieldName: string): void { _delObjActFieldFn(this.getCrudContext(), objName, actionName, fieldName); }
  private static editParamDialog(name: string): void { _editParamDialogFn(this.getCrudContext(), name); }
  private static editParamFieldDirect(paramName: string, fieldName: string): void { _editParamFieldFn(this.getCrudContext(), paramName, fieldName); }
  private static addParamField(paramName: string): void { _addParamFieldFn(this.getCrudContext(), paramName); }
  private static deleteParamField(paramName: string, fieldName: string): void { _delParamFieldFn(this.getCrudContext(), paramName, fieldName); }
  private static editActionDialog(name: string): void { _editActionDialogFn(this.getCrudContext(), name); }
  private static editGlobalActionField(actionName: string, fieldName: string): void { _editGlobalActFieldFn(this.getCrudContext(), actionName, fieldName); }
  private static addGlobalActionField(actionName: string): void { _addGlobalActFieldFn(this.getCrudContext(), actionName); }
  private static deleteGlobalActionField(actionName: string, fieldName: string): void { _delGlobalActFieldFn(this.getCrudContext(), actionName, fieldName); }
  private static editFuncDialog(name: string): void { _editFuncDialogFn(this.getCrudContext(), name); }
  private static editFuncStep(funcName: string, stepIndex: number): void { _editFuncStepFn(this.getCrudContext(), funcName, stepIndex); }
  private static deleteFuncStep(funcName: string, stepIndex: number): void { _delFuncStepFn(this.getCrudContext(), funcName, stepIndex); }
  private static addFuncStep(funcName: string): void { _addFuncStepFn(this.getCrudContext(), funcName); }

  // ===== JSON Syntax Highlighting =====

  private static updateJsonHighlight(): void {
    const jsonEditor = document.getElementById('map-json-editor') as HTMLTextAreaElement;
    const highlightEl = document.getElementById('json-highlight');
    if (!jsonEditor || !highlightEl) return;
    highlightEl.innerHTML = _highlightJsonFn(jsonEditor.value);
  }

  // ===== Visual Block Editor =====

  private static renderVisualEditor(): void {
    const canvas = document.getElementById('visual-editor-canvas');
    if (canvas) canvas.innerHTML = renderVisualEditorHtml(this.mapData);
  }

  private static editVisualBlock(type: string, name: string): void {
    _editVisualBlockFn(this.getCrudContext(), type, name);
    this.renderVisualEditor();
  }

  private static deleteVisualBlock(type: string, name: string): void {
    _delVisualBlockFn(this.getCrudContext(), type, name);
    this.renderVisualEditor();
  }
}
