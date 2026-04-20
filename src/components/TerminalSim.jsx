import { useState, useRef } from "react";

// Parse OQL/IQL code to extract scenario info and steps
function parseScenarioCode(code, scenarioData) {
  const lines = code.split('\n');
  const steps = [];
  let scenarioName = scenarioData?.title || "Scenario";
  let device = "Device";
  
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    
    // Extract SCENARIO name
    const scenarioMatch = trimmed.match(/SCENARIO:\s*"([^"]+)"/);
    if (scenarioMatch) scenarioName = scenarioMatch[1];
    
    // Extract DEVICE_MODEL
    const deviceMatch = trimmed.match(/DEVICE_MODEL:\s*"([^"]+)"/);
    if (deviceMatch) device = deviceMatch[1];
    
    // Parse commands as steps
    if (/^(SET|WAIT|LOG|API|NAVIGATE|CLICK|INPUT|ASSERT|STEP_COMPLETE|RECORD)/.test(trimmed)) {
      steps.push(trimmed);
    }
  });
  
  return { scenarioName, device, steps };
}

function _buildHeaderLines(scenarioName, device, lang) {
  return [
    { text: `$ oqlctl run ${lang === 'TestQL' ? 'test.testql.toon.yaml' : 'test.oql'} --mode dry-run`, type: "cmd" },
    { text: "", type: "blank" },
    { text: `╭─ ${lang} Scenario: ${scenarioName} ─╮`, type: "header" },
    { text: `│  Device: ${device.padEnd(28)} │`, type: "header" },
    { text: "│  Mode:   dry-run (simulated)     │", type: "header" },
    { text: "╰──────────────────────────────────╯", type: "header" },
    { text: "", type: "blank" },
  ];
}

function _buildStepLines(steps) {
  const lines = [];
  lines.push({ text: `▶ Executing ${steps.length} step${steps.length > 1 ? 's' : ''}`, type: "goal" });

  steps.slice(0, 8).forEach((step, idx) => {
    const isLast = idx === steps.length - 1 || idx === 7;
    const prefix = isLast ? "  └─" : "  ├─";
    const shortStep = step.length > 35 ? step.substring(0, 32) + '...' : step;
    lines.push({ text: `${prefix} ${shortStep.padEnd(35)} ✓`, type: "pass" });
  });

  if (steps.length > 8) {
    lines.push({ text: `  ... and ${steps.length - 8} more steps`, type: "info" });
  }

  return lines;
}

function _buildPreviewLines(code) {
  const lines = [{ text: "▶ Code preview:", type: "goal" }];
  const previewLines = code.split('\n').slice(0, 5);

  previewLines.forEach((line, idx) => {
    const isLast = idx === previewLines.length - 1;
    const prefix = isLast ? "  └─" : "  ├─";
    const cleanLine = line.trim() || "(empty line)";
    lines.push({ text: `${prefix} ${cleanLine.substring(0, 35)}`, type: idx % 2 === 0 ? "pass" : "info" });
  });

  return lines;
}

function _buildFooterLines(stepCount) {
  const duration = (2 + stepCount * 0.3).toFixed(2);
  return [
    { text: "", type: "blank" },
    { text: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", type: "divider" },
    { text: `  Result: PASS  │  Steps: ${stepCount || 'ok'}  │  0 errors`, type: "result" },
    { text: `  Duration: ${duration}s (simulated)`, type: "info" },
    { text: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", type: "divider" },
  ];
}

function generateTermLines(scenarioData, code) {
  const { scenarioName, device, steps } = parseScenarioCode(code, scenarioData);
  const lang = scenarioData?.lang === 'iql' ? 'TestQL' : 'OQL';

  const lines = [
    ..._buildHeaderLines(scenarioName, device, lang),
    ...(steps.length > 0 ? _buildStepLines(steps) : _buildPreviewLines(code)),
    ..._buildFooterLines(steps.length),
  ];

  return lines;
}

export default function TerminalSim({ scenarioData, code }) {
  const [lines, setLines] = useState([]);
  const [running, setRunning] = useState(false);
  const termRef = useRef(null);

  const runSim = () => {
    if (running) return;
    
    // Generate dynamic output based on current scenario and code
    const effectiveCode = code || scenarioData?.code || '';
    const termLines = generateTermLines(scenarioData, effectiveCode);
    
    setRunning(true);
    setLines([]);
    let idx = 0;
    const iv = setInterval(() => {
      if (idx < termLines.length) {
        setLines((p) => [...p, termLines[idx]]);
        idx++;
        if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight;
      } else {
        clearInterval(iv);
        setRunning(false);
      }
    }, 180);
  };

  const colorMap = {
    cmd: "#6ee7b7",
    header: "#94a3b8",
    goal: "#f59e0b",
    pass: "#34d399",
    fail: "#f87171",
    result: "#a78bfa",
    info: "#60a5fa",
    divider: "#475569",
    blank: "transparent",
  };

  return (
    <div className="terminal-wrapper">
      <div className="terminal-bar">
        <div className="terminal-dots">
          <span className="dot dot-r" />
          <span className="dot dot-y" />
          <span className="dot dot-g" />
        </div>
        <span className="terminal-title">oqlctl — {scenarioData?.title || 'dry-run simulation'}</span>
        <button className="run-btn" onClick={runSim} disabled={running}>
          {running ? "Running..." : "▶ Run"}
        </button>
      </div>
      <div className="terminal-body" ref={termRef}>
        {lines.length === 0 && (
          <div style={{ color: "#64748b", fontStyle: "italic" }}>
            Click "▶ Run" to simulate an OQL scenario execution…
          </div>
        )}
        {lines.map((l, i) => (
          <div key={i} style={{ color: colorMap[l?.type] || "#cbd5e1", minHeight: "1.4em" }}>
            {l?.text || ""}
          </div>
        ))}
        {running && <span className="cursor-blink">█</span>}
      </div>
    </div>
  );
}
