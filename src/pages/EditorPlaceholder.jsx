import SharedNav from "../components/SharedNav";
import { useAppConfig } from "../context/AppConfigProvider";
import { useI18n } from "../i18n/I18nProvider";
import { useWsStatus } from "../hooks/useWsStatus";

/**
 * Shared shell for the DSL-family editors that were migrated from maskservice
 * to standalone cql routes. Each editor (`dsl-editor`, `func-editor`,
 * `library-editor`, `map-editor`, `scenario-editor`) mounts this component
 * with a distinct `kind` so we show a clear heading and consistent status.
 *
 * The full React re-implementation of each editor will land incrementally
 * under this path; for now we surface the URL contract + live connection
 * indicator so the iframe has a useful placeholder target.
 */
export default function EditorPlaceholder({ kind }) {
  const { scenario, isReadOnly } = useAppConfig();
  const { t } = useI18n();
  const wsOnline = useWsStatus(true);

  const labels = {
    "dsl-editor": { title: "DSL Editor", subtitle: t("editors.dslEditorDesc") },
    "func-editor": { title: "Func Editor", subtitle: t("editors.funcEditorDesc") },
    "library-editor": { title: "Library Editor", subtitle: t("editors.libraryEditorDesc") },
    "map-editor": { title: "Map Editor", subtitle: t("editors.mapEditorDesc") },
    "scenario-editor": { title: "Scenario Editor", subtitle: t("editors.scenarioEditorDesc") },
    "operator-parameters": { title: "Operator Parameters", subtitle: t("editors.operatorParametersDesc") },
  };
  const label = labels[kind] || { title: kind, subtitle: "" };

  return (
    <div className="dashboard">
      <SharedNav />
      <div className="dash-content">
        <div className="section-label" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span>{label.title}</span>
          <span className={`cql-status ${wsOnline ? "cql-status--online" : ""}`}>
            {wsOnline ? t("scenarios.connected") : t("scenarios.disconnected")}
          </span>
          {scenario && (
            <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)", fontSize: 11 }}>
              #{scenario}
            </span>
          )}
        </div>
        <h2>{label.title}</h2>
        <p className="section-desc">{label.subtitle}</p>
        {isReadOnly && (
          <div
            style={{
              padding: "8px 12px",
              margin: "12px 0",
              border: "1px solid var(--accent-amber)",
              background: "rgba(245, 158, 11, 0.1)",
              color: "var(--accent-amber)",
              borderRadius: 6,
              fontSize: 13,
            }}
          >
            {t("role.readonly")}
          </div>
        )}
        <div
          style={{
            border: "1px dashed var(--border-color)",
            borderRadius: 8,
            padding: "48px 24px",
            textAlign: "center",
            color: "var(--text-muted)",
            background: "var(--bg-card)",
          }}
        >
          <p style={{ marginBottom: 12 }}>{t("editors.placeholderHint")}</p>
          <code style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            /{kind}?scenario={scenario || "<id>"}&amp;theme=…&amp;role=…&amp;lang=…
          </code>
        </div>
      </div>
    </div>
  );
}
