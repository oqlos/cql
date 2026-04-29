// frontend/src/components/dsl/dsl.parser.ts
import type { DslAst, ParseResult } from './dsl.types';
import { getFirstDefined } from './dsl.quotes';
import { normalizeQuotedDslLine } from './dsl.quote-utils';

// ==================== REGEX CONSTANTS ====================
const RX_SCENARIO = /^\s*SCENARIO:\s*(.+)$/i;
const RX_GOAL = /^\s*GOAL:\s*(.+)$/i;
const RX_FUNC = /^\s*FUNC:\s*(.+)$/i;
const RX_TASK = /^\s*TASK\s+(\d+)\s*:\s*$/i;
const RX_TASK_INLINE = /^\s*TASK\s*(?::\s*)?(.+)$/i;
const RX_ACT = /^\s*→\s*([^\["]+?)\s*(?:\[(.+?)\]|"([^"]*)")\s*$/;
const RX_AND = /^\s*AND\s+([^\["]+?)\s*(?:\[(.+?)\]|"([^"]*)")\s*$/i;
const RX_IF_BR = /^\s*IF\s*"([^"]+)"\s*(>=|<=|>|<|=)\s*"([^"]+)"\s*$/i;
const RX_IF_PAR = /^\s*IF\s*"([^"]+)"\s*\((>=|<=|>|<|=)\)\s*"([^"]+)"\s*$/i;
const RX_IF_INFIX = /^\s*IF\s*"([^"]+)"\s*(>=|<=|>|<|=)\s*(?:"([^"]*)"|\[([^\]]+)\])\s*$/i;
const RX_IF_COMPOUND = /^\s*IF\s*"([^"]+)"\s*(>=|<=|>|<|=)\s*"([^"]+)"\s+OR\s+"([^"]+)"\s*(>=|<=|>|<|=)\s*"([^"]+)"\s*$/i;
const RX_IF_COMPOUND_OR_IF = /^\s*IF\s*"([^"]+)"\s*(>=|<=|>|<|=)\s*"([^"]+)"\s+OR\s+IF\s+"([^"]+)"\s*(>=|<=|>|<|=)\s*"([^"]+)"\s*$/i;
const RX_IF_STR = /^\s*IF\s*"([^"]+)"\s*"([^"]*)"/i;
const RX_IF_OP_STR = /^\s*IF\s*"([^"]+)"\s*(>=|<=|>|<|=|!=)\s*"([^"]*)"/i;
const RX_OR_IF = /^\s*OR\s+IF\s*"(.+?)"\s*(>=|<=|>|<|=)?\s*"?([^"]*)"?\s*$/i;
const RX_ELSE = /^\s*ELSE\s+(ERROR|WARNING|INFO|GOAL)\s*\"(.*)\"\s*$/i;
const RX_ELSE_PLAIN = /^\s*ELSE\s*$/i;
const RX_GET = /^\s*GET\s*"([^"]+)"(?:\s*"([^"]+)")?\s*$/i;
const RX_VAL = /^\s*VAL\s*"([^"]+)"(?:\s*"([^"]+)")?\s*$/i;
const RX_SET = /^\s*SET\s*"([^"]+)"\s*"([^"]+)"\s*$/i;
const RX_SET_QUOTED = /^\s*SET\s*"([^"]+)"\s*"([^"]*)"/i;
const RX_MAX = /^\s*MAX\s*"([^"]+)"\s*"([^"]+)"\s*$/i;
const RX_MIN = /^\s*MIN\s*"([^"]+)"\s*"([^"]+)"\s*$/i;
const RX_DELTA_MAX = /^\s*DELTA[_ ]MAX\s*"([^"]+)"\s*"([^"]+)"(?:\s*PER\s*"([^"]+)")?\s*$/i;
const RX_DELTA_MIN = /^\s*DELTA[_ ]MIN\s*"([^"]+)"\s*"([^"]+)"(?:\s*PER\s*"([^"]+)")?\s*$/i;
const RX_WAIT = /^\s*(?:WAIT|SET\s*"(?:WAIT|wait)")\s*"([^"]+)"\s*$/i;
const RX_PUMP = /^\s*(?:PUMP|SET\s*"(?:PUMP|pump|POMPA|pompa)")\s*"([^"]+)"\s*$/i;
const RX_SAMPLE = /^\s*SAMPLE\s*"([^"]+)"\s*"(START|STOP)"(?:\s*"([^"]+)")?\s*$/i;
const RX_CALC = /^\s*CALC\s*"([^"]+)"\s*=\s*"(AVG|SUM|MIN|MAX|COUNT|STDDEV)"\s*"([^"]+)"\s*$/i;
const RX_FUN = /^\s*FUN\s*"([^"]+)"\s*=\s*(.+)\s*$/i;
const RX_LOG = /^\s*LOG\s*"([^"]+)"\s*$/i;
const RX_ALARM = /^\s*ALARM\s*"([^"]+)"\s*$/i;
const RX_ERROR = /^\s*ERROR\s*"([^"]+)"\s*$/i;
const RX_SAVE = /^\s*SAVE\s*"([^"]+)"\s*$/i;
const RX_USER = /^\s*USER\s*"([^"]+)"\s*"([^"]+)"\s*$/i;
const RX_RESULT = /^\s*RESULT\s*"([^"]+)"\s*$/i;
const RX_OPT = /^\s*OPT\s*"([^"]+)"\s*(?:"([^"]+)"|)/i;
const RX_INFO = /^\s*INFO\s*"([^"]+)"\s*(?:"([^"]*)")?/i;
const RX_REPEAT = /^\s*REPEAT\s*$/i;
const RX_END = /^\s*END\s*$/i;
const RX_FUNC_CALL_BR = /^\s*FUNC\s*"([^"]+)"((?:\s*(?:"[^"]+"))*)\s*$/i;
const RX_OUT = /^\s*OUT\s*"([^"]+)"\s*(?:"([^"]*)"|)/i;
const RX_DIALOG = /^\s*DIALOG\s*"([^"]+)"\s*"([^"]*)"/i;

// ==================== HELPER FUNCTIONS ====================

function parseTaskPart(s: string): { function: string; object: string } | null {
  const mk2 = s.match(/^\s*"([^"]+)"\s*"([^"]+)"\s*$/) || s.match(/^\s*\[([^\]]+)\]\s*\[([^\]]+)\]\s*$/);
  if (mk2) return { function: (mk2[1] || '').trim(), object: (mk2[2] || '').trim() };
  const mkQuote = s.match(/^\s*"([^"]+)"\s*"([^"]*)"\s*$/) || s.match(/^\s*\[([^\]]+)\]\s*"([^"]*)"\s*$/);
  if (mkQuote) return { function: (mkQuote[1] || '').trim(), object: (mkQuote[2] || '').trim() };
  const mk = s.match(/^([^\["]+?)(?:\s*(?:\[(.+?)\]|"([^"]*)"))?$/);
  if (mk) return { function: (mk[1] || '').trim(), object: (mk[2] || mk[3] || '').trim() };
  return null;
}

function addError(errors: string[], lineNum: number, msg: string): void {
  errors.push(`Linia ${lineNum}: ${msg}`);
}

// ==================== LINE PARSERS ====================

function parseGoalLine(m: RegExpMatchArray, ast: DslAst, state: { curGoal: any; curFunc: any; curTask: any }): boolean {
  state.curGoal = { name: m[1].trim(), tasks: [], conditions: [], steps: [] };
  ast.goals.push(state.curGoal);
  state.curFunc = null;
  state.curTask = null;
  return true;
}

function parseFuncLine(ln: string, m: RegExpMatchArray, ast: DslAst, state: { curGoal: any; curFunc: any; curTask: any }): boolean {
  const indent = ln.search(/\S/);
  if (indent > 0 && state.curGoal) {
    const step = { type: 'func_call', name: m[1].trim() };
    if (state.curGoal.steps) state.curGoal.steps.push(step);
    return true;
  }
  state.curFunc = { name: m[1].trim(), tasks: [], steps: [] };
  ast.funcs!.push(state.curFunc);
  state.curGoal = null;
  state.curTask = null;
  return true;
}

function parseFuncCallLine(m: RegExpMatchArray, curGoal: any, curFunc: any, errors: string[], lineNum: number): boolean {
  const curBlock = curGoal || curFunc;
  if (!curBlock) { addError(errors, lineNum, 'FUNC call bez GOAL/FUNC'); return false; }
  const funcName = m[1].trim();
  const argsRaw = m[2] || '';
  const args: string[] = [];
  const argMatches = argsRaw.matchAll(/"([^"]+)"|\[([^\]]+)\]/g);
  for (const am of argMatches) args.push((am[1] || am[2] || '').trim());
  const step = { type: 'func_call', name: funcName, arguments: args };
  if (curBlock.steps) curBlock.steps.push(step);
  return true;
}

function parseTaskInlineLine(m: RegExpMatchArray, curGoal: any, curFunc: any, errors: string[], lineNum: number): boolean {
  const curBlock = curGoal || curFunc;
  if (!curBlock) { addError(errors, lineNum, 'TASK bez GOAL/FUNC'); return false; }
  const body = m[1];
  const taskQuoted = body.match(/^\s*\[([^\]]+)\]\s*"([^"]*)"\s*$/);
  if (taskQuoted) {
    const action = taskQuoted[1].trim();
    const value = taskQuoted[2].trim();
    if (action.toUpperCase() === 'WAIT') {
      const step = { type: 'wait', duration: value };
      if (curBlock.steps) curBlock.steps.push(step);
      return true;
    }
    const t = { function: action, object: value, ands: [] };
    curBlock.tasks.push(t); if (curBlock.steps) curBlock.steps.push({ type: 'task', ...t }); return true;
  }
  const parts = body.split(/\bAND\b/i).map(s => s.trim()).filter(Boolean);
  if (!parts.length) { addError(errors, lineNum, 'Pusta definicja TASK'); return false; }
  const first = parseTaskPart(parts[0]);
  if (!first) { addError(errors, lineNum, 'Nieprawidłowa akcja w TASK'); return false; }
  const t = { function: first.function, object: first.object, ands: [] as any[] };
  for (let k = 1; k < parts.length; k++) {
    const mk = parseTaskPart(parts[k]);
    if (mk) t.ands.push({ function: mk.function, object: mk.object });
    else addError(errors, lineNum, 'Nieprawidłowa składnia AND');
  }
  curBlock.tasks.push(t); if (curBlock.steps) curBlock.steps.push({ type: 'task', ...t }); return true;
}

