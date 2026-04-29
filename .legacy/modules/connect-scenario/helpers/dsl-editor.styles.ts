/**
 * dsl-editor.styles.ts
 * CSS styles for DslEditorPage
 */
import { getDslSyntaxStyles } from '../../../shared/dsl-syntax.styles';
import { saveIndicatorStyles } from '../../../shared/autosave.service';

export function getDslEditorStyles(): string {
  return `
    ${getDslSyntaxStyles()}
    ${saveIndicatorStyles}
    .dsl-editor-page { height: 100%; display: flex; flex-direction: column; min-width: 0; }
    .dsl-editor-layout { display: flex; flex: 1; gap: 12px; min-height: 0; min-width: 0; }

    .dsl-editor-page .page-header {
      gap: 12px;
      flex-wrap: wrap;
      align-items: flex-start;
    }

    .dsl-editor-page .page-header h2 {
      margin: 0;
      max-width: 100%;
      overflow-wrap: anywhere;
    }

    .scenario-context {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      min-width: 0;
    }
    
    /* Scenario list */
    .dsl-scenario-list {
      width: 280px;
      min-width: 280px;
      background: var(--panel-bg);
      border: 1px solid var(--panel-border);
      border-radius: 8px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    
    .dsl-scenario-list .scenario-list-filter {
      padding: 8px;
      border-bottom: 1px solid var(--panel-border);
    }
    
    .dsl-scenario-list .filter-row {
      display: flex;
      gap: 4px;
      align-items: center;
    }
    
    .dsl-scenario-list .search-input {
      flex: 1;
      min-width: 0;
      padding: 6px 10px;
      border: 1px solid var(--panel-border);
      border-radius: 4px;
      font-size: 12px;
    }
    
    .dsl-scenario-list #dsl-add-scenario-btn {
      flex-shrink: 0;
      padding: 6px 8px;
    }
    
    .dsl-scenario-list .scenario-table-wrapper {
      flex: 1;
      overflow-y: auto;
    }
    
    .dsl-scenario-list .scenario-table {
      width: 100%;
      border-collapse: collapse;
    }
    
    .dsl-scenario-list .scenario-table th {
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
    
    .dsl-scenario-list .scenario-row {
      cursor: pointer;
      transition: background 0.15s;
    }
    
    .dsl-scenario-list .scenario-row:hover {
      background: var(--bg-muted);
    }
    
    .dsl-scenario-list .scenario-row.active {
      background: var(--primary);
      color: var(--primary-contrast);
    }
    
    .dsl-scenario-list .scenario-row td {
      padding: 8px 10px;
      border-bottom: 1px solid var(--panel-border);
    }

    .dsl-scenario-list .scenario-row-inner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .dsl-scenario-list .scenario-name {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .dsl-scenario-list .scenario-delete-btn {
      flex-shrink: 0;
      border: none;
      background: transparent;
      cursor: pointer;
      padding: 2px 4px;
      border-radius: 4px;
      font-size: 12px;
      line-height: 1;
      opacity: 0.7;
    }

    .dsl-scenario-list .scenario-row:hover .scenario-delete-btn {
      opacity: 1;
    }

    .dsl-scenario-list .scenario-delete-btn:hover {
      background: rgba(255, 255, 255, 0.08);
    }
    
    /* Main editor */
    .dsl-editor-main {
      flex: 1;
      min-width: 0;
      background: var(--panel-bg);
      border: 1px solid var(--panel-border);
      border-radius: 8px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      overflow-y: auto;
    }
    
    .dsl-section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--panel-border);
    }
    
    .dsl-section-header h3 { margin: 0; }

    .dsl-toolbar-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }

    .dsl-toolbar-actions .btn {
      flex: 0 0 auto;
    }
    
    /* Source code editor */
    .dsl-source-container {
      position: relative;
      flex: 1;
      font-family: "Monaco", "Menlo", "Ubuntu Mono", "Consolas", monospace;
      font-size: 13px;
      line-height: 1.5;
      letter-spacing: normal;
      word-spacing: normal;
      tab-size: 2;
      -moz-tab-size: 2;
      background: var(--bg-muted);
      border: 1px solid var(--panel-border);
      border-radius: 6px;
      min-height: 300px;
    }
    
    .dsl-source-highlight,
    .dsl-source-textarea {
      padding: 12px;
      font-family: inherit;
      font-size: inherit;
      line-height: inherit;
      letter-spacing: inherit;
      word-spacing: inherit;
      tab-size: inherit;
      -moz-tab-size: inherit;
      white-space: pre-wrap;
      word-wrap: break-word;
      margin: 0;
    }
    
    .dsl-source-highlight {
      pointer-events: none;
      color: var(--text);
    }
    
    .dsl-source-textarea {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      border: none;
      border-radius: 6px;
      resize: none;
      background: transparent;
      color: transparent;
      -webkit-text-fill-color: transparent;
      caret-color: var(--text);
      overflow: hidden;
    }
    
    .dsl-source-textarea:focus {
      outline: none;
    }
    
    .dsl-source-textarea::selection {
      background: rgba(255, 165, 0, 0.3);
      color: transparent;
      -webkit-text-fill-color: transparent;
    }
    
    .dsl-source-textarea::-moz-selection {
      background: rgba(255, 165, 0, 0.3);
      color: transparent;
    }
    
    .dsl-source-textarea::placeholder {
      color: var(--text-muted);
      -webkit-text-fill-color: var(--text-muted);
    }

    .dsl-source-line {
      display: block;
      min-height: 1.5em;
      border-left: 2px solid transparent;
      border-radius: 4px;
      padding: 0 6px;
      margin: 0 -6px;
    }

    .dsl-source-line.active {
      background: color-mix(in srgb, var(--primary) 10%, transparent);
      border-left-color: var(--primary);
    }

    .dsl-line-run-hint {
      margin-top: 8px;
      padding: 8px 10px;
      border-radius: 6px;
      font-size: 12px;
      color: var(--text-muted);
      background: color-mix(in srgb, var(--primary) 8%, transparent);
      border: 1px dashed color-mix(in srgb, var(--primary) 35%, var(--panel-border));
    }

    .dsl-runtime-sidebar {
      width: 320px;
      min-width: 320px;
      display: flex;
      flex-direction: column;
      min-height: 0;
    }

    .dsl-inline-runtime-panel {
      flex: 1;
      margin-top: 0;
      border: 1px solid var(--panel-border);
      border-radius: 8px;
      background: var(--bg-muted);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      min-height: 0;
    }

    .dsl-inline-runtime-header {
      margin-bottom: 0;
      padding: 10px 12px;
    }

    .dsl-inline-runtime-header h3 {
      margin: 0;
      font-size: 14px;
    }

    .dsl-inline-run-meta {
      padding: 8px 12px;
      border-bottom: 1px solid var(--panel-border);
      background: color-mix(in srgb, var(--panel-bg) 70%, transparent);
    }

    .dsl-inline-runtime-preview {
      padding: 10px 12px;
      border-bottom: 1px solid var(--panel-border);
    }

    .dsl-inline-runtime-preview pre {
      margin: 0;
      white-space: pre-wrap;
    }

    .dsl-inline-terminal {
      margin: 0;
      padding: 10px 12px;
      min-height: 120px;
      max-height: 220px;
      overflow: auto;
      background: var(--code-bg);
      color: var(--code-text);
      white-space: pre-wrap;
    }
    
    /* GOAL Structure Panel */
    .dsl-structure-panel {
      width: 100%;
      min-width: 0;
      background: var(--panel-bg);
      border: 1px solid var(--panel-border);
      border-radius: 8px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      margin-top: 12px;
      min-height: 220px;
    }

    .dsl-structure-panel--in-sidebar {
      flex: 1;
      min-height: 260px;
    }
    
    .dsl-structure-panel .dsl-section-header {
      padding: 8px 12px;
      border-bottom: 1px solid var(--panel-border);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    
    .dsl-structure-panel h3 {
      margin: 0;
      font-size: 14px;
    }
    
    .goal-structure-container {
      flex: 1;
      overflow-y: auto;
      padding: 8px;
    }
    
    .goal-card {
      background: var(--panel-bg);
      border: 1px solid var(--panel-border);
      border-radius: 6px;
      margin-bottom: 8px;
      overflow: hidden;
    }
    
    .goal-header {
      background: linear-gradient(135deg, var(--primary), var(--accent));
      color: var(--primary-contrast);
      padding: 8px 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .goal-number {
      background: rgba(255,255,255,0.2);
      border-radius: 50%;
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: bold;
    }
    
    .goal-name {
      font-weight: 600;
      font-size: 12px;
    }
    
    .goal-outputs {
      padding: 8px 12px;
    }
    
    .output-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 0;
      border-bottom: 1px solid var(--panel-border);
    }
    
    .output-row:last-child {
      border-bottom: none;
    }
    
    .output-label {
      font-size: 11px;
      color: var(--text-muted);
      min-width: 70px;
    }
    
    .output-value {
      font-family: monospace;
      font-size: 12px;
      color: var(--primary);
      font-weight: 500;
    }
    
    .output-value.empty {
      color: var(--text-muted);
    }
    
    .result-row .output-value {
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
    }
    
    .output-value.result-error {
      background: color-mix(in oklab, var(--danger) 15%, var(--bg));
      color: var(--danger);
    }
    
    .output-value.result-ok {
      background: var(--badge-green-bg);
      color: var(--badge-green-text);
    }
    
    .goal-options {
      background: var(--bg-muted);
      padding: 8px 12px;
      border-top: 1px solid var(--panel-border);
    }
    
    .options-title {
      font-size: 11px;
      font-weight: 600;
      color: var(--text-muted);
      margin-bottom: 4px;
    }
    
    .option-row {
      display: flex;
      flex-direction: column;
      padding: 4px 0;
      border-bottom: 1px solid var(--panel-border);
    }
    
    .option-row:last-child {
      border-bottom: none;
    }
    
    .option-name {
      font-family: monospace;
      font-size: 11px;
      color: var(--primary);
    }
    
    .option-desc {
      font-size: 10px;
      color: var(--text-muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    /* Modal styles */
    .modal {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
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
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      max-width: 600px;
      width: 90%;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
    }
    
    .modal-dialog.wide {
      max-width: 900px;
    }
    
    .modal-header {
      padding: 16px 20px;
      border-bottom: 1px solid var(--panel-border);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    
    .modal-header h4 {
      margin: 0;
      font-size: 16px;
    }
    
    .modal-close {
      background: none;
      border: none;
      font-size: 20px;
      cursor: pointer;
      color: var(--text-muted);
      padding: 4px 8px;
    }
    
    .modal-close:hover {
      color: var(--text);
    }
    
    .modal-body {
      padding: 20px;
      flex: 1;
      overflow-y: auto;
    }
    
    .modal-footer {
      padding: 12px 20px;
      border-top: 1px solid var(--panel-border);
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
    
    /* Run modal tabs */
    .run-tabs {
      display: flex;
      gap: 4px;
      margin-bottom: 12px;
    }
    
    .run-tab {
      padding: 8px 16px;
      border: 1px solid var(--panel-border);
      background: var(--bg-muted);
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
    }
    
    .run-tab.active {
      background: var(--primary);
      color: var(--primary-contrast);
      border-color: var(--primary);
    }
    
    .run-panel {
      background: var(--bg-muted);
      border: 1px solid var(--panel-border);
      border-radius: 6px;
      padding: 12px;
    }
    
    .run-panel.hidden {
      display: none;
    }
    
    .run-panel-header {
      margin-bottom: 12px;
    }

    @media (max-width: 1100px) {
      .dsl-editor-layout {
        flex-direction: column;
      }

      .dsl-editor-main {
        order: 1;
      }

      .dsl-runtime-sidebar {
        order: 2;
        width: 100%;
        min-width: 0;
      }

      .dsl-scenario-list {
        order: 3;
        width: 100%;
        min-width: 0;
      }

      .dsl-scenario-list .scenario-table-wrapper {
        max-height: 260px;
      }

      .dsl-inline-terminal {
        max-height: 180px;
      }
    }

    @media (max-width: 768px) {
      .dsl-editor-main {
        padding: 12px;
      }

      .dsl-editor-page .page-header {
        margin-bottom: 4px;
      }

      .dsl-editor-page .page-header h2 {
        font-size: calc(var(--font-size-xl) * 0.82);
        line-height: 1.2;
      }

      .scenario-context {
        width: 100%;
      }

      .dsl-toolbar-actions {
        width: 100%;
        justify-content: stretch;
      }

      .dsl-toolbar-actions .btn {
        flex: 1 1 140px;
      }

      .dsl-source-container {
        min-height: 240px;
      }

      .modal-dialog,
      .modal-dialog.wide {
        width: min(96vw, 96vw);
        max-width: none;
      }

      .modal-body {
        padding: 14px;
      }

      .run-tabs {
        flex-wrap: wrap;
      }

      .run-tab {
        flex: 1 1 140px;
        text-align: center;
      }

      .run-panel-header {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: flex-start;
        justify-content: space-between;
      }

      #dsl-run-fw-body {
        grid-template-columns: 1fr !important;
      }
    }
  `;
}
