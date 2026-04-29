import { useCallback, useEffect, useMemo, useState } from "react";
import SharedNav from "../components/SharedNav";
import { useAppConfig } from "../context/AppConfigProvider";
import { useI18n } from "../i18n/I18nProvider";
import { useWsStatus } from "../hooks/useWsStatus";
import { ScenariosApi } from "../api/scenariosApi";

const TABS = ["objects", "params", "actions", "funcs", "json"];

const EMPTY_MAP = Object.freeze({
  objectActionMap: {},
  paramSensorMap: {},
  actions: {},
  funcImplementations: {},
});

function ensureMapShape(input) {
  const src = input && typeof input === "object" ? input : {};
  return {
    objectActionMap: src.objectActionMap && typeof src.objectActionMap === "object" ? src.objectActionMap : {},
    paramSensorMap: src.paramSensorMap && typeof src.paramSensorMap === "object" ? src.paramSensorMap : {},
    actions: src.actions && typeof src.actions === "object" ? src.actions : {},
    funcImplementations: src.funcImplementations && typeof src.funcImplementations === "object" ? src.funcImplementations : {},
  };
}

function parseMapFromRow(row) {
  const direct = row?.map;
  if (typeof direct === "string") {
    try { return ensureMapShape(JSON.parse(direct)); } catch {}
  }
  if (direct && typeof direct === "object") return ensureMapShape(direct);

  const nested = row?.content?.map;
  if (typeof nested === "string") {
    try { return ensureMapShape(JSON.parse(nested)); } catch {}
  }
  if (nested && typeof nested === "object") return ensureMapShape(nested);

  return { ...EMPTY_MAP };
}

function toPrettyJson(mapData) {
  return JSON.stringify(ensureMapShape(mapData), null, 2);
}

