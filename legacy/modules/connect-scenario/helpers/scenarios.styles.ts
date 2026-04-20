// frontend/src/modules/connect-scenario/helpers/scenarios.styles.ts
import { DslBuilderStyles } from '../../../components/dsl-editor';

/**
 * Scenarios Styles - now using reusable DSL Builder Styles component
 * Only page-specific overrides and customizations are kept here
 */
export class ScenariosStyles {
  static getStyles(): string {
    return `
      /* Import base DSL Builder styles */
      ${DslBuilderStyles.getStyles()}
      
      /* Page-specific styles */
      .page-content.content-scroll { 
        height: 100%;
        overflow-y: auto;
        overflow-x: hidden;
      }
      
      .page-header { 
        margin-bottom: 20px; 
      }
      
      .page-header h2 { 
        color: var(--text); 
        margin-bottom: 5px; 
      }
      
      .page-header p { 
        color: var(--text-muted); 
      }
      
      /* Scenarios page specific overrides */
      .scenario-builder-layout {
        display: grid;
        grid-template-columns: 220px 1fr 330px;
        gap: 6px;
        align-items: start;
      }

      .right-column {
        display: flex;
        flex-direction: column;
        gap: 8px;
        position: sticky;
        top: 0;
        align-self: start;
        max-height: 100vh;
        overflow-y: auto;
      }
      
      .scenario-list {
        position: sticky;
        top: 0;
        align-self: start;
        max-height: 100vh;
        overflow-y: auto;
      }

      body.fixed-1280 .page-content.content-scroll {
        display: flex;
        flex-direction: column;
        min-height: 0;
      }

      body.fixed-1280 .page-content.content-scroll .page-header {
        flex: 0 0 auto;
        margin-bottom: 6px;
      }

      body.fixed-1280 .page-content.content-scroll .scenario-builder-layout {
        flex: 1 1 auto;
        min-height: 0;
        height: 100%;
        overflow: hidden;
        align-items: stretch;
        grid-template-rows: minmax(0, 1fr);
      }

      body.fixed-1280 .scenario-builder-layout .right-column,
      body.fixed-1280 .scenario-builder-layout .scenario-list,
      body.fixed-1280 .scenario-builder-layout .main-builder {
        position: static;
        top: auto;
        align-self: stretch;
        max-height: none;
        height: 100%;
        min-height: 0;
      }

      body.fixed-1280 .scenario-builder-layout .right-column,
      body.fixed-1280 .scenario-builder-layout .scenario-list {
        overflow-y: auto;
      }

      /* Responsive: collapse preview below on narrower screens */
      @media (max-width: 1280px) {
        .scenario-builder-layout {
          grid-template-columns: 210px 1fr;
        }
        .scenario-builder-layout > .right-column {
          grid-column: 1 / span 2;
        }
      }
      @media (max-width: 900px) {
        .scenario-builder-layout .preview-section {
          display: none;
        }
      }
      
      .main-builder {
        counter-reset: code-line;
      }
      
      /* Global line numbering before labels (TASK/IF/ELSE/VAR) */
      .task-label::before,
      .variable-label::before,
      .condition-label::before {
        counter-increment: code-line;
        content: counter(code-line) ". ";
        margin-right: 4px;
      }
      
      /* Custom form control styling for scenarios page */
      .function-select, 
      .object-select, 
      .param-select, 
      .operator-select, 
      .unit-select, 
      .variable-select,
      .result-select,
      .opt-param-select,
      .opt-desc-select,
      .info-message-select,
      .conn-select { 
        padding: 6px 10px; 
        border: 2px solid var(--primary); 
        background: var(--panel-bg); 
        color: var(--on-panel); 
        border-radius: 10px; 
        font-weight: 600; 
      }
      
      .operator-select {
        width: 50px;
      }
      
      .value-input { 
        padding: 6px 10px; 
        border: 2px solid var(--success); 
        background: var(--panel-bg); 
        color: var(--success); 
        font-weight: 600; 
        text-align: center; 
      }
      
      .condition-builder .value-input {
        width: 50px;
        height: 28px;
      }
      
      /* Condition group custom styling */
      .condition-group { 
        background: color-mix(in oklab, var(--danger) 8%, var(--panel-bg)); 
      }
      
      .condition-label.error { 
        background: var(--warning); 
        color: var(--on-warning); 
      }
      
      .operator-text { 
        background: color-mix(in oklab, var(--warning) 25%, var(--panel-bg)); 
        color: var(--on-warning); 
        padding: 4px 8px; 
        font-weight: 600; 
      }
      
      .action-text { 
        color: var(--danger); 
        font-weight: 600; 
      }
      
      .error-message { 
        padding: 6px 10px; 
        border: 2px solid var(--danger); 
        color: var(--danger); 
        font-weight: 600; 
      }
      
      /* Sentence builder custom styling */
      .sentence-builder { 
        padding: 2px; 
        background: var(--bg-muted); 
        border-radius: 6px; 
        min-height: 45px; 
      }
      
      .sentence-builder .sentence-part { 
      }
      
      /* Library items (drag & drop) */
      .sidebar {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      
      .library-actions { 
        justify-content: flex-end; 
        margin-bottom: 8px; 
      }
      
      .sidebar-section { 
        background: var(--panel-bg); 
        color: var(--on-panel); 
        padding: 2px; 
        border-radius: 8px; 
        box-shadow: 0 2px 8px rgba(0,0,0,0.1); 
      }
      
      .sidebar-section h3 { 
        margin-bottom: 15px; 
        color: var(--text); 
      }
      
      .element-library {
        display: flex;
        flex-direction: column;
        gap: 15px;
      }
      
      .library-category h4 {
        font-weight: 600;
        color: var(--text-muted);
        text-transform: uppercase;
        margin-bottom: 8px;
      }
      
      .library-items { 
        display: flex; 
        flex-wrap: wrap; 
        gap: 6px; 
      }
      
      .library-item { 
        padding: 6px 10px; 
        background: var(--bg-muted); 
        border: 1px solid var(--panel-border); 
        border-radius: var(--control-radius, 4px); 
        cursor: move; 
        transition: all 0.2s; 
      }
      
      .library-item:hover { 
        border-color: var(--primary); 
        background: color-mix(in oklab, var(--primary) 12%, var(--bg)); 
      }
      
      .library-item.dragging {
        opacity: 0.5;
      }
      
      /* Goal run code line styling - theme aware */
      .goal-run-code-line {
        padding: 2px 6px;
      }
      
      .goal-run-code-line.active {
        background: var(--menu-active-bg);
        color: var(--menu-active-text);
        border-left: 3px solid var(--success);
      }
      
      .goal-run-code-line .line-number {
        opacity: 0.6;
        display: inline-block;
        width: 2em;
        text-align: right;
        margin-right: 6px;
      }

      /* Nested step styling */
      .step-nested {
        margin-left: 20px;
        border-left: 3px solid var(--panel-border);
      }
    `;
  }
}
