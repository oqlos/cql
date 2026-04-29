// frontend/src/components/dsl-editor/dsl-builder-ui.ts
/**
 * Reusable DSL Builder UI Component
 * Generates complete HTML structure for DSL scenario builder interface
 */

import { highlightDsl } from '../dsl/dsl.highlight';

export interface DslBuilderConfig {
  showScenarioList?: boolean;
  showPreview?: boolean;
  showLibraryManager?: boolean;
  showRunModal?: boolean;
  showDefEditor?: boolean;
  containerClass?: string;
}

export class DslBuilderUI {
  /**
   * Renders the complete DSL builder layout
   */
  static renderBuilderLayout(config: DslBuilderConfig = {}): string {
    const {
      showScenarioList = true,
      showPreview = true,
      showLibraryManager = true,
      showRunModal = true,
      showDefEditor = false,
      containerClass = 'scenario-builder-layout'
    } = config;

    return `
      <div class="${containerClass}">
        ${showScenarioList ? this.renderScenarioList() : ''}
        ${this.renderMainBuilder()}
        <div class="right-column">
          ${showPreview ? this.renderPreviewSection() : ''}
          ${showDefEditor ? this.renderDefEditorSection() : ''}
          ${this.renderLiveStatePanel()}
        </div>
      </div>
      ${showLibraryManager ? this.renderLibraryManagerModal() : ''}
      ${showRunModal ? this.renderGoalRunModal() : ''}
      ${this.renderDslConsoleModal()}
    `;
  }

  private static renderLiveStatePanel(): string {
    return `
      <div class="dsl-live-state-panel section-mt">
        <div class="preview-header d-flex items-center justify-between">
          <h3 class="preview-title text-md">🧩 Stan (Live)</h3>
          <div class="d-flex items-center gap-sm">
            <button class="btn btn-secondary btn-sm" id="dsl-state-manual-refresh">🔄 Refresh</button>
          </div>
        </div>
        <div id="dsl-live-state" class="run-panel-content live-state-container">
          <table class="dsl-data-table text-xs">
            <thead>
              <tr>
                <th class="text-color">Typ</th>
                <th class="text-color">Nazwa</th>
                <th class="text-color">Wartość</th>
                <th class="text-color">Jednostka</th>
              </tr>
            </thead>
            <tbody id="dsl-live-state-body"></tbody>
          </table>
        </div>
      </div>
    `;
  }

