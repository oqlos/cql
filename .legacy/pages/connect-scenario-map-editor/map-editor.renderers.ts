// frontend/src/pages/connect-scenario-map-editor/map-editor.renderers.ts
// Extracted from map-editor.page.ts — tab list and visual editor HTML rendering

import { escapeHtml } from '../../utils/html.utils';

interface MapData {
  objectActionMap: Record<string, Record<string, any>>;
  paramSensorMap: Record<string, any>;
  actions: Record<string, any>;
  funcImplementations: Record<string, any>;
}

// ===== Tab List Renderers =====

export function renderObjectsListHtml(mapData: MapData): string {
  const objects = mapData.objectActionMap || {};
  if (Object.keys(objects).length === 0) {
    return '<p class="text-muted text-xs">Brak zdefiniowanych obiektów</p>';
  }

  return Object.entries(objects).map(([objName, actions]) => `
    <div class="map-item expanded">
      <div class="map-item-header" onclick="this.parentElement.classList.toggle('expanded')">
        <span class="map-item-name">📦 ${escapeHtml(objName)}</span>
        <span class="map-item-actions">
          <button class="btn-icon" data-action="add-object-action" data-name="${escapeHtml(objName)}" title="Dodaj akcję">➕</button>
          <button class="btn-icon" data-action="edit-object" data-name="${escapeHtml(objName)}" title="Zmień nazwę">✏️</button>
          <button class="btn-icon btn-danger" data-action="delete-object" data-name="${escapeHtml(objName)}" title="Usuń">🗑️</button>
        </span>
      </div>
      <div class="map-item-body">
        ${Object.entries(actions).map(([action, config]) => {
          const cfg = config as any;
          const standardFields = ['kind', 'url', 'method', 'py'];
          const customFields = Object.keys(cfg).filter(k => !standardFields.includes(k));
          return `
          <div class="map-action-row-expanded">
            <div class="action-row-header">
              <span class="action-name-edit">
                <strong class="action-key">${escapeHtml(action)}</strong>
                <button class="btn-icon-xs" data-action="edit-action-name" data-obj="${escapeHtml(objName)}" data-sub="${escapeHtml(action)}" title="Zmień nazwę akcji">✏️</button>
              </span>
              <span class="action-btns">
                <button class="btn-icon-sm btn-danger" data-action="delete-object-action" data-name="${escapeHtml(objName)}" data-sub="${escapeHtml(action)}" title="Usuń">🗑️</button>
              </span>
            </div>
            <div class="action-row-details">
              <div class="action-field">
                <span class="field-label">Typ:</span>
                <span class="field-value">${cfg.kind || 'api'}</span>
                <button class="btn-icon-xs" data-action="edit-action-field" data-obj="${escapeHtml(objName)}" data-sub="${escapeHtml(action)}" data-field="kind" title="Edytuj">✏️</button>
              </div>
              <div class="action-field">
                <span class="field-label">URL:</span>
                <span class="field-value field-url">${cfg.url || cfg.py || '—'}</span>
                <button class="btn-icon-xs" data-action="edit-action-field" data-obj="${escapeHtml(objName)}" data-sub="${escapeHtml(action)}" data-field="url" title="Edytuj">✏️</button>
              </div>
              <div class="action-field">
                <span class="field-label">Metoda:</span>
                <span class="field-value">${cfg.method || 'POST'}</span>
                <button class="btn-icon-xs" data-action="edit-action-field" data-obj="${escapeHtml(objName)}" data-sub="${escapeHtml(action)}" data-field="method" title="Edytuj">✏️</button>
              </div>
              ${customFields.map(field => `
              <div class="action-field action-field-custom">
                <span class="field-label">${escapeHtml(field)}:</span>
                <span class="field-value">${escapeHtml(String(cfg[field]))}</span>
                <button class="btn-icon-xs" data-action="edit-action-field" data-obj="${escapeHtml(objName)}" data-sub="${escapeHtml(action)}" data-field="${escapeHtml(field)}" title="Edytuj">✏️</button>
                <button class="btn-icon-xs btn-danger" data-action="delete-action-field" data-obj="${escapeHtml(objName)}" data-sub="${escapeHtml(action)}" data-field="${escapeHtml(field)}" title="Usuń pole">✕</button>
              </div>
              `).join('')}
              <button class="btn btn-xs btn-secondary add-field-btn" data-action="add-action-field" data-obj="${escapeHtml(objName)}" data-sub="${escapeHtml(action)}">➕ Dodaj pole</button>
            </div>
          </div>
        `}).join('')}
      </div>
    </div>
  `).join('');
}

