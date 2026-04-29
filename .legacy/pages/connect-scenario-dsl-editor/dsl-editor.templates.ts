// frontend/src/pages/connect-scenario-dsl-editor/dsl-editor.templates.ts
import { DslBuilderUI } from '../../components/dsl-editor';
import { getDslEditorPlaceholder } from '../../modules/connect-scenario/helpers/cql-editor-content';

export function getDslEditorContent(): string {
  return `
      <div class="page-content dsl-editor-page">
        <div class="page-header d-flex items-center justify-between">
          <div>
            <h2>📜 Edytor CQL — Connex Query Language — edycja scenariusza testowego</h2>
          </div>
          <div class="scenario-context" id="scenario-context">
            <span class="text-sm text-muted">Scenariusz:</span>
            <strong id="scenario-title">—</strong>
            <span id="dsl-save-indicator" class="save-indicator"></span>
            <a href="/connect-scenario/scenarios" class="btn btn-secondary btn-sm ml-2">← Budowanie</a>
          </div>
        </div>
        
        <div class="dsl-editor-layout">
          <!-- Scenario List -->
          <div class="dsl-scenario-list">
            <div class="scenario-list-filter">
              <div class="filter-row d-flex gap-sm" style="flex-wrap:wrap;align-items:center;">
                <input type="text" id="dsl-scenario-filter" class="search-input" placeholder="Filtruj...">
                <select id="scenario-sort" class="search-input" style="flex:1 1 180px;min-width:160px;max-width:100%;">
                  <option value="date_desc">Data (najnowsze)</option>
                  <option value="date_asc">Data (najstarsze)</option>
                  <option value="name_asc">Nazwa (A→Z)</option>
                  <option value="name_desc">Nazwa (Z→A)</option>
                </select>
                <button id="dsl-add-scenario-btn" class="btn btn-primary btn-sm" title="Dodaj scenariusz">➕</button>
              </div>
            </div>
            <div class="scenario-table-wrapper">
              <table class="scenario-table text-sm">
                <thead>
                  <tr>
                    <th>Scenariusz</th>
                  </tr>
                </thead>
                <tbody id="dsl-scenario-list-body"></tbody>
              </table>
            </div>
            <div class="dsl-structure-panel dsl-structure-panel--in-sidebar">
              <div class="dsl-section-header">
                <h3>📊 Struktura GOAL</h3>
                <button class="btn btn-secondary btn-xs" data-action="refresh-structure">🔄</button>
              </div>
              <div id="dsl-goal-structure" class="goal-structure-container">
                <p class="text-sm text-muted">Wybierz scenariusz, aby zobaczyć strukturę celów</p>
              </div>
            </div>
          </div>
          
          <!-- DSL Editor Main -->
          <div class="dsl-editor-main">
            <div class="dsl-section-header">
              <h3>📜 Kod CQL</h3>
              <div class="dsl-toolbar-actions d-flex gap-sm">
                <button class="btn btn-primary btn-sm" data-action="dsl-run">▶️ Uruchom</button>
                <button class="btn btn-secondary btn-sm" data-action="dsl-validate">✅ Waliduj</button>
                <button class="btn btn-secondary btn-sm" data-action="dsl-format">🎨 Formatuj</button>
                <button class="btn btn-secondary btn-sm" data-action="dsl-copy">📋 Kopiuj CQL</button>
                <button class="btn btn-secondary btn-sm" data-action="open-weboql-dsl-client">🧭 WebOQL DSL</button>
                <button class="btn btn-success btn-sm" data-action="dsl-save">💾 Zapisz</button>
              </div>
            </div>
            <div class="dsl-source-container">
              <div class="dsl-source-highlight" id="dsl-source-highlight"></div>
              <textarea id="dsl-source-editor" class="dsl-source-textarea" spellcheck="false" data-gramm="false" placeholder="${getDslEditorPlaceholder()}"></textarea>
            </div>
            <div id="dsl-line-run-hint" class="dsl-line-run-hint">
              💡 Kliknij pojedynczą linię w edytorze, aby wysłać ją do runtime i zobaczyć log po prawej stronie.
            </div>
          </div>

          <div class="dsl-runtime-sidebar">
            <div class="dsl-inline-runtime-panel">
              <div class="dsl-section-header dsl-inline-runtime-header">
                <h3>🖥️ Terminal pojedynczej linii</h3>
                <div class="d-flex gap-sm items-center">
                  <span id="dsl-inline-run-status" class="text-sm text-muted">Oczekiwanie</span>
                  <button class="btn btn-secondary btn-xs" data-action="dsl-clear-inline-terminal">Wyczyść</button>
                </div>
              </div>
              <div id="dsl-inline-run-meta" class="dsl-inline-run-meta text-sm text-muted">
                Kliknij linię z komendą <code>SET</code> / <code>PUMP</code> / <code>GET</code> / <code>IF</code> / <code>WAIT</code>, aby uruchomić ją w runtime.
              </div>
              <div id="dsl-inline-runtime-preview" class="dsl-inline-runtime-preview text-sm"></div>
              <pre id="dsl-inline-terminal" class="dsl-inline-terminal text-xs mono">[ready] Runtime linii jest gotowy…</pre>
            </div>
          </div>
        </div>
      </div>
      
      ${DslBuilderUI.renderAddScenarioModal()}
      ${getDslRunModalContent()}
    `;
}