function parseActLine(m: RegExpMatchArray, curGoal: any, curFunc: any, errors: string[], lineNum: number, state: { curTask: any }): boolean {
  const curBlock = curGoal || curFunc;
  if (!curBlock) { addError(errors, lineNum, 'Akcja bez GOAL/FUNC'); return false; }
  const t = { function: m[1].trim(), object: getFirstDefined(m[2], m[3]).trim(), ands: [] };
  curBlock.tasks.push(t); if (curBlock.steps) curBlock.steps.push({ type: 'task', ...t }); state.curTask = t; return true;
}

function parseAndLine(m: RegExpMatchArray, curTask: any, errors: string[], lineNum: number): boolean {
  if (!curTask) { addError(errors, lineNum, 'AND bez poprzedniej akcji'); return false; }
  curTask.ands.push({ function: m[1].trim(), object: getFirstDefined(m[2], m[3]).trim() }); return true;
}

function parseIfCompoundOrIfLine(m: RegExpMatchArray, curGoal: any, curFunc: any, errors: string[], lineNum: number): boolean {
  const curBlock = curGoal || curFunc;
  if (!curBlock) { addError(errors, lineNum, 'IF bez GOAL/FUNC'); return false; }
  const c1 = { type: 'if', parameter: m[1].trim(), operator: m[2], value: m[3].trim(), connector: 'OR' };
  if (curGoal) curGoal.conditions.push(c1);
  if (curBlock.steps) curBlock.steps.push(c1);
  const c2 = { type: 'if', parameter: m[4].trim(), operator: m[5], value: m[6].trim(), incomingConnector: 'OR' };
  if (curGoal) curGoal.conditions.push(c2);
  if (curBlock.steps) curBlock.steps.push(c2);
  return true;
}

