/**
 * copy-ops.ts
 * Clipboard copy operations for protocol steps page.
 * Extracted from protocol-steps.page.ts
 */

import { quoteDslValue as q } from '../../../components/dsl/dsl.quotes';

/** Copy current goal logs to clipboard */
export function copyCurrentGoalLogs(getGoalLogs: (goal: string) => string[], getCurrentGoalName: () => string): void {
  const goal = getCurrentGoalName();
  if (!goal) return;
  const logs = getGoalLogs(goal);
  const text = logs.join('\n');
  try {
    navigator.clipboard.writeText(text).then(() => {
      const btn = document.getElementById('ps-logs-copy');
      if (btn) {
        const orig = btn.textContent;
        btn.textContent = '✅ Skopiowano!';
        setTimeout(() => { btn.textContent = orig || '📋 Kopiuj'; }, 1500);
      }
    });
  } catch {
    // Fallback for older browsers
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch { /* silent */ }
    document.body.removeChild(ta);
  }
}

/** Reconstruct DSL code from current goal steps and copy to clipboard */
export function copyCurrentGoalDsl(
  getCurrentGoalName: () => string,
  getCurrentGoalSteps: () => any[],
): void {
  const goal = getCurrentGoalName();
  if (!goal) return;

  const steps = getCurrentGoalSteps();
  const lines: string[] = [];
  const vars = new Set<string>();
  for (const s of steps) {
    const t = String(s?.type || '').toUpperCase();
    const p = String(s?.parameter || '').trim();
    if (!p) continue;
    if (t === 'SET' || t === 'GET' || t === 'VAL' || t === 'MIN' || t === 'MAX' || t === 'DIALOG') vars.add(p);
  }
  const stripOuter = (v: string): string => {
    const s = String(v || '').trim();
    if (!s) return '';
    if ((s.startsWith('[') && s.endsWith(']')) || (s.startsWith('"') && s.endsWith('"'))) return s.slice(1, -1).trim();
    return s;
  };
  const isVarRef = (v: string): boolean => {
    const s = String(v || '').trim();
    if (!s) return false;
    if (s.startsWith('[') && s.endsWith(']')) return true;
    const inner = stripOuter(s);
    return inner ? vars.has(inner) : false;
  };
  const fmtValue = (v: string, unit?: string): string => {
    const vv = String(v || '').trim();
    const u = String(unit || '').trim();
    if (isVarRef(vv)) {
      const inner = (vv.startsWith('[') && vv.endsWith(']')) ? vv.slice(1, -1) : stripOuter(vv);
      return q(inner);
    }
    const payload = `${stripOuter(vv)}${u ? ' ' + u : ''}`.trim();
    return q(payload);
  };

  lines.push(`GOAL: ${goal}`);
  let depth = 0;
  for (const s of steps) {
    const type = String(s?.type || '').toUpperCase();
    const param = String(s?.parameter || '').trim();
    const value = String(s?.value ?? '').trim();
    const unit = String(s?.unit || '').trim();
    const level = String(s?.level || '').trim();
    const msg = String(s?.message || '').trim();
    const op = String(s?.operator || '=').trim();
    const outType = String(s?.outType || '').toUpperCase().trim();

    let line = '';
    if (type === 'SET') {
      line = `SET ${q(param)} ${fmtValue(value, unit)}`;
    } else if (type === 'DIALOG') {
      line = `DIALOG ${q(param)}${msg ? ` ${q(stripOuter(msg))}` : ''}`;
    } else if (type === 'IF') {
      line = `IF ${q(param)} ${op || '='} ${fmtValue(value, unit)}`;
    } else if (type === 'OR IF') {
      const chunk = `OR IF ${q(param)} ${op || '='} ${fmtValue(value, unit)}`;
      if (lines.length > 0 && /^\s*IF\s+['"]/.test(lines[lines.length - 1])) {
        lines[lines.length - 1] = `${lines[lines.length - 1]} ${chunk}`;
        continue;
      }
      line = chunk;
    } else if (type === 'ELSE') {
      line = 'ELSE';
    } else if (type === 'END' || type === 'END IF' || type === 'ENDIF') {
      line = 'END';
    } else if (type === 'GET') {
      line = unit ? `GET ${q(param)} ${q(unit)}` : `GET ${q(param)}`;
    } else if (type === 'WAIT') {
      const dur = String((s as any)?.duration || value || '1').trim();
      const du = String((s as any)?.unit || '').trim();
      const payload = `${stripOuter(dur)}${du ? ' ' + du : ''}`.trim() || '1 s';
      line = `SET ${q('WAIT')} ${q(payload)}`;
    } else if (type === 'TASK') {
      const fn = String((s as any)?.function || '').trim();
      const obj = String((s as any)?.object || '').trim();
      if (fn) line = `TASK ${q(fn)}${obj ? ` ${q(stripOuter(obj))}` : ''}`;
    } else if (type === 'OUT') {
      line = `OUT ${q(outType || '?')} ${fmtValue(value, unit)}`;
    } else if (type === 'INFO') {
      line = `INFO ${q(level.toUpperCase())} ${q(stripOuter(msg))}`;
    } else {
      line = `${type}${param ? ` ${q(param)}` : ''}${value ? ` ${fmtValue(value, unit)}` : ''}`;
    }

    if (!line) continue;

    const isIf = line.startsWith('IF ');
    const isElse = line === 'ELSE';
    const isEnd = line === 'END';
    const indent = `  ${(!isIf && !isElse && !isEnd && depth > 0) ? '  ' : ''}`;
    lines.push(`${indent}${line}`);
    if (isIf) depth++;
    if (isElse) depth = Math.max(depth, 1);
    if (isEnd) depth = Math.max(0, depth - 1);
  }
  const text = lines.join('\n');

  const doFallback = () => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch { /* silent */ }
    document.body.removeChild(ta);
  };

  try {
    navigator.clipboard.writeText(text).then(() => {
      const btn = document.getElementById('ps-dsl-copy');
      if (btn) {
        const orig = btn.textContent;
        btn.textContent = '✅ Skopiowano!';
        setTimeout(() => { btn.textContent = orig || '📋 Kopiuj DSL'; }, 1500);
      }
    }).catch(() => {
      doFallback();
    });
  } catch {
    doFallback();
  }
}

