// frontend/src/components/dsl/dsl-execution.handlers.ts
// Extracted step handlers for executeAst - reduces CC from 217 to manageable units

import type { DslIfCondition, ExecContext, ExecPlanStep } from './dsl.types';

export interface ExecutionState {
  state: Record<string, any>;
  stateUnits: Record<string, string | undefined>;
  sampleBuffers: Record<string, number[]>;
  plan: ExecPlanStep[];
}

export interface UnitInfo {
  family: 'time' | 'pressure' | null;
  toBase: number;
}

export type StepHandler = (
  step: any,
  ctx: ExecContext | undefined,
  execState: ExecutionState,
  helpers: ExecutionHelpers
) => void;

export interface ExecutionHelpers {
  getVar: (name: string) => any;
  setVar: (name: string, rawValue: any, unit?: string) => void;
  getVarUnit: (name: string) => string | undefined;
  normUnit: (u?: string) => string | undefined;
  getUnitInfo: (u?: string) => UnitInfo;
  toBase: (num: number, unit?: string) => { base: number; family: UnitInfo['family'] };
  toNumber: (v: any) => number | null;
  evaluateFunExpression: (expr: string) => number | null;
  calcAggregate: (fn: string, input: string) => number | null;
  resolveParam: (name: string) => { num: number | null; unit?: string };
  resolveLiteral: (val: any, unit?: string) => { num: number | null; unit?: string };
  compareWithUnits: (op: DslIfCondition['operator'], l: { num: number | null; unit?: string }, r: { num: number | null; unit?: string }) => boolean | null;
}

// Step handler registry
export const stepHandlers: Record<string, StepHandler> = {
  if: handleIfStep,
  else: handleElseStep,
  task: handleTaskStep,
  pump: handlePumpStep,
  func_call: handleFuncCallStep,
  get: handleGetStep,
  set: handleSetStep,
  max: handleMaxStep,
  min: handleMinStep,
  delta_max: handleDeltaMaxStep,
  delta_min: handleDeltaMinStep,
  val: handleValStep,
  wait: handleWaitStep,
  log: handleLogStep,
  alarm: handleAlarmStep,
  error: handleErrorStep,
  save: handleSaveStep,
  user: handleUserStep,
  result: handleResultStep,
  opt: handleOptStep,
  repeat: handleRepeatStep,
  end: handleEndStep,
  out: handleOutStep,
  dialog: handleDialogStep,
  info: handleInfoStep,
  sample: handleSampleStep,
  calc: handleCalcStep,
  fun: handleFunStep,
};

function handleIfStep(s: any, _ctx: ExecContext | undefined, state: ExecutionState, h: ExecutionHelpers): void {
  const lhs = h.resolveParam(s.parameter);
  const rhs = h.resolveLiteral(s.value, s.unit);
  const passed = h.compareWithUnits(s.operator, lhs, rhs);
  state.plan.push({ kind: 'condition', condition: s, passed });
}

function handleElseStep(s: any, _ctx: ExecContext | undefined, state: ExecutionState, _h: ExecutionHelpers): void {
  state.plan.push({ kind: 'else', else: s });
}

function handleTaskStep(s: any, ctx: ExecContext | undefined, state: ExecutionState, _h: ExecutionHelpers): void {
  const t = { function: s.function, object: s.object, ands: s.ands } as any;
  state.plan.push({ kind: 'task', task: t });
  try {
    if (ctx?.executeTasks && typeof ctx.runTask === 'function') {
      Promise.resolve(ctx.runTask(t.function, t.object)).catch(() => {});
    }
  } catch { /* silent */ }
}

function handlePumpStep(s: any, ctx: ExecContext | undefined, state: ExecutionState, _h: ExecutionHelpers): void {
  const raw = s.raw || [s.value, s.unit].filter(Boolean).join(' ').trim();
  state.plan.push({ kind: 'pump', value: s.value, unit: s.unit, raw });
  try {
    if (ctx?.executeTasks && typeof ctx.runTask === 'function') {
      Promise.resolve(ctx.runTask('PUMP', raw)).catch(() => {});
    }
  } catch { /* silent */ }
}