function parseIfCompoundLine(m: RegExpMatchArray, curGoal: any, curFunc: any, errors: string[], lineNum: number): boolean {
  const curBlock = curGoal || curFunc;
  if (!curBlock) { addError(errors, lineNum, 'IF bez GOAL/FUNC'); return false; }
  const c1 = { type: 'if', parameter: m[1].trim(), operator: m[2], value: m[3].trim(), connector: 'OR' };
  if (curGoal) curGoal.conditions.push(c1);
  if (curBlock.steps) curBlock.steps.push(c1);
  const c2 = { type: 'if', parameter: m[4].trim(), operator: m[5], value: m[6].trim(), incomingConnector: 'OR' };
  if (curGoal) curGoal.conditions.push(c2);
  if (curBlock.steps) curBlock.steps.push(c2);
  return true;
}

function parseIfOpStrLine(m: RegExpMatchArray, curGoal: any, curFunc: any, errors: string[], lineNum: number): boolean {
  const curBlock = curGoal || curFunc;
  if (!curBlock) { addError(errors, lineNum, 'IF bez GOAL/FUNC'); return false; }
  const c = { type: 'if', parameter: m[1].trim(), operator: m[2], value: m[3].trim() };
  if (curGoal) curGoal.conditions.push(c);
  if (curBlock.steps) curBlock.steps.push(c);
  return true;
}

