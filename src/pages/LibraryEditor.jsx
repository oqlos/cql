import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import SharedNav from "../components/SharedNav";
import { useAppConfig } from "../context/AppConfigProvider";
import { useI18n } from "../i18n/I18nProvider";
import { useWsStatus } from "../hooks/useWsStatus";
import { LibraryApi } from "../api/libraryApi";
import { ScenariosApi } from "../api/scenariosApi";
import ScenariosList from "../components/ScenariosList";

const DATASETS = ["objects", "functions", "params"];
const SAVE_DEBOUNCE_MS = 800;

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function normalizeLibraryShape(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  return {
    objects: toArray(source.objects),
    functions: toArray(source.functions),
    params: toArray(source.params),
  };
}

function makeLocalId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function LibraryEditor() {
  const { isReadOnly, scenario: scenarioId, patch } = useAppConfig();
  const { t } = useI18n();
  const wsOnline = useWsStatus(true);

  const [activeDataset, setActiveDataset] = useState("objects");
  const [filterName, setFilterName] = useState("");
  const [filterUnits, setFilterUnits] = useState("");
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState("asc");

  const [items, setItems] = useState([]);
  const [loadStatus, setLoadStatus] = useState("idle"); // idle | loading | ready | error
  const [saveStatus, setSaveStatus] = useState("idle"); // idle | saving | saved | error

  const [activeDbId, setActiveDbId] = useState(scenarioId || null);
  const [remoteScenario, setRemoteScenario] = useState(null);
  const [scenarioLibrary, setScenarioLibrary] = useState(() => normalizeLibraryShape(null));

  const [newValue, setNewValue] = useState("");
  const [newUnits, setNewUnits] = useState("");
  const [addStatus, setAddStatus] = useState("idle");
  const saveTimer = useRef(null);

  useEffect(() => {
    setActiveDbId(scenarioId || null);
  }, [scenarioId]);

  useEffect(() => {
    if (!scenarioId) {
      setRemoteScenario(null);
      setScenarioLibrary(normalizeLibraryShape(null));
      setSaveStatus("idle");
      return;
    }

    let cancelled = false;
    setLoadStatus("loading");
    ScenariosApi.get(scenarioId)
      .then((row) => {
        if (cancelled) return;
        if (!row) {
          setRemoteScenario(null);
          setScenarioLibrary(normalizeLibraryShape(null));
          setLoadStatus("error");
          return;
        }
        const rawLibrary = (row.content && row.content.library) || row.library || {};
        setRemoteScenario(row);
        setScenarioLibrary(normalizeLibraryShape(rawLibrary));
        setLoadStatus("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setRemoteScenario(null);
        setScenarioLibrary(normalizeLibraryShape(null));
        setLoadStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [scenarioId]);

  const isScenarioMode = useMemo(() => !!remoteScenario && !!scenarioId, [remoteScenario, scenarioId]);

  const scheduleScenarioSave = useCallback((nextLibrary) => {
    if (!scenarioId || isReadOnly) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveStatus("saving");
    saveTimer.current = setTimeout(async () => {
      try {
        const prevContent = remoteScenario?.content && typeof remoteScenario.content === "object"
          ? remoteScenario.content
          : {};
        await ScenariosApi.update(scenarioId, {
          content: {
            ...prevContent,
            library: nextLibrary,
          },
          library: JSON.stringify(nextLibrary),
        });
        setSaveStatus("saved");
      } catch {
        setSaveStatus("error");
      }
    }, SAVE_DEBOUNCE_MS);
  }, [scenarioId, isReadOnly, remoteScenario]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  // Load items for active dataset (scenario-local or global DSL endpoints)
  useEffect(() => {
    if (isScenarioMode) {
      setItems(scenarioLibrary[activeDataset] || []);
      setLoadStatus("ready");
      return;
    }

    let cancelled = false;
    setLoadStatus("loading");
    const load = async () => {
      try {
        let data = [];
        if (activeDataset === "objects") {
          data = await LibraryApi.listObjects();
        } else if (activeDataset === "functions") {
          data = await LibraryApi.listFunctions();
        } else if (activeDataset === "params") {
          data = await LibraryApi.listParams();
        }
        if (!cancelled) {
          setItems(data);
          setLoadStatus("ready");
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to load library items:", err);
          setItems([]);
          setLoadStatus("error");
        }
      }
    };
    load();
    return () => { cancelled = true; };
  }, [activeDataset, isScenarioMode, scenarioLibrary]);

  // Filter and sort items
  const filteredItems = items.filter(item => {
    const nameMatch = !filterName || (item.name || "").toLowerCase().includes(filterName.toLowerCase());
    let unitsMatch = true;
    if (filterUnits && activeDataset === "params") {
      try {
        const unitsArray = typeof item.units === "string" ? JSON.parse(item.units) : item.units;
        const unitsText = Array.isArray(unitsArray) ? unitsArray.join(", ") : String(item.units || "");
        unitsMatch = unitsText.toLowerCase().includes(filterUnits.toLowerCase());
      } catch {
        unitsMatch = String(item.units || "").toLowerCase().includes(filterUnits.toLowerCase());
      }
    }
    return nameMatch && unitsMatch;
  });

  const sortedItems = [...filteredItems].sort((a, b) => {
    const keyFn = (item) => {
      if (sortKey === "type") return activeDataset;
      if (sortKey === "units") return String(item.units || "");
      return String(item.name || "");
    };
    return keyFn(a).localeCompare(keyFn(b), undefined, { numeric: true, sensitivity: "base" }) * (sortDir === "asc" ? 1 : -1);
  });

  const handleSort = useCallback((key) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }, [sortKey, sortDir]);

  const handleAdd = useCallback(async () => {
    if (!newValue.trim() || isReadOnly) return;
    setAddStatus("loading");

    if (isScenarioMode) {
      const name = newValue.trim();
      const newItem = activeDataset === "functions"
        ? { id: makeLocalId("fn"), name, runtime: "firmware", handler: name }
        : activeDataset === "params"
          ? {
            id: makeLocalId("param"),
            name,
            units: newUnits
              ? newUnits.split(",").map((s) => s.trim()).filter(Boolean)
              : [],
          }
          : { id: makeLocalId("obj"), name };

      setScenarioLibrary((prev) => {
        const next = {
          ...prev,
          [activeDataset]: [...(prev[activeDataset] || []), newItem],
        };
        scheduleScenarioSave(next);
        return next;
      });

      setNewValue("");
      setNewUnits("");
      setAddStatus("saved");
      setTimeout(() => setAddStatus("idle"), 2000);
      return;
    }

    try {
      let id = "";
      if (activeDataset === "objects") {
        id = await LibraryApi.addObject({ name: newValue.trim() });
      } else if (activeDataset === "functions") {
        id = await LibraryApi.addFunction({
          name: newValue.trim(),
          runtime: "firmware",
          handler: newValue.trim(),
        });
      } else if (activeDataset === "params") {
        const unitsArray = newUnits ? newUnits.split(",").map(s => s.trim()).filter(Boolean) : [];
        id = await LibraryApi.addParam({ name: newValue.trim(), units: unitsArray });
      }
      if (id) {
        // Reload items
        let data = [];
        if (activeDataset === "objects") {
          data = await LibraryApi.listObjects();
        } else if (activeDataset === "functions") {
          data = await LibraryApi.listFunctions();
        } else if (activeDataset === "params") {
          data = await LibraryApi.listParams();
        }
        setItems(data);
        setNewValue("");
        setNewUnits("");
        setAddStatus("saved");
        setTimeout(() => setAddStatus("idle"), 2000);
      }
    } catch (err) {
      console.error("Failed to add item:", err);
      setAddStatus("error");
      setTimeout(() => setAddStatus("idle"), 2000);
    }
  }, [activeDataset, newValue, newUnits, isReadOnly, isScenarioMode, scheduleScenarioSave]);

  const handleDelete = useCallback(async (id) => {
    if (!id || isReadOnly) return;
    if (!confirm(t("library.confirmDelete"))) return;

    if (isScenarioMode) {
      setScenarioLibrary((prev) => {
        const next = {
          ...prev,
          [activeDataset]: (prev[activeDataset] || []).filter((item) => item.id !== id),
        };
        scheduleScenarioSave(next);
        return next;
      });
      return;
    }

    try {
      if (activeDataset === "objects") {
        await LibraryApi.deleteObject(id);
      } else if (activeDataset === "functions") {
        await LibraryApi.deleteFunction(id);
      } else if (activeDataset === "params") {
        await LibraryApi.deleteParam(id);
      }
      // Reload items
      let data = [];
      if (activeDataset === "objects") {
        data = await LibraryApi.listObjects();
      } else if (activeDataset === "functions") {
        data = await LibraryApi.listFunctions();
      } else if (activeDataset === "params") {
        data = await LibraryApi.listParams();
      }
      setItems(data);
    } catch (err) {
      console.error("Failed to delete item:", err);
      alert(t("library.deleteError"));
    }
  }, [activeDataset, isReadOnly, t, isScenarioMode, scheduleScenarioSave]);

  const handleSelectFromDb = useCallback((row) => {
    setActiveDbId(row.id);
    patch({ scenario: row.id });
  }, [patch]);

  const handleCreated = useCallback((id) => {
    setActiveDbId(id);
    patch({ scenario: id });
  }, [patch]);

  const formatUnits = (units) => {
    if (!units) return "";
    try {
      const parsed = typeof units === "string" ? JSON.parse(units) : units;
      return Array.isArray(parsed) ? parsed.join(", ") : String(units);
    } catch {
      return String(units);
    }
  };

  const statusBadge = (
    <span className={`cql-status ${wsOnline ? "cql-status--online" : ""}`}>
      {wsOnline ? t("scenarios.connected") : t("scenarios.disconnected")}
    </span>
  );

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <ScenariosList
        activeId={activeDbId}
        onSelect={handleSelectFromDb}
        onCreated={handleCreated}
        onDeleted={(id) => {
          if (activeDbId === id) {
            setActiveDbId(null);
            patch({ scenario: "" });
          }
        }}
      />
      <div className="dashboard" style={{ flex: 1, overflow: "auto" }}>
        <SharedNav />
        <div className="dash-content">
        <div className="section-label" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span>{t("library.title")}</span>
          {statusBadge}
          {scenarioId && (
            <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)", fontSize: "11px" }}>
              #{scenarioId}
            </span>
          )}
          {isScenarioMode && saveStatus !== "idle" && (
            <span style={{ fontSize: "11px", color: saveStatus === "error" ? "var(--accent-red)" : "var(--text-muted)" }}>
              {saveStatus === "saving" && "…"}
              {saveStatus === "saved" && "✓"}
              {saveStatus === "error" && "✗"}
            </span>
          )}
        </div>
        <h2>{t("library.title")}</h2>
        <p className="section-desc">
          {isScenarioMode
            ? `${t("library.subtitle")} (scenario-local)`
            : `${t("library.subtitle")} (global)`}
        </p>

        {isReadOnly && (
          <div
            style={{
              padding: "8px 12px",
              marginBottom: "16px",
              border: "1px solid var(--accent-amber)",
              background: "rgba(245, 158, 11, 0.1)",
              color: "var(--accent-amber)",
              borderRadius: "6px",
              fontSize: "13px",
            }}
          >
            {t("role.readonly")}
          </div>
        )}

        {/* Controls */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
          <select
            value={activeDataset}
            onChange={(e) => { setActiveDataset(e.target.value); setFilterName(""); setFilterUnits(""); }}
            disabled={isReadOnly}
            style={{
              padding: "8px 12px",
              border: "1px solid var(--border-color)",
              borderRadius: "6px",
              background: "var(--bg-card)",
              color: "var(--text)",
            }}
          >
            <option value="objects">{t("library.objects")}</option>
            <option value="functions">{t("library.functions")}</option>
            <option value="params">{t("library.params")}</option>
          </select>

          <input
            type="text"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
            placeholder={t("library.newNamePlaceholder")}
            disabled={isReadOnly}
            style={{
              padding: "8px 12px",
              border: "1px solid var(--border-color)",
              borderRadius: "6px",
              background: "var(--bg-card)",
              color: "var(--text)",
              flex: 1,
              minWidth: "200px",
            }}
          />

          {activeDataset === "params" && (
            <input
              type="text"
              value={newUnits}
              onChange={(e) => setNewUnits(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
              placeholder={t("library.unitsPlaceholder")}
              disabled={isReadOnly}
              style={{
                padding: "8px 12px",
                border: "1px solid var(--border-color)",
                borderRadius: "6px",
                background: "var(--bg-card)",
                color: "var(--text)",
                width: "200px",
              }}
            />
          )}

          <button
            onClick={handleAdd}
            disabled={isReadOnly || !newValue.trim() || addStatus === "loading"}
            style={{
              padding: "8px 16px",
              background: "var(--primary)",
              color: "var(--on-primary)",
              border: "none",
              borderRadius: "6px",
              cursor: isReadOnly || !newValue.trim() ? "not-allowed" : "pointer",
              opacity: isReadOnly || !newValue.trim() ? 0.6 : 1,
            }}
          >
            {addStatus === "loading" ? "…" : addStatus === "saved" ? "✓" : t("library.add")}
          </button>
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
          <input
            type="text"
            value={filterName}
            onChange={(e) => setFilterName(e.target.value)}
            placeholder={t("library.filterNamePlaceholder")}
            style={{
              padding: "8px 12px",
              border: "1px solid var(--border-color)",
              borderRadius: "6px",
              background: "var(--bg-card)",
              color: "var(--text)",
              width: "200px",
            }}
          />

          {activeDataset === "params" && (
            <input
              type="text"
              value={filterUnits}
              onChange={(e) => setFilterUnits(e.target.value)}
              placeholder={t("library.filterUnitsPlaceholder")}
              style={{
                padding: "8px 12px",
                border: "1px solid var(--border-color)",
                borderRadius: "6px",
                background: "var(--bg-card)",
                color: "var(--text)",
                width: "200px",
              }}
            />
          )}
        </div>

        {/* Table */}
        {loadStatus === "loading" && (
          <div style={{ color: "var(--text-muted)", margin: "12px 0" }}>{t("library.loading")}</div>
        )}

        {loadStatus === "error" && (
          <div style={{ color: "var(--accent-red)", margin: "12px 0" }}>{t("library.loadError")}</div>
        )}

        <div style={{ overflowX: "auto", border: "1px solid var(--border-color)", borderRadius: "8px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "600px" }}>
            <thead>
              <tr style={{ background: "var(--bg-muted)" }}>
                <th
                  onClick={() => handleSort("type")}
                  style={{
                    padding: "12px",
                    textAlign: "left",
                    borderBottom: "1px solid var(--border-color)",
                    cursor: "pointer",
                    userSelect: "none",
                  }}
                >
                  {t("library.type")} {sortKey === "type" && (sortDir === "asc" ? "▲" : "▼")}
                </th>
                <th
                  onClick={() => handleSort("name")}
                  style={{
                    padding: "12px",
                    textAlign: "left",
                    borderBottom: "1px solid var(--border-color)",
                    cursor: "pointer",
                    userSelect: "none",
                  }}
                >
                  {t("library.name")} {sortKey === "name" && (sortDir === "asc" ? "▲" : "▼")}
                </th>
                <th
                  onClick={() => handleSort("units")}
                  style={{
                    padding: "12px",
                    textAlign: "left",
                    borderBottom: "1px solid var(--border-color)",
                    cursor: "pointer",
                    userSelect: "none",
                  }}
                >
                  {t("library.units")} {sortKey === "units" && (sortDir === "asc" ? "▲" : "▼")}
                </th>
                <th style={{ padding: "12px", borderBottom: "1px solid var(--border-color)", width: "80px" }}>
                  {t("library.actions")}
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedItems.map((item) => (
                <tr
                  key={item.id}
                  style={{ borderBottom: "1px solid var(--border-color)", background: "var(--bg-card)" }}
                >
                  <td style={{ padding: "12px" }}>{activeDataset}</td>
                  <td style={{ padding: "12px" }}>{item.name || ""}</td>
                  <td style={{ padding: "12px" }}>{formatUnits(item.units)}</td>
                  <td style={{ padding: "12px", textAlign: "right" }}>
                    {!isReadOnly && (
                      <button
                        onClick={() => handleDelete(item.id)}
                        style={{
                          padding: "4px 8px",
                          background: "var(--danger)",
                          color: "var(--on-danger)",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                        }}
                      >
                        {t("library.delete")}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {sortedItems.length === 0 && loadStatus === "ready" && (
          <div style={{ color: "var(--text-muted)", margin: "12px 0", textAlign: "center", padding: "24px" }}>
            {t("library.noItems")}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
