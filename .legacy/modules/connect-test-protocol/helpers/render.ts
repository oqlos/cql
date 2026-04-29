/**
 * protocol-steps.render.ts
 * Rendering functions for thresholds table and goal steps.
 * Extracted from protocol-steps.page.ts
 */

import { escapeHtml } from '../../connect-test/helpers/reports/utils';
import { highlightDsl } from '../../../components/dsl/dsl.highlight';
import { quoteDslValue as q } from '../../../components/dsl/dsl.quotes';

/** Escape HTML entities */
export function esc(s: string): string {
  return escapeHtml(s);
}

/** DSL Runtime state for preview */
export interface DslRuntimeStatePreview {
  result: 'pending' | 'OK' | 'ERROR';
  resultValue?: string;
  resultMax?: string;
  resultMin?: string;
  resultUnit?: string;
}

/** Context for rendering thresholds */
export interface ThresholdsRenderContext {
  getCurrentGoalSteps: () => any[];
  getSteps: () => any[];
  getCurrentStep: () => number;
  getDslRuntimeState?: () => DslRuntimeStatePreview | null;
}

/**
 * Render the thresholds table showing MIN/MAX/VAL for current goal.
 */
export function renderThresholdsTable(ctx: ThresholdsRenderContext): string {
  const steps = ctx.getCurrentGoalSteps();
  if (!steps.length) return '';
  
  // Find VAL, MIN, MAX steps
  const valStep = steps.find((s: any) => String(s?.type || '').toUpperCase() === 'VAL');
  const minStep = steps.find((s: any) => String(s?.type || '').toUpperCase() === 'MIN');
  const maxStep = steps.find((s: any) => String(s?.type || '').toUpperCase() === 'MAX');
  
  if (!valStep && !minStep && !maxStep) return '';
  
  const param = esc(String(valStep?.parameter || minStep?.parameter || maxStep?.parameter || ''));
  const unit = esc(String(valStep?.unit || minStep?.unit || maxStep?.unit || ''));
  const minVal = minStep ? esc(String(minStep.value || '')) : '';
  const maxVal = maxStep ? esc(String(maxStep.value || '')) : '';
  
  // Get current recorded value from step if available
  const idx = ctx.getCurrentStep() - 1;
  const currentStepData = ctx.getSteps()[idx];
  const recordedValue = esc(String(currentStepData?.value || ''));
  
  return `
    <div class="mt-sm thresholds-table-section">
      <table class="thresholds-table" style="width:100%;border-collapse:collapse;background:#1a1a2e;border-radius:6px;overflow:hidden;">
        <thead>
          <tr style="background:#252542;">
            <th style="padding:8px 12px;text-align:left;border-bottom:1px solid #333;color:#888;">Badanie</th>
            <th style="padding:8px 12px;text-align:center;border-bottom:1px solid #333;color:#888;width:80px;">Jedn.</th>
            <th style="padding:8px 12px;text-align:center;border-bottom:1px solid #333;color:#888;width:100px;">Min</th>
            <th style="padding:8px 12px;text-align:center;border-bottom:1px solid #333;color:#888;width:100px;">Max</th>
            <th style="padding:8px 12px;text-align:center;border-bottom:1px solid #333;color:#888;width:120px;">Wartość</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding:8px 12px;color:#fff;">
              <span style="color:#6c8;">📊</span> ${param || 'Parametr'}
            </td>
            <td style="padding:8px 12px;text-align:center;color:#aaa;">${unit}</td>
            <td style="padding:8px 12px;text-align:center;color:#4af;">${minVal}</td>
            <td style="padding:8px 12px;text-align:center;color:#f84;">${maxVal}</td>
            <td style="padding:8px 12px;text-align:center;">
              <input id="ps-value-input-table" type="text" class="form-input" 
                style="width:100%;text-align:center;background:#111;border:1px solid #444;color:#fff;padding:4px 8px;border-radius:4px;" 
                placeholder="${minVal && maxVal ? minVal + ' – ' + maxVal : '0'}" 
                value="${recordedValue}" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    ${renderOutPreview(ctx)}
  `;
}

/**
 * Render preview of DSL OUT values that will be persisted.
 */