export function renderParamsListHtml(mapData: MapData): string {
  const params = mapData.paramSensorMap || {};
  if (Object.keys(params).length === 0) {
    return '<p class="text-muted text-xs">Brak zdefiniowanych parametrów</p>';
  }

  return Object.entries(params).map(([name, config]) => {
    const cfg = config as any;
    const standardFields = ['sensor', 'url', 'unit', 'py', 'kind'];
    const customFields = Object.keys(cfg).filter(k => !standardFields.includes(k));
    const eName = escapeHtml(name);
    return `
    <div class="map-item expanded">
      <div class="map-item-header" onclick="this.parentElement.classList.toggle('expanded')">
        <span class="map-item-name">📊 ${eName}</span>
        <span class="map-item-actions">
          <button class="btn-icon-sm" data-action="edit-param" data-name="${eName}" title="Zmień nazwę">✏️</button>
          <button class="btn-icon-sm btn-danger" data-action="delete-param" data-name="${eName}" title="Usuń">🗑️</button>
        </span>
      </div>
      <div class="map-item-body">
        <div class="action-row-details">
          <div class="action-field">
            <span class="field-label">Sensor:</span>
            <span class="field-value">${cfg.sensor || '—'}</span>
            <button class="btn-icon-xs" data-action="edit-param-field" data-name="${eName}" data-field="sensor" title="Edytuj">✏️</button>
          </div>
          <div class="action-field">
            <span class="field-label">Jednostka:</span>
            <span class="field-value">${cfg.unit || '—'}</span>
            <button class="btn-icon-xs" data-action="edit-param-field" data-name="${eName}" data-field="unit" title="Edytuj">✏️</button>
          </div>
          <div class="action-field">
            <span class="field-label">URL:</span>
            <span class="field-value field-url">${cfg.url || '—'}</span>
            <button class="btn-icon-xs" data-action="edit-param-field" data-name="${eName}" data-field="url" title="Edytuj">✏️</button>
          </div>
          ${customFields.map(field => `
          <div class="action-field action-field-custom">
            <span class="field-label">${escapeHtml(field)}:</span>
            <span class="field-value">${escapeHtml(String(cfg[field]))}</span>
            <button class="btn-icon-xs" data-action="edit-param-field" data-name="${eName}" data-field="${escapeHtml(field)}" title="Edytuj">✏️</button>
            <button class="btn-icon-xs btn-danger" data-action="delete-param-field" data-name="${eName}" data-field="${escapeHtml(field)}" title="Usuń">✕</button>
          </div>
          `).join('')}
          <button class="btn btn-xs btn-secondary add-field-btn" data-action="add-param-field" data-name="${eName}">➕ Dodaj pole</button>
        </div>
      </div>
    </div>
  `}).join('');
}

export function renderActionsListHtml(mapData: MapData): string {
  const actions = mapData.actions || {};
  if (Object.keys(actions).length === 0) {
    return '<p class="text-muted text-xs">Brak globalnych akcji</p>';
  }

  return Object.entries(actions).map(([name, config]) => {
    const cfg = config as any;
    const standardFields = ['kind', 'url', 'method', 'py'];
    const customFields = Object.keys(cfg).filter(k => !standardFields.includes(k));
    const eName = escapeHtml(name);
    return `
    <div class="map-item expanded">
      <div class="map-item-header" onclick="this.parentElement.classList.toggle('expanded')">
        <span class="map-item-name">⚡ ${eName}</span>
        <span class="map-item-actions">
          <button class="btn-icon-sm" data-action="edit-action" data-name="${eName}" title="Zmień nazwę">✏️</button>
          <button class="btn-icon-sm btn-danger" data-action="delete-action" data-name="${eName}" title="Usuń">🗑️</button>
        </span>
      </div>
      <div class="map-item-body">
        <div class="action-row-details">
          <div class="action-field">
            <span class="field-label">Typ:</span>
            <span class="field-value">${cfg.kind || 'api'}</span>
            <button class="btn-icon-xs" data-action="edit-global-action-field" data-name="${eName}" data-field="kind" title="Edytuj">✏️</button>
          </div>
          <div class="action-field">
            <span class="field-label">URL:</span>
            <span class="field-value field-url">${cfg.url || cfg.py || '—'}</span>
            <button class="btn-icon-xs" data-action="edit-global-action-field" data-name="${eName}" data-field="url" title="Edytuj">✏️</button>
          </div>
          <div class="action-field">
            <span class="field-label">Metoda:</span>
            <span class="field-value">${cfg.method || 'POST'}</span>
            <button class="btn-icon-xs" data-action="edit-global-action-field" data-name="${eName}" data-field="method" title="Edytuj">✏️</button>
          </div>
          ${customFields.map(field => `
          <div class="action-field action-field-custom">
            <span class="field-label">${escapeHtml(field)}:</span>
            <span class="field-value">${escapeHtml(String(cfg[field]))}</span>
            <button class="btn-icon-xs" data-action="edit-global-action-field" data-name="${eName}" data-field="${escapeHtml(field)}" title="Edytuj">✏️</button>
            <button class="btn-icon-xs btn-danger" data-action="delete-global-action-field" data-name="${eName}" data-field="${escapeHtml(field)}" title="Usuń">✕</button>
          </div>
          `).join('')}
          <button class="btn btn-xs btn-secondary add-field-btn" data-action="add-global-action-field" data-name="${eName}">➕ Dodaj pole</button>
        </div>
      </div>
    </div>
  `}).join('');
}

