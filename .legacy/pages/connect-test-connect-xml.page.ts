// frontend/src/modules/connect-test/pages/connect-xml.page.ts
import { getDslEngine } from '../components/dsl';
import { fetchWithAuth } from '../utils/fetch.utils';

export class ConnectXmlPage {

  /** Page discovery compatible render method */
  render(): string {
    return ConnectXmlPage.getContent();
  }
  static getContent(): string {
    return `
      <div class="page-content">
        <div class="page-header d-flex items-center justify-between mb-sm">
          <h2 class="text-md">📥 Import XML / DSL Maintenance</h2>
          <div class="d-flex items-center gap-sm">
            <button id="cx-scan" class="btn btn-secondary btn-sm">🔎 Scan DSL/Goals</button>
            <button id="cx-standardize" class="btn btn-primary btn-sm">🧰 Standardize DSL/Goals</button>
            <button id="cx-sync" class="btn btn-primary btn-sm">🔗 Sync DSL Tables</button>
          </div>
        </div>

        <div class="panel mb-sm">
          <div class="panel-header d-flex items-center justify-between">
            <h5 class="text-sm m-0">💾 Import z pliku XML → migracja do bazy</h5>
            <div class="d-flex items-center gap-xs">
              <button id="cx-validate" class="btn btn-secondary btn-xs">✅ Waliduj</button>
              <button id="cx-autofix" class="btn btn-secondary btn-xs" style="display:none">🪄 Auto-fix</button>
              <button id="cx-save" class="btn btn-success btn-xs">📤 Zapisz do bazy</button>
            <button id="cx-save-split" class="btn btn-success btn-xs">📤 Zapisz rozdzielone scenariusze</button>
              <button id="cx-dl-schema" class="btn btn-outline btn-xs">⬇️ JSON Schema</button>
              <button id="cx-dl-xsd" class="btn btn-outline btn-xs">⬇️ XSD</button>
            </div>
          </div>
          <div class="panel-body">
            <div class="d-flex items-center gap-sm mb-xs">
              <input id="cx-file" type="file" accept=".xml" class="form-input" style="max-width:360px" multiple>
              <input id="cx-name" class="form-input" placeholder="Nazwa scenariusza" style="min-width:240px">
              <button id="cx-batch" class="btn btn-primary btn-xs">📦 Batch migrate</button>
              <button id="cx-validate-db" class="btn btn-secondary btn-xs">🧪 Waliduj scenariusze w DB</button>
            </div>
            <div class="grid-2">
              <div>
                <div class="text-xs text-muted mb-xxs">Edytowalny DSL (asysta operatora)</div>
                <textarea id="cx-dsl-text" class="dsl-textarea" placeholder="DSL po konwersji z XML"></textarea>
              </div>
              <div>
                <div class="text-xs text-muted mb-xxs">Podgląd XML (z DSL)</div>
                <pre id="cx-xml" class="mono xml-preview"></pre>
              </div>
            </div>
          </div>
        </div>

        <div class="panel mb-sm">
          <div class="panel-header d-flex items-center justify-between">
            <h5 class="text-sm m-0">🌐 Import z dysku serwera (glob)</h5>
          </div>
          <div class="panel-body">
            <div class="d-flex items-center gap-sm mb-xs">
              <label class="text-sm">Glob:</label>
              <input id="cx-glob" class="form-input" placeholder="c10/Data/Reports/*/*.xml" style="min-width:420px">
              <label class="text-sm">Limit:</label>
              <input id="cx-limit" class="form-input" type="number" value="10" min="1" style="width:90px">
              <button id="cx-import" class="btn btn-success btn-sm">📥 Import</button>
              <button id="cx-import-name" class="btn btn-outline btn-sm">📥 Import by name</button>
              <button id="cx-verify-name" class="btn btn-outline btn-sm">🔎 Verify by name</button>
            </div>
            <div class="text-xs text-muted">Uwaga: Operacja używa ścieżek na serwerze backend (dev). Do produkcji zalecany jest upload endpoint.</div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-header d-flex items-center justify-between">
            <h5 class="text-sm m-0">📄 Wynik</h5>
            <button id="cx-clear" class="btn btn-secondary btn-xs">🧹 Wyczyść</button>
          </div>
          <div class="panel-body">
            <pre id="cx-out" class="mono" style="max-height:50vh; overflow:auto"></pre>
          </div>
        </div>
      </div>
    `;
  }