export function getDslRunModalContent(): string {
  return `
      <div id="dsl-run-modal" class="modal hidden">
        <div class="modal-dialog wide">
          <div class="modal-header d-flex items-center justify-between">
            <h4 class="text-md" id="dsl-run-title">▶️ Uruchamianie scenariusza</h4>
            <button class="modal-close" data-modal-close>✕</button>
          </div>
          <div class="modal-body" style="max-height:75vh;overflow-y:auto;">
            <div class="run-tabs d-flex gap-xs mb-xs">
              <button class="run-tab active" data-run-tab="exec">▶️ Wykonanie</button>
              <button class="run-tab" data-run-tab="terminal">🖥️ Terminal</button>
              <button class="run-tab" data-run-tab="state">🧩 Stan</button>
              <button class="run-tab" data-run-tab="firmware">🔌 Firmware</button>
            </div>
            
            <!-- Execution Panel -->
            <div id="dsl-run-exec" class="run-panel">
              <div class="run-panel-header d-flex items-center justify-between">
                <span class="text-sm">Status: <span id="dsl-run-status">Oczekiwanie</span></span>
                <div class="d-flex gap-xs">
                  <button id="dsl-run-pause" class="btn btn-secondary btn-xs">⏸️ Pauza</button>
                  <button id="dsl-run-resume" class="btn btn-secondary btn-xs">▶️ Wznów</button>
                  <button id="dsl-run-stop" class="btn btn-danger btn-xs">⏹️ Stop</button>
                </div>
              </div>
              <div class="progress-bar" style="height:8px;background:var(--bg-muted);border-radius:4px;margin:12px 0;">
                <div id="dsl-run-progress" style="width:0%;height:100%;background:var(--success);border-radius:4px;transition:width 0.3s;"></div>
              </div>
              <div class="text-xs text-muted mb-xs">Kroki wykonania:</div>
              <ol id="dsl-run-steps" class="text-sm" style="margin:0;padding-left:20px;max-height:200px;overflow-y:auto;"></ol>
            </div>
            
            <!-- Terminal Panel -->
            <div id="dsl-run-terminal" class="run-panel hidden">
              <div class="run-panel-header d-flex items-center justify-between">
                <span class="text-sm">🖥️ Terminal</span>
                <button id="dsl-run-logs-clear" class="btn btn-secondary btn-xs">Wyczyść</button>
              </div>
              <pre id="dsl-run-logs" class="text-xs mono" style="background:var(--code-bg);color:var(--code-text);padding:8px;margin:0;height:250px;overflow:auto;border-radius:4px;"></pre>
            </div>
            
            <!-- State Panel -->
            <div id="dsl-run-state" class="run-panel hidden">
              <div class="run-panel-header d-flex items-center justify-between">
                <span class="text-sm">🧩 Stan urządzeń</span>
                <button id="dsl-run-state-refresh" class="btn btn-secondary btn-xs">🔄 Odśwież</button>
              </div>
              <table class="text-sm" style="width:100%;border-collapse:collapse;">
                <thead>
                  <tr style="background:var(--bg-muted);">
                    <th style="text-align:left;padding:8px;border-bottom:1px solid var(--panel-border);">Urządzenie</th>
                    <th style="text-align:left;padding:8px;border-bottom:1px solid var(--panel-border);">Stan</th>
                    <th style="text-align:left;padding:8px;border-bottom:1px solid var(--panel-border);">Wartość</th>
                  </tr>
                </thead>
                <tbody id="dsl-run-state-body"></tbody>
              </table>
            </div>

            <!-- Firmware Panel -->
            <div id="dsl-run-firmware" class="run-panel hidden">
              <div class="run-panel-header d-flex items-center justify-between">
                <span class="text-sm">🔌 Identyfikacja sprzętu</span>
                <button id="dsl-run-fw-refresh" class="btn btn-secondary btn-xs">🔄 Odśwież</button>
              </div>
              <div id="dsl-run-fw-status" class="text-xs text-muted mb-xs">Ładowanie…</div>
              <div id="dsl-run-fw-body" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;"></div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" data-modal-close>Zamknij</button>
          </div>
        </div>
      </div>
    `;
}