/** Copy measurements table as JSON to clipboard */
export function copyMeasurementsTableJson(): void {
  try {
    const jsonPre = document.getElementById('ps-measurements-json') as HTMLElement | null;
    if (!jsonPre) return;
    const raw = String(jsonPre.textContent || '').trim();
    if (!raw) return;
    let parsed: any = null;
    try { parsed = JSON.parse(raw); } catch { parsed = null; }
    const payload = parsed && parsed.measurements ? { measurements: parsed.measurements, final_result: parsed.final_result } : parsed;
    const text = JSON.stringify(payload, null, 2);
    navigator.clipboard.writeText(text).then(() => {
      const btn = document.getElementById('ps-copy-measurements-table-json');
      if (btn) {
        const orig = btn.textContent;
        btn.textContent = '✅ Skopiowano!';
        setTimeout(() => { btn.textContent = orig || '📋 Kopiuj tabelę JSON'; }, 1500);
      }
    }).catch(() => {
      const btn = document.getElementById('ps-copy-measurements-table-json');
      if (btn) {
        const orig = btn.textContent;
        btn.textContent = '❌ Błąd';
        setTimeout(() => { btn.textContent = orig || '📋 Kopiuj tabelę JSON'; }, 1500);
      }
    });
  } catch { /* silent */ }
}

/** Copy measurements table as HTML to clipboard */
export function copyMeasurementsTableHtml(): void {
  try {
    const table = document.querySelector('.measurements-preview-section table.measurements-preview-table') as HTMLTableElement | null;
    if (!table) return;
    const wrap = document.createElement('div');
    wrap.style.marginTop = '4px';
    wrap.style.overflowX = 'auto';
    wrap.appendChild(table.cloneNode(true));
    const text = wrap.outerHTML;
    navigator.clipboard.writeText(text).then(() => {
      const btn = document.getElementById('ps-copy-measurements-table-html');
      if (btn) {
        const orig = btn.textContent;
        btn.textContent = '✅ Skopiowano!';
        setTimeout(() => { btn.textContent = orig || '📋 Kopiuj tabelę HTML'; }, 1500);
      }
    }).catch(() => {
      const btn = document.getElementById('ps-copy-measurements-table-html');
      if (btn) {
        const orig = btn.textContent;
        btn.textContent = '❌ Błąd';
        setTimeout(() => { btn.textContent = orig || '📋 Kopiuj tabelę HTML'; }, 1500);
      }
    });
  } catch { /* silent */ }
}