  static getStyles(): string {
    return `
      .panel { border: 1px solid var(--panel-border); border-radius: 6px; background: var(--panel-bg); }
      .panel-header { padding: 8px 10px; border-bottom: 1px solid var(--panel-border); }
      .panel-body { padding: 10px; }
      .form-input { background: var(--panel-bg); border: 1px solid var(--panel-border); color: var(--text); border-radius: 6px; padding: 6px 8px; }
      .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-size: 12px; }
      .dsl-textarea { width: 100%; min-height: 240px; background: var(--panel-bg); border: 1px solid var(--panel-border); color: var(--text); border-radius: 6px; padding: 8px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px; }
      .xml-preview { min-height: 240px; white-space: pre-wrap; }
      .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    `;
  }

  static setup(root?: HTMLElement): void {
    const container = root || document.getElementById('connect-test-content') || document.querySelector('.module-main-content');
    if (!container) return;
    const el = container as HTMLElement;

    const $ = (sel: string) => el.querySelector(sel) as HTMLElement | null;
    const out = $('#cx-out') as HTMLElement | null;
    const log = (msg: string) => { if (out) { out.textContent += msg + '\n'; out.scrollTop = out.scrollHeight; } };
    const clear = () => { if (out) out.textContent = ''; };
    const dsl = getDslEngine();
    let lastXml: string | null = null;
    let lastXmlNameHint: string | null = null;
    const getInputs = () => ({
      file: el.querySelector('#cx-file') as HTMLInputElement | null,
      name: el.querySelector('#cx-name') as HTMLInputElement | null,
      dslText: el.querySelector('#cx-dsl-text') as HTMLTextAreaElement | null,
      xml: el.querySelector('#cx-xml') as HTMLElement | null,
    });

    // Save split scenarios from last loaded XML
    (el.querySelector('#cx-save-split') as HTMLButtonElement | null)?.addEventListener('click', async () => {
      const { name } = getInputs();
      if (!lastXml) { log('❌ Brak XML w pamięci. Wczytaj najpierw plik XML.'); return; }
      try {
        const splits = dsl.splitLegacyXmlToScenarios(lastXml, lastXmlNameHint || (name?.value || ''));
        if (!splits.length) { log('ℹ️ Nie wykryto wielu scenariuszy w XML'); return; }
        log(`▶️ Zapis rozdzielonych scenariuszy (count=${splits.length})...`);
        let ok = 0, fail = 0;
        for (const s of splits) {
          try {
            const res = await dsl.postScenarioToDb(s.name, s.dsl);
            if (res.ok) { ok++; log(`  ✅ ${s.name} → id=${res.id || ''}`); }
            else { fail++; log(`  ❌ ${s.name} → POST failed`); }
          } catch (e: any) {
            fail++; log(`  ❌ ${s.name} → ${String(e?.message || e)}`);
          }
        }
        log(`📊 Wynik: ok=${ok}, fail=${fail}`);
      } catch (e: any) {
        log('ERR save-split: ' + String(e));
      }
    });
    const downloadText = (filename: string, text: string, type = 'text/plain') => {
      try {
        const blob = new Blob([text], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename; a.click();
        URL.revokeObjectURL(url);
      } catch { /* silent */ }
    };

    const postJson = async (url: string, body?: any) => {
      const res = await fetchWithAuth(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: body ? JSON.stringify(body) : undefined } as RequestInit);
      const txt = await res.text();
      try { return { ok: res.ok, data: JSON.parse(txt) }; } catch { return { ok: res.ok, data: txt }; }
    };

    $('#cx-clear')?.addEventListener('click', () => clear());

    $('#cx-dl-schema')?.addEventListener('click', () => {
      const schema = JSON.stringify(dsl.getJsonSchema(), null, 2);
      downloadText('dsl.schema.json', schema, 'application/json');
    });
    $('#cx-dl-xsd')?.addEventListener('click', () => {
      const xsd = dsl.getXsd();
      downloadText('dsl.xsd', xsd, 'application/xml');
    });

    $('#cx-scan')?.addEventListener('click', async () => {
      log('▶️ /api/v3/devtools/dsl/scan ...');
      try {
        const res = await postJson('/api/v3/devtools/dsl/scan');
        log('SCAN: ' + JSON.stringify(res.data, null, 2));
      } catch (e: any) { log('ERR scan: ' + String(e)); }
    });

    $('#cx-standardize')?.addEventListener('click', async () => {
      log('▶️ /api/v3/devtools/dsl/standardize ...');
      try {
        const res = await postJson('/api/v3/devtools/dsl/standardize');
        log('STANDARDIZE: ' + JSON.stringify(res.data || res, null, 2));
      } catch (e: any) { log('ERR standardize: ' + String(e)); }
    });

    $('#cx-sync')?.addEventListener('click', async () => {
      log('▶️ /api/v3/devtools/dsl/sync ...');
      try {
        const res = await postJson('/api/v3/devtools/dsl/sync');
        log('SYNC: ' + JSON.stringify(res.data || res, null, 2));
      } catch (e: any) { log('ERR sync: ' + String(e)); }
    });

    $('#cx-import')?.addEventListener('click', async () => {
      const glob = (el.querySelector('#cx-glob') as HTMLInputElement | null)?.value || '';
      const limitRaw = (el.querySelector('#cx-limit') as HTMLInputElement | null)?.value || '10';
      const limit = parseInt(limitRaw, 10) || 10;
      if (!glob) { log('❌ Podaj glob ścieżki (np. c10/Data/Reports/*/*.xml)'); return; }
      log(`▶️ Import XML via glob=${glob} limit=${limit}`);
      try {
        const url = `/api/v3/devtools/dsl/import-xml?glob=${encodeURIComponent(glob)}&limit=${limit}`;
        const res = await postJson(url, { glob, limit });
        log('IMPORT: ' + JSON.stringify(res.data || res, null, 2));
      } catch (e: any) { log('ERR import: ' + String(e)); }
    });

    const pickServerFilename = (): string => {
      const globInp = el.querySelector('#cx-glob') as HTMLInputElement | null;
      let raw = (globInp?.value || '').trim();
      if (!raw && lastXmlNameHint) raw = `${lastXmlNameHint}.xml`;
      if (!raw) {
        const { file } = getInputs();
        const f = (file && file.files && file.files[0]) ? file.files[0] : null;
        if (f) raw = f.name;
      }
      const name = raw.split(/[\\/]/).pop() || raw; // basename
      return name;
    };

    (el.querySelector('#cx-import-name') as HTMLButtonElement | null)?.addEventListener('click', async () => {
      const name = pickServerFilename();
      if (!name || !/\.xml$/i.test(name)) { log('❌ Podaj nazwę pliku XML (np. tst00000.xml) w polu Glob lub wybierz plik.'); return; }
      const url = `/api/v3/devtools/dsl/import-xml-by-name?name=${encodeURIComponent(name)}`;
      log(`▶️ ${url}`);
      try {
        const res = await fetchWithAuth(url, { credentials: 'include' } as RequestInit);
        const txt = await res.text();
        try { log('IMPORT-NAME: ' + JSON.stringify(JSON.parse(txt), null, 2)); } catch { log('IMPORT-NAME: ' + txt); }
      } catch (e: any) { log('ERR import-name: ' + String(e)); }
    });

    (el.querySelector('#cx-verify-name') as HTMLButtonElement | null)?.addEventListener('click', async () => {
      const name = pickServerFilename();
      if (!name || !/\.xml$/i.test(name)) { log('❌ Podaj nazwę pliku XML (np. tst00000.xml) w polu Glob lub wybierz plik.'); return; }
      const url = `/api/v3/devtools/dsl/verify-xml-import?name=${encodeURIComponent(name)}`;
      log(`▶️ ${url}`);
      try {
        const res = await fetchWithAuth(url, { credentials: 'include' } as RequestInit);
        const txt = await res.text();
        try { log('VERIFY: ' + JSON.stringify(JSON.parse(txt), null, 2)); } catch { log('VERIFY: ' + txt); }
      } catch (e: any) { log('ERR verify-name: ' + String(e)); }
    });

    $('#cx-file')?.addEventListener('change', async () => {
      const { file, name, dslText, xml } = getInputs();
      if (!file || !file.files || !file.files.length) return;
      if (file.files.length > 1) {
        log(`📦 Wybrano ${file.files.length} plików. Użyj przycisku Batch migrate aby wykonać migrację zbiorczą.`);
        return;
      }
      const f = file.files[0];
      log('📄 Wczytywanie pliku: ' + f.name);
      try {
        const xmlStr = await f.text();
        lastXml = xmlStr;
        const nameHint = f.name.replace(/\.xml$/i, '');
        lastXmlNameHint = nameHint;
        const mig = dsl.migrateLegacyXmlToDsl(xmlStr, nameHint);
        if (!mig.ok) { log('❌ Migracja nie powiodła się: ' + (mig.errors || []).join('; ')); if (dslText) dslText.value = ''; if (xml) xml.textContent = ''; return; }
        if (name && !name.value) name.value = mig.name || mig.ast?.scenario || nameHint;
        if (dslText) dslText.value = mig.dsl || '';
        // pokaż XML z AST lub z DSL
        const xmlOut = mig.ast ? dsl.astToXml(mig.ast) : (dsl.toXml(dslText?.value || '').xml || '');
        if (xml) xml.textContent = xmlOut;
        // schema-level validate
        if (mig.ast) {
          const schemaVal = dsl.validateAst(mig.ast);
          if (!schemaVal.ok) log('⚠️ AST vs Schema: ' + (schemaVal.errors || []).join('; '));
        }
        log('✅ Załadowano i przekształcono XML → DSL');
      } catch (e: any) { log('ERR file: ' + String(e)); }
    });

    // Batch migrate selected files
    (el.querySelector('#cx-batch') as HTMLButtonElement | null)?.addEventListener('click', async () => {
      const { file } = getInputs();
      const files = file?.files;
      if (!files || !files.length) { log('ℹ️ Wybierz najpierw pliki XML'); return; }
      log(`▶️ Batch migrate start (count=${files.length})...`);
      try {
        const results = await dsl.migrateFilesToDb(files);
        const ok = results.filter(r => r.ok).length;
        const fail = results.length - ok;
        log(`✅ Batch done: ok=${ok}, fail=${fail}`);
        for (const r of results) {
          log(` - ${r.file}: ${r.ok ? `OK id=${r.id || ''}` : `FAIL ${((r.errors||[]).join('; '))}`}`);
        }
      } catch (e: any) {
        log('ERR batch: ' + String(e));
      }
    });

    // Validate all scenarios in DB
    (el.querySelector('#cx-validate-db') as HTMLButtonElement | null)?.addEventListener('click', async () => {
      log('▶️ Walidacja scenariuszy w DB...');
      try {
        const reports = await dsl.validateDbScenarios();
        const ok = reports.filter(r => r.ok).length;
        const fail = reports.length - ok;
        log(`📊 Wynik walidacji DB: total=${reports.length}, ok=${ok}, fail=${fail}`);
        for (const r of reports) {
          if (!r.ok) log(` - ${r.id} ${r.name ? `(${r.name})` : ''}: ${r.errors.join('; ')}`);
        }
      } catch (e: any) {
        log('ERR validate-db: ' + String(e));
      }
    });

    // Save current DSL to DB
    (el.querySelector('#cx-save') as HTMLButtonElement | null)?.addEventListener('click', async () => {
      const { name, dslText } = getInputs();
      const nm = (name?.value || '').trim();
      const txt = (dslText?.value || '').trim();
      if (!nm) { log('❌ Podaj nazwę scenariusza'); return; }
      if (!txt) { log('❌ Brak DSL do zapisu'); return; }
      try {
        log('🧪 Krok 1: Walidacja formatu...');
        const fmt = dsl.validate(txt);
        if (fmt.fixedText && fmt.fixedText.trim() && fmt.fixedText.trim() !== txt) {
          log('ℹ️ Propozycja auto-fix dostępna (użyj 🪄 Auto-fix przed zapisem).');
        }
        log('🧪 Krok 2: Walidacja parser + schema + XML...');
        const rep = dsl.validateDslText(txt);
        if (!rep.ok) { log('❌ Błędy: ' + (rep.errors || []).join('; ')); return; }
        log('🧪 Krok 3: Zapis do bazy...');
        const res = await dsl.postScenarioToDb(nm, txt);
        if (res.ok) {
          log('✅ Zapisano do bazy, id=' + (res.id || ''));
        } else {
          log('❌ Błąd zapisu');
        }
      } catch (e: any) {
        log('ERR save: ' + String(e));
      }
    });

    $('#cx-validate')?.addEventListener('click', () => {
      const { dslText, xml } = getInputs();
      const txt = (dslText?.value || '').trim();
      if (!txt) { log('❌ Brak DSL do walidacji'); return; }
      try {
        const fmt = dsl.validate(txt); // stylistic + fixedText
        const autoFixBtn = el.querySelector('#cx-autofix') as HTMLButtonElement | null;
        const hasFix = !!(fmt.fixedText && fmt.fixedText.trim() && fmt.fixedText.trim() !== txt);
        if (autoFixBtn) autoFixBtn.style.display = hasFix ? 'inline-block' : 'none';
        if (hasFix) log('ℹ️ Propozycja auto-fix dostępna. Użyj przycisku 🪄 Auto-fix.');
        const rep = dsl.validateDslText(txt); // parse + schema + xml
        if (rep.ok) { log('✅ Walidacja OK'); if (rep.xml && xml) xml.textContent = rep.xml; }
        else { log('❌ Błędy: ' + (rep.errors || []).join('; ')); if (rep.xml && xml) xml.textContent = rep.xml; }
        // dodatkowo sprawdź AST→schema
        const pr = dsl.parse(txt);
        if (pr.ok) {
          const sv = dsl.validateAst(pr.ast);
          if (!sv.ok) log('⚠️ AST vs Schema: ' + (sv.errors || []).join('; '));
        }
      } catch (e: any) { log('ERR validate: ' + String(e)); }
    });

    (el.querySelector('#cx-autofix') as HTMLButtonElement | null)?.addEventListener('click', () => {
      const { dslText, xml } = getInputs();
      if (!dslText) return;
      const txt = (dslText.value || '').trim();
      const fmt = dsl.validate(txt);
      if (fmt.fixedText && fmt.fixedText.trim()) {
        dslText.value = fmt.fixedText;
        const res = dsl.toXml(fmt.fixedText.trim());
        if (xml) xml.textContent = res.ok ? (res.xml || '') : (res.errors || []).join('\n');
        log('✅ Zastosowano auto-fix');
      } else {
        log('ℹ️ Brak propozycji auto-fix');
      }
    });
  }
}