export function renderFuncsListHtml(mapData: MapData): string {
  const funcs = mapData.funcImplementations || {};
  if (Object.keys(funcs).length === 0) {
    return '<p class="text-muted text-xs">Brak implementacji FUNC</p>';
  }

  return Object.entries(funcs).map(([name, config]) => `
    <div class="map-item expanded">
      <div class="map-item-header" onclick="this.parentElement.classList.toggle('expanded')">
        <span class="map-item-name">🔧 ${escapeHtml(name)}</span>
        <span class="map-item-actions">
          <button class="btn-icon-sm" data-action="edit-func" data-name="${escapeHtml(name)}" title="Edytuj">✏️</button>
          <button class="btn-icon-sm btn-danger" data-action="delete-func" data-name="${escapeHtml(name)}" title="Usuń">🗑️</button>
        </span>
      </div>
      <div class="map-item-body">
        <div class="func-steps">
          ${((config as any).steps || []).map((step: any, i: number) => `
            <div class="func-step" data-func="${escapeHtml(name)}" data-step-index="${i}">
              <span class="step-num">${i + 1}.</span>
              <span class="step-action">${escapeHtml(step.action || '—')}</span>
              <span class="step-object">${step.object ? `→ ${escapeHtml(step.object)}` : ''}</span>
              <span class="step-actions">
                <button class="btn-icon-xs" data-action="edit-func-step" data-func="${escapeHtml(name)}" data-step="${i}" title="Edytuj krok">✏️</button>
                <button class="btn-icon-xs btn-danger" data-action="delete-func-step" data-func="${escapeHtml(name)}" data-step="${i}" title="Usuń krok">✕</button>
              </span>
            </div>
          `).join('') || '<span class="text-muted">Brak kroków</span>'}
        </div>
        <button class="btn btn-xs btn-secondary func-add-step" data-action="add-func-step" data-func="${escapeHtml(name)}">➕ Dodaj krok</button>
      </div>
    </div>
  `).join('');
}

// ===== Visual Editor =====

function getBlockBadge(type: string, data: any): string {
  switch (type) {
    case 'param': return data.sensor || '—';
    case 'action': return data.kind || 'api';
    case 'func': return `${(data.steps || []).length} kroków`;
    default: return '';
  }
}

