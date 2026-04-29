// frontend/src/components/dsl/dsl.exec.ts
import type { DslAst, DslIfCondition, ExecContext, ExecPlanStep, ExecResult, ParseResult } from './dsl.types';
import { parseDsl } from './dsl.parser';
import { stepHandlers, ExecutionHelpers, ExecutionState, UnitInfo } from './dsl-execution.handlers';

function toNumber(v: any): number | null {
  if (typeof v === 'number' && isFinite(v)) return v;
  if (typeof v === 'string') {
    const m = v.trim().match(/^(-?\d+(?:[\.,]\d+)?)/);
    if (m) {
      const n = Number(m[1].replace(',', '.'));
      if (isFinite(n)) return n;
    }
  }
  return null;
}

function cmp(op: DslIfCondition['operator'], left: any, right: any): boolean | null {
  const ln = toNumber(left);
  const rn = toNumber(right);
  if (ln !== null && rn !== null) {
    switch (op) {
      case '>': return ln > rn;
      case '<': return ln < rn;
      case '=': return ln === rn;
      case '>=': return ln >= rn;
      case '<=': return ln <= rn;
    }
  }
  // fallback for string equality only
  if (op === '=') return String(left) === String(right);
  return null;
}

function normalizeStateKey(name: string): string {
  return String(name || '').trim();
}

function normUnit(u?: string): string | undefined {
  return u ? String(u).trim().toLowerCase() : undefined;
}

const DEFAULT_UNIT_INFO: UnitInfo = { family: null, toBase: 1 };

const UNIT_INFO_BY_CODE: Record<string, UnitInfo> = {
  ms: { family: 'time', toBase: 1e-3 },
  s: { family: 'time', toBase: 1 },
  sec: { family: 'time', toBase: 1 },
  min: { family: 'time', toBase: 60 },
  h: { family: 'time', toBase: 3600 },
  pa: { family: 'pressure', toBase: 1 },
  kpa: { family: 'pressure', toBase: 1e3 },
  mpa: { family: 'pressure', toBase: 1e6 },
  mbar: { family: 'pressure', toBase: 100 },
  bar: { family: 'pressure', toBase: 1e5 },
};

function getUnitInfo(u?: string): UnitInfo {
  const normalized = normUnit(u);
  return (normalized && UNIT_INFO_BY_CODE[normalized]) || DEFAULT_UNIT_INFO;
}

function toBase(num: number, unit?: string): { base: number; family: UnitInfo['family'] } {
  const info = getUnitInfo(unit);
  return { base: num * info.toBase, family: info.family };
}

function getNumericValue(value: any): number | null {
  const num = toNumber(value);
  return num !== null ? num : (typeof value === 'number' ? value : null);
}

type ExecutionAccessors = Pick<ExecutionHelpers, 'getVar' | 'setVar' | 'getVarUnit'>;

function createExecutionAccessors(
  state: Record<string, any>,
  stateUnits: Record<string, string | undefined>,
  ctx: ExecContext | undefined,
): ExecutionAccessors {
  const getVar = (name: string): any => {
    const key = normalizeStateKey(name);
    if (!key) return null;
    if (Object.prototype.hasOwnProperty.call(state, key)) return state[key];
    try {
      return ctx?.getParamValue ? ctx.getParamValue(key) : null;
    } catch {
      return null;
    }
  };

  const setVar = (name: string, rawValue: any, unit?: string): void => {
    const key = normalizeStateKey(name);
    if (!key) return;
    const composed = unit ? `${rawValue} ${unit}` : rawValue;
    const num = toNumber(composed);
    state[key] = num !== null ? num : composed;
    if (unit) stateUnits[key] = normUnit(unit);
  };

  const getVarUnit = (name: string): string | undefined => stateUnits[normalizeStateKey(name)];

  return { getVar, setVar, getVarUnit };
}

function replaceExpressionVariables(expr: string, getVar: ExecutionHelpers['getVar']): string | null {
  let evalExpr = expr;
  const varMatches = expr.matchAll(/\[([^\]]+)\]/g);
  for (const match of varMatches) {
    const varName = match[1].trim();
    const value = getVar(varName);
    const num = toNumber(value);
    if (num === null) return null;
    const escaped = match[0].replace(/[[\]]/g, '\\$&');
    evalExpr = evalExpr.replace(new RegExp(escaped, 'g'), String(num));
  }
  return evalExpr;
}