function handleFuncCallStep(s: any, _ctx: ExecContext | undefined, state: ExecutionState, _h: ExecutionHelpers): void {
  state.plan.push({ kind: 'func_call', name: s.name, arguments: s.arguments });
}

function handleGetStep(s: any, ctx: ExecContext | undefined, state: ExecutionState, h: ExecutionHelpers): void {
  const cur = h.getVar(s.parameter);
  if (cur === null || cur === undefined) {
    const v = ctx?.getParamValue ? ctx.getParamValue(s.parameter) : null;
    if (v !== null && v !== undefined) state.state[String(s.parameter).trim()] = v;
  }
  state.plan.push({ kind: 'var', action: 'GET', parameter: s.parameter, value: h.getVar(s.parameter), unit: s.unit });
}

function handleSetStep(s: any, _ctx: ExecContext | undefined, state: ExecutionState, h: ExecutionHelpers): void {
  h.setVar(s.parameter, s.value, s.unit);
  state.plan.push({ kind: 'var', action: 'SET', parameter: s.parameter, value: s.value, unit: s.unit });
  if (['wait', 'delay', 'timeout', 'pause'].includes(String(s.parameter || '').trim().toLowerCase())) {
    state.plan.push({ kind: 'wait', duration: s.value, unit: s.unit });
  }
}

function resolveUnitAwareValue(
  lhs: number | null, lhsUnit: string | undefined,
  rhs: number | null, rhsUnit: string | undefined,
  fn: (a: number, b: number) => number,
  h: ExecutionHelpers,
): number | null {
  if (lhs !== null && rhs !== null) {
    const lb = h.toBase(lhs, lhsUnit);
    const rb = h.toBase(rhs, rhsUnit);
    return (lb.family && rb.family && lb.family === rb.family)
      ? fn(lb.base, rb.base) / h.getUnitInfo(lhsUnit).toBase
      : fn(lhs, rhs);
  }
  return rhs !== null ? rhs : null;
}

function handleMaxStep(s: any, _ctx: ExecContext | undefined, state: ExecutionState, h: ExecutionHelpers): void {
  const key = String(s.parameter || '').trim();
  const lit = h.resolveLiteral(s.value, s.unit);
  const cur = h.resolveParam(key);
  const result = resolveUnitAwareValue(cur.num, cur.unit, lit.num, lit.unit, Math.max, h);
  if (result !== null) state.state[key] = result;
  if (s.unit) state.stateUnits[key] = h.normUnit(s.unit);
  state.plan.push({ kind: 'var', action: 'MAX', parameter: s.parameter, value: state.state[key] ?? s.value, unit: s.unit });
}

function handleMinStep(s: any, _ctx: ExecContext | undefined, state: ExecutionState, h: ExecutionHelpers): void {
  const key = String(s.parameter || '').trim();
  const lit = h.resolveLiteral(s.value, s.unit);
  const cur = h.resolveParam(key);
  const result = resolveUnitAwareValue(cur.num, cur.unit, lit.num, lit.unit, Math.min, h);
  if (result !== null) state.state[key] = result;
  if (s.unit) state.stateUnits[key] = h.normUnit(s.unit);
  state.plan.push({ kind: 'var', action: 'MIN', parameter: s.parameter, value: state.state[key] ?? s.value, unit: s.unit });
}

function handleDeltaMaxStep(s: any, _ctx: ExecContext | undefined, state: ExecutionState, _h: ExecutionHelpers): void {
  state.plan.push({ kind: 'var', action: 'DELTA_MAX', parameter: s.parameter, value: s.value, unit: s.unit, per: s.per });
}

function handleDeltaMinStep(s: any, _ctx: ExecContext | undefined, state: ExecutionState, _h: ExecutionHelpers): void {
  state.plan.push({ kind: 'var', action: 'DELTA_MIN', parameter: s.parameter, value: s.value, unit: s.unit, per: s.per });
}

function handleValStep(s: any, ctx: ExecContext | undefined, state: ExecutionState, h: ExecutionHelpers): void {
  const key = String(s.parameter || '').trim();
  const v = ctx?.getParamValue ? ctx.getParamValue(key) : null;
  if (v !== null && v !== undefined) {
    state.state[key] = h.toNumber(v) ?? v;
    if (s.unit) state.stateUnits[key] = h.normUnit(s.unit);
  }
  state.plan.push({ kind: 'var', action: 'VAL', parameter: s.parameter, value: state.state[key], unit: s.unit });
}