function parseIfStrLine(m: RegExpMatchArray, curGoal: any, curFunc: any, errors: string[], lineNum: number): boolean {
  const curBlock = curGoal || curFunc;
  if (!curBlock) { addError(errors, lineNum, 'IF bez GOAL/FUNC'); return false; }
  const c = { type: 'if', parameter: m[1].trim(), operator: '=', value: m[2].trim() };
  if (curGoal) curGoal.conditions.push(c);
  if (curBlock.steps) curBlock.steps.push(c);
  return true;
}

function parseOrIfLine(m: RegExpMatchArray, curGoal: any, curFunc: any, errors: string[], lineNum: number): boolean {
  const curBlock = curGoal || curFunc;
  if (!curBlock) { addError(errors, lineNum, 'OR IF bez GOAL/FUNC'); return false; }
  const op = m[2] || '=';
  const val = m[3] ? m[3].trim() : '';
  const c = { type: 'if', parameter: m[1].trim(), operator: op, value: val, incomingConnector: 'OR' };
  if (curBlock.steps && curBlock.steps.length > 0) {
    const prev = curBlock.steps[curBlock.steps.length - 1];
    if (prev && prev.type === 'if') prev.connector = 'OR';
  }
  if (curGoal) curGoal.conditions.push(c);
  if (curBlock.steps) curBlock.steps.push(c);
  return true;
}

function parseIfStandardLine(m: RegExpMatchArray, curGoal: any, curFunc: any): boolean {
  const curBlock = curGoal || curFunc;
  if (!curBlock) return false;
  const c = { type: 'if', parameter: m[1].trim(), operator: m[2], value: m[3].trim() };
  if (curGoal) curGoal.conditions.push(c);
  if (curBlock.steps) curBlock.steps.push(c);
  return true;
}

function parseElseLine(m: RegExpMatchArray, curGoal: any, curFunc: any, errors: string[], lineNum: number): boolean {
  const curBlock = curGoal || curFunc;
  if (!curBlock) { addError(errors, lineNum, 'ELSE bez GOAL/FUNC'); return false; }
  const c = { type: 'else', actionType: m[1].toUpperCase(), actionMessage: m[2] };
  if (curGoal) curGoal.conditions.push(c);
  if (curBlock.steps) curBlock.steps.push(c);
  return true;
}

function parseElsePlainLine(curGoal: any, curFunc: any, errors: string[], lineNum: number): boolean {
  const curBlock = curGoal || curFunc;
  if (!curBlock) { addError(errors, lineNum, 'ELSE bez GOAL/FUNC'); return false; }
  const c = { type: 'else' };
  if (curGoal) curGoal.conditions.push(c);
  if (curBlock.steps) curBlock.steps.push(c);
  return true;
}

function createParamStep(type: string, m: RegExpMatchArray, curGoal: any, curFunc: any, errors: string[], lineNum: number): boolean {
  const curBlock = curGoal || curFunc;
  if (!curBlock) { addError(errors, lineNum, `${type.toUpperCase()} bez GOAL/FUNC`); return false; }
  const step: any = { type, parameter: m[1].trim() };
  const unit = (m[2] || '').trim(); if (unit) step.unit = unit;
  if (curBlock.steps) curBlock.steps.push(step);
  return true;
}

