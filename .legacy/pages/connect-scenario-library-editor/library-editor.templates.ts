// frontend/src/pages/connect-scenario-library-editor/library-editor.templates.ts
import { DslBuilderUI } from '../../components/dsl-editor';

export function getLibraryEditorContent(): string {
  return `
      <div class="page-content library-editor-page">
        <div class="page-header d-flex items-center justify-between">
          <div>
            <h2>📚 Edytor Library — Edytor biblioteki: obiekty, funkcje, parametry, jednostki, goals</h2>
          </div>
          <div class="scenario-context" id="scenario-context">
            <span class="text-sm text-muted">Scenariusz:</span>
            <strong id="scenario-title">—</strong>
            <span id="save-indicator" class="save-indicator"></span>
            <a href="/connect-scenario/scenarios" class="btn btn-secondary btn-sm ml-2">← Budowanie</a>
          </div>
        </div>
        
        <div class="def-editor-layout">
          <!-- Scenario List -->
          <div class="def-scenario-list">
            <div class="scenario-list-filter">
              <div class="filter-row d-flex gap-sm" style="flex-wrap:wrap;align-items:center;">
                <input type="text" id="def-scenario-filter" class="search-input" placeholder="Filtruj...">
                <select id="scenario-sort" class="search-input" style="flex:1 1 180px;min-width:160px;max-width:100%;">
                  <option value="date_desc">Data (najnowsze)</option>
                  <option value="date_asc">Data (najstarsze)</option>
                  <option value="name_asc">Nazwa (A→Z)</option>
                  <option value="name_desc">Nazwa (Z→A)</option>
                </select>
                <button id="def-add-scenario-btn" class="btn btn-primary btn-sm" title="Dodaj scenariusz">➕</button>
              </div>
            </div>
            <div class="scenario-table-wrapper">
              <table class="scenario-table text-sm">
                <thead>
                  <tr>
                    <th>Scenariusz</th>
                  </tr>
                </thead>
                <tbody id="def-scenario-list-body"></tbody>
              </table>
            </div>
          </div>
          
          <!-- Tabs -->
          <div class="def-editor-sidebar">
            <div class="def-tabs">
              <button class="def-tab active" data-tab="goals">🎯 GOAL</button>
              <button class="def-tab" data-tab="goals-order">↕️ Kolejność</button>
              <button class="def-tab" data-tab="funcs">🔧 FUNC</button>
              <button class="def-tab" data-tab="defaults">⚙️ Zmienne</button>
              <button class="def-tab def-tab-source" data-tab="source">📝 JSON</button>
            </div>
            
            <div class="def-actions">
              <div id="save-indicator" class="save-indicator"></div>
            </div>
          </div>
          
          <div class="def-editor-main">
            <!-- Goals Tab -->
            <div class="def-tab-content active" data-tab-content="goals">
              <div class="def-section-header">
                <h3>🎯 Czynności GOAL</h3>
                <div class="d-flex gap-sm">
                  <button class="btn btn-secondary btn-sm" data-action="export-dsl-file" title="Eksportuj DSL do pliku">📁 Eksportuj</button>
                  <button class="btn btn-secondary btn-sm" data-action="copy-dsl-all" title="Kopiuj cały DSL">📋 Kopiuj DSL</button>
                  <button class="btn btn-success btn-sm" data-action="add-goal">+ Dodaj GOAL</button>
                </div>
              </div>
              <p class="text-sm text-muted mb-2">Czynności testowe scenariusza. Przeciągnij aby zmienić kolejność.</p>
              <div class="def-items-list" id="goals-list"></div>
            </div>

            <!-- Goals Order Tab (operator-friendly) -->
            <div class="def-tab-content" data-tab-content="goals-order">
              <div class="def-section-header">
                <h3>↕️ Kolejność GOAL</h3>
              </div>
              <p class="text-sm text-muted mb-2">Ustaw kolejność GOAL bez edycji treści DSL. Przeciągnij lub użyj strzałek.</p>
              <div class="def-items-list goals-order-list" id="goals-order-list"></div>
            </div>

            <!-- FUNC Tab -->
            <div class="def-tab-content" data-tab-content="funcs">
              <div class="def-section-header">
                <h3>🔧 Procedury FUNC</h3>
                <button class="btn btn-success btn-sm" data-action="add-func">+ Dodaj FUNC</button>
              </div>
              <p class="text-sm text-muted mb-2">Procedury FUNC - przechowywane w library.funcs (JSON)</p>
              <div class="def-items-list" id="funcs-list"></div>
            </div>
            
            <!-- Defaults Tab (OPT/SET variables) -->
            <div class="def-tab-content" data-tab-content="defaults">
              <div class="def-section-header">
                <h3>⚙️ Wartości domyślne (OPT/SET)</h3>
                <button class="btn btn-success btn-sm" data-action="add-default">+ Dodaj zmienną</button>
                <button class="btn btn-secondary btn-sm" data-action="scan-defaults">🔍 Skanuj DSL</button>
              </div>
              <p class="text-sm text-muted mb-2">Zmienne zadeklarowane przez OPT i SET w celach. Wartości domyślne można nadpisać w poszczególnych GOAL.</p>
              <div class="def-items-list" id="defaults-list"></div>
            </div>
            
            <!-- Source Code Tab (JSON) -->
            <div class="def-tab-content" data-tab-content="source">
              <div class="def-section-header">
                <h3>📝 Library JSON</h3>
                <div class="d-flex gap-sm">
                  <button class="btn btn-secondary btn-sm" data-action="source-validate">✅ Waliduj</button>
                  <button class="btn btn-success btn-sm" data-action="source-apply">💾 Zastosuj zmiany</button>
                </div>
              </div>
              <div class="def-source-container">
                <div class="def-source-highlight" id="def-source-highlight"></div>
                <textarea id="def-source-editor" class="def-source-textarea" spellcheck="false" data-gramm="false"></textarea>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Code Preview Modal -->
        <div class="modal hidden" id="def-code-modal">
          <div class="modal-dialog" style="width:800px;">
            <div class="modal-header">
              <h4>📄 Kod DEF</h4>
              <button class="btn-close" data-action="close-modal">✕</button>
            </div>
            <div class="modal-body">
              <pre id="def-code-preview" class="mono text-sm" style="max-height:400px;overflow:auto;background:var(--bg-muted);padding:12px;border-radius:4px;"></pre>
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary" data-action="copy-code">📋 Kopiuj</button>
              <button class="btn btn-primary" data-action="close-modal">Zamknij</button>
            </div>
          </div>
        </div>
        
        ${DslBuilderUI.renderAddScenarioModal()}
      </div>
    `;
}