function handleWaitStep(s: any, _ctx: ExecContext | undefined, state: ExecutionState, _h: ExecutionHelpers): void {
  state.plan.push({ kind: 'wait', duration: s.duration, unit: s.unit });
}

function handleLogStep(s: any, _ctx: ExecContext | undefined, state: ExecutionState, _h: ExecutionHelpers): void {
  state.plan.push({ kind: 'message', level: 'LOG', message: s.message });
}

function handleAlarmStep(s: any, _ctx: ExecContext | undefined, state: ExecutionState, _h: ExecutionHelpers): void {
  state.plan.push({ kind: 'message', level: 'ALARM', message: s.message });
}

function handleErrorStep(s: any, _ctx: ExecContext | undefined, state: ExecutionState, _h: ExecutionHelpers): void {
  state.plan.push({ kind: 'message', level: 'ERROR', message: s.message });
}

function handleSaveStep(s: any, _ctx: ExecContext | undefined, state: ExecutionState, _h: ExecutionHelpers): void {
  state.plan.push({ kind: 'save', parameter: s.parameter });
}

function handleUserStep(s: any, _ctx: ExecContext | undefined, state: ExecutionState, _h: ExecutionHelpers): void {
  state.plan.push({ kind: 'user', action: s.action, message: s.message });
}

function handleResultStep(s: any, _ctx: ExecContext | undefined, state: ExecutionState, _h: ExecutionHelpers): void {
  state.plan.push({ kind: 'result', status: s.status });
}

function handleOptStep(s: any, _ctx: ExecContext | undefined, state: ExecutionState, _h: ExecutionHelpers): void {
  state.plan.push({ kind: 'opt', parameter: s.parameter, description: s.description });
}

function handleRepeatStep(_s: any, _ctx: ExecContext | undefined, state: ExecutionState, _h: ExecutionHelpers): void {
  state.plan.push({ kind: 'repeat' });
}

function handleEndStep(_s: any, _ctx: ExecContext | undefined, state: ExecutionState, _h: ExecutionHelpers): void {
  state.plan.push({ kind: 'end' });
}

function handleOutStep(s: any, _ctx: ExecContext | undefined, state: ExecutionState, _h: ExecutionHelpers): void {
  state.plan.push({ kind: 'out', outType: s.outType, value: s.value });
}

function handleDialogStep(s: any, _ctx: ExecContext | undefined, state: ExecutionState, _h: ExecutionHelpers): void {
  state.plan.push({ kind: 'dialog', parameter: s.parameter, message: s.message });
}

function handleInfoStep(s: any, _ctx: ExecContext | undefined, state: ExecutionState, _h: ExecutionHelpers): void {
  state.plan.push({ kind: 'info', level: s.level, message: s.message });
}

function handleSampleStep(s: any, _ctx: ExecContext | undefined, state: ExecutionState, _h: ExecutionHelpers): void {
  const key = String(s.parameter || '').trim();
  if (s.state === 'START') {
    state.sampleBuffers[key] = [];
  }
  // STOP state: values should have been collected
  state.plan.push({ kind: 'sample', parameter: s.parameter, state: s.state, interval: s.interval });
}

function handleCalcStep(s: any, _ctx: ExecContext | undefined, state: ExecutionState, h: ExecutionHelpers): void {
  const key = String(s.result || '').trim();
  const val = h.calcAggregate(s.function, s.input);
  if (val !== null) state.state[key] = val;
  state.plan.push({ kind: 'calc', result: s.result, function: s.function, input: s.input, value: val });
}

function handleFunStep(s: any, _ctx: ExecContext | undefined, state: ExecutionState, h: ExecutionHelpers): void {
  const key = String(s.result || '').trim();
  const val = h.evaluateFunExpression(s.expression);
  if (val !== null) state.state[key] = val;
  state.plan.push({ kind: 'fun', result: s.result, expression: s.expression, value: val });
}