function parseSetQuotedLine(m: RegExpMatchArray, curGoal: any, curFunc: any, errors: string[], lineNum: number): boolean {
  const curBlock = curGoal || curFunc;
  if (!curBlock) { addError(errors, lineNum, 'SET bez GOAL/FUNC'); return false; }
  const step = { type: 'set', parameter: m[1].trim(), value: m[2].trim() };
  if (curBlock.steps) curBlock.steps.push(step);
  return true;
}

function parseSetLine(m: RegExpMatchArray, curGoal: any, curFunc: any, errors: string[], lineNum: number): boolean {
  const curBlock = curGoal || curFunc;
  if (!curBlock) { addError(errors, lineNum, 'SET bez GOAL/FUNC'); return false; }
  const inside = (m[2] || '').trim();
  const parts = inside.split(/\s+/);
  const value = parts[0] || '';
  const unit = parts.slice(1).join(' ');
  const step: any = { type: 'set', parameter: m[1].trim(), value };
  if (unit) step.unit = unit;
  if (curBlock.steps) curBlock.steps.push(step);
  return true;
}

function parseLimitLine(type: 'max' | 'min', m: RegExpMatchArray, curGoal: any, curFunc: any, errors: string[], lineNum: number): boolean {
  const curBlock = curGoal || curFunc;
  if (!curBlock) { addError(errors, lineNum, `${type.toUpperCase()} bez GOAL/FUNC`); return false; }
  const inside = (m[2] || '').trim();
  const parts = inside.split(/\s+/);
  const value = parts[0] || '';
  const unit = parts.slice(1).join(' ');
  const step: any = { type, parameter: m[1].trim(), value };
  if (unit) step.unit = unit;
  if (curBlock.steps) curBlock.steps.push(step);
  return true;
}

function parseDeltaLine(type: 'delta_max' | 'delta_min', m: RegExpMatchArray, curGoal: any, curFunc: any, errors: string[], lineNum: number): boolean {
  const curBlock = curGoal || curFunc;
  if (!curBlock) { addError(errors, lineNum, `${type.toUpperCase().replace('_', '_')} bez GOAL/FUNC`); return false; }
  const inside = (m[2] || '').trim();
  const parts = inside.split(/\s+/);
  const value = parts[0] || '';
  const unit = parts.slice(1).join(' ');
  const per = (m[3] || '').trim();
  const step: any = { type, parameter: m[1].trim(), value };
  if (unit) step.unit = unit;
  if (per) step.per = per;
  if (curBlock.steps) curBlock.steps.push(step);
  return true;
}

function parseWaitLine(m: RegExpMatchArray, curGoal: any, curFunc: any, errors: string[], lineNum: number): boolean {
  const curBlock = curGoal || curFunc;
  if (!curBlock) { addError(errors, lineNum, 'WAIT bez GOAL/FUNC'); return false; }
  const dur = (m[1] || '').trim();
  const durParts = dur.split(/\s+/);
  const step: any = { type: 'wait', duration: durParts[0] || dur };
  if (durParts[1]) step.unit = durParts.slice(1).join(' ');
  if (curBlock.steps) curBlock.steps.push(step);
  return true;
}

function parsePumpLine(m: RegExpMatchArray, curGoal: any, curFunc: any, errors: string[], lineNum: number): boolean {
  const curBlock = curGoal || curFunc;
  if (!curBlock) { addError(errors, lineNum, 'PUMP bez GOAL/FUNC'); return false; }
  const raw = (m[1] || '').trim();
  const parts = raw.split(/\s+/);
  const step: any = { type: 'pump', raw, value: parts[0] || raw };
  if (parts[1]) step.unit = parts.slice(1).join(' ');
  if (curBlock.steps) curBlock.steps.push(step);
  return true;
}

function parseSampleLine(m: RegExpMatchArray, curGoal: any, errors: string[], lineNum: number): boolean {
  if (!curGoal) { addError(errors, lineNum, 'SAMPLE bez GOAL'); return false; }
  const step: any = { type: 'sample', parameter: m[1].trim(), state: m[2].toUpperCase() };
  if (m[3]) step.interval = m[3].trim();
  if (curGoal.steps) curGoal.steps.push(step);
  return true;
}