function renderOutPreview(ctx: ThresholdsRenderContext): string {
  if (!ctx.getDslRuntimeState) return '';
  
  const state = ctx.getDslRuntimeState();
  if (!state) return '';
  
  // Only show preview if there's any OUT data
  const hasData = state.resultValue !== undefined || 
                  state.resultMin !== undefined || 
                  state.resultMax !== undefined || 
                  state.resultUnit !== undefined ||
                  state.result !== 'pending';
  
  if (!hasData) return '';
  
  const resultColor = state.result === 'OK' ? '#4f4' : state.result === 'ERROR' ? '#f44' : '#888';
  const resultText = state.result === 'OK' ? 'PASSED' : state.result === 'ERROR' ? 'FAILED' : 'Oczekuje...';
  
  return `
    <div class="out-preview mt-sm" style="background:#1a2a1a;border:1px solid #2a4a2a;border-radius:6px;padding:10px 12px;">
      <div style="font-size:11px;color:#6a8;margin-bottom:6px;font-weight:600;">📋 Podgląd danych OUT (do zapisu)</div>
      <div style="display:grid;grid-template-columns:repeat(5, 1fr);gap:8px;font-size:12px;">
        <div style="text-align:center;">
          <div style="color:#666;font-size:10px;">VAL</div>
          <div style="color:#fff;font-weight:500;">${state.resultValue !== undefined ? esc(state.resultValue) : '—'}</div>
        </div>
        <div style="text-align:center;">
          <div style="color:#666;font-size:10px;">MIN</div>
          <div style="color:#4af;">${state.resultMin !== undefined ? esc(state.resultMin) : '—'}</div>
        </div>
        <div style="text-align:center;">
          <div style="color:#666;font-size:10px;">MAX</div>
          <div style="color:#f84;">${state.resultMax !== undefined ? esc(state.resultMax) : '—'}</div>
        </div>
        <div style="text-align:center;">
          <div style="color:#666;font-size:10px;">UNIT</div>
          <div style="color:#aaa;">${state.resultUnit !== undefined ? esc(state.resultUnit) : '—'}</div>
        </div>
        <div style="text-align:center;">
          <div style="color:#666;font-size:10px;">RESULT</div>
          <div style="color:${resultColor};font-weight:600;">${resultText}</div>
        </div>
      </div>
    </div>
  `;
}

function stripOuter(v: string): string {
  const s = String(v || '').trim();
  if (!s) return '';
  if ((s.startsWith('[') && s.endsWith(']')) || (s.startsWith('"') && s.endsWith('"'))) return s.slice(1, -1).trim();
  return s;
}

function collectVarNames(steps: any[]): Set<string> {
  const out = new Set<string>();
  for (const s of steps) {
    const t = String(s?.type || '').toUpperCase();
    const p = String(s?.parameter || '').trim();
    if (!p) continue;
    if (t === 'SET' || t === 'GET' || t === 'VAL' || t === 'MIN' || t === 'MAX' || t === 'DIALOG') out.add(p);
  }
  return out;
}

function fmtValue(value: string, unit: string | undefined, vars: Set<string>): string {
  const raw = String(value || '').trim();
  const u = String(unit || '').trim();
  if (raw.startsWith('"') && raw.endsWith('"')) {
    const inner = raw.slice(1, -1).trim();
    return q(inner);
  }
  if (raw.startsWith('[') && raw.endsWith(']')) {
    const inner = raw.slice(1, -1).trim();
    return q(inner);
  }
  const inner = stripOuter(raw);
  if (inner && vars.has(inner)) return q(inner);
  const payload = `${inner}${u ? ' ' + u : ''}`.trim();
  return q(payload);
}