function renderVisualBlock(type: string, name: string, data: any, icon: string, _color: string): string {
  const itemCount = type === 'object' ? Object.keys(data).length : 0;
  const badge = type === 'object' ? `${itemCount} akcji` : getBlockBadge(type, data);
  const eName = escapeHtml(name);

  let bodyContent = '';

  if (type === 'object') {
    bodyContent = Object.entries(data).map(([action, config]: [string, any]) => {
      const objStdFields = ['kind', 'url', 'method', 'py'];
      const objCustomFields = Object.keys(config).filter(k => !objStdFields.includes(k));
      const eAction = escapeHtml(action);
      return `
      <div class="visual-action-block">
        <div class="visual-action-header">
          <span class="visual-action-name">${eAction}</span>
          <span class="visual-action-btns">
            <button class="btn-icon-xs" data-visual-action="edit-obj-action-name" data-block-name="${eName}" data-sub-name="${eAction}" title="Zmień nazwę">✏️</button>
            <button class="btn-icon-xs btn-danger" data-visual-action="delete-sub" data-block-type="object" data-block-name="${eName}" data-sub-name="${eAction}" title="Usuń">✕</button>
          </span>
        </div>
        <div class="visual-action-fields">
          <div class="visual-field-row">
            <span class="field-label">Typ:</span>
            <span class="field-value">${config.kind || 'api'}</span>
            <button class="btn-icon-xs" data-visual-action="edit-obj-action-field" data-block-name="${eName}" data-sub-name="${eAction}" data-field="kind" title="Edytuj">✏️</button>
          </div>
          <div class="visual-field-row">
            <span class="field-label">URL:</span>
            <span class="field-value field-url">${config.url || config.py || '—'}</span>
            <button class="btn-icon-xs" data-visual-action="edit-obj-action-field" data-block-name="${eName}" data-sub-name="${eAction}" data-field="url" title="Edytuj">✏️</button>
          </div>
          <div class="visual-field-row">
            <span class="field-label">Metoda:</span>
            <span class="field-value">${config.method || 'POST'}</span>
            <button class="btn-icon-xs" data-visual-action="edit-obj-action-field" data-block-name="${eName}" data-sub-name="${eAction}" data-field="method" title="Edytuj">✏️</button>
          </div>
          ${objCustomFields.map(field => `
          <div class="visual-field-row action-field-custom">
            <span class="field-label">${escapeHtml(field)}:</span>
            <span class="field-value">${escapeHtml(String(config[field]))}</span>
            <button class="btn-icon-xs" data-visual-action="edit-obj-action-field" data-block-name="${eName}" data-sub-name="${eAction}" data-field="${escapeHtml(field)}" title="Edytuj">✏️</button>
            <button class="btn-icon-xs btn-danger" data-visual-action="delete-obj-action-field" data-block-name="${eName}" data-sub-name="${eAction}" data-field="${escapeHtml(field)}" title="Usuń">✕</button>
          </div>
          `).join('')}
          <button class="btn btn-xs btn-secondary add-field-btn" data-visual-action="add-obj-action-field" data-block-name="${eName}" data-sub-name="${eAction}">➕ Dodaj pole</button>
        </div>
      </div>
    `}).join('');
    bodyContent += `<button class="btn btn-xs btn-secondary visual-add-sub" data-visual-action="add-sub" data-block-type="object" data-block-name="${eName}">➕ Dodaj akcję</button>`;
  } else if (type === 'param') {
    const paramStdFields = ['sensor', 'url', 'unit', 'py', 'kind'];
    const paramCustomFields = Object.keys(data).filter(k => !paramStdFields.includes(k));
    bodyContent = `
      <div class="visual-sub-item visual-sub-editable" data-visual-action="edit-param-field" data-block-name="${eName}" data-field="sensor">
        <span class="visual-sub-label">Sensor</span>
        <span class="visual-sub-value">${data.sensor || '—'}</span>
        <button class="btn-icon-xs visual-edit-inline" title="Edytuj">✏️</button>
      </div>
      <div class="visual-sub-item visual-sub-editable" data-visual-action="edit-param-field" data-block-name="${eName}" data-field="unit">
        <span class="visual-sub-label">Jednostka</span>
        <span class="visual-sub-value">${data.unit || '—'}</span>
        <button class="btn-icon-xs visual-edit-inline" title="Edytuj">✏️</button>
      </div>
      <div class="visual-sub-item visual-sub-editable" data-visual-action="edit-param-field" data-block-name="${eName}" data-field="url">
        <span class="visual-sub-label">URL</span>
        <span class="visual-sub-value">${data.url || '—'}</span>
        <button class="btn-icon-xs visual-edit-inline" title="Edytuj">✏️</button>
      </div>
      ${paramCustomFields.map(field => `
      <div class="visual-sub-item visual-sub-editable action-field-custom" data-visual-action="edit-param-field" data-block-name="${eName}" data-field="${escapeHtml(field)}">
        <span class="visual-sub-label">${escapeHtml(field)}</span>
        <span class="visual-sub-value">${escapeHtml(String(data[field]))}</span>
        <button class="btn-icon-xs visual-edit-inline" title="Edytuj">✏️</button>
        <button class="btn-icon-xs btn-danger" data-visual-action="delete-visual-param-field" data-block-name="${eName}" data-field="${escapeHtml(field)}" title="Usuń">✕</button>
      </div>
      `).join('')}
      <button class="btn btn-xs btn-secondary visual-add-sub" data-visual-action="add-visual-param-field" data-block-name="${eName}">➕ Dodaj pole</button>
    `;
  } else if (type === 'action') {
    const actStdFields = ['kind', 'url', 'method', 'py'];
    const actCustomFields = Object.keys(data).filter(k => !actStdFields.includes(k));
    bodyContent = `
      <div class="visual-sub-item visual-sub-editable" data-visual-action="edit-action-field" data-block-name="${eName}" data-field="kind">
        <span class="visual-sub-label">Typ</span>
        <span class="visual-sub-value">${data.kind || 'api'}</span>
        <button class="btn-icon-xs visual-edit-inline" title="Edytuj">✏️</button>
      </div>
      <div class="visual-sub-item visual-sub-editable" data-visual-action="edit-action-field" data-block-name="${eName}" data-field="url">
        <span class="visual-sub-label">URL</span>
        <span class="visual-sub-value">${data.url || '—'}</span>
        <button class="btn-icon-xs visual-edit-inline" title="Edytuj">✏️</button>
      </div>
      <div class="visual-sub-item visual-sub-editable" data-visual-action="edit-action-field" data-block-name="${eName}" data-field="method">
        <span class="visual-sub-label">Metoda</span>
        <span class="visual-sub-value">${data.method || 'POST'}</span>
        <button class="btn-icon-xs visual-edit-inline" title="Edytuj">✏️</button>
      </div>
      ${actCustomFields.map(field => `
      <div class="visual-sub-item visual-sub-editable action-field-custom" data-visual-action="edit-action-field" data-block-name="${eName}" data-field="${escapeHtml(field)}">
        <span class="visual-sub-label">${escapeHtml(field)}</span>
        <span class="visual-sub-value">${escapeHtml(String(data[field]))}</span>
        <button class="btn-icon-xs visual-edit-inline" title="Edytuj">✏️</button>
        <button class="btn-icon-xs btn-danger" data-visual-action="delete-visual-action-field" data-block-name="${eName}" data-field="${escapeHtml(field)}" title="Usuń">✕</button>
      </div>
      `).join('')}
      <button class="btn btn-xs btn-secondary visual-add-sub" data-visual-action="add-visual-action-field" data-block-name="${eName}">➕ Dodaj pole</button>
    `;
  } else if (type === 'func') {
    const steps = data.steps || [];
    bodyContent = steps.map((step: any, i: number) => `
      <div class="visual-sub-item visual-sub-editable">
        <span class="visual-sub-label">${i + 1}.</span>
        <span class="visual-sub-value">${step.action || '—'} ${step.object ? `→ ${step.object}` : ''}</span>
        <span class="visual-sub-actions">
          <button class="btn-icon-xs" data-visual-action="edit-func-step" data-block-name="${eName}" data-step="${i}" title="Edytuj">✏️</button>
          <button class="btn-icon-xs btn-danger" data-visual-action="delete-func-step" data-block-name="${eName}" data-step="${i}" title="Usuń">✕</button>
        </span>
      </div>
    `).join('') || '<span class="text-muted">Brak kroków</span>';
    bodyContent += `<button class="btn btn-xs btn-secondary visual-add-sub" data-visual-action="add-func-step" data-block-name="${eName}">➕ Dodaj krok</button>`;
  }

  return `
    <div class="visual-block block-${type} expanded">
      <div class="visual-block-header" data-visual-action="toggle-block">
        <div class="visual-block-title">
          <span class="visual-block-icon">${icon}</span>
          <span class="visual-block-name">${escapeHtml(name)}</span>
          <span class="visual-block-badge">${badge}</span>
        </div>
        <div class="visual-block-actions">
          <button class="btn-icon-sm" data-visual-action="edit-block" data-block-type="${type}" data-block-name="${escapeHtml(name)}" title="Edytuj">✏️</button>
          <button class="btn-icon-sm btn-danger" data-visual-action="delete-block" data-block-type="${type}" data-block-name="${escapeHtml(name)}" title="Usuń">🗑️</button>
        </div>
      </div>
      <div class="visual-block-body">
        ${bodyContent}
      </div>
    </div>
  `;
}

export function renderVisualEditorHtml(mapData: MapData): string {
  let html = '';

  // Objects
  for (const [name, actions] of Object.entries(mapData.objectActionMap || {})) {
    html += renderVisualBlock('object', name, actions, '📦', '#4fc3f7');
  }

  // Parameters
  for (const [name, config] of Object.entries(mapData.paramSensorMap || {})) {
    html += renderVisualBlock('param', name, config, '📊', '#81c784');
  }

  // Actions
  for (const [name, config] of Object.entries(mapData.actions || {})) {
    html += renderVisualBlock('action', name, config, '⚡', '#ffb74d');
  }

  // FUNCs
  for (const [name, config] of Object.entries(mapData.funcImplementations || {})) {
    html += renderVisualBlock('func', name, config, '🔧', '#ba68c8');
  }

  if (!html) {
    html = '<p class="text-muted text-center">Brak elementów. Użyj przycisków powyżej, aby dodać.</p>';
  }

  return html;
}