function parseCalcLine(m: RegExpMatchArray, curGoal: any, errors: string[], lineNum: number): boolean {
  if (!curGoal) { addError(errors, lineNum, 'CALC bez GOAL'); return false; }
  const step = { type: 'calc', result: m[1].trim(), function: m[2].toUpperCase(), input: m[3].trim() };
  if (curGoal.steps) curGoal.steps.push(step);
  return true;
}

function parseFunLine(m: RegExpMatchArray, curGoal: any, errors: string[], lineNum: number): boolean {
  if (!curGoal) { addError(errors, lineNum, 'FUN bez GOAL'); return false; }
  const result = m[1].trim();
  const expr = m[2].trim();
  const vars: string[] = [];
  const varMatches = expr.matchAll(/"([^"]+)"|\[([^\]]+)\]/g);
  for (const vm of varMatches) vars.push((vm[1] || vm[2]).trim());
  const step = { type: 'fun', result, expression: expr, variables: vars };
  if (curGoal.steps) curGoal.steps.push(step);
  return true;
}

function parseSimpleLine(type: string, m: RegExpMatchArray, curGoal: any, curFunc: any, errors: string[], lineNum: number): boolean {
  const curBlock = curGoal || curFunc;
  if (!curBlock) { addError(errors, lineNum, `${type.toUpperCase()} bez GOAL/FUNC`); return false; }
  const step: any = { type, message: m[1].trim() };
  if (curBlock.steps) curBlock.steps.push(step);
  return true;
}

function parseSaveLine(m: RegExpMatchArray, curGoal: any, curFunc: any, errors: string[], lineNum: number): boolean {
  const curBlock = curGoal || curFunc;
  if (!curBlock) { addError(errors, lineNum, 'SAVE bez GOAL/FUNC'); return false; }
  const step = { type: 'save', parameter: m[1].trim() };
  if (curBlock.steps) curBlock.steps.push(step);
  return true;
}

function parseUserLine(m: RegExpMatchArray, curGoal: any, curFunc: any, errors: string[], lineNum: number): boolean {
  const curBlock = curGoal || curFunc;
  if (!curBlock) { addError(errors, lineNum, 'USER bez GOAL/FUNC'); return false; }
  const step = { type: 'user', action: m[1].trim(), message: m[2].trim() };
  if (curBlock.steps) curBlock.steps.push(step);
  return true;
}

function parseResultLine(m: RegExpMatchArray, curGoal: any, curFunc: any, errors: string[], lineNum: number): boolean {
  const curBlock = curGoal || curFunc;
  if (!curBlock) { addError(errors, lineNum, 'RESULT bez GOAL/FUNC'); return false; }
  const step = { type: 'result', status: m[1].trim() };
  if (curBlock.steps) curBlock.steps.push(step);
  return true;
}

function parseOptLine(m: RegExpMatchArray, curGoal: any, curFunc: any, errors: string[], lineNum: number): boolean {
  const curBlock = curGoal || curFunc;
  if (!curBlock) { addError(errors, lineNum, 'OPT bez GOAL/FUNC'); return false; }
  const desc = (m[2] || m[3] || '').trim();
  const step = { type: 'opt', parameter: m[1].trim(), description: desc };
  if (curBlock.steps) curBlock.steps.push(step);
  return true;
}

function parseInfoLine(m: RegExpMatchArray, curGoal: any, curFunc: any, errors: string[], lineNum: number): boolean {
  const curBlock = curGoal || curFunc;
  if (!curBlock) { addError(errors, lineNum, 'INFO bez GOAL/FUNC'); return false; }
  const msg = (m[2] || m[3] || '').trim();
  const step = { type: 'info', level: m[1].trim().toUpperCase(), message: msg };
  if (curBlock.steps) curBlock.steps.push(step);
  return true;
}

function parseRepeatLine(curGoal: any, curFunc: any, errors: string[], lineNum: number): boolean {
  const curBlock = curGoal || curFunc;
  if (!curBlock) { addError(errors, lineNum, 'REPEAT bez GOAL/FUNC'); return false; }
  const step = { type: 'repeat' };
  if (curBlock.steps) curBlock.steps.push(step);
  return true;
}

function parseEndLine(curGoal: any, curFunc: any, errors: string[], lineNum: number): boolean {
  const curBlock = curGoal || curFunc;
  if (!curBlock) { addError(errors, lineNum, 'END bez GOAL/FUNC'); return false; }
  const step = { type: 'end' };
  if (curBlock.steps) curBlock.steps.push(step);
  return true;
}