function stepToDslLine(s: any, vars: Set<string>): string {
  const type = String(s?.type || '').toUpperCase();
  const param = String(s?.parameter || '').trim();
  const value = String(s?.value ?? '').trim();
  const unit = String(s?.unit || '').trim();
  const func = String(s?.function || '').trim();
  const obj = String(s?.object || '').trim();
  const op = String(s?.operator || '=').trim() || '=';
  const outType = String(s?.outType || '').toUpperCase().trim();
  const msg = String(s?.message || '').trim();
  const level = String(s?.level || 'INFO').toUpperCase().trim() || 'INFO';
  const incoming = String((s as any)?.incomingConnector || '').toUpperCase().trim();

  if (type === 'TASK') {
    if (!func && !obj) return '';
    return `TASK ${q(func)}${obj ? ` ${q(stripOuter(obj))}` : ''}`;
  }
  if (type === 'SET') {
    if (!param) return '';
    return `SET ${q(param)} ${fmtValue(value, unit, vars)}`;
  }
  if (type === 'GET') {
    if (!param) return '';
    const u = unit && unit !== '[]' && unit !== '""' ? unit : '';
    return u ? `GET ${q(param)} ${q(u)}` : `GET ${q(param)}`;
  }
  if (type === 'VAL') {
    if (!param) return '';
    const u = unit && unit !== '[]' && unit !== '""' ? unit : '';
    return u ? `VAL ${q(param)} ${q(u)}` : `VAL ${q(param)}`;
  }
  if (type === 'MIN') {
    if (!param) return '';
    return `MIN ${q(param)} ${q(`${stripOuter(value)}${unit ? ` ${unit}` : ''}`)}`;
  }
  if (type === 'MAX') {
    if (!param) return '';
    return `MAX ${q(param)} ${q(`${stripOuter(value)}${unit ? ` ${unit}` : ''}`)}`;
  }
  if (type === 'IF') {
    if (!param) return '';
    const kw = incoming === 'OR' ? 'OR IF' : 'IF';
    return `${kw} ${q(param)} ${op} ${fmtValue(value, unit, vars)}`;
  }
  if (type === 'OR IF') {
    if (!param) return '';
    return `OR IF ${q(param)} ${op} ${fmtValue(value, unit, vars)}`;
  }
  if (type === 'ELSE') return 'ELSE';
  if (type === 'END' || type === 'END IF' || type === 'ENDIF') return 'END';
  if (type === 'OUT') {
    const t = outType || 'RESULT';
    return `OUT ${q(t)} ${fmtValue(value, unit, vars)}`;
  }
  if (type === 'WAIT') {
    const dur = String((s as any)?.duration || value || '1').trim();
    const du = String((s as any)?.unit || '').trim();
    const payload = `${stripOuter(dur)}${du ? ' ' + du : ''}`.trim() || '1 s';
    return `SET ${q('WAIT')} ${q(payload)}`;
  }
  if (type === 'INFO') {
    return `INFO ${q(level)} ${q(stripOuter(msg))}`;
  }
  if (type === 'DIALOG') {
    if (!param) return '';
    return `DIALOG ${q(param)} ${q(stripOuter(msg))}`;
  }
  if (type === 'REPEAT') return 'REPEAT';
  return '';
}

/**
 * Render HTML for goal steps list.
 */
export function renderGoalStepsHtml(getCurrentGoalSteps: () => any[]): string {
  const steps = getCurrentGoalSteps();
  if (!steps.length) return '<div class="text-muted text-sm">Brak zdefiniowanych kroków dla tego GOAL-a</div>';

  const goalName = (getCurrentGoalSteps as any)?.goalName ? String((getCurrentGoalSteps as any).goalName || '').trim() : '';
  const dslLines: string[] = [];
  if (goalName) dslLines.push(`GOAL: ${goalName}`);
  const vars = collectVarNames(steps);
  const baseIndent = goalName ? '  ' : '';
  let depth = 0;
  for (const s of steps) {
    const line = stepToDslLine(s, vars);
    if (!line) continue;

    if (/^OR\s+IF\s+['"]/.test(line) && dslLines.length > 0) {
      const prev = dslLines[dslLines.length - 1] || '';
      if (/^IF\s+['"]/.test(prev.trimStart())) {
        dslLines[dslLines.length - 1] = `${prev} ${line}`;
        continue;
      }
    }

    const isIf = line.startsWith('IF ');
    const isOrIf = line.startsWith('OR IF ');
    const isElse = line === 'ELSE';
    const isEnd = line === 'END';
    const indent = `${baseIndent}${(!isIf && !isOrIf && !isElse && !isEnd && depth > 0) ? '  ' : ''}`;
    dslLines.push(indent ? `${indent}${line}` : line);
    if (isIf) depth++;
    if (isElse) depth = Math.max(depth, 1);
    if (isEnd) depth = Math.max(0, depth - 1);
  }
  const dslText = dslLines.join('\n');
  try {
    return `<pre class="preview-code">${highlightDsl(dslText)}</pre>`;
  } catch {
    return `<pre class="preview-code">${esc(dslText)}</pre>`;
  }
}