  /**
   * Renders the left panel with scenario list and preview
   */
  private static renderScenarioList(): string {
    return `
      <div class="scenario-list">
        <div class="scenario-list-filter">
          <div class="filter-row d-flex gap-sm">
            <input type="text" id="scenario-filter" class="search-input filter-flex-input" placeholder="Filtruj scenariusze..." />
            <select id="scenario-sort" class="search-input filter-flex-sort">
              <option value="date_desc">Data (najnowsze)</option>
              <option value="date_asc">Data (najstarsze)</option>
              <option value="name_asc">Nazwa (A→Z)</option>
              <option value="name_desc">Nazwa (Z→A)</option>
            </select>
            <input type="text" id="scenario-add-name" class="search-input filter-flex-add" placeholder="Nowy scenariusz..." />
            <button id="scenario-add-btn" class="btn btn-primary filter-flex-btn" title="Dodaj scenariusz">➕</button>
          </div>
        </div>
        
        <div class="scenario-table-wrapper">
          <table class="scenario-table text-sm">
            <thead>
              <tr>
                <th>Nazwa</th>
                <th style="width:44px;">Akcje</th>
              </tr>
            </thead>
            <tbody id="scenario-list-body">
              <!-- rows injected at runtime -->
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  private static renderDefEditorSection(): string {
    return `
      <div class="def-section section-mt">
        <div class="preview-header d-flex items-center justify-between">
          <div class="d-flex items-center gap-sm">
            <h3 class="preview-title text-md">🧩 DEF (JavaScript)</h3>
            <span id="def-source-badge" class="badge badge-info">Źródło: DEF</span>
          </div>
          <div class="d-flex items-center gap-sm">
            <label class="text-sm d-flex items-center gap-xs">
              <input type="checkbox" id="def-source-toggle" ${(globalThis as any).__dslLibrarySourceOverride === 'DB' ? '' : 'checked'}>
              <span>Używaj DEF</span>
            </label>
            <button class="btn btn-primary" data-action="def-visual-editor">📝 Graficzny edytor</button>
            <button class="btn btn-secondary" data-action="def-validate">✅ Waliduj DEF</button>
            <button class="btn btn-secondary" data-action="def-import">📥 Importuj z DB</button>
            <button class="btn btn-secondary" data-action="def-reload">🔄 Przeładuj runtime</button>
            <button class="btn btn-success" data-action="def-save">💾 Zapisz DEF</button>
          </div>
        </div>
        <textarea id="scenario-def-editor" class="mono text-sm editor-textarea" rows="12"></textarea>
      </div>

      <div class="def-section section-mt">
        <div class="preview-header d-flex items-center justify-between">
          <h3 class="preview-title text-md">🔧 FUNC – procedury wielokrotnego użytku</h3>
          <div class="d-flex items-center gap-sm">
            <button class="btn btn-primary" data-action="func-visual-editor">📝 Graficzny edytor</button>
            <button class="btn btn-secondary" data-action="func-validate">✅ Waliduj FUNC</button>
            <button class="btn btn-secondary" data-action="func-add-template">➕ Dodaj FUNC</button>
            <button class="btn btn-success" data-action="func-save">💾 Zapisz FUNC</button>
          </div>
        </div>        
      </div>

      <div class="def-section section-mt">
        <div class="preview-header d-flex items-center justify-between">
          <h3 class="preview-title text-md">🗺️ MAP (JS/JSON) – globalne mapowania runtime</h3>
          <div class="d-flex items-center gap-sm">
            <button class="btn btn-primary" data-action="map-visual-editor">📝 Graficzny edytor</button>
            <button class="btn btn-secondary" data-action="map-validate">✅ Waliduj MAP</button>
            <button class="btn btn-secondary" data-action="map-reload">🔄 Przeładuj runtime</button>
            <button class="btn btn-success" data-action="map-save">💾 Zapisz MAP</button>
          </div>
        </div>
        <textarea id="scenario-map-editor" class="mono text-sm editor-textarea" rows="8" placeholder='{"actions": {"Włącz 2": {"kind": "api", "method": "PUT", "url": "/api/v1/peripherals/pump-main"}}, "objectActionMap": {"pompa 1": {"Włącz 2": {"kind": "api", "method": "PUT", "url": "/api/v1/peripherals/pump-main"}}}}'></textarea>
      </div>
    `;
  }

  /**
   * Renders the DSL preview section with validation buttons
   */
  private static renderPreviewSection(): string {
    return `
      <div class="preview-section">
        <div class="preview-header d-flex items-center justify-between">
          <button class="btn btn-primary btn-copy" data-action="copy-scenario">📋 Kopiuj</button>
          <button class="btn btn-primary btn-copy" data-action="clone-scenario">📋 Klonuj</button>
          <button class="btn btn-secondary btn-validate-dsl" data-action="validate-dsl">✅ Waliduj</button>
          <button class="btn btn-secondary btn-run-dsl" data-action="run-dsl">▶️ Uruchom CQL</button>
          <button class="btn btn-secondary btn-autofix-dsl" data-action="autofix-dsl">🪄 Auto-fix</button>
          <button class="btn btn-success btn-apply-dsl-fix" data-action="apply-dsl-fix">💾 Zastosuj + Zapisz</button>
        </div>
        
        <div class="preview-header d-flex items-center justify-between" style="margin-top: 8px;">
          <button class="btn btn-secondary btn-sm" data-action="library-editor">📚 Biblioteka</button>
          <button class="btn btn-secondary btn-sm" data-action="variables-editor">🔢 Zmienne</button>
          <button class="btn btn-secondary btn-sm" data-action="activities-editor">🎯 Czynności</button>
          <button class="btn btn-secondary btn-sm" data-action="intervals-editor">⏱️ Interwały</button>
          <button class="btn btn-secondary btn-sm" data-action="objects-editor">🔧 Obiekty</button>
        </div>
        
        <div class="preview-header d-flex items-center justify-between">
          <h3 class="preview-title text-md">📝 Podgląd CQL</h3>
          <button class="btn btn-primary btn-sm" data-action="dsl-visual-editor">📜 Edytor CQL</button>
        </div>

        <pre class="preview-code text-xs" id="scenario-preview">
SCENARIO: Test szczelności C20

GOAL: Wytworzyć podciśnienie
          SET 'zawór 1' '1'
          SET 'POMPA' '5 l'

          IF 'czas' > '10 s' TO 'niskie ciśnienie'
          ELSE ERROR 'Nieszczelność'
        </pre>
        <div id="dsl-results" class="text-sm mono"></div>
      </div>
      
      ${this.renderDslRuntimePanel()}
    `;
  }

  /**
   * Renders the main builder area with goals container
   */
  private static renderMainBuilder(): string {
    return `
      <div class="main-builder">
        <div class="scenario-name-input d-flex items-center justify-between gap-sm">
          <input type="text" id="scenario-name" class="text-md" placeholder="Nazwa scenariusza..." value="Test szczelności C20">
          <div class="top-actions d-flex gap-sm">
            <button class="btn btn-success btn-save-scenario">💾 Zapisz</button>
            <button class="btn btn-primary btn-load-scenario">📂 Wczytaj scenariusz</button>
            <button class="btn btn-secondary btn-export">📤 Eksportuj</button>
            <button class="btn btn-primary btn-run-scenario" data-action="run-scenario">▶️ Uruchom</button>
          </div>
        </div>

        <div id="goals-container">
          ${this.renderDefaultGoal()}
        </div>

        <button class="btn btn-outline-primary btn-add-goal" id="add-goal-btn">+ Dodaj nowy cel (Goal)</button>
      </div>
    `;
  }

  /**
   * Renders a default goal template
   */
  private static renderDefaultGoal(): string {
    return `
      <div class="goal-section" data-goal-id="goal1">
        <div class="goal-header d-flex items-center gap-sm">
          <span class="goal-label text-xs rounded-4">GOAL</span>
          <select class="goal-select text-sm rounded-4">
            <option>Wytworzyć podciśnienie</option>
            <option>Sprawdzić szczelność</option>
            <option>Zmierzyć przepływ</option>
            <option>Przetestować ciśnienie</option>
            <option>Kalibrować urządzenie</option>
          </select>
          <button class="btn btn-secondary btn-move-up" data-action="goal-up">⬆️</button>
          <button class="btn btn-secondary btn-move-down" data-action="goal-down">⬇️</button>
          <button class="btn btn-secondary btn-clone" data-action="clone-goal">⧉</button>
          <button class="btn btn-danger btn-delete" data-action="delete-goal">🗑️</button>
        </div>

        <div class="steps-container">
          ${this.renderDefaultSet()}
          ${this.renderDefaultCondition()}
        </div>

        <div class="goal-actions d-flex gap-sm">
          <button class="btn btn-outline-primary btn-add-get">+ Dodaj GET</button>
          <button class="btn btn-outline-primary btn-add-set">+ Dodaj SET</button>
          <button class="btn btn-outline-primary btn-add-out">+ Dodaj OUT</button>
          <button class="btn btn-outline-primary btn-add-condition">+ Dodaj warunek</button>
          <button class="btn btn-primary btn-run-scenario" data-action="run-scenario">▶️ Uruchom</button>
          <button class="btn btn-primary" data-action="run-goal-map">▶️ Uruchom (MAP)</button>
        </div>
      </div>
    `;
  }

  /**
   * Renders a default SET step template
   */
  private static renderDefaultSet(): string {
    return `
      <div class="step-block variable-block set-block" data-step-id="set1" data-var-kind="SET">
        <div class="step-content d-flex flex-wrap items-center gap-sm">
          <span class="step-type-label set-label rounded-4">SET</span>
          <select class="param-select text-sm rounded-4">
            <option>zawór 1</option>
            <option>zawór 2</option>
            <option>zawór 3</option>
            <option>zawór 4</option>
            <option>zawór 5</option>
            <option>zawór 6</option>
            <option>zawór 7</option>
            <option>zawór 8</option>
            <option>zawór 9</option>
            <option>zawór 10</option>
            <option>zawór 11</option>
            <option>zawór 12</option>
            <option>zawór 13</option>
            <option>zawór 14</option>
            <option>sprężarka</option>
          </select>
          <span class="text-muted">=</span>
          <input type="text" class="value-input text-sm rounded-4" value="1" placeholder="wartość">
          <select class="unit-select text-sm rounded-4">
            <option></option>
            <option>l/min</option>
            <option>s</option>
          </select>
          <button class="btn btn-secondary btn-move-up" data-action="step-up">⬆️</button>
          <button class="btn btn-secondary btn-move-down" data-action="step-down">⬇️</button>
          <button class="btn btn-secondary btn-clone" data-action="clone-step">⧉</button>
          <button class="btn btn-danger text-sm btn-delete-small" data-action="delete-step">✕</button>
        </div>
      </div>
    `;
  }

  /**
   * Renders a default condition template
   */
  private static renderDefaultCondition(): string {
    return `
      <div class="condition-group" data-condition-type="if">
        <span class="condition-label condition-label--if">IF</span>
        <button class="btn btn-secondary btn-move-up" data-action="condition-up">⬆️</button>
        <button class="btn btn-secondary btn-move-down" data-action="condition-down">⬇️</button>
        <button class="btn btn-secondary btn-clone" data-action="clone-condition">⧉</button>
        <button class="btn-delete-small" data-action="delete-condition">✕</button>
        <div class="condition-builder d-flex flex-wrap items-center gap-sm">
          <select class="param-select text-sm rounded-4">
            <option>czas</option>
            <option>ciśnienie</option>
            <option>temperatura</option>
            <option>przepływ</option>
            <option>objętość</option>
          </select>
          <select class="operator-select text-sm rounded-4">
            <option>></option>
            <option><</option>
            <option>=</option>
            <option>>=</option>
            <option><=</option>
          </select>
          <input type="text" class="value-input text-sm rounded-4" value="10" size="2">
          <select class="unit-select text-sm rounded-4">
            <option>s</option>
            <option>min</option>
            <option>mbar</option>
            <option>bar</option>
            <option>°C</option>
            <option>l/min</option>
          </select>
          <button class="btn btn-outline-primary btn-add-condition-and">+ AND</button>
          <button class="btn btn-outline-primary btn-add-condition-or">+ OR</button>
        </div>
      </div>
    `;
  }

  /**
   * Renders the add scenario modal dialog
   */
  static renderAddScenarioModal(): string {
    return `
      <div id="scenario-add-modal" class="modal hidden">
        <div class="modal-dialog">
          <div class="modal-header">
            <h4 class="text-md">➕ Nowy scenariusz</h4>
            <button class="modal-close" data-modal-close>✕</button>
          </div>
          <div class="modal-body">
            <label>Nazwa scenariusza</label>
            <input type="text" id="scenario-new-name" class="search-input" placeholder="np. Test przepływu" />
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" data-modal-close>Anuluj</button>
            <button class="btn btn-primary" id="scenario-save-new">Zapisz</button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Renders the library manager modal
   */
  private static renderLibraryManagerModal(): string {
    return `
      <div id="library-modal" class="modal hidden">
        <div class="modal-dialog wide">
          <div class="modal-header">
            <h4 class="text-md">⚙️ Zarządzaj biblioteką elementów</h4>
            <button class="modal-close" data-modal-close>✕</button>
          </div>
          <div class="modal-body">
            <div class="library-manager">
              <div class="lm-controls">
                <select id="lm-dataset">
                  <option value="objects">Obiekty</option>
                  <option value="functions">Funkcje</option>
                  <option value="params">Parametry</option>
                  <option value="units">Jednostki</option>
                  <option value="results">Rezultaty</option>
                  <option value="operators">Operatory</option>
                  <option value="logs">Logi (LOG)</option>
                  <option value="alarms">Alarmy (ALARM)</option>
                  <option value="errors">Błędy (ERROR)</option>
                </select>
                <input type="text" id="lm-filter" class="search-input" placeholder="Filtruj..." />
                <input type="text" id="lm-new-value" class="search-input" placeholder="Nowa wartość" />
                <button id="lm-add" class="btn btn-primary">Dodaj</button>
              </div>
              <div class="lm-table">
                <table class="text-sm">
                  <thead>
                    <tr>
                      <th>Wartość</th>
                      <th style="width:60px;">Akcje</th>
                    </tr>
                  </thead>
                  <tbody id="lm-tbody"></tbody>
                </table>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" data-modal-close>Zamknij</button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Renders the goal run/execution modal
   */
  private static renderGoalRunModal(): string {
    return `
      <div id="goal-run-modal" class="modal hidden">
        <div class="modal-dialog wide">
          <div class="modal-header d-flex items-center justify-between">
            <h4 class="text-md" id="goal-run-title">▶️ Uruchamianie celu</h4>
            <button class="modal-close" data-modal-close>✕</button>
          </div>
          <div class="modal-body" style="max-height:85vh;overflow-y:auto;">
            <!-- Tabs header -->
            <div class="run-tabs d-flex gap-xs mb-xs">
              <button class="run-tab active" data-run-tab="exec">▶️ Wykonanie</button>
              <button class="run-tab" data-run-tab="terminal">🖥️ Terminal</button>
              <button class="run-tab" data-run-tab="state">🧩 Stan</button>
              <button class="run-tab" data-run-tab="code">👨‍💻 Kod</button>
            </div>

            ${this.renderExecutionPanel()}
            ${this.renderTerminalPanel()}
            ${this.renderStatePanel()}
            ${this.renderCodePanel()}
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" data-modal-close>Zamknij</button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Renders the execution panel in run modal
   */
  private static renderExecutionPanel(): string {
    return `
      <div class="run-panel mb-md">
        <div class="run-panel-header d-flex items-center justify-between">
          <h5 class="text-sm">▶️ Wykonanie</h5>
          <div class="d-flex gap-xs">
            <button id="goal-run-pause" class="btn btn-secondary btn-xs">Pauza</button>
            <button id="goal-run-resume" class="btn btn-secondary btn-xs">Wznów</button>
            <button id="goal-run-stop" class="btn btn-danger btn-xs">Stop</button>
          </div>
        </div>
        <div id="goal-run-exec" class="run-panel-content run-panel-content--exec">
          <div class="d-flex items-center justify-between mb-xs">
            <div class="text-sm text-muted">Status: <span id="goal-run-status">—</span></div>
          </div>
          <div class="progress-bar run-progress-bar">
            <div id="goal-run-progress" class="progress-fill run-progress-fill"></div>
          </div>
          <div class="text-xs text-muted mb-xxs run-steps-label">Kroki wykonania:</div>
          <ol id="goal-run-steps" class="text-xs run-steps-list"></ol>
        </div>
      </div>
    `;
  }

  /**
   * Renders the terminal panel in run modal
   */
  private static renderTerminalPanel(): string {
    return `
      <div class="run-panel mb-md">
        <div class="run-panel-header d-flex items-center justify-between">
          <h5 class="text-sm">🖥️ Terminal</h5>
          <button id="goal-run-logs-clear" class="btn btn-secondary btn-xs">Wyczyść</button>
        </div>
        <div id="goal-run-terminal" class="run-panel-content run-panel-content--terminal">
          <pre id="goal-run-logs" class="text-xs mono run-panel-logs"></pre>
        </div>
      </div>
    `;
  }

  /**
   * Renders the state panel in run modal
   */
  private static renderStatePanel(): string {
    return `
      <div class="run-panel mb-md">
        <div class="run-panel-header d-flex items-center justify-between">
          <h5 class="text-sm">🧩 Stan</h5>
          <button id="goal-run-state-refresh" class="btn btn-secondary btn-xs">Odśwież</button>
        </div>
        <div id="goal-run-state" class="run-panel-content run-panel-content--state">
          <table class="dsl-data-table text-xs">
            <thead>
              <tr>
                <th>Typ</th>
                <th>Nazwa</th>
                <th>Wartość</th>
              </tr>
            </thead>
            <tbody id="goal-run-state-body"></tbody>
          </table>
        </div>
      </div>
    `;
  }

  /**
   * Renders the code panel in run modal
   */
  private static renderCodePanel(): string {
    return `
      <div class="run-panel mb-md">
        <div class="run-panel-header d-flex items-center justify-between">
          <h5 class="text-sm">👨‍💻 Kod</h5>
        </div>
        <div id="goal-run-code" class="run-panel-content hidden run-panel-content--code">
          <pre id="goal-run-code-pre" class="text-xs mono" style="margin:0;"></pre>
        </div>
      </div>
    `;
  }

  /**
   * Renders a modal used for local DSL console (simulation + diagnostics)
   */
  private static renderDslConsoleModal(): string {
    return `
      <div id="dsl-console-modal" class="modal hidden">
        <div class="modal-dialog wide">
          <div class="modal-header d-flex items-center justify-between">
            <h4 class="text-md">🖥️ CQL Konsola</h4>
            <button class="modal-close" data-modal-close>✕</button>
          </div>
          <div class="modal-body" style="max-height:75vh;overflow-y:auto;">
            <div id="dsl-console-output" class="text-sm mono"></div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" data-modal-close>Zamknij</button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Renders the live DSL Runtime panel with auto-refresh
   */
  private static renderDslRuntimePanel(): string {
    return `
      <div class="dsl-runtime-panel section-mt">
        <div class="preview-header d-flex items-center justify-between">
          <h3 class="preview-title text-md">🔄 CQL Runtime (Auto-refresh)</h3>
          <div class="d-flex items-center gap-sm">
            <label class="text-sm">
              <input type="checkbox" id="dsl-auto-refresh" checked> Auto (3s)
            </label>
            <button class="btn btn-secondary btn-sm" id="dsl-manual-refresh">🔄 Refresh</button>
          </div>
        </div>
        
        <div class="dsl-runtime-output" id="dsl-runtime-output">
          <div class="text-muted">⏳ Inicjalizacja CQL Runtime...</div>
        </div>
        
        <div class="runtime-status text-sm" id="dsl-runtime-status">
          Status: Gotowy | Ostatnia aktualizacja: --
        </div>
      </div>
    `;
  }

  /**
   * Initialize syntax highlighting for FUNC editor textarea
   * Call this after the DOM is ready
   */
  static initializeFuncEditorHighlighting(container?: HTMLElement): void {
    const root = container || document;
    const textarea = root.querySelector('#scenario-func-editor') as HTMLTextAreaElement;
    const highlight = root.querySelector('#scenario-func-highlight') as HTMLElement;
    const wrapper = root.querySelector('#func-editor-wrapper') as HTMLElement;
    
    if (!textarea || !highlight || !wrapper) return;
    
    const updateHighlight = () => {
      const code = textarea.value;
      highlight.innerHTML = highlightDsl(code) + '\n';
      
      // Toggle has-content class for styling
      if (code.trim()) {
        wrapper.classList.add('has-content');
      } else {
        wrapper.classList.remove('has-content');
      }
    };
    
    // Sync scroll position
    const syncScroll = () => {
      highlight.scrollTop = textarea.scrollTop;
      highlight.scrollLeft = textarea.scrollLeft;
    };
    
    // Bind events
    textarea.addEventListener('input', updateHighlight);
    textarea.addEventListener('scroll', syncScroll);
    
    // Initial highlight if there's content
    if (textarea.value) {
      updateHighlight();
    }
  }

} 