export default function MapEditor() {
  const { scenario: scenarioIdFromUrl, patch, isReadOnly } = useAppConfig();
  const { t } = useI18n();
  const wsOnline = useWsStatus(true);

  const [activeTab, setActiveTab] = useState(() => {
    const tab = new URLSearchParams(globalThis.location.search).get("tab");
    return TABS.includes(tab) ? tab : "objects";
  });

  const [scenarios, setScenarios] = useState([]);
  const [filterText, setFilterText] = useState("");
  const [sortMode, setSortMode] = useState("date_desc");
  const [selectedScenario, setSelectedScenario] = useState(null);

  const [mapData, setMapData] = useState({ ...EMPTY_MAP });
  const [jsonText, setJsonText] = useState(toPrettyJson(EMPTY_MAP));
  const [originalJson, setOriginalJson] = useState(toPrettyJson(EMPTY_MAP));
  const [jsonError, setJsonError] = useState("");

  const [loadingList, setLoadingList] = useState(false);
  const [loadingScenario, setLoadingScenario] = useState(false);
  const [saveState, setSaveState] = useState("idle");

  const isDirty = jsonText !== originalJson && !jsonError;

  const setTabAndUrl = useCallback((tab) => {
    setActiveTab(tab);
    const url = new URL(globalThis.location.href);
    url.searchParams.set("tab", tab);
    globalThis.history.replaceState(null, "", `${url.pathname}${url.search}`);
  }, []);

  const loadScenarioById = useCallback(async (id) => {
    if (!id) return;
    setLoadingScenario(true);
    try {
      const row = await ScenariosApi.get(id);
      if (!row) return;
      const parsed = parseMapFromRow(row);
      const pretty = toPrettyJson(parsed);
      setSelectedScenario(row);
      setMapData(parsed);
      setJsonText(pretty);
      setOriginalJson(pretty);
      setJsonError("");
      setSaveState("idle");
    } catch (err) {
      console.error("MapEditor: failed to load scenario", err);
      setSaveState("error");
    } finally {
      setLoadingScenario(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoadingList(true);
    ScenariosApi.list({ limit: 1000 })
      .then((rows) => {
        if (cancelled) return;
        setScenarios(Array.isArray(rows) ? rows : []);
      })
      .catch((err) => {
        console.error("MapEditor: failed to list scenarios", err);
        if (!cancelled) setScenarios([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingList(false);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!scenarioIdFromUrl) return;
    loadScenarioById(scenarioIdFromUrl);
  }, [scenarioIdFromUrl, loadScenarioById]);

  const filteredScenarios = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    const rows = scenarios
      .filter((s) => !q || `${s.title || ""} ${s.id || ""}`.toLowerCase().includes(q))
      .slice();

    const ts = (s) => {
      const value = s?.updatedAt || "";
      const parsed = Date.parse(value);
      return Number.isFinite(parsed) ? parsed : 0;
    };

    rows.sort((a, b) => {
      if (sortMode === "name_asc") return (a.title || a.id || "").localeCompare(b.title || b.id || "", "pl");
      if (sortMode === "name_desc") return (b.title || b.id || "").localeCompare(a.title || a.id || "", "pl");
      if (sortMode === "date_asc") return ts(a) - ts(b);
      return ts(b) - ts(a);
    });

    return rows;
  }, [scenarios, filterText, sortMode]);

  const onScenarioSelect = useCallback((row) => {
    if (!row?.id) return;
    patch({ scenario: row.id });
    loadScenarioById(row.id);
  }, [patch, loadScenarioById]);

  const onJsonChange = useCallback((value) => {
    setJsonText(value);
    try {
      const parsed = JSON.parse(value);
      setMapData(ensureMapShape(parsed));
      setJsonError("");
    } catch (err) {
      setJsonError(err?.message || "Invalid JSON");
    }
  }, []);

  const applyMapMutation = useCallback((mutator) => {
    if (isReadOnly) return;
    setMapData((prev) => {
      const next = ensureMapShape(structuredClone(prev));
      mutator(next);
      const pretty = toPrettyJson(next);
      setJsonText(pretty);
      setJsonError("");
      return next;
    });
  }, [isReadOnly]);

  const addObject = useCallback(() => {
    const name = prompt(t("mapEditor.prompts.objectName"));
    if (!name) return;
    applyMapMutation((next) => {
      next.objectActionMap[name] = {
        Włącz: { kind: "api", url: `/api/v1/peripherals/${name.replaceAll(" ", "-").toLowerCase()}`, method: "PUT" },
        Wyłącz: { kind: "api", url: `/api/v1/peripherals/${name.replaceAll(" ", "-").toLowerCase()}`, method: "PUT" },
      };
    });
  }, [applyMapMutation, t]);

  const addParam = useCallback(() => {
    const name = prompt(t("mapEditor.prompts.paramName"));
    if (!name) return;
    applyMapMutation((next) => {
      next.paramSensorMap[name] = { sensor: "AI01", url: "/api/v1/state", unit: "mbar" };
    });
  }, [applyMapMutation, t]);

  const addAction = useCallback(() => {
    const name = prompt(t("mapEditor.prompts.actionName"));
    if (!name) return;
    applyMapMutation((next) => {
      next.actions[name] = { kind: "api", url: `/api/v1/peripherals/${name.replaceAll(" ", "-").toLowerCase()}`, method: "POST" };
    });
  }, [applyMapMutation, t]);

  const addFunc = useCallback(() => {
    const name = prompt(t("mapEditor.prompts.funcName"));
    if (!name) return;
    applyMapMutation((next) => {
      next.funcImplementations[name] = { kind: "sequence", steps: [{ action: "Włącz", object: "pompa 1" }] };
    });
  }, [applyMapMutation, t]);

  const renameKey = useCallback((group, oldName) => {
    const nextName = prompt(t("mapEditor.prompts.rename"), oldName);
    if (!nextName || nextName === oldName) return;
    applyMapMutation((next) => {
      const item = next[group][oldName];
      delete next[group][oldName];
      next[group][nextName] = item;
    });
  }, [applyMapMutation, t]);

  const deleteKey = useCallback((group, name) => {
    if (!confirm(t("mapEditor.prompts.confirmDelete", { name }))) return;
    applyMapMutation((next) => {
      delete next[group][name];
    });
  }, [applyMapMutation, t]);

  const editJsonField = useCallback((group, name, field) => {
    const current = mapData[group]?.[name];
    if (!current) return;
    const value = prompt(`${field}:`, current[field] ?? "");
    if (value === null) return;
    applyMapMutation((next) => {
      next[group][name][field] = value;
    });
  }, [applyMapMutation, mapData]);

  const saveMap = useCallback(async () => {
    if (!selectedScenario?.id || isReadOnly || jsonError) return;
    setSaveState("saving");
    try {
      const pretty = toPrettyJson(mapData);
      const contentObj = selectedScenario.content && typeof selectedScenario.content === "object"
        ? { ...selectedScenario.content, map: pretty }
        : { map: pretty };
      await ScenariosApi.update(selectedScenario.id, { map: pretty, content: JSON.stringify(contentObj) });
      setOriginalJson(pretty);
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 1200);
    } catch (err) {
      console.error("MapEditor: save failed", err);
      setSaveState("error");
    }
  }, [selectedScenario, isReadOnly, jsonError, mapData]);

  const reloadCurrent = useCallback(() => {
    if (!selectedScenario?.id) return;
    loadScenarioById(selectedScenario.id);
  }, [selectedScenario, loadScenarioById]);

  const objectsEntries = Object.entries(mapData.objectActionMap || {});
  const paramsEntries = Object.entries(mapData.paramSensorMap || {});
  const actionsEntries = Object.entries(mapData.actions || {});
  const funcsEntries = Object.entries(mapData.funcImplementations || {});

  return (
    <div className="dashboard">
      <SharedNav />
      <div className="dash-content mapx-page">
        <div className="section-label mapx-topline">
          <span>{t("mapEditor.title")}</span>
          <span className={`cql-status ${wsOnline ? "cql-status--online" : ""}`}>
            {wsOnline ? t("scenarios.connected") : t("scenarios.disconnected")}
          </span>
        </div>

        <div className="mapx-header">
          <div>
            <h2>{t("mapEditor.title")}</h2>
            <p className="section-desc">{t("mapEditor.subtitle")}</p>
          </div>
          <div className="mapx-header-actions">
            <span className="mapx-selected">{selectedScenario?.title || "—"}</span>
            <button onClick={saveMap} disabled={!isDirty || isReadOnly || saveState === "saving"} className="mapx-btn mapx-btn-primary">
              {saveState === "saving" ? "…" : t("mapEditor.save")}
            </button>
            <button onClick={reloadCurrent} disabled={!selectedScenario?.id} className="mapx-btn">{t("mapEditor.reload")}</button>
          </div>
        </div>

        <div className="mapx-layout">
          <aside className="mapx-list">
            <div className="mapx-list-filters">
              <input value={filterText} onChange={(e) => setFilterText(e.target.value)} placeholder={t("mapEditor.filter")} />
              <select value={sortMode} onChange={(e) => setSortMode(e.target.value)}>
                <option value="date_desc">{t("mapEditor.sortDateDesc")}</option>
                <option value="date_asc">{t("mapEditor.sortDateAsc")}</option>
                <option value="name_asc">{t("mapEditor.sortNameAsc")}</option>
                <option value="name_desc">{t("mapEditor.sortNameDesc")}</option>
              </select>
            </div>
            <div className="mapx-list-body">
              {loadingList ? <div className="mapx-empty">…</div> : filteredScenarios.map((row) => (
                <button
                  key={row.id}
                  className={`mapx-list-item ${selectedScenario?.id === row.id ? "active" : ""}`}
                  onClick={() => onScenarioSelect(row)}
                >
                  {row.title || row.id}
                </button>
              ))}
            </div>
          </aside>

          <nav className="mapx-tabs">
            {TABS.map((tab) => (
              <button key={tab} className={`mapx-tab ${activeTab === tab ? "active" : ""}`} onClick={() => setTabAndUrl(tab)}>
                {t(`mapEditor.tabs.${tab}`)}
              </button>
            ))}
          </nav>

          <main className="mapx-main">
            {loadingScenario && <div className="mapx-empty">{t("scenarios.loading")}</div>}
            {!loadingScenario && !selectedScenario && <div className="mapx-empty">{t("mapEditor.noScenario")}</div>}

            {!loadingScenario && selectedScenario && activeTab === "objects" && (
              <div>
                <div className="mapx-section-head"><span>{t("mapEditor.objectsDesc")}</span><button className="mapx-btn" onClick={addObject} disabled={isReadOnly}>+ {t("mapEditor.add")}</button></div>
                {objectsEntries.length === 0 ? <div className="mapx-empty">{t("mapEditor.emptyObjects")}</div> : objectsEntries.map(([name, cfg]) => (
                  <div className="mapx-card" key={name}>
                    <div className="mapx-card-head"><strong>{name}</strong><span><button className="mapx-btn" onClick={() => renameKey("objectActionMap", name)} disabled={isReadOnly}>✎</button><button className="mapx-btn" onClick={() => deleteKey("objectActionMap", name)} disabled={isReadOnly}>🗑</button></span></div>
                    <pre>{JSON.stringify(cfg, null, 2)}</pre>
                  </div>
                ))}
              </div>
            )}

            {!loadingScenario && selectedScenario && activeTab === "params" && (
              <div>
                <div className="mapx-section-head"><span>{t("mapEditor.paramsDesc")}</span><button className="mapx-btn" onClick={addParam} disabled={isReadOnly}>+ {t("mapEditor.add")}</button></div>
                {paramsEntries.length === 0 ? <div className="mapx-empty">{t("mapEditor.emptyParams")}</div> : paramsEntries.map(([name, cfg]) => (
                  <div className="mapx-card" key={name}>
                    <div className="mapx-card-head"><strong>{name}</strong><span><button className="mapx-btn" onClick={() => editJsonField("paramSensorMap", name, "sensor")} disabled={isReadOnly}>sensor</button><button className="mapx-btn" onClick={() => renameKey("paramSensorMap", name)} disabled={isReadOnly}>✎</button><button className="mapx-btn" onClick={() => deleteKey("paramSensorMap", name)} disabled={isReadOnly}>🗑</button></span></div>
                    <pre>{JSON.stringify(cfg, null, 2)}</pre>
                  </div>
                ))}
              </div>
            )}

            {!loadingScenario && selectedScenario && activeTab === "actions" && (
              <div>
                <div className="mapx-section-head"><span>{t("mapEditor.actionsDesc")}</span><button className="mapx-btn" onClick={addAction} disabled={isReadOnly}>+ {t("mapEditor.add")}</button></div>
                {actionsEntries.length === 0 ? <div className="mapx-empty">{t("mapEditor.emptyActions")}</div> : actionsEntries.map(([name, cfg]) => (
                  <div className="mapx-card" key={name}>
                    <div className="mapx-card-head"><strong>{name}</strong><span><button className="mapx-btn" onClick={() => editJsonField("actions", name, "url")} disabled={isReadOnly}>url</button><button className="mapx-btn" onClick={() => renameKey("actions", name)} disabled={isReadOnly}>✎</button><button className="mapx-btn" onClick={() => deleteKey("actions", name)} disabled={isReadOnly}>🗑</button></span></div>
                    <pre>{JSON.stringify(cfg, null, 2)}</pre>
                  </div>
                ))}
              </div>
            )}

            {!loadingScenario && selectedScenario && activeTab === "funcs" && (
              <div>
                <div className="mapx-section-head"><span>{t("mapEditor.funcsDesc")}</span><button className="mapx-btn" onClick={addFunc} disabled={isReadOnly}>+ {t("mapEditor.add")}</button></div>
                {funcsEntries.length === 0 ? <div className="mapx-empty">{t("mapEditor.emptyFuncs")}</div> : funcsEntries.map(([name, cfg]) => (
                  <div className="mapx-card" key={name}>
                    <div className="mapx-card-head"><strong>{name}</strong><span><button className="mapx-btn" onClick={() => renameKey("funcImplementations", name)} disabled={isReadOnly}>✎</button><button className="mapx-btn" onClick={() => deleteKey("funcImplementations", name)} disabled={isReadOnly}>🗑</button></span></div>
                    <pre>{JSON.stringify(cfg, null, 2)}</pre>
                  </div>
                ))}
              </div>
            )}

            {!loadingScenario && selectedScenario && activeTab === "json" && (
              <div className="mapx-json-wrap">
                <div className="mapx-section-head"><span>{t("mapEditor.jsonDesc")}</span><button className="mapx-btn" onClick={() => {
                  try {
                    const parsed = JSON.parse(jsonText);
                    const pretty = JSON.stringify(parsed, null, 2);
                    setJsonText(pretty);
                    setMapData(ensureMapShape(parsed));
                    setJsonError("");
                  } catch (err) {
                    setJsonError(err?.message || "Invalid JSON");
                  }
                }}>{t("mapEditor.format")}</button></div>
                <textarea className="mapx-json" value={jsonText} onChange={(e) => onJsonChange(e.target.value)} spellCheck={false} />
                {jsonError && <div className="mapx-error">{jsonError}</div>}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
