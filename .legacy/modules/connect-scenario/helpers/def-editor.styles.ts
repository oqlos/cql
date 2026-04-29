/**
 * def-editor.styles.ts
 * CSS styles for DefEditorPage
 */
import { getDslSyntaxStyles } from '../../../shared/dsl-syntax.styles';
import { saveIndicatorStyles } from '../../../shared/autosave.service';

export function getDefEditorStyles(): string {
  return `
    ${getDslSyntaxStyles()}
    ${saveIndicatorStyles}
    .def-editor-page { height: 100%; display: flex; flex-direction: column; }
    .def-editor-layout { display: flex; flex: 1; gap: 12px; min-height: 0; }
    
    /* Scenario list */
    .def-scenario-list {
      width: 200px;
      min-width: 200px;
      background: var(--panel-bg);
      border: 1px solid var(--panel-border);
      border-radius: 8px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    
    .def-scenario-list .scenario-list-filter {
      padding: 8px;
      border-bottom: 1px solid var(--panel-border);
    }
    
    .def-scenario-list .filter-row {
      display: flex;
      gap: 4px;
      align-items: center;
    }
    
    .def-scenario-list .search-input {
      flex: 1;
      min-width: 0;
      padding: 6px 10px;
      border: 1px solid var(--panel-border);
      border-radius: 4px;
      font-size: 12px;
    }
    
    .def-scenario-list #def-add-scenario-btn {
      flex-shrink: 0;
      padding: 6px 8px;
    }
    
    .def-scenario-list .scenario-table-wrapper {
      flex: 1;
      overflow-y: auto;
    }
    
    .def-scenario-list .scenario-table {
      width: 100%;
      border-collapse: collapse;
    }
    
    .def-scenario-list .scenario-table th {
      padding: 6px 10px;
      text-align: left;
      background: var(--bg-muted);
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      color: var(--text-muted);
      position: sticky;
      top: 0;
    }
    
    .def-scenario-list .scenario-row {
      cursor: pointer;
      transition: background 0.15s;
    }
    
    .def-scenario-list .scenario-row:hover {
      background: var(--bg-muted);
    }
    
    .def-scenario-list .scenario-row.active {
      background: var(--primary);
      color: var(--primary-contrast);
    }
    
    .def-scenario-list .scenario-row td {
      padding: 8px 10px;
      border-bottom: 1px solid var(--panel-border);
    }
    
    .def-editor-sidebar {
      width: 160px;
      min-width: 160px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    
    .def-tabs {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    
    .def-tab {
      padding: 8px 12px;
      border: 1px solid var(--panel-border);
      background: var(--panel-bg);
      color: var(--text);
      border-radius: 6px;
      cursor: pointer;
      text-align: left;
      transition: all 0.2s;
    }
    
    .def-tab:hover { background: var(--bg-muted); }
    .def-tab.active {
      background: var(--primary);
      color: var(--primary-contrast);
      border-color: var(--primary);
    }
    
    .def-actions {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-top: auto;
    }
    
    .def-editor-main {
      flex: 1;
      background: var(--panel-bg);
      border: 1px solid var(--panel-border);
      border-radius: 8px;
      padding: 16px;
      overflow-y: auto;
    }
    
    .def-tab-content { display: none; }
    .def-tab-content.active { display: block; }
    
    .def-section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--panel-border);
    }
    
    .def-section-header h3 { margin: 0; }
    
    .def-items-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    
    .def-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: var(--bg-muted);
      border: 1px solid var(--panel-border);
      border-radius: 6px;
    }
    
    .def-item-name {
      flex: 1;
      font-weight: 500;
    }
    
    .def-item-value {
      color: var(--text-muted);
      font-family: monospace;
    }
    
    .def-item-actions {
      display: flex;
      gap: 4px;
    }
    
    .def-item-actions button {
      padding: 4px 8px;
      font-size: 12px;
    }
    
    /* FUNC editor styles */
    .def-func-item {
      background: var(--bg-muted);
      border: 1px solid var(--panel-border);
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 12px;
    }
    
    .def-func-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }
    
    .def-func-name {
      flex: 1;
      padding: 8px 12px;
      border: 1px solid var(--panel-border);
      border-radius: 6px;
      background: var(--bg);
      font-size: 14px;
      font-weight: 600;
    }
    
    .def-func-name:focus {
      border-color: var(--accent);
      outline: none;
    }
    
    .def-func-code {
      width: 100%;
      padding: 10px;
      border: 1px solid var(--panel-border);
      border-radius: 6px;
      background: var(--bg);
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 13px;
      line-height: 1.5;
      resize: vertical;
      min-height: 100px;
    }
    
    .def-func-code:focus {
      border-color: var(--accent);
      outline: none;
    }
    
    .def-func-code::placeholder {
      color: var(--text-muted);
      opacity: 0.6;
    }
    
    /* GOAL item styles */
    .def-goal-item {
      padding: 12px;
      border: 1px solid var(--panel-border);
      border-radius: 8px;
      margin-bottom: 12px;
      background: var(--bg);
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    
    .def-goal-item:hover {
      border-color: var(--accent);
    }
    
    .def-goal-item[draggable="true"] {
      cursor: grab;
    }
    
    .def-goal-item.dragging {
      opacity: 0.5;
      border-style: dashed;
    }
    
    .def-goal-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }
    
    .def-goal-header .drag-handle {
      cursor: grab;
      color: var(--text-muted);
      font-size: 16px;
      padding: 4px;
    }
    
    .def-goal-header .goal-order {
      background: var(--accent);
      color: white;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      min-width: 28px;
      text-align: center;
    }
    
    .def-goal-name {
      flex: 1;
      padding: 8px 12px;
      border: 1px solid var(--panel-border);
      border-radius: 6px;
      background: var(--bg);
      font-size: 14px;
      font-weight: 600;
    }
    
    .def-goal-name:focus {
      border-color: var(--accent);
      outline: none;
    }
    
    .def-goal-actions {
      display: flex;
      gap: 4px;
    }
    
    .def-goal-code {
      width: 100%;
      padding: 10px;
      border: 1px solid var(--panel-border);
      border-radius: 6px;
      background: var(--bg);
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 13px;
      line-height: 1.5;
      resize: vertical;
      min-height: 120px;
    }
    
    .def-goal-code:focus {
      border-color: var(--accent);
      outline: none;
    }
    
    .def-goal-code::placeholder {
      color: var(--text-muted);
      opacity: 0.6;
    }
    
    .mappings-container {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }
    
    .mapping-section h4 {
      margin: 0 0 4px 0;
      color: var(--text);
    }
    
    .mapping-row {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 10px;
      background: var(--bg-muted);
      border: 1px solid var(--panel-border);
      border-radius: 6px;
      margin-top: 8px;
    }
    
    .mapping-label {
      min-width: 120px;
      font-weight: 600;
      padding-top: 6px;
    }
    
    .mapping-values {
      flex: 1;
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    
    .mapping-tag {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 8px;
      background: var(--primary);
      color: var(--primary-contrast);
      border-radius: 4px;
      font-size: 12px;
    }
    
    .mapping-tag .remove-tag {
      cursor: pointer;
      opacity: 0.7;
    }
    
    .mapping-tag .remove-tag:hover { opacity: 1; }
    
    .mapping-add-btn {
      padding: 4px 8px;
      font-size: 12px;
      background: transparent;
      border: 1px dashed var(--panel-border);
      border-radius: 4px;
      cursor: pointer;
      color: var(--text-muted);
    }
    
    .mapping-add-btn:hover {
      background: var(--bg-muted);
      border-color: var(--primary);
      color: var(--primary);
    }
    
    .mappings-info-box {
      background: var(--bg-muted);
      border: 1px solid var(--panel-border);
      border-radius: 6px;
      padding: 12px;
      margin-bottom: 16px;
    }
    
    .mappings-info-box p:first-child {
      margin-bottom: 4px;
    }
    
    .mapping-examples {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 8px 0 12px 0;
    }
    
    .example-tag {
      display: inline-block;
      padding: 4px 10px;
      background: var(--bg);
      border: 1px dashed var(--panel-border);
      border-radius: 4px;
      font-size: 12px;
      color: var(--text-muted);
      font-style: italic;
    }
    
    /* Defaults (OPT/SET) item styles */
    .def-default-item {
      padding: 10px 12px;
      border: 1px solid var(--panel-border);
      border-radius: 6px;
      margin-bottom: 8px;
      background: var(--bg);
    }
    
    .def-default-row {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    
    .def-default-type {
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      min-width: 36px;
      text-align: center;
    }
    
    .def-default-type.opt {
      background: var(--badge-green-bg);
      color: var(--badge-green-text);
    }
    
    .def-default-type.set {
      background: var(--badge-blue-bg);
      color: var(--badge-blue-text);
    }
    
    .def-default-name {
      width: 140px;
      padding: 6px 10px;
      border: 1px solid var(--panel-border);
      border-radius: 4px;
      font-weight: 500;
    }
    
    .def-default-eq {
      color: var(--text-muted);
      font-weight: bold;
    }
    
    .def-default-value {
      width: 120px;
      padding: 6px 10px;
      border: 1px solid var(--panel-border);
      border-radius: 4px;
      font-family: monospace;
    }
    
    .def-default-desc {
      flex: 1;
      min-width: 150px;
      padding: 6px 10px;
      border: 1px solid var(--panel-border);
      border-radius: 4px;
      font-size: 12px;
      color: var(--text-muted);
    }
    
    .def-default-type-select {
      padding: 6px 8px;
      border: 1px solid var(--panel-border);
      border-radius: 4px;
      font-size: 12px;
      background: var(--bg);
    }
    
    .def-default-name:focus,
    .def-default-value:focus,
    .def-default-desc:focus,
    .def-default-type-select:focus {
      border-color: var(--accent);
      outline: none;
    }
    
    /* SET/OPT variables from GOALs */
    .def-vars-goal-section {
      margin-bottom: 16px;
      border: 1px solid var(--panel-border);
      border-radius: 8px;
      overflow: hidden;
    }
    
    .def-vars-goal-header {
      padding: 10px 14px;
      background: var(--bg-muted);
      font-weight: 600;
      font-size: 13px;
      border-bottom: 1px solid var(--panel-border);
    }
    
    .def-vars-goal-list {
      padding: 8px;
    }
    
    .def-set-var-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      margin-bottom: 6px;
      background: var(--bg);
      border: 1px solid var(--panel-border);
      border-radius: 6px;
    }
    
    .def-set-var-item:last-child {
      margin-bottom: 0;
    }
    
    .def-var-type {
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      min-width: 32px;
      text-align: center;
    }
    
    .def-var-type.set {
      background: var(--badge-blue-bg);
      color: var(--badge-blue-text);
    }
    
    .def-var-type.opt {
      background: var(--badge-green-bg);
      color: var(--badge-green-text);
    }
    
    .def-var-name {
      font-family: monospace;
      font-weight: 500;
      color: var(--text);
      min-width: 120px;
    }
    
    .def-var-eq {
      color: var(--text-muted);
      font-weight: bold;
    }
    
    .def-var-value {
      flex: 1;
      padding: 6px 10px;
      border: 1px solid var(--panel-border);
      border-radius: 4px;
      font-family: monospace;
      font-size: 13px;
    }
    
    .def-var-value:focus {
      border-color: var(--accent);
      outline: none;
    }
    
    .def-var-role {
      padding: 6px 10px;
      border: 1px solid var(--panel-border);
      border-radius: 4px;
      font-size: 12px;
      background: var(--bg);
      color: var(--text);
      min-width: 100px;
      cursor: pointer;
    }
    
    .def-var-role:focus {
      border-color: var(--accent);
      outline: none;
    }
    
    .def-var-role option {
      padding: 4px;
    }
    
    #def-code-modal .modal-dialog {
      max-height: 90vh;
      display: flex;
      flex-direction: column;
    }
    
    #def-code-modal .modal-body {
      flex: 1;
      overflow: auto;
    }
    
    /* Source code editor */
    .def-tab-source {
      margin-top: 8px;
      border-top: 1px solid var(--panel-border);
      padding-top: 12px;
    }
    
    .def-source-container {
      position: relative;
      font-family: "Monaco", "Menlo", "Ubuntu Mono", "Consolas", monospace;
      font-size: 13px;
      line-height: 1.5;
      background: var(--bg-muted);
      border: 1px solid var(--panel-border);
      border-radius: 6px;
    }
    
    .def-source-highlight {
      padding: 12px;
      pointer-events: none;
      white-space: pre-wrap;
      word-wrap: break-word;
      color: var(--text);
    }
    
    .def-source-textarea {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      padding: 12px;
      font-family: inherit;
      font-size: inherit;
      line-height: inherit;
      border: none;
      border-radius: 6px;
      resize: none;
      background: transparent;
      color: transparent;
      -webkit-text-fill-color: transparent;
      caret-color: var(--text);
      white-space: pre-wrap;
      word-wrap: break-word;
      overflow: hidden;
    }
    
    .def-source-textarea:focus {
      outline: none;
      border-color: var(--primary);
    }
    
    .def-source-textarea::selection {
      background: rgba(255, 165, 0, 0.3);
      color: transparent;
      -webkit-text-fill-color: transparent;
    }
    
    .def-source-textarea::-moz-selection {
      background: rgba(255, 165, 0, 0.3);
      color: transparent;
    }
    
    /* Goals Order List */
    .goals-order-list {
      min-height: 100px;
    }
    
    .goal-order-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: var(--panel-bg);
      border: 1px solid var(--panel-border);
      border-radius: 6px;
      margin-bottom: 4px;
      cursor: grab;
      transition: all 0.2s ease;
    }
    
    .goal-order-item:hover {
      border-color: var(--primary);
      background: var(--panel-hover);
    }
    
    .goal-order-item.disabled {
      opacity: 0.5;
      background: var(--panel-disabled);
    }
    
    .goal-order-item.dragging {
      opacity: 0.5;
      border-color: var(--primary);
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    }
    
    .goal-order-item .drag-handle {
      cursor: grab;
      color: var(--text-muted);
      font-size: 14px;
      padding: 4px;
    }
    
    .goal-order-item .goal-order-index {
      color: var(--text-muted);
      font-size: 12px;
      min-width: 24px;
    }
    
    .goal-order-item .goal-order-checkbox {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 1;
      cursor: pointer;
    }
    
    .goal-order-item .goal-order-checkbox input[type="checkbox"] {
      width: 16px;
      height: 16px;
      cursor: pointer;
    }
    
    .goal-order-item .def-item-name {
      flex: 1;
    }
    
    .goal-order-item .def-item-actions {
      display: flex;
      gap: 4px;
    }
    
    /* Goal OPTs List */
    .goal-opts-container {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    
    .goal-opts-section {
      background: var(--panel-bg);
      border: 1px solid var(--panel-border);
      border-radius: 8px;
      overflow: hidden;
    }
    
    .goal-opts-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 14px;
      background: var(--panel-header);
      border-bottom: 1px solid var(--panel-border);
    }
    
    .goal-opts-title {
      font-weight: 600;
      font-size: 13px;
    }
    
    .goal-opts-count {
      font-size: 11px;
      color: var(--text-muted);
      background: var(--badge-bg);
      padding: 2px 8px;
      border-radius: 10px;
    }
    
    .goal-opts-items {
      padding: 8px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    
    .goal-opt-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: var(--input-bg);
      border: 1px solid var(--panel-border);
      border-radius: 4px;
      transition: all 0.15s ease;
    }
    
    .goal-opt-item:hover {
      border-color: var(--primary);
      background: var(--panel-hover);
    }
    
    .goal-opt-item .opt-name {
      font-family: monospace;
      font-weight: 600;
      color: var(--primary);
      min-width: 150px;
    }
    
    .goal-opt-item .opt-value {
      font-family: monospace;
      color: var(--success);
      flex: 1;
    }
    
    .goal-opt-item .opt-desc {
      font-size: 11px;
      color: var(--text-muted);
      max-width: 200px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    /* Goals Config List (unified) */
    .goals-config-container {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    
    .goal-config-section {
      background: var(--panel-bg);
      border: 1px solid var(--panel-border);
      border-radius: 8px;
      overflow: hidden;
      transition: all 0.2s ease;
    }
    
    .goal-config-section:hover {
      border-color: var(--primary);
    }
    
    .goal-config-section.disabled {
      opacity: 0.5;
    }
    
    .goal-config-section.dragging {
      opacity: 0.6;
      border-color: var(--primary);
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    }
    
    .goal-config-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      background: var(--panel-header);
      border-bottom: 1px solid var(--panel-border);
      cursor: grab;
    }
    
    .goal-config-header .drag-handle {
      cursor: grab;
      color: var(--text-muted);
      font-size: 14px;
    }
    
    .goal-config-index {
      color: var(--text-muted);
      font-size: 12px;
      min-width: 24px;
    }
    
    .goal-config-checkbox {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 1;
      cursor: pointer;
    }
    
    .goal-config-checkbox input[type="checkbox"] {
      width: 16px;
      height: 16px;
      cursor: pointer;
    }
    
    .goal-config-name {
      font-weight: 600;
      font-size: 13px;
    }
    
    .goal-opts-badge {
      font-size: 11px;
      color: var(--text-muted);
      background: var(--badge-bg);
      padding: 2px 8px;
      border-radius: 10px;
    }
    
    .goal-config-actions {
      display: flex;
      gap: 4px;
    }
    
    .goal-config-opts {
      padding: 8px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      background: var(--input-bg);
    }
    
    /* Modal Styles */
    .modal {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }
    
    .modal.hidden {
      display: none;
    }
    
    .modal-dialog {
      background: var(--panel-bg);
      border: 1px solid var(--panel-border);
      border-radius: 8px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
      max-height: 90vh;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
    }
    
    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      border-bottom: 1px solid var(--panel-border);
      background: var(--panel-header);
      border-radius: 8px 8px 0 0;
    }
    
    .modal-header h4 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: var(--text);
    }
    
    .btn-close {
      background: none;
      border: none;
      font-size: 18px;
      cursor: pointer;
      color: var(--text-muted);
      padding: 4px;
      border-radius: 4px;
      transition: background-color 0.2s;
    }
    
    .btn-close:hover {
      background: var(--surface-hover);
      color: var(--text);
    }
    
    .modal-body {
      padding: 20px;
      flex: 1;
      overflow-y: auto;
    }
    
    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding: 16px 20px;
      border-top: 1px solid var(--panel-border);
      background: var(--panel-footer);
      border-radius: 0 0 8px 8px;
    }
    
    .func-selection-item:hover {
      border-color: var(--primary) !important;
      background: var(--surface-hover) !important;
    }
    
    .d-flex {
      display: flex;
    }
    
    .justify-between {
      justify-content: space-between;
    }
    
    .items-center {
      align-items: center;
    }
    
    .gap-sm {
      gap: 8px;
    }
  `;
}