function parseOutLine(m: RegExpMatchArray, curGoal: any, curFunc: any, errors: string[], lineNum: number): boolean {
  const curBlock = curGoal || curFunc;
  if (!curBlock) { addError(errors, lineNum, 'OUT bez GOAL/FUNC'); return false; }
  const outType = m[1].trim().toUpperCase();
  const outVal = (m[2] || m[3] || '').trim();
  const step = { type: 'out', outType, value: outVal };
  if (curBlock.steps) curBlock.steps.push(step);
  return true;
}

function parseDialogLine(m: RegExpMatchArray, curGoal: any, curFunc: any, errors: string[], lineNum: number): boolean {
  const curBlock = curGoal || curFunc;
  if (!curBlock) { addError(errors, lineNum, 'DIALOG bez GOAL/FUNC'); return false; }
  const step = { type: 'dialog', parameter: m[1].trim(), message: m[2].trim() };
  if (curBlock.steps) curBlock.steps.push(step);
  return true;
}

// ==================== MAIN PARSER ====================

export function parseDsl(text: string): ParseResult {
  const errors: string[] = [];
  const lines = (text || '').split(/\r?\n/);
  const ast: DslAst = { scenario: '', goals: [], funcs: [] };
  const state = { curGoal: null as any, curFunc: null as any, curTask: null as any };
  let m: RegExpMatchArray | null;

  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    if (!ln.trim()) continue;
    const normalizedLn = normalizeQuotedDslLine(ln);

    if ((m = normalizedLn.match(RX_SCENARIO))) { ast.scenario = m[1].trim(); continue; }
    if ((m = normalizedLn.match(RX_GOAL))) { parseGoalLine(m, ast, state); continue; }
    if ((m = normalizedLn.match(RX_FUNC))) { parseFuncLine(ln, m, ast, state); continue; }
    if ((m = normalizedLn.match(RX_FUNC_CALL_BR))) { parseFuncCallLine(m, state.curGoal, state.curFunc, errors, i + 1); continue; }
    if ((m = normalizedLn.match(RX_TASK))) { if (!state.curGoal && !state.curFunc) { addError(errors, i + 1, 'TASK bez GOAL/FUNC'); continue; } state.curTask = null; continue; }
    if ((m = normalizedLn.match(RX_TASK_INLINE))) { parseTaskInlineLine(m, state.curGoal, state.curFunc, errors, i + 1); continue; }
    if ((m = normalizedLn.match(RX_ACT))) { parseActLine(m, state.curGoal, state.curFunc, errors, i + 1, state); continue; }
    if ((m = normalizedLn.match(RX_AND))) { parseAndLine(m, state.curTask, errors, i + 1); continue; }
    if ((m = normalizedLn.match(RX_IF_COMPOUND_OR_IF))) { parseIfCompoundOrIfLine(m, state.curGoal, state.curFunc, errors, i + 1); continue; }
    if ((m = normalizedLn.match(RX_IF_COMPOUND))) { parseIfCompoundLine(m, state.curGoal, state.curFunc, errors, i + 1); continue; }
    if ((m = normalizedLn.match(RX_IF_OP_STR))) { parseIfOpStrLine(m, state.curGoal, state.curFunc, errors, i + 1); continue; }
    if ((m = normalizedLn.match(RX_IF_STR))) { parseIfStrLine(m, state.curGoal, state.curFunc, errors, i + 1); continue; }
    if ((m = normalizedLn.match(RX_OR_IF))) { parseOrIfLine(m, state.curGoal, state.curFunc, errors, i + 1); continue; }
    if ((m = normalizedLn.match(RX_IF_INFIX)) || (m = normalizedLn.match(RX_IF_BR)) || (m = normalizedLn.match(RX_IF_PAR))) { parseIfStandardLine(m, state.curGoal, state.curFunc); continue; }
    if ((m = normalizedLn.match(RX_ELSE))) { parseElseLine(m, state.curGoal, state.curFunc, errors, i + 1); continue; }
    if ((m = normalizedLn.match(RX_ELSE_PLAIN))) { parseElsePlainLine(state.curGoal, state.curFunc, errors, i + 1); continue; }
    if ((m = normalizedLn.match(RX_GET))) { createParamStep('get', m, state.curGoal, state.curFunc, errors, i + 1); continue; }
    if ((m = normalizedLn.match(RX_VAL))) { createParamStep('val', m, state.curGoal, state.curFunc, errors, i + 1); continue; }
    if ((m = normalizedLn.match(RX_SET_QUOTED))) { parseSetQuotedLine(m, state.curGoal, state.curFunc, errors, i + 1); continue; }
    if ((m = normalizedLn.match(RX_SET))) { parseSetLine(m, state.curGoal, state.curFunc, errors, i + 1); continue; }
    if ((m = normalizedLn.match(RX_MAX))) { parseLimitLine('max', m, state.curGoal, state.curFunc, errors, i + 1); continue; }
    if ((m = normalizedLn.match(RX_MIN))) { parseLimitLine('min', m, state.curGoal, state.curFunc, errors, i + 1); continue; }
    if ((m = normalizedLn.match(RX_DELTA_MAX))) { parseDeltaLine('delta_max', m, state.curGoal, state.curFunc, errors, i + 1); continue; }
    if ((m = normalizedLn.match(RX_DELTA_MIN))) { parseDeltaLine('delta_min', m, state.curGoal, state.curFunc, errors, i + 1); continue; }
    if ((m = normalizedLn.match(RX_WAIT))) { parseWaitLine(m, state.curGoal, state.curFunc, errors, i + 1); continue; }
    if ((m = normalizedLn.match(RX_PUMP))) { parsePumpLine(m, state.curGoal, state.curFunc, errors, i + 1); continue; }
    if ((m = normalizedLn.match(RX_LOG))) { parseSimpleLine('log', m, state.curGoal, state.curFunc, errors, i + 1); continue; }
    if ((m = normalizedLn.match(RX_ALARM))) { parseSimpleLine('alarm', m, state.curGoal, state.curFunc, errors, i + 1); continue; }
    if ((m = normalizedLn.match(RX_ERROR))) { parseSimpleLine('error', m, state.curGoal, state.curFunc, errors, i + 1); continue; }
    if ((m = normalizedLn.match(RX_SAVE))) { parseSaveLine(m, state.curGoal, state.curFunc, errors, i + 1); continue; }
    if ((m = normalizedLn.match(RX_SAMPLE))) { parseSampleLine(m, state.curGoal, errors, i + 1); continue; }
    if ((m = normalizedLn.match(RX_CALC))) { parseCalcLine(m, state.curGoal, errors, i + 1); continue; }
    if ((m = normalizedLn.match(RX_FUN))) { parseFunLine(m, state.curGoal, errors, i + 1); continue; }
    if ((m = normalizedLn.match(RX_USER))) { parseUserLine(m, state.curGoal, state.curFunc, errors, i + 1); continue; }
    if ((m = normalizedLn.match(RX_RESULT))) { parseResultLine(m, state.curGoal, state.curFunc, errors, i + 1); continue; }
    if ((m = normalizedLn.match(RX_OPT))) { parseOptLine(m, state.curGoal, state.curFunc, errors, i + 1); continue; }
    if ((m = normalizedLn.match(RX_INFO))) { parseInfoLine(m, state.curGoal, state.curFunc, errors, i + 1); continue; }
    if ((m = normalizedLn.match(RX_REPEAT))) { parseRepeatLine(state.curGoal, state.curFunc, errors, i + 1); continue; }
    if ((m = normalizedLn.match(RX_END))) { parseEndLine(state.curGoal, state.curFunc, errors, i + 1); continue; }
    if ((m = normalizedLn.match(RX_OUT))) { parseOutLine(m, state.curGoal, state.curFunc, errors, i + 1); continue; }
    if ((m = normalizedLn.match(RX_DIALOG))) { parseDialogLine(m, state.curGoal, state.curFunc, errors, i + 1); continue; }

    if (/^\s*#/.test(normalizedLn)) continue;
    if (ln.trim()) errors.push(`Linia ${i + 1}: Nieznana składnia: ${ln.trim()}`);
  }

  const hasContent = ast.goals.length > 0 || (ast.funcs?.length ?? 0) > 0;
  if (!hasContent) errors.push('Brak sekcji GOAL lub FUNC');
  return { ok: hasContent, errors, ast };
}
