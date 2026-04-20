import { useState, useMemo, useEffect } from 'react';
import { parseOqlToSteps, collectThresholds, toReportJson } from './parseOqlToSteps';
import './OqlStepRenderer.css';

export default function OqlStepRenderer({ scenarioData, code, onGoalClick, onStepClick, activeGoal, activeStep }) {
  const effectiveCode = code || scenarioData?.code || '';
  const parsed = useMemo(() => parseOqlToSteps(effectiveCode), [effectiveCode]);

  const [activeGoalIdx, setActiveGoalIdx] = useState(0);
  const [activeStepIdx, setActiveStepIdx] = useState(null);

  const goals = parsed.goals;
  const currentGoal = goals[activeGoalIdx] || null;
  const thresholds = currentGoal ? collectThresholds(currentGoal) : [];

  // Sync with external activeGoal prop
  useEffect(() => {
    if (activeGoal) {
      const goalIdx = goals.findIndex(g => g.name === activeGoal);
      if (goalIdx !== -1) {
        setActiveGoalIdx(goalIdx);
      }
    }
  }, [activeGoal, goals]);

  // Sync with external activeStep prop
  useEffect(() => {
    if (activeStep && currentGoal) {
      const stepIdx = currentGoal.steps.findIndex(s => 
        s.command === activeStep || s.raw === activeStep
      );
      if (stepIdx !== -1) {
        setActiveStepIdx(stepIdx);
      }
    }
  }, [activeStep, currentGoal]);

  const handleGoalChange = (idx) => {
    setActiveGoalIdx(idx);
    setActiveStepIdx(null);
    if (onGoalClick && goals[idx]) {
      onGoalClick(goals[idx].name);
    }
  };

  const handleStepClick = (idx) => {
    setActiveStepIdx(idx);
    if (onStepClick && currentGoal?.steps[idx]) {
      onStepClick(idx, currentGoal.steps[idx]);
    }
  };

  if (!goals.length) {
    return (
      <div className="oql-renderer">
        <div className="oql-renderer-empty">
          No GOAL blocks found. Write OQL code with GOAL: sections to see the graphical view.
        </div>
      </div>
    );
  }

  return (
    <div className="oql-renderer">
      <div className="oql-renderer-header">
        <div className="oql-renderer-dots">
          <span className="dot dot-r" />
          <span className="dot dot-y" />
          <span className="dot dot-g" />
        </div>
        <span className="oql-renderer-title">
          {parsed.scenarioName || 'OQL Scenario'} — Protocol View
        </span>
        <button
          className="oql-report-export-btn"
          style={{ marginLeft: 'auto' }}
          onClick={() => {
            const reportData = toReportJson(parsed);
            const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${(parsed.scenarioName || 'scenario').replace(/[^a-z0-9]/gi, '_')}.data.json`;
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          Export data.json
        </button>
      </div>

      {(parsed.deviceModel || parsed.deviceType || parsed.manufacturer) && (
        <div className="oql-meta-bar">
          {parsed.deviceType && <span className="oql-meta-tag">Type: {parsed.deviceType}</span>}
          {parsed.deviceModel && <span className="oql-meta-tag">Model: {parsed.deviceModel}</span>}
          {parsed.manufacturer && <span className="oql-meta-tag">Mfr: {parsed.manufacturer}</span>}
        </div>
      )}

      <div className="oql-steps-topbar">
        <ul className="oql-steps-topbar-list">
          {goals.map((g, i) => (
            <li
              key={i}
              className={i === activeGoalIdx ? 'active' : ''}
              onClick={() => handleGoalChange(i)}
              title={g.name}
              style={{ cursor: 'pointer' }}
            >
              {i + 1}
            </li>
          ))}
        </ul>
      </div>

      {currentGoal && (
        <div className="oql-goal-strip">
          <div className="oql-goal-strip-header">
            <div className="oql-goal-cell name">Goal</div>
            <div className="oql-goal-cell min">Min</div>
            <div className="oql-goal-cell max">Max</div>
            <div className="oql-goal-cell val">Val</div>
            <div className="oql-goal-cell result">Checks</div>
            <div className="oql-goal-cell steps">Steps</div>
          </div>
          <div className="oql-goal-strip-row">
            <div className="oql-goal-cell name">{currentGoal.name}</div>
            <div className="oql-goal-cell min">{currentGoal.min || '—'}</div>
            <div className="oql-goal-cell max">{currentGoal.max || '—'}</div>
            <div className="oql-goal-cell val">{currentGoal.val || '—'}</div>
            <div className="oql-goal-cell result">{currentGoal.steps.filter(s => s.type === 'CHECK').length}</div>
            <div className="oql-goal-cell steps">{currentGoal.steps.filter(s => s.type !== 'COMMENT').length}</div>
          </div>
        </div>
      )}

      <div className="oql-layout">
        <div className="oql-sidebar">
          <div className="oql-sidebar-meta-header">
            <div className="oql-sidebar-cell idx">#</div>
            <div className="oql-sidebar-cell type">Type</div>
            <div className="oql-sidebar-cell param">Parameter</div>
            <div className="oql-sidebar-cell value">Value</div>
          </div>
          <ul className="oql-steps-list">
            {currentGoal && currentGoal.steps.map((step, i) => {
              if (step.type === 'COMMENT') return null;
              const stepNum = currentGoal.steps.slice(0, i).filter(s => s.type !== 'COMMENT').length + 1;
              return (
                <li
                  key={i}
                  className={`oql-step-row ${stepTypeClass(step.type)}${activeStepIdx === i ? ' active' : ''}`}
                  onClick={() => setActiveStepIdx(i)}
                >
                  <div className="oql-sidebar-cell idx">
                    <span className="oql-step-badge">{stepNum}</span>
                  </div>
                  <div className="oql-sidebar-cell type">{stepDisplayType(step.type)}</div>
                  <div className="oql-sidebar-cell param">{step.parameter || ''}</div>
                  <div className="oql-sidebar-cell value">{stepValueDisplay(step)}</div>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="oql-main">
          {thresholds.length > 0 && (
            <div className="oql-thresholds-section">
              <div className="oql-section-label">Thresholds</div>
              <table className="oql-thresholds-table">
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
                      <td className="td-min">{t.min || '—'}</td>
                      <td className="td-max">{t.max || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeStepIdx !== null && currentGoal?.steps[activeStepIdx] && (
            <StepDetail step={currentGoal.steps[activeStepIdx]} />
          )}

          <div className="oql-goal-steps-section">
            <div className="oql-section-label">Commands</div>
            <div className="oql-goal-steps-list">
              {currentGoal && currentGoal.steps.map((step, i) => (
                <div
                  key={i}
                  className={`oql-goal-step ${stepTypeClass(step.type)}${activeStepIdx === i ? ' active' : ''}`}
                  onClick={() => setActiveStepIdx(i)}
                >
                  <span className="step-type">{stepDisplayType(step.type)}</span>
                  {step.type === 'CHECK' && (
                    <>
                      <span className="step-param">{step.parameter}</span>
                      <span className="step-val">{step.min}</span>
                      <span className="step-op">..</span>
                      <span className="step-val">{step.max}</span>
                      {step.unit && <span className="step-unit">{step.unit}</span>}
                    </>
                  )}
                  {step.type !== 'CHECK' && step.parameter && <span className="step-param">'{step.parameter}'</span>}
                  {step.type !== 'CHECK' && step.value && <span className="step-val">'{step.value}{step.unit ? ' ' + step.unit : ''}'</span>}
                  {step.type === 'WAIT' && (
                    <span className="step-unit">{step.value}{step.unit}</span>
                  )}
                  {step.type === 'LOG' && (
                    <span className="step-msg">"{step.message}"</span>
                  )}
                  {step.type === 'FUNC_CALL' && (
                    <>
                      <span className="step-param">"{step.funcName}"</span>
                      {step.args?.map((a, ai) => (
                        <span key={ai} className="step-val">"{a}"</span>
                      ))}
                    </>
                  )}
                  {step.type === 'COMMENT' && (
                    <span className="step-comment">{step.text}</span>
                  )}
                  {step.correctMsg && <span className="step-correct-badge">✓ {step.correctMsg}</span>}
                  {step.errorMsg && <span className="step-error-badge">✗ {step.errorMsg}</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StepDetail({ step }) {
  return (
    <div className="oql-step-detail">
      <div className="oql-section-label">Step Detail</div>
      <div className="oql-detail-grid">
        <div className="oql-detail-row">
          <span className="oql-detail-label">Type</span>
          <span className={`oql-detail-value type-${stepTypeClass(step.type)}`}>{stepDisplayType(step.type)}</span>
        </div>
        {step.parameter && (
          <div className="oql-detail-row">
            <span className="oql-detail-label">Parameter</span>
            <span className="oql-detail-value">{step.parameter}</span>
          </div>
        )}
        {step.value && (
          <div className="oql-detail-row">
            <span className="oql-detail-label">Value</span>
            <span className="oql-detail-value">{step.value}{step.unit ? ` ${step.unit}` : ''}</span>
          </div>
        )}
        {step.min && (
          <div className="oql-detail-row">
            <span className="oql-detail-label">Min</span>
            <span className="oql-detail-value oql-min">{step.min}{step.unit ? ` ${step.unit}` : ''}</span>
          </div>
        )}
        {step.max && (
          <div className="oql-detail-row">
            <span className="oql-detail-label">Max</span>
            <span className="oql-detail-value oql-max">{step.max}{step.unit ? ` ${step.unit}` : ''}</span>
          </div>
        )}
        {step.condition && (
          <div className="oql-detail-row">
            <span className="oql-detail-label">Condition</span>
            <span className="oql-detail-value">{step.parameter} {step.condition} {step.value}</span>
          </div>
        )}
        {step.correctMsg && (
          <div className="oql-detail-row">
            <span className="oql-detail-label">On Pass</span>
            <span className="oql-detail-value oql-ok">✓ {step.correctMsg}</span>
          </div>
        )}
        {step.errorMsg && (
          <div className="oql-detail-row">
            <span className="oql-detail-label">On Fail</span>
            <span className="oql-detail-value oql-err">✗ {step.errorMsg}</span>
          </div>
        )}
        {step.message && (
          <div className="oql-detail-row">
            <span className="oql-detail-label">Message</span>
            <span className="oql-detail-value">{step.message}</span>
          </div>
        )}
        {step.url && (
          <div className="oql-detail-row">
            <span className="oql-detail-label">URL</span>
            <span className="oql-detail-value">{step.url}</span>
          </div>
        )}
        {step.funcName && (
          <div className="oql-detail-row">
            <span className="oql-detail-label">Function</span>
            <span className="oql-detail-value">{step.funcName}</span>
          </div>
        )}
        {step.args?.length > 0 && (
          <div className="oql-detail-row">
            <span className="oql-detail-label">Arguments</span>
            <span className="oql-detail-value">{step.args.join(', ')}</span>
          </div>
        )}
        <div className="oql-detail-row">
          <span className="oql-detail-label">Raw</span>
          <code className="oql-detail-raw">{step.raw}</code>
        </div>
      </div>
    </div>
  );
}

function stepTypeClass(type) {
  const map = {
    SET: 'set', WAIT: 'wait', CHECK: 'if-check',
    SAVE: 'save', LOG: 'log', ASSERT: 'assert',
    API: 'api', EXPECT: 'expect', NAVIGATE: 'navigate', COMMENT: 'comment',
    CORRECT: 'correct', ERROR: 'error', FUNC_CALL: 'func-call',
  };
  return map[type] || 'other';
}

function stepDisplayType(type) {
  if (type === 'CHECK') return 'IF';
  if (type === 'FUNC_CALL') return 'FUNC';
  return type;
}

function stepValueDisplay(step) {
  if (step.type === 'CHECK') {
    const parts = [];
    if (step.min) parts.push(step.min);
    parts.push('..');
    if (step.max) parts.push(step.max);
    if (step.unit) parts.push(step.unit);
    return parts.join(' ');
  }
  if (step.type === 'FUNC_CALL') {
    const argStr = step.args?.length ? ` (${step.args.join(', ')})` : '';
    return `${step.funcName}${argStr}`;
  }
  if (step.type === 'WAIT') return `${step.value}${step.unit}`;
  if (step.value && step.unit) return `${step.value} ${step.unit}`;
  if (step.value) return step.value;
  if (step.message) return step.message;
  return '';
}
