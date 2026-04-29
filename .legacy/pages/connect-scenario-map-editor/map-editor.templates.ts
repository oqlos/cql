// frontend/src/pages/connect-scenario-map-editor/map-editor.templates.ts

export function getMapEditorContent(): string {
  return `
      <div class="page-content map-editor-page">
        <div class="page-header d-flex items-center justify-between">
          <div>
            <h2>🗺️ Edytor MAP — Mapowanie DSL → funkcje JS/Python</h2>
          </div>
          <div class="scenario-context d-flex items-center gap-sm">
            <span class="text-sm text-muted">Scenariusz:</span>
            <strong id="map-scenario-title">—</strong>
            <button id="map-save-btn" class="btn btn-primary btn-sm" disabled>💾 Zapisz</button>
            <button id="map-reload-btn" class="btn btn-secondary btn-sm">🔄 Przeładuj</button>
            <a href="/connect-scenario/scenarios" class="btn btn-secondary btn-sm">← Budowanie</a>
          </div>
        </div>
        
        <div class="map-editor-layout">
          <!-- Scenario List (Left) -->
          <div class="map-scenario-list">
            <div class="scenario-list-filter">
              <div class="d-flex gap-sm" style="flex-wrap:wrap;align-items:center;">
                <input type="text" id="map-scenario-filter" class="search-input" placeholder="Filtruj..." style="flex:1 1 155px;min-width:140px;max-width:100%;">
                <select id="scenario-sort" class="search-input" style="flex:1 1 180px;min-width:160px;max-width:100%;">
                  <option value="date_desc">Data (najnowsze)</option>
                  <option value="date_asc">Data (najstarsze)</option>
                  <option value="name_asc">Nazwa (A→Z)</option>
                  <option value="name_desc">Nazwa (Z→A)</option>
                </select>
              </div>
            </div>
            <div class="scenario-table-wrapper">
              <table class="scenario-table text-sm">
                <thead>
                  <tr>
                    <th>Scenariusz</th>
                  </tr>
                </thead>
                <tbody id="map-scenario-list-body"></tbody>
              </table>
            </div>
          </div>
          <!-- Tabs -->
          <div class="map-editor-tabs">
            <button class="map-tab active" data-tab="objects">📦 Obiekty</button>
            <button class="map-tab" data-tab="params">📊 Parametry</button>
            <button class="map-tab" data-tab="actions">⚡ Akcje</button>
            <button class="map-tab" data-tab="funcs">🔧 FUNC</button>
            <button class="map-tab" data-tab="json">📝 JSON</button>
          </div>
          
          <div class="map-editor-main">
            <!-- Objects Tab -->
            <div class="map-tab-content active" data-tab-content="objects">
              <div class="map-section-header">
                <span>Mapowanie Object → Action → API/Function</span>
                <button id="map-add-object" class="btn btn-secondary btn-xs">➕ Dodaj obiekt</button>
              </div>
              <div id="map-objects-list" class="map-items-list"></div>
            </div>
            
            <!-- Params Tab -->
            <div class="map-tab-content" data-tab-content="params">
              <div class="map-section-header">
                <span>Mapowanie Param → Sensor</span>
                <button id="map-add-param" class="btn btn-secondary btn-xs">➕ Dodaj parametr</button>
              </div>
              <div id="map-params-list" class="map-items-list"></div>
            </div>
            
            <!-- Actions Tab -->
            <div class="map-tab-content" data-tab-content="actions">
              <div class="map-section-header">
                <span>Globalne akcje</span>
                <button id="map-add-action" class="btn btn-secondary btn-xs">➕ Dodaj akcję</button>
              </div>
              <div id="map-actions-list" class="map-items-list"></div>
            </div>
            
            <!-- Funcs Tab -->
            <div class="map-tab-content" data-tab-content="funcs">
              <div class="map-section-header">
                <span>Implementacje FUNC</span>
                <div class="func-toolbar">
                  <button id="map-add-func" class="btn btn-success btn-xs">➕ Nowa FUNC</button>
                  <span class="func-help-hint">💡 Typy kroków: SET, SET 'POMPA', SET 'WAIT', MIN, MAX, IF, LOG, ERROR, SAVE</span>
                </div>
              </div>
              <div id="map-funcs-list" class="func-editor-list"></div>
              
              <!-- DSL Step Types Reference -->
              <div class="func-reference-panel">
                <div class="reference-header" onclick="this.parentElement.classList.toggle('expanded')">
                  📖 Składnia DSL (kliknij aby rozwinąć)
                </div>
                <div class="reference-body">
                  <div class="reference-item"><code>SET 'zawór 1' '1'</code> - Ustaw stan zaworu lub zmiennej</div>
                  <div class="reference-item"><code>SET 'POMPA' '5 l/min'</code> - Ustaw przepływ pompy</div>
                  <div class="reference-item"><code>SET 'WAIT' '5 s'</code> - Czekaj (np. 5 s, 100 ms)</div>
                  <div class="reference-item"><code>MIN 'param' 'wartość'</code> - Minimalna wartość</div>
                  <div class="reference-item"><code>MAX 'param' 'wartość'</code> - Maksymalna wartość</div>
                  <div class="reference-item"><code>IF 'param' >= 'wartość'</code> - Warunek</div>
                  <div class="reference-item"><code>LOG 'wiadomość'</code> - Zapisz log</div>
                  <div class="reference-item"><code>ERROR 'komunikat'</code> - Zgłoś błąd</div>
                  <div class="reference-item"><code>SAVE 'zmienna'</code> - Zapisz wartość</div>
                </div>
              </div>
            </div>
            
            <!-- JSON Tab -->
            <div class="map-tab-content" data-tab-content="json">
              <div class="map-section-header">
                <span>Edycja MAP</span>
                <div class="json-view-toggle">
                  <button class="json-view-btn active" data-view="code">📝 Kod</button>
                  <button class="json-view-btn" data-view="visual">🧩 Bloczki</button>
                </div>
                <div class="json-actions">
                  <button id="map-format-json" class="btn btn-secondary btn-xs">📐 Formatuj</button>
                  <button id="map-validate-json" class="btn btn-secondary btn-xs">✅ Waliduj</button>
                </div>
              </div>
              
              <!-- Code View with Syntax Highlighting -->
              <div class="json-view json-code-view active">
                <div class="code-editor-wrapper">
                  <pre class="json-highlight-overlay" aria-hidden="true"><code id="json-highlight"></code></pre>
                  <textarea id="map-json-editor" class="mono" spellcheck="false"></textarea>
                </div>
              </div>
              
              <!-- Visual Block Editor -->
              <div class="json-view json-visual-view">
                <div class="visual-editor-toolbar">
                  <button class="btn btn-sm btn-success" data-visual-action="add-object">📦 + Obiekt</button>
                  <button class="btn btn-sm btn-success" data-visual-action="add-param">📊 + Parametr</button>
                  <button class="btn btn-sm btn-success" data-visual-action="add-action">⚡ + Akcja</button>
                  <button class="btn btn-sm btn-success" data-visual-action="add-func">🔧 + FUNC</button>
                </div>
                <div class="visual-editor-canvas" id="visual-editor-canvas"></div>
              </div>
            </div>
          </div>
          
          <!-- Sidebar -->
          <div class="map-editor-sidebar">
            <div class="map-panel">
              <div class="map-panel-header">📖 Struktura MAP</div>
              <div class="map-panel-body text-xs">
                <pre class="mono">{
  "objectActionMap": {
    "pompa 1": {
      "Włącz": {
        "kind": "api",
        "url": "/api/pump/1/on"
      }
    }
  },
  "paramSensorMap": {
    "ciśnienie": {
      "sensor": "AI01",
      "unit": "mbar"
    }
  }
}</pre>
              </div>
            </div>
            
            <div class="map-panel mt-sm">
              <div class="map-panel-header">⚙️ Kind Types</div>
              <div class="map-panel-body text-xs">
                <ul class="m-0 pl-sm">
                  <li><code>api</code> - HTTP request</li>
                  <li><code>ui</code> - UI component</li>
                  <li><code>sequence</code> - Step sequence</li>
                  <li><code>backend</code> - Python call</li>
                </ul>
              </div>
            </div>
            
            <div class="map-panel mt-sm">
              <div class="map-panel-header">📊 Statystyki</div>
              <div class="map-panel-body text-xs">
                <div id="map-stats"></div>
              </div>
            </div>
          </div>
        </div>
        
        <div id="map-status" class="map-status"></div>
      </div>
    `;
}
