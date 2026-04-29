// dsl-registry.parsing.ts
// Extracted DSL line parsing: regex constants, utilities, and line handlers

import type { DslRegistryContext } from './dsl-registry.types';
import { compare } from './dsl-registry.execution';

// Shared regex patterns for DSL parsing
export const DSL_PATTERNS = {
  VALUE: '("[^"]*"|\\[[^\\]]+\\])',  // "literal" or [variable]
  VAR: '\\[([^\\]]+)\\]',             // [variable] - captures name
  NUMBER: /^(-?[\d.,]+)\s*(\w+)?$/,   // -10.5 mbar - captures [value, unit]
  OPERATORS: '(>=|<=|>|<|=)',
} as const;

// Pre-compiled regex for DSL commands
export const DSL_REGEX = {
  TASK: new RegExp(`^TASK\\s+\\[([^\\]]+)\\]\\s*${DSL_PATTERNS.VALUE}`, 'i'),
  SET: new RegExp(`^SET\\s+\\[([^\\]]+)\\]\\s*${DSL_PATTERNS.VALUE}`, 'i'),
  WAIT: new RegExp(`^(?:WAIT|TASK\\s+\\[WAIT\\])\\s*${DSL_PATTERNS.VALUE}`, 'i'),
  DIALOG: new RegExp(`^DIALOG\\s+\\[([^\\]]+)\\]\\s*${DSL_PATTERNS.VALUE}`, 'i'),
  OUT: new RegExp(`^OUT\\s+\\[(VAL|MAX|MIN|UNIT|GET|RESULT)\\]\\s*${DSL_PATTERNS.VALUE}`, 'i'),
  IF: new RegExp(`^IF\\s+\\[([^\\]]+)\\]\\s*${DSL_PATTERNS.OPERATORS}?\\s*${DSL_PATTERNS.VALUE}`, 'i'),
  INFO: /^INFO\s+\[(LOG|ALARM|ERROR)\]\s*"([^"]*)"/i,
  FUNC: /^FUNC:\s*(.+)$/i,
  BLOCK_START: /^(GOAL|IF|SET|TASK|OUT|INFO|FUNC|DIALOG|WAIT|ELSE|END)/i,
} as const;

// --- Pure parsing utilities ---

/** Check if value is literal "..." or variable [...] */
export function isLiteral(val: string): boolean {
  return val.trim().startsWith('"');
}

/** Extract inner value from [var] or "literal" */
export function parseValue(val: string): string {
  val = val.trim();
  if ((val.startsWith('[') && val.endsWith(']')) || (val.startsWith('"') && val.endsWith('"'))) {
    return val.slice(1, -1);
  }
  return val;
}

/** Resolve value - get from state if [variable], or return literal value */
export function resolveValue(val: string, state: Map<string, any>): any {
  val = val.trim();
  if (val.startsWith('[') && val.endsWith(']')) {
    const varName = val.slice(1, -1);
    return state.get(varName) ?? varName;
  }
  return val.startsWith('"') ? val.slice(1, -1) : val;
}

/** Parse number with optional unit: "-10.5 mbar" → { value: -10.5, unit: "mbar" } */
export function parseNumber(str: string): { value: number; unit: string } | null {
  const m = String(str).match(DSL_PATTERNS.NUMBER);
  if (!m) return null;
  return { value: parseFloat(m[1].replace(',', '.')), unit: m[2] || '' };
}

/** Convert time string to milliseconds */
export function parseTimeMs(timeStr: string): number {
  const parsed = parseNumber(timeStr);
  if (!parsed) return 0;
  const unit = parsed.unit.toLowerCase();
  if (unit === 'ms') return parsed.value;
  if (unit === 'min') return parsed.value * 60000;
  return parsed.value * 1000; // default seconds
}

// --- Line handlers (internal) ---

async function handleTask(line: string, ctx: DslRegistryContext): Promise<boolean> {
  const m = line.match(DSL_REGEX.TASK);
  if (!m) return false;
  await ctx.executeTask(m[1].trim(), String(resolveValue(m[2], ctx.state)));
  return true;
}

