import { useState, useCallback, useEffect, useRef } from "react";
import { OQL_EXAMPLES } from "../components/oql-examples";
import CodeEditor from "../components/CodeEditor";
import TerminalSim from "../components/TerminalSim";
import OqlStepRenderer from "../components/OqlStepRenderer";
import OqlReportRenderer from "../components/OqlReportRenderer";
import SharedNav from "../components/SharedNav";
import { useAppConfig } from "../context/AppConfigProvider";
import { useI18n } from "../i18n/I18nProvider";
import { useWsStatus } from "../hooks/useWsStatus";
import { ScenariosApi } from "../api/scenariosApi";
import { getWsClient } from "../api/wsClient";

const SAVE_DEBOUNCE_MS = 800;

function pickExampleKey(scenarioId) {
  if (!scenarioId) return "pump-test";
  // Heuristic mapping: use the prefix as the example if we have a matching one.
  const keys = Object.keys(OQL_EXAMPLES);
  const direct = keys.find((k) => scenarioId.toLowerCase().includes(k));
  return direct || keys[0];
}

export default function Scenarios() {
  const { scenario: scenarioId, isReadOnly, isAdmin, patch } = useAppConfig();
  const { t } = useI18n();
  const wsOnline = useWsStatus(true);

  const [activeExample, setActiveExample] = useState(() => pickExampleKey(scenarioId));
  const [viewMode, setViewMode] = useState("graphical");
  const [reportData, setReportData] = useState(null);

  const [activeGoal, setActiveGoal] = useState(null);
  const [activeStep, setActiveStep] = useState(null);
  const [executionStatus, setExecutionStatus] = useState("idle");
  const [lastCommand, setLastCommand] = useState(null);
  const [lastResult, setLastResult] = useState(null);

  const [remoteScenario, setRemoteScenario] = useState(null);
  const [loadStatus, setLoadStatus] = useState("idle"); // idle | loading | ready | error | local
  const [saveStatus, setSaveStatus] = useState("idle"); // idle | saving | saved | error

  const [scenarioCodes, setScenarioCodes] = useState(() => {
    const initial = {};
    Object.keys(OQL_EXAMPLES).forEach((key) => {
      initial[key] = OQL_EXAMPLES[key].code;
    });
    return initial;
  });

  const exampleKeys = Object.keys(OQL_EXAMPLES);
  const currentScenario = remoteScenario
    ? { title: remoteScenario.title || scenarioId || "Remote scenario", lang: "oql", code: remoteScenario.dsl || "" }
    : OQL_EXAMPLES[activeExample];
  const currentCode = remoteScenario
    ? (scenarioCodes[`__remote:${scenarioId}`] ?? (remoteScenario.dsl || ""))
    : scenarioCodes[activeExample];

  // ── Fetch scenario by id from backend ──────────────────────────────────
  useEffect(() => {
    if (!scenarioId) { setRemoteScenario(null); setLoadStatus("idle"); return; }
    let cancelled = false;
    setLoadStatus("loading");
    ScenariosApi.get(scenarioId)
      .then((row) => {
        if (cancelled) return;
        if (row) {
          setRemoteScenario(row);
          setScenarioCodes((prev) => ({ ...prev, [`__remote:${scenarioId}`]: row.dsl || "" }));
          setLoadStatus("ready");
        } else {
          // Not found — fall back to local example keyed by id prefix
          setRemoteScenario(null);
          setActiveExample(pickExampleKey(scenarioId));
          setLoadStatus("local");
        }
      })
      .catch(() => {
        if (cancelled) return;
        setRemoteScenario(null);
        setActiveExample(pickExampleKey(scenarioId));
        setLoadStatus("error");
      });
    return () => { cancelled = true; };
  }, [scenarioId]);

  // ── Subscribe to scenario update events over WS so the iframe reflects
  //    changes pushed from other clients in real time. ─────────────────────
  useEffect(() => {
    if (!scenarioId || !wsOnline) return undefined;
    const client = getWsClient();
    const unsub = client.subscribe("ScenarioUpdated", (evt) => {
      if (!evt?.data || evt.data.scenario_id !== scenarioId) return;
      ScenariosApi.get(scenarioId).then((row) => {
        if (!row) return;
        setRemoteScenario(row);
        setScenarioCodes((prev) => ({ ...prev, [`__remote:${scenarioId}`]: row.dsl || "" }));
      }).catch(() => {/* non-blocking */});
    });
    return unsub;
  }, [scenarioId, wsOnline]);

  // ── Debounced autosave back to backend when editing a remote scenario ──
  const saveTimer = useRef(null);
  const scheduleSave = useCallback((id, dsl) => {
    if (!id || isReadOnly) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveStatus("saving");
    saveTimer.current = setTimeout(async () => {
      try {
        const prevContent = remoteScenario?.content || {};
        await ScenariosApi.saveContent(id, { ...prevContent, dsl });
        setSaveStatus("saved");
      } catch {
        setSaveStatus("error");
      }
    }, SAVE_DEBOUNCE_MS);
  }, [remoteScenario, isReadOnly]);

  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  const handleCodeChange = useCallback((newCode) => {
    if (isReadOnly) return;
    if (remoteScenario && scenarioId) {
      setScenarioCodes((prev) => ({ ...prev, [`__remote:${scenarioId}`]: newCode }));
      scheduleSave(scenarioId, newCode);
    } else {
      setScenarioCodes((prev) => ({ ...prev, [activeExample]: newCode }));
    }
  }, [activeExample, remoteScenario, scenarioId, isReadOnly, scheduleSave]);

  const handleTabChange = useCallback((key) => {
    setActiveExample(key);
    setRemoteScenario(null);
    if (scenarioId) patch({ scenario: "" });
  }, [scenarioId, patch]);

  // ── URL sync for execution state (preserves existing behavior) ─────────
  const updateUrlState = useCallback((goal, step, status) => {
    const params = new URLSearchParams(window.location.search);
    if (goal) params.set("goal", goal); else params.delete("goal");
    if (step) params.set("step", step); else params.delete("step");
    if (status && status !== "idle") params.set("status", status); else params.delete("status");
    const newUrl = `${window.location.pathname}${params.toString() ? "?" + params.toString() : ""}`;
    window.history.replaceState({}, "", newUrl);
  }, []);

  const handleGoalClick = useCallback((goalName) => {
    setActiveGoal(goalName);
    setActiveStep(null);
    setExecutionStatus("running");
    updateUrlState(goalName, null, "running");
    setLastCommand(`GOAL: ${goalName}`);
    setLastResult("Goal selected - waiting for steps...");
    // Broadcast via WS if available so backend simulator can react.
    if (wsOnline && scenarioId) {
      getWsClient()
        .command("StartGoal", { scenario_id: scenarioId, goal: goalName })
        .catch(() => {/* non-blocking */});
    }
  }, [updateUrlState, wsOnline, scenarioId]);

  const handleStepClick = useCallback((stepIndex, stepData) => {
    const stepName = stepData?.command || `step-${stepIndex}`;
    setActiveStep(stepName);
    updateUrlState(activeGoal, stepName, "running");
    setLastCommand(`${stepData?.type || "CMD"}: ${stepData?.raw || stepName}`);
    setLastResult(`Executing ${stepData?.type || "command"}...`);

    if (wsOnline && scenarioId) {
      getWsClient()
        .command("ExecuteStep", {
          scenario_id: scenarioId,
          goal: activeGoal,
          step_index: stepIndex,
          step: stepData,
        })
        .then((result) => {
          setLastResult(`✓ ${result?.message || "Command completed"}`);
          setExecutionStatus("completed");
          updateUrlState(activeGoal, stepName, "completed");
        })
        .catch((err) => {
          setLastResult(`✗ ${err.message}`);
          setExecutionStatus("error");
          updateUrlState(activeGoal, stepName, "error");
        });
    } else {
      setTimeout(() => {
        setLastResult(`✓ ${stepData?.type || "Command"} completed (local sim)`);
        setExecutionStatus("completed");
        updateUrlState(activeGoal, stepName, "completed");
      }, 500);
    }
  }, [activeGoal, updateUrlState, wsOnline, scenarioId]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const goalParam = params.get("goal");
    const stepParam = params.get("step");
    const statusParam = params.get("status");
    if (goalParam) setActiveGoal(goalParam);
    if (stepParam) setActiveStep(stepParam);
    if (statusParam) setExecutionStatus(statusParam);
  }, []);

  const statusBadge = (
    <span className={`cql-status ${wsOnline ? "cql-status--online" : ""}`}>
      {wsOnline ? t("scenarios.connected") : t("scenarios.disconnected")}
    </span>
  );

  return (
    <div className="dashboard">
      <SharedNav />

      <div className="dash-content">
        <div className="section-label" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span>Scenarios</span>
          {statusBadge}
          {scenarioId && (
            <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)", fontSize: "11px" }}>
              #{scenarioId}
            </span>
          )}
          {saveStatus !== "idle" && (
            <span style={{ fontSize: "11px", color: saveStatus === "error" ? "var(--accent-red)" : "var(--text-muted)" }}>
              {saveStatus === "saving" && "…"}
              {saveStatus === "saved" && `✓ ${t("scenarios.saved")}`}
              {saveStatus === "error" && `✗ ${t("scenarios.saveError")}`}
            </span>
          )}
        </div>

        <h2>{t("scenarios.title")}</h2>
        <p className="section-desc">{t("scenarios.subtitle")}</p>

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

        {loadStatus === "loading" && (
          <div style={{ color: "var(--text-muted)", margin: "12px 0" }}>{t("scenarios.loading")}</div>
        )}
        {loadStatus === "error" && (
          <div style={{ color: "var(--accent-red)", margin: "12px 0" }}>{t("scenarios.loadError")}</div>
        )}

        <div className="editor-terminal-container">
          <div className="editor-section">
            {!remoteScenario && (
              <div className="example-tabs role-hidden">
                {exampleKeys.map((k) => (
                  <button
                    key={k}
                    className={`example-tab ${activeExample === k ? "active" : ""}`}
                    onClick={() => handleTabChange(k)}
                    disabled={isReadOnly}
                  >
                    {OQL_EXAMPLES[k].title}
                  </button>
                ))}
              </div>
            )}
            <CodeEditor
              example={currentScenario}
              value={currentCode}
              onChange={handleCodeChange}
              readOnly={isReadOnly}
            />
          </div>
          <TerminalSim scenarioData={currentScenario} code={currentCode} />
        </div>

        {(activeGoal || lastCommand) && (
          <div
            className="execution-status-panel"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-color)",
              borderRadius: "8px",
              padding: "12px 16px",
              marginBottom: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
              <span
                style={{
                  padding: "4px 8px",
                  borderRadius: "4px",
                  fontSize: "12px",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  background:
                    executionStatus === "running" ? "#f59e0b"
                    : executionStatus === "completed" ? "#10b981"
                    : executionStatus === "error" ? "#ef4444"
                    : "#6b7280",
                  color: "white",
                }}
              >
                {executionStatus}
              </span>
              {activeGoal && (
                <span style={{ fontSize: "14px", color: "var(--text-muted)" }}>
                  GOAL: <strong style={{ color: "var(--accent-blue)" }}>{activeGoal}</strong>
                </span>
              )}
              {activeStep && (
                <span style={{ fontSize: "14px", color: "var(--text-muted)" }}>
                  STEP: <strong style={{ color: "var(--accent-purple)" }}>{activeStep}</strong>
                </span>
              )}
            </div>
            {lastCommand && (
              <div
                style={{
                  fontSize: "13px",
                  fontFamily: "monospace",
                  background: "var(--bg-deep)",
                  padding: "8px 12px",
                  borderRadius: "4px",
                  borderLeft: "3px solid var(--accent-blue)",
                }}
              >
                <span style={{ color: "var(--text-muted)" }}>$</span> {lastCommand}
              </div>
            )}
            {lastResult && (
              <div
                style={{
                  fontSize: "13px",
                  color: lastResult.startsWith("✓") ? "#10b981" : "var(--text-muted)",
                  paddingLeft: "12px",
                }}
              >
                {lastResult}
              </div>
            )}
          </div>
        )}

        <div className="oql-view-toggle">
          <button
            className={viewMode === "graphical" ? "active" : ""}
            onClick={() => setViewMode("graphical")}
          >
            {t("scenarios.protocol")}
          </button>
          <button className="active">{t("scenarios.terminal")}</button>
          <button
            className={viewMode === "report" ? "active" : ""}
            onClick={() => setViewMode("report")}
          >
            {t("scenarios.report")}
          </button>
        </div>

        {viewMode === "report" && isAdmin && (
          <div style={{ margin: "12px 0" }}>
            <input
              type="file"
              accept=".json"
              id="report-file-input"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                  try { setReportData(JSON.parse(ev.target.result)); }
                  catch { alert("Invalid JSON file"); }
                };
                reader.readAsText(file);
              }}
            />
            <button
              className="oql-report-export-btn"
              onClick={() => document.getElementById("report-file-input")?.click()}
            >
              {t("scenarios.loadReport")}
            </button>
          </div>
        )}

        {viewMode === "graphical" && (
          <OqlStepRenderer
            scenarioData={currentScenario}
            code={currentCode}
            onGoalClick={handleGoalClick}
            onStepClick={handleStepClick}
            activeGoal={activeGoal}
            activeStep={activeStep}
          />
        )}
        {viewMode === "report" && <OqlReportRenderer data={reportData} />}
      </div>
    </div>
  );
}
