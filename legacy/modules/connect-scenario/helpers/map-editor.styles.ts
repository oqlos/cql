// frontend/src/modules/connect-scenario/helpers/map-editor.styles.ts
// Extracted styles for MapEditorPage

export function getMapEditorStyles(): string {
  return `
    .map-editor-page { height: 100%; display: flex; flex-direction: column; }
    .map-editor-layout { display: flex; flex: 1; gap: 12px; min-height: 0; margin-top: 12px; }
    
    /* Scenario List */
    .map-scenario-list {
      width: 200px;
      min-width: 180px;
      display: flex;
      flex-direction: column;
      background: var(--panel-bg);
      border: 1px solid var(--panel-border);
      border-radius: 6px;
      overflow: hidden;
    }
    .scenario-list-filter { padding: 8px; border-bottom: 1px solid var(--panel-border); }
    .search-input {
      width: 100%;
      padding: 6px 8px;
      border: 1px solid var(--panel-border);
      border-radius: 4px;
      background: var(--bg-muted);
      color: var(--text);
      font-size: 12px;
    }
    .scenario-table-wrapper { flex: 1; overflow: auto; }
    .scenario-table { width: 100%; border-collapse: collapse; }
    .scenario-table th, .scenario-table td {
      padding: 8px;
      text-align: left;
      border-bottom: 1px solid var(--panel-border);
    }
    .scenario-table tbody tr { cursor: pointer; }
    .scenario-table tbody tr:hover { background: var(--bg-muted); }
    .scenario-table tbody tr.active { background: var(--primary); color: white; }
    
    .map-editor-tabs {
      display: flex;
      flex-direction: column;
      gap: 4px;
      width: 120px;
      min-width: 120px;
    }
    .map-tab {
      padding: 10px;
      border: 1px solid var(--panel-border);
      background: var(--panel-bg);
      border-radius: 6px;
      cursor: pointer;
      text-align: left;
      font-size: 12px;
    }
    .map-tab:hover { background: var(--bg-muted); }
    .map-tab.active { background: var(--primary); color: white; border-color: var(--primary); }
    .map-editor-main {
      flex: 1;
      background: var(--panel-bg);
      border: 1px solid var(--panel-border);
      border-radius: 6px;
      padding: 12px;
      overflow: auto;
    }
    .map-tab-content { display: none; height: 100%; }
    .map-tab-content.active { display: flex; flex-direction: column; }
    .map-section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      font-weight: 600;
    }
    .map-items-list { flex: 1; overflow: auto; }
    .map-item {
      border: 1px solid var(--panel-border);
      border-radius: 6px;
      margin-bottom: 8px;
      overflow: hidden;
    }
    .map-item-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 12px;
      background: var(--bg-muted);
      cursor: pointer;
    }
    .map-item-header:hover { background: var(--panel-border); }
    .map-item-name { font-weight: 600; }
    .map-item-body { padding: 12px; display: none; }
    .map-item.expanded .map-item-body { display: block; }
    
    /* JSON Editor */
    .json-editor-wrapper {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
    }
    .json-editor-container {
      position: relative;
      flex: 1;
      min-height: 0;
      border: 1px solid var(--panel-border);
      border-radius: 6px;
      overflow: hidden;
    }
    .json-highlight-overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      overflow: auto;
      pointer-events: none;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      line-height: 1.5;
      white-space: pre-wrap;
      word-wrap: break-word;
      background: var(--bg-muted);
      color: transparent;
    }
    .json-highlight-overlay code {
      display: block;
      font-family: inherit;
      color: var(--text);
    }
    #map-json-editor {
      position: relative;
      width: 100%;
      height: 100%;
      resize: none;
      border: none;
      background: transparent;
      color: var(--text);
      padding: 12px;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      line-height: 1.5;
      caret-color: var(--text);
      z-index: 1;
    }

    /* JSON Syntax Highlighting Colors */
    .tok-property { color: #9cdcfe; }
    .tok-string { color: #ce9178; }
    .tok-number { color: #b5cea8; }
    .tok-boolean { color: #569cd6; }
    .tok-null { color: #569cd6; }
    .tok-bracket { color: #ffd700; }

    /* Visual Block Editor */
    .visual-editor-toolbar {
      display: flex;
      gap: 8px;
      padding: 8px;
      background: var(--bg-muted);
      border-radius: 6px;
      margin-bottom: 12px;
    }
    .visual-editor-canvas {
      flex: 1;
      overflow: auto;
      padding: 12px;
      background: var(--panel-bg);
      border: 1px solid var(--panel-border);
      border-radius: 6px;
    }

    /* Visual Blocks */
    .visual-block {
      background: var(--panel-bg);
      border: 2px solid var(--panel-border);
      border-radius: 8px;
      margin-bottom: 12px;
      overflow: hidden;
    }
    .visual-block.block-object { border-left: 4px solid #4fc3f7; }
    .visual-block.block-param { border-left: 4px solid #81c784; }
    .visual-block.block-action { border-left: 4px solid #ffb74d; }
    .visual-block.block-func { border-left: 4px solid #ba68c8; }
    
    .visual-block-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 12px;
      background: var(--bg-muted);
      cursor: pointer;
    }
    .visual-block-header:hover { background: var(--panel-border); }
    .visual-block-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
    }
    .visual-block-icon { font-size: 16px; }
    .visual-block-name { font-size: 14px; }
    .visual-block-badge {
      font-size: 11px;
      padding: 2px 8px;
      background: var(--panel-border);
      border-radius: 10px;
      color: var(--text-muted);
    }
    .visual-block-actions { display: flex; gap: 4px; }
    
    .visual-block-body {
      padding: 12px;
      display: none;
    }
    .visual-block.expanded .visual-block-body { display: block; }
    
    .visual-sub-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      background: var(--bg-muted);
      border-radius: 4px;
      margin-bottom: 6px;
      font-size: 12px;
    }
    .visual-sub-item:last-child { margin-bottom: 0; }
    .visual-sub-item:hover { background: var(--panel-border); }
    .visual-sub-label { font-weight: 600; min-width: 80px; }
    .visual-sub-value { flex: 1; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; }
    .visual-sub-input {
      flex: 1;
      padding: 4px 8px;
      border: 1px solid var(--panel-border);
      border-radius: 4px;
      background: var(--panel-bg);
      color: var(--text);
      font-size: 12px;
    }
    .visual-sub-select {
      padding: 4px 8px;
      border: 1px solid var(--panel-border);
      border-radius: 4px;
      background: var(--panel-bg);
      color: var(--text);
      font-size: 12px;
    }

    /* Editable sub-items */
    .visual-sub-editable { cursor: pointer; position: relative; }
    .visual-sub-editable .visual-sub-actions,
    .visual-sub-editable .visual-edit-inline { opacity: 0; transition: opacity 0.2s; }
    .visual-sub-editable:hover .visual-sub-actions,
    .visual-sub-editable:hover .visual-edit-inline { opacity: 1; }
    .visual-sub-actions { display: flex; gap: 4px; margin-left: auto; }
    .visual-add-sub { margin-top: 8px; width: 100%; }
    
    /* Tiny icon buttons */
    .btn-icon-xs {
      background: transparent;
      border: 1px solid var(--panel-border);
      border-radius: 3px;
      cursor: pointer;
      padding: 2px 4px;
      font-size: 10px;
      line-height: 1;
    }
    .btn-icon-xs:hover { background: var(--bg-muted); }
    .btn-icon-xs.btn-danger:hover { background: var(--danger); color: white; }
    .visual-edit-inline { margin-left: auto; }

    /* Visual action block (for object actions with fields) */
    .visual-action-block {
      border: 1px solid var(--panel-border);
      border-radius: 6px;
      margin-bottom: 8px;
      overflow: hidden;
    }
    .visual-action-block:hover { border-color: var(--primary); }
    .visual-action-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px;
      background: var(--bg-muted);
      border-bottom: 1px solid var(--panel-border);
    }
    .visual-action-name { font-weight: 600; font-size: 13px; }
    .visual-action-btns { display: flex; gap: 4px; }
    .visual-action-btns .btn-icon-xs { opacity: 0; transition: opacity 0.2s; }
    .visual-action-header:hover .btn-icon-xs { opacity: 1; }
    .visual-action-fields { padding: 8px 12px; }
    .visual-field-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 0;
      font-size: 12px;
    }
    .visual-field-row .field-label {
      font-weight: 500;
      min-width: 60px;
      color: var(--text-muted);
    }
    .visual-field-row .field-value {
      flex: 1;
      font-family: 'Courier New', monospace;
      font-size: 11px;
      color: var(--text);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .visual-field-row .field-url { max-width: 250px; }
    .visual-field-row .btn-icon-xs { opacity: 0; transition: opacity 0.2s; }
    .visual-field-row:hover .btn-icon-xs { opacity: 1; }

    /* FUNC step with inline actions */
    .func-step { position: relative; justify-content: flex-start; }
    .func-step .step-actions { display: flex; gap: 4px; margin-left: auto; opacity: 0; transition: opacity 0.2s; }
    .func-step:hover .step-actions { opacity: 1; }
    .func-add-step { margin-top: 8px; }

    /* FUNC toolbar and reference */
    .func-toolbar { display: flex; gap: 8px; align-items: center; margin-left: auto; }
    .func-help-hint { font-size: 11px; color: var(--text-muted); }
    .func-editor-list { flex: 1; overflow: auto; }
    
    .func-reference-panel { 
      margin-top: 12px; 
      border: 1px solid var(--panel-border); 
      border-radius: 6px; 
      overflow: hidden;
    }
    .func-reference-panel .reference-header {
      padding: 8px 12px;
      background: var(--bg-muted);
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
    }
    .func-reference-panel .reference-body { 
      display: none; 
      padding: 12px;
      font-size: 11px;
    }
    .func-reference-panel.expanded .reference-body { display: block; }
    .func-reference-panel .reference-item { 
      padding: 4px 0; 
      border-bottom: 1px solid var(--panel-border);
    }
    .func-reference-panel .reference-item:last-child { border-bottom: none; }
    .func-reference-panel .reference-item code {
      background: var(--bg-muted);
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 11px;
    }
  `;
}
