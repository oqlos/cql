/**
 * Flat OQL v5 SSOT via @semcod/oqlts — mirrors c2004 cql-backend oql_*_ssot.py adapters.
 */
import { parseOql, validateOql } from '@semcod/oqlts';
import type { OqlCommand, OqlParseResult } from '@semcod/oqlts';

// @semcod/oqlts is the single parser for ALL supported OQL versions (v3/v4/v5).
// Route every `VERSION: 3|4|5` document to it — not just v5 — so v4 GOAL: and v3
// scenarios execute through the TS runtime instead of the retired legacy parser.
const VERSION_FLAT_RE = /^\s*VERSION\s*:\s*[345]\s*$/im;

export function isOqlV5Flat(text: string): boolean {
  return VERSION_FLAT_RE.test(text || '');
}

export type LegacyStep = Record<string, unknown>;
export type LegacyGoal = {
  name: string;
  tasks: unknown[];
  conditions: unknown[];
  steps: LegacyStep[];
};
export type LegacyAst = {
  scenario: string;
  goals: LegacyGoal[];
  funcs: unknown[];
};

function str(value: unknown): string {
  return value == null ? '' : String(value);
}

function cmdToSteps(cmd: OqlCommand): LegacyStep[] {
  const name = str(cmd.cmd).toUpperCase();
  const args = (cmd.args ?? {}) as Record<string, unknown>;
  const steps: LegacyStep[] = [];

  if (name === 'SET') {
    const target = str(args.target);
    if (target.toUpperCase() === 'NAME') return steps;
    return [{ type: 'set', parameter: target, value: str(args.value), unit: args.unit }];
  }
  if (name === 'WAIT') {
    return [{ type: 'wait', duration: str(args.value ?? args.raw), unit: args.unit }];
  }
  if (name === 'MIN') {
    return [{ type: 'min', parameter: str(args.sensor), value: str(args.value), unit: args.unit }];
  }
  if (name === 'MAX') {
    return [{ type: 'max', parameter: str(args.sensor), value: str(args.value), unit: args.unit }];
  }
  if (name === 'RANGE') {
    const unit = args.unit;
    return [
      { type: 'min', parameter: str(args.sensor), value: str(args.min), unit },
      { type: 'max', parameter: str(args.sensor), value: str(args.max), unit },
    ];
  }
  if (name === 'PASS') {
    if (args.sensor) {
      return [{ type: 'pass', parameter: str(args.sensor), message: str(args.message) }];
    }
    return [{ type: 'info', level: 'CORRECT', message: str(args.message) }];
  }
  if (name === 'FAIL') {
    const step: LegacyStep = { message: str(args.message) };
    if (args.sensor) {
      step.type = 'fail';
      step.parameter = str(args.sensor);
    } else {
      step.type = 'error';
    }
    if (args.goto) step.goto = str(args.goto);
    if (args.retry != null) step.retry = args.retry;
    return [step];
  }
  if (name === 'TASK') {
    return [{ type: 'task_dialog_line', field: str(args.field), value: str(args.value) }];
  }
  if (name === 'LOG') {
    return [{ type: 'log', message: str(args.message) }];
  }
  if (name === 'GET' || name === 'READ') {
    return [{ type: 'get', parameter: str(args.sensor), unit: args.unit }];
  }
  if (name === 'VAL') {
    return [{ type: 'val', parameter: str(args.param), unit: args.unit }];
  }
  if (name === 'SAVE') {
    return [{ type: 'save', parameter: str(args.label) }];
  }
  if (name === 'SAMPLE') {
    return [{
      type: 'sample',
      parameter: str(args.sensor),
      state: str(args.direction).toUpperCase(),
      interval: str(args.interval_ms) || null,
    }];
  }
  if (name === 'IF') {
    return [{
      type: 'if',
      parameter: str(args.param),
      operator: str(args.operator),
      value: str(args.value),
      unit: args.unit,
    }];
  }
  return [{ type: 'other', cmd: name, args, raw: cmd.raw }];
}

export function tsParseToAst(payload: OqlParseResult): LegacyAst {
  const scenario = payload.scenario ?? { goals: [], meta: {} };
  const meta = scenario.meta ?? {};
  const title = str(scenario.title ?? meta.scenario ?? 'OQL Scenario');
  const goals: LegacyGoal[] = [];

  for (const goal of scenario.goals ?? []) {
    const uiGoal: LegacyGoal = { name: str(goal.name), tasks: [], conditions: [], steps: [] };
    for (const cmd of goal.steps ?? []) {
      for (const step of cmdToSteps(cmd)) {
        uiGoal.steps.push(step);
      }
    }
    goals.push(uiGoal);
  }

  return { scenario: title, goals, funcs: [] };
}

function formatIssue(issue: { line?: number; message?: string }): string {
  const message = str(issue.message);
  return issue.line != null ? `Linia ${issue.line}: ${message}` : message;
}

export function parseDslSsot(text: string): { ok: boolean; errors: string[]; ast: LegacyAst | null } | null {
  if (!isOqlV5Flat(text)) return null;
  const payload = parseOql(text);
  const errors = (payload.errors ?? []).map((issue) => formatIssue(issue));
  if (errors.length) {
    return { ok: false, errors, ast: null };
  }
  const ast = tsParseToAst(payload);
  return { ok: ast.goals.length > 0, errors: [], ast };
}

export function validateDslSsot(text: string): {
  ok: boolean;
  errors: string[];
  warnings: string[];
  violations: unknown[];
  fixedText: string | null;
} | null {
  if (!isOqlV5Flat(text)) return null;
  const payload = validateOql(text);
  const errors = (payload.errors ?? []).map((issue) => formatIssue(issue));
  const warnings = (payload.warnings ?? []).map((issue) => formatIssue(issue));
  return {
    ok: Boolean(payload.valid) && errors.length === 0,
    errors,
    warnings,
    violations: [],
    fixedText: null,
  };
}