async function handleSet(line: string, ctx: DslRegistryContext): Promise<boolean> {
  const m = line.match(DSL_REGEX.SET);
  if (!m) return false;
  const key = m[1].trim();
  const resolved = String(resolveValue(m[2], ctx.state));
  const parsed = parseNumber(resolved);
  ctx.state.set(key, parsed ? parsed.value : resolved);
  if (/^(wait|delay|timeout|pause)$/i.test(key)) {
    const ms = parseTimeMs(resolved);
    if (ms > 0) await ctx.delay(ms);
  }
  return true;
}

async function handleWait(line: string, ctx: DslRegistryContext): Promise<boolean> {
  const m = line.match(DSL_REGEX.WAIT);
  if (!m) return false;
  const ms = parseTimeMs(String(resolveValue(m[1], ctx.state)));
  if (ms > 0) await ctx.delay(ms);
  return true;
}

async function handleDialog(line: string, ctx: DslRegistryContext): Promise<boolean> {
  const m = line.match(DSL_REGEX.DIALOG);
  if (!m) return false;
  await ctx.executeDialog(m[1].trim(), parseValue(m[2]));
  return true;
}

async function handleOut(line: string, ctx: DslRegistryContext): Promise<boolean> {
  const m = line.match(DSL_REGEX.OUT);
  if (!m) return false;

  const outType = m[1].toUpperCase();
  const rawVal = m[2];
  const literal = isLiteral(rawVal);
  const varName = parseValue(rawVal);
  ctx.log('OUT', `${outType}: ${varName}`);

  const outputs = ctx.state.get('__outputs') || [];
  outputs.push({ type: outType, name: varName, isLiteral: literal });
  ctx.state.set('__outputs', outputs);

  switch (outType) {
    case 'VAL':
      if (!literal) ctx.state.set(`${varName}_result`, await ctx.readParam(varName));
      break;
    case 'MAX':
      if (!literal) ctx.state.set(`${varName}_max`, ctx.state.get(varName));
      break;
    case 'MIN':
      if (!literal) ctx.state.set(`${varName}_min`, ctx.state.get(varName));
      break;
    case 'RESULT':
      ctx.state.set('__result', literal ? varName : (ctx.state.get(varName) ?? varName));
      break;
    case 'GET':
      if (!literal) ctx.state.set(varName, await ctx.readParam(varName));
      break;
    case 'OPT':
      ctx.state.set(`${varName}_opt`, true);
      break;
  }
  return true;
}

async function handleInfo(line: string, ctx: DslRegistryContext): Promise<boolean> {
  const m = line.match(DSL_REGEX.INFO);
  if (!m) return false;
  await ctx.executeCommand(m[1].toUpperCase() as any, m[2]);
  return true;
}

function handleIf(line: string, lines: string[], lineIdx: number, ctx: DslRegistryContext): { handled: boolean; skip: number } {
  const m = line.match(DSL_REGEX.IF);
  if (!m) return { handled: false, skip: 0 };

  const leftVal = ctx.state.get(m[1].trim());
  const rightVal = resolveValue(m[3], ctx.state);
  const op = m[2] || '=';

  const result = compare(leftVal, op, rightVal);
  ctx.log('IF', `[${m[1]}]=${leftVal} ${op} ${rightVal} => ${result}`);

  // Skip block if condition is false
  let skip = 0;
  if (!result) {
    for (let j = lineIdx + 1; j < lines.length; j++) {
      if (lines[j].match(DSL_REGEX.BLOCK_START)) break;
      skip++;
    }
  }
  return { handled: true, skip };
}

async function handleFuncCall(line: string, ctx: DslRegistryContext): Promise<boolean> {
  const m = line.match(DSL_REGEX.FUNC);
  if (!m) return false;
  await ctx.executeFunc(m[1].trim());
  return true;
}

/**
 * Execute FUNC code (DSL lines) - mini interpreter
 */
export async function executeFuncCode(code: string, ctx: DslRegistryContext): Promise<any> {
  const lines = code.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (await handleTask(line, ctx)) continue;
    if (await handleSet(line, ctx)) continue;
    if (await handleWait(line, ctx)) continue;
    if (await handleDialog(line, ctx)) continue;
    if (await handleOut(line, ctx)) continue;
    if (await handleInfo(line, ctx)) continue;

    const ifResult = handleIf(line, lines, i, ctx);
    if (ifResult.handled) { i += ifResult.skip; continue; }

    if (await handleFuncCall(line, ctx)) continue;

    ctx.log('FUNC', `Unknown DSL line: ${line}`);
  }

  return { success: true };
}