function normalizeFunctionExpression(expr: string): string {
  return expr
    .replace(/\bABS\s*\(/gi, 'Math.abs(')
    .replace(/\bSQRT\s*\(/gi, 'Math.sqrt(')
    .replace(/\bLOG\s*\(/gi, 'Math.log(')
    .replace(/\bEXP\s*\(/gi, 'Math.exp(')
    .replace(/\bROUND\s*\(/gi, 'Math.round(')
    .replace(/\bPOW\s*\(/gi, 'Math.pow(')
    .replace(/\^/g, '**');
}

function evaluateNumericExpression(expr: string): number | null {
  try {
    const result = Function('"use strict"; return (' + expr + ')')();
    return typeof result === 'number' && isFinite(result) ? result : null;
  } catch {
    return null;
  }
}

function createExpressionEvaluator(getVar: ExecutionHelpers['getVar']): ExecutionHelpers['evaluateFunExpression'] {
  return (expr: string): number | null => {
    const expressionWithValues = replaceExpressionVariables(expr, getVar);
    if (expressionWithValues === null) return null;
    return evaluateNumericExpression(normalizeFunctionExpression(expressionWithValues));
  };
}

function getAggregateBuffer(
  sampleBuffers: Record<string, number[]>,
  input: string,
  getVar: ExecutionHelpers['getVar'],
): number[] {
  const buffer = sampleBuffers[input] || [];
  if (!buffer.length) {
    const value = getVar(input);
    const num = toNumber(value);
    if (num !== null) buffer.push(num);
  }
  return buffer;
}

function calculateAggregateValue(fn: string, buffer: number[]): number | null {
  if (!buffer.length) return null;
  switch (fn.toUpperCase()) {
    case 'AVG': return buffer.reduce((a, b) => a + b, 0) / buffer.length;
    case 'SUM': return buffer.reduce((a, b) => a + b, 0);
    case 'MIN': return Math.min(...buffer);
    case 'MAX': return Math.max(...buffer);
    case 'COUNT': return buffer.length;
    case 'STDDEV': {
      const avg = buffer.reduce((a, b) => a + b, 0) / buffer.length;
      const sqDiffs = buffer.map(v => (v - avg) ** 2);
      return Math.sqrt(sqDiffs.reduce((a, b) => a + b, 0) / buffer.length);
    }
    default: return null;
  }
}

function createAggregateCalculator(
  sampleBuffers: Record<string, number[]>,
  getVar: ExecutionHelpers['getVar'],
): ExecutionHelpers['calcAggregate'] {
  return (fn: string, input: string): number | null => {
    const buffer = getAggregateBuffer(sampleBuffers, input, getVar);
    return calculateAggregateValue(fn, buffer);
  };
}

function createParamResolver(
  getVar: ExecutionHelpers['getVar'],
  getVarUnit: ExecutionHelpers['getVarUnit'],
): ExecutionHelpers['resolveParam'] {
  return (name: string) => {
    const value = getVar(name);
    return { num: getNumericValue(value), unit: getVarUnit(name) };
  };
}

function resolveNamedLiteral(
  value: string,
  getVar: ExecutionHelpers['getVar'],
  getVarUnit: ExecutionHelpers['getVarUnit'],
): { num: number | null; unit?: string } | null {
  const key = normalizeStateKey(value);
  const resolved = getVar(key);
  if (resolved === null || resolved === undefined) return null;
  return { num: getNumericValue(resolved), unit: getVarUnit(key) };
}

function resolveLiteralWithUnit(value: any, unitArg?: string): { num: number | null; unit?: string } | null {
  if (!unitArg) return null;
  const num = toNumber(`${value} ${unitArg}`);
  return { num: num !== null ? num : null, unit: normUnit(unitArg) };
}

function resolveNumericStringLiteral(value: any): { num: number | null; unit?: string } | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  const match = trimmed.match(/^(-?\d+(?:[\.,]\d+)?)\s*([a-zA-Z]+)?$/);
  if (!match) return null;
  const num = Number(match[1].replace(',', '.'));
  return isNaN(num) ? null : { num, unit: normUnit(match[2]) };
}

function createLiteralResolver(
  getVar: ExecutionHelpers['getVar'],
  getVarUnit: ExecutionHelpers['getVarUnit'],
): ExecutionHelpers['resolveLiteral'] {
  return (value: any, unitArg?: string) => {
    if (typeof value === 'string' && value && !unitArg) {
      const namedLiteral = resolveNamedLiteral(value, getVar, getVarUnit);
      if (namedLiteral) return namedLiteral;
    }
    const literalWithUnit = resolveLiteralWithUnit(value, unitArg);
    if (literalWithUnit) return literalWithUnit;
    const numericStringLiteral = resolveNumericStringLiteral(value);
    if (numericStringLiteral) return numericStringLiteral;
    return { num: getNumericValue(value), unit: undefined };
  };
}

function compareWithSameFamily(
  op: DslIfCondition['operator'],
  leftBase: { base: number; family: UnitInfo['family'] },
  rightBase: { base: number; family: UnitInfo['family'] },
): boolean | null {
  if (leftBase.family && rightBase.family && leftBase.family === rightBase.family) {
    return cmp(op, leftBase.base, rightBase.base);
  }
  return null;
}

function compareWithMixedFamily(
  op: DslIfCondition['operator'],
  leftNum: number, leftBase: { base: number; family: UnitInfo['family'] },
  rightNum: number, rightBase: { base: number; family: UnitInfo['family'] },
): boolean | null {
  const family = leftBase.family || rightBase.family;
  if (family) {
    const leftValue = leftBase.family ? leftBase.base : leftNum;
    const rightValue = rightBase.family ? rightBase.base : rightNum;
    return cmp(op, leftValue, rightValue);
  }
  return cmp(op, leftNum, rightNum);
}

function compareWithUnits(
  op: DslIfCondition['operator'],
  left: { num: number | null; unit?: string },
  right: { num: number | null; unit?: string },
): boolean | null {
  if (left.num === null || right.num === null) return null;
  const leftUnit = normUnit(left.unit);
  const rightUnit = normUnit(right.unit);
  if (!leftUnit && !rightUnit) return cmp(op, left.num, right.num);
  if (leftUnit && rightUnit && leftUnit === rightUnit) return cmp(op, left.num, right.num);
  const leftBase = toBase(left.num, leftUnit);
  const rightBase = toBase(right.num, rightUnit);
  const sameFamilyResult = compareWithSameFamily(op, leftBase, rightBase);
  if (sameFamilyResult !== null) return sameFamilyResult;
  return compareWithMixedFamily(op, left.num, leftBase, right.num, rightBase);
}

// Create execution helpers for step handlers
function createExecutionHelpers(
  state: Record<string, any>,
  stateUnits: Record<string, string | undefined>,
  sampleBuffers: Record<string, number[]>,
  ctx: ExecContext | undefined
): ExecutionHelpers {
  const accessors = createExecutionAccessors(state, stateUnits, ctx);
  return {
    ...accessors,
    normUnit,
    getUnitInfo,
    toBase,
    toNumber,
    evaluateFunExpression: createExpressionEvaluator(accessors.getVar),
    calcAggregate: createAggregateCalculator(sampleBuffers, accessors.getVar),
    resolveParam: createParamResolver(accessors.getVar, accessors.getVarUnit),
    resolveLiteral: createLiteralResolver(accessors.getVar, accessors.getVarUnit),
    compareWithUnits,
  };
}

/** Execute DSL AST using handler registry - refactored from CC=217 */
export function executeAst(ast: DslAst, ctx?: ExecContext): ExecResult {
  const plan: ExecPlanStep[] = [];
  const errors: string[] = [];
  const state: Record<string, any> = {};
  const stateUnits: Record<string, string | undefined> = {};
  const sampleBuffers: Record<string, number[]> = {};

  const helpers = createExecutionHelpers(state, stateUnits, sampleBuffers, ctx);
  const execState: ExecutionState = { state, stateUnits, sampleBuffers, plan };

  for (const g of ast.goals) {
    plan.push({ kind: 'goal', name: g.name });

    // Prefer original textual order if available (new step-based format)
    if (Array.isArray((g as any).steps) && (g as any).steps.length) {
      for (const s of (g as any).steps as any[]) {
        const handler = stepHandlers[s?.type];
        if (handler) {
          handler(s, ctx, execState, helpers);
        }
      }
    } else {
      // Fallback: conditions then tasks (legacy format)
      for (const c of g.conditions) {
        const handler = stepHandlers[c.type === 'if' ? 'if' : 'else'];
        if (handler) {
          handler(c, ctx, execState, helpers);
        }
      }
      for (const t of g.tasks) {
        const isPump = String(t.function || '').trim().toUpperCase() === 'PUMP';
        if (isPump) {
          const raw = String(t.object || '').trim();
          plan.push({ kind: 'pump', value: raw.split(/\s+/)[0] || raw, raw });
        } else {
          plan.push({ kind: 'task', task: t });
        }
        try {
          if (ctx?.executeTasks && typeof ctx.runTask === 'function') {
            Promise.resolve(ctx.runTask(t.function, t.object)).catch(() => {});
          }
        } catch { /* silent */ }
      }
    }
  }

  return { ok: errors.length === 0, errors, ast, plan };
}

export function executeDsl(input: string | DslAst, ctx?: ExecContext): ExecResult {
  let parsed: ParseResult | null = null;
  if (typeof input === 'string') {
    parsed = parseDsl(input);
    if (!parsed.ok) {
      return { ok: false, errors: parsed.errors.slice(), ast: parsed.ast, plan: [] };
    }
    return executeAst(parsed.ast, ctx);
  }
  return executeAst(input, ctx);
}
