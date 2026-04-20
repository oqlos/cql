import { useState, useMemo } from 'react';
import './OqlReportRenderer.css';

export default function OqlReportRenderer({ data, dataJson }) {
  const report = useMemo(() => {
    if (data) return data;
    if (dataJson) {
      try { return JSON.parse(dataJson); }
      catch { return null; }
    }
    return null;
  }, [data, dataJson]);

  const [expandedGoal, setExpandedGoal] = useState(0);

  if (!report) {
    return (
      <div className="oql-report">
        <div className="oql-report-empty">
          No report data. Run an OQL scenario to generate data.json.
        </div>
      </div>
    );
  }

  const sc = report.scenario || {};
  const meta = report.metadata || {};
  const goals = report.goals || [];

  return (
    <div className="oql-report">
      <div className="oql-report-header">
        <div className="oql-report-title-row">
          <h2 className="oql-report-title">OQL Test Report</h2>
          <span className={`oql-report-badge ${sc.ok ? 'pass' : 'fail'}`}>
            {sc.ok ? 'PASSED' : 'FAILED'}
          </span>
        </div>
        <div className="oql-report-meta">
          <span>Source: <strong>{sc.source || '—'}</strong></span>
          <span>Duration: <strong>{(sc.duration_ms || 0).toFixed(0)} ms</strong></span>
          <span>Steps: <strong>{sc.passed || 0}/{sc.total || 0}</strong> passed</span>
        </div>
        {(meta.device_type || meta.device_model || meta.manufacturer) && (
          <div className="oql-report-device">
            {meta.device_type && <span className="oql-report-tag">Type: {meta.device_type}</span>}
            {meta.device_model && <span className="oql-report-tag">Model: {meta.device_model}</span>}
            {meta.manufacturer && <span className="oql-report-tag">Mfr: {meta.manufacturer}</span>}
          </div>
        )}
      </div>

      <div className="oql-report-goals">
        {goals.map((goal, gi) => (
          <GoalCard
            key={gi}
            goal={goal}
            index={gi}
            expanded={expandedGoal === gi}
            onToggle={() => setExpandedGoal(expandedGoal === gi ? -1 : gi)}
          />
        ))}
      </div>

      {report.errors?.length > 0 && (
        <div className="oql-report-errors">
          <h3>Errors</h3>
          <ul>{report.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
        </div>
      )}
      {report.warnings?.length > 0 && (
        <div className="oql-report-warnings">
          <h3>Warnings</h3>
          <ul>{report.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
        </div>
      )}

      <div className="oql-report-footer">
        <span>OQLos Report v1</span>
        <button
          className="oql-report-export-btn"
          onClick={() => _downloadJson(report)}
        >
          Export data.json
        </button>
      </div>
    </div>
  );
}

function GoalCard({ goal, index, expanded, onToggle }) {
  const steps = goal.steps || [];
  const thresholds = goal.thresholds || [];
  const passed = steps.filter(s => s.status === 'passed').length;
  const failed = steps.filter(s => s.status === 'failed' || s.status === 'error').length;
  const cls = failed > 0 ? 'fail' : (passed === steps.length && steps.length > 0) ? 'pass' : 'pending';

  return (
    <div className={`oql-report-goal ${cls}`}>
      <div className="oql-report-goal-header" onClick={onToggle}>
        <span className="oql-report-goal-idx">{index + 1}</span>
        <span className="oql-report-goal-name">{goal.name || 'Goal'}</span>
        <span className="oql-report-goal-stats">{passed}/{steps.length}</span>
        <span className="oql-report-goal-chevron">{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div className="oql-report-goal-body">
          {thresholds.length > 0 && (
            <table className="oql-report-thresholds">
              <thead>
                <tr>
                  <th>Parameter</th>
                  <th>Unit</th>
                  <th className="th-min">Min</th>
                  <th className="th-max">Max</th>
                </tr>
              </thead>
              <tbody>
                {thresholds.map((t, i) => (
                  <tr key={i}>
                    <td className="td-param">{t.parameter}</td>
                    <td className="td-unit">{t.unit || '—'}</td>
                    <td className="td-min">{t.min ?? '—'}</td>
                    <td className="td-max">{t.max ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="oql-report-steps">
            <div className="oql-report-steps-header">
              <span className="rsh-idx">#</span>
              <span className="rsh-name">Step</span>
              <span className="rsh-status">Status</span>
              <span className="rsh-val">Value</span>
              <span className="rsh-time">Time</span>
              <span className="rsh-msg">Message</span>
            </div>
            {steps.map((step, si) => (
              <StepRow key={si} step={step} index={si} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StepRow({ step, index }) {
  const statusCls = {
    passed: 'pass', failed: 'fail', error: 'fail',
    skipped: 'skip', warning: 'warn', pending: 'pending',
  }[step.status] || 'pending';
  const icon = {
    passed: '✓', failed: '✗', error: '✗', skipped: '—', warning: '⚠',
  }[step.status] || '·';

  const val = step.value != null ? `${step.value}${step.unit ? ' ' + step.unit : ''}` : '—';

  return (
    <div className={`oql-report-step-row ${statusCls}`}>
      <span className="rs-idx">{index + 1}</span>
      <span className="rs-name">{step.name}</span>
      <span className="rs-status"><span className="rs-icon">{icon}</span> {step.status}</span>
      <span className="rs-val">{val}</span>
      <span className="rs-time">{(step.duration_ms || 0).toFixed(0)}ms</span>
      <span className="rs-msg">
        {step.message || ''}
        {step.pass_message && <span className="msg-pass"> ✓ {step.pass_message}</span>}
        {step.fail_message && <span className="msg-fail"> ✗ {step.fail_message}</span>}
      </span>
    </div>
  );
}

function _downloadJson(report) {
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `oql-report-${(report.scenario?.source || 'data').replace(/[^a-z0-9]/gi, '_')}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
