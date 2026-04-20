import { TaskStep, VarStep, IfStep, ElseStep, LogStep, AlarmStep, ErrorStep, SaveStep, FuncCallStep, UserStep, ResultStep, OptStep, InfoStep, RepeatStep, Step, Goal, DialogStep, OutStep } from '@/shared/types/scenario.types';
import { renderLegacyTaskAsDslLines } from '../../../components/dsl/dsl-content-helpers';
import { quoteDslValue as q } from '../../../components/dsl/dsl.quotes';

function text(el: Element | null): string {
  return (el as HTMLInputElement | HTMLSelectElement | null)?.value?.toString() || '';
}

function sanitizeToken(token: string): string {
  const raw = String(token || '');
  return raw.replace(/\[[^\]]*]/g, '').replace(/\s+/g, ' ').trim();
}

function normalizeUnit(unit: string): string {
  const raw = String(unit || '').trim();
  if (!raw) return '';
  if (raw === '[]' || /^\[\s*\]$/.test(raw)) return '';
  if (raw === '""' || /^"\s*"$/.test(raw)) return '';
  if (raw === "''" || /^'\s*'$/.test(raw)) return '';
  return sanitizeToken(raw);
}

function formatValueWithUnit(value: unknown, unit: string): string {
  const normalizedUnit = normalizeUnit(unit);
  const normalizedValue = String(value ?? '').trim();
  if (normalizedValue && normalizedUnit) return `${normalizedValue} ${normalizedUnit}`;
  return normalizedValue || normalizedUnit;
}

const VARIABLE_STEP_CREATORS: Record<string, (parameter: string, value: string, unit: string) => VarStep> = {
  'GET': (parameter, _value, unit) => ({ type: 'get', parameter, unit } as VarStep),
  'SET': (parameter, value, unit) => ({ type: 'set', parameter, value, unit } as VarStep),
  'MAX': (parameter, value, unit) => ({ type: 'max', parameter, value, unit } as VarStep),
  'MIN': (parameter, value, unit) => ({ type: 'min', parameter, value, unit } as VarStep),
  'VAL': (parameter, _value, unit) => ({ type: 'val', parameter, unit } as VarStep),
};

function pushVariableStep(
  steps: Step[],
  action: string,
  parameter: string,
  value: string,
  unit: string,
): void {
  if (!parameter) return;
  const creator = VARIABLE_STEP_CREATORS[action];
  if (creator) steps.push(creator(parameter, value, unit));
}

function parseMessageStepBlock(el: HTMLElement): Step | null {
  if (el.classList.contains('log-block')) {
    const sel = el.querySelector('.log-select') as HTMLSelectElement | null;
    const inp = el.querySelector('.log-message-input') as HTMLInputElement | null;
    return { type: 'log', message: (sel?.value || inp?.value || '').trim() } as LogStep;
  }
  if (el.classList.contains('alarm-block')) {
    const sel = el.querySelector('.alarm-select') as HTMLSelectElement | null;
    const inp = el.querySelector('.alarm-message-input') as HTMLInputElement | null;
    return { type: 'alarm', message: (sel?.value || inp?.value || '').trim() } as AlarmStep;
  }
  if (el.classList.contains('error-block')) {
    const sel = el.querySelector('.error-select') as HTMLSelectElement | null;
    const inp = el.querySelector('.error-message-input') as HTMLInputElement | null;
    return { type: 'error', message: (sel?.value || inp?.value || '').trim() } as ErrorStep;
  }
  return null;
}

// Action block parsers - extracted to reduce CC
type ActionBlockParser = (el: HTMLElement) => Step | null;

const ACTION_BLOCK_PARSERS: Record<string, ActionBlockParser> = {
  'wait-block': (el) => {
    const dur = (el.querySelector('.wait-duration-input') as HTMLInputElement | null)?.value?.trim() || '';
    const mode = ((el.querySelector('.task-wait-select') as HTMLSelectElement | null)?.value || 'wait').trim().toLowerCase();
    return dur ? ({ type: 'set', parameter: mode, value: dur, unit: '' } as VarStep) : null;
  },
  'save-block': (el) => {
    const par = el.querySelector('.param-select') as HTMLSelectElement | null;
    return { type: 'save', parameter: (par?.value || '').trim() } as SaveStep;
  },
  'func-call-block': (el) => {
    const sel = el.querySelector('.func-call-select') as HTMLSelectElement | null;
    const argInputs = el.querySelectorAll('.func-arg-input');
    const args = Array.from(argInputs).map((inp) => (inp as HTMLInputElement).value.trim());
    return { type: 'func_call', name: (sel?.value || '').trim(), arguments: args } as FuncCallStep;
  },
  'user-block': (el) => {
    const act = el.querySelector('.user-action-input') as HTMLInputElement | null;
    const msg = el.querySelector('.user-message-input') as HTMLInputElement | null;
    return { type: 'user', action: (act?.value || '').trim(), message: (msg?.value || '').trim() } as UserStep;
  },
  'result-block': (el) => {
    const st = el.querySelector('.result-select') as HTMLSelectElement | null;
    return { type: 'result', status: (st?.value || '').trim() } as ResultStep;
  },
  'opt-block': (el) => {
    const parSel = el.querySelector('.opt-param-select') as HTMLSelectElement | null;
    const descSel = el.querySelector('.opt-desc-select') as HTMLSelectElement | null;
    return { type: 'opt', parameter: (parSel?.value || '').trim(), description: (descSel?.value || '').trim() } as OptStep;
  },
  'info-block': (el) => {
    const lvl = el.querySelector('.info-level-select') as HTMLSelectElement | null;
    const msgSel = el.querySelector('.info-message-select') as HTMLSelectElement | null;
    return { type: 'info', level: (lvl?.value || 'INFO').trim(), message: (msgSel?.value || '').trim() } as InfoStep;
  },
  'repeat-block': () => ({ type: 'repeat' } as RepeatStep),
  'end-block': () => ({ type: 'END' } as unknown as Step),
  'dialog-block': (el) => {
    const parSel = el.querySelector('.dialog-param-select') as HTMLSelectElement | null;
    const msgInp = el.querySelector('.dialog-message-input') as HTMLInputElement | null;
    return { type: 'dialog', parameter: (parSel?.value || '').trim(), message: (msgInp?.value || '').trim() } as DialogStep;
  },
  'out-block': (el) => {
    const typeSel = el.querySelector('.out-type-select') as HTMLSelectElement | null;
    const valInp = el.querySelector('.out-value-input') as HTMLInputElement | null;
    const valSel = el.querySelector('.out-value-select') as HTMLSelectElement | null;
    const outType = (typeSel?.value || 'RESULT').toUpperCase();
    const outValue = (valInp?.style.display !== 'none' ? valInp?.value : valSel?.value) || '';
    return { type: 'out', outType, value: outValue.trim() } as OutStep;
  },
  'set-action-block': (el) => {
    const actSel = el.querySelector('.task-action-select') as HTMLSelectElement | null;
    const objSel = el.querySelector('.task-object-select') as HTMLSelectElement | null;
    return { type: 'task', function: (actSel?.value || '').trim(), object: (objSel?.value || '').trim() } as TaskStep;
  },
};

function parseActionStepBlock(el: HTMLElement): Step | null {
  for (const [className, parser] of Object.entries(ACTION_BLOCK_PARSERS)) {
    if (el.classList.contains(className)) {
      return parser(el);
    }
  }
  return null;
}

const VARIABLE_KIND_PARSERS: Record<string, (parameter: string, value: string, unit: string) => VarStep> = {
  'GET': (parameter, _value, unit) => ({ type: 'get', parameter, unit } as VarStep),
  'SET': (parameter, value, unit) => ({ type: 'set', parameter, value, unit } as VarStep),
  'MAX': (parameter, value, unit) => ({ type: 'max', parameter, value, unit } as VarStep),
  'MIN': (parameter, value, unit) => ({ type: 'min', parameter, value, unit } as VarStep),
  'VAL': (parameter, _value, unit) => ({ type: 'val', parameter, unit } as VarStep),
};

function parseVariableStepBlock(el: HTMLElement): Step | null {
  if (!el.classList.contains('variable-block')) return null;
  const parSel = el.querySelector('.param-select') as HTMLSelectElement | null;
  const valInp = el.querySelector('.value-input') as HTMLInputElement | null;
  const unitSel = el.querySelector('.unit-select') as HTMLSelectElement | null;
  const kind = ((el as HTMLElement).dataset.varKind || 'SET').toUpperCase();
  const parameter = (parSel?.value || '').trim();
  const value = (valInp?.value || '').trim();
  const unit = normalizeUnit(unitSel?.value || '');
  if (!parameter) return null;

  const parser = VARIABLE_KIND_PARSERS[kind];
  return parser ? parser(parameter, value, unit) : null;
}

function parseStepBlock(el: HTMLElement): Step | null {
  return parseMessageStepBlock(el) || parseActionStepBlock(el) || parseVariableStepBlock(el);
}

function parseTaskContainer(el: HTMLElement): TaskStep | null {
  const baseFn = el.querySelector('.sentence-builder > .sentence-part .function-select') as HTMLSelectElement | null;
  const baseObj = el.querySelector('.sentence-builder > .sentence-part .object-select') as HTMLSelectElement | null;
  if (!baseFn || !baseObj) return null;

  const taskData: TaskStep = { type: 'task', function: baseFn.value, object: baseObj.value };
  const ands: Array<{ function: string; object: string }> = [];
  const andRows = Array.from(el.querySelectorAll('.and-row')) as HTMLElement[];
  andRows.forEach((row) => {
    const label = (row.querySelector('.sentence-text')?.textContent || '').trim().toUpperCase();
    if (label !== 'AND') return;
    const f = row.querySelector('.function-select') as HTMLSelectElement | null;
    const o = row.querySelector('.object-select') as HTMLSelectElement | null;
    if (f && o) ands.push({ function: f.value, object: o.value });
  });
  if (ands.length) taskData.ands = ands;
  return taskData;
}

function parseVariableContainer(el: HTMLElement): VarStep[] {
  const builder = el.querySelector('.variable-builder') as HTMLElement | null;
  if (!builder) return [];

  const steps: VarStep[] = [];
  const rows = Array.from(builder.querySelectorAll('.var-row')) as HTMLElement[];
  rows.forEach((row) => {
    const actSel = row.querySelector('.action-select') as HTMLSelectElement | null;
    const parSel = row.querySelector('.param-select') as HTMLSelectElement | null;
    const valInp = row.querySelector('.value-input') as HTMLInputElement | null;
    const unitSel = row.querySelector('.unit-select') as HTMLSelectElement | null;
    const containerKind = (el as HTMLElement).dataset.varKind || '';
    const rowKind = (row.getAttribute('data-kind') || '').toUpperCase();
    const action = (rowKind || actSel?.value || containerKind || 'SET').toUpperCase();
    const parameter = (parSel?.value || '').trim();
    const value = (valInp?.value || '').trim();
    const unit = normalizeUnit(unitSel?.value || '');
    pushVariableStep(steps, action, parameter, value, unit);
  });
  return steps;
}

function parseConditionGroup(el: HTMLElement): Step | null {
  const conditionType = (el as HTMLElement).dataset.conditionType || 'if';
  if (conditionType === 'else') {
    const actionTypeSel = el.querySelector('.action-type-select') as HTMLSelectElement | null;
    const actionMsg = el.querySelector('.message-input') as HTMLInputElement | null;
    return {
      type: 'else',
      actionType: (actionTypeSel?.value || 'ERROR').toUpperCase(),
      actionMessage: actionMsg?.value || '',
    } as ElseStep;
  }

  const p = el.querySelector('.param-select') as HTMLSelectElement | null;
  const op = el.querySelector('.operator-select') as HTMLSelectElement | null;
  const vsel = el.querySelector('.variable-select') as HTMLSelectElement | null;
  const val = el.querySelector('.value-input') as HTMLInputElement | null;
  const un = el.querySelector('.unit-select') as HTMLSelectElement | null;
  const connector = ((el as HTMLElement).dataset.connector || '').toUpperCase();
  const parameterValue = text(p);
  if (!parameterValue || parameterValue === '*' || parameterValue === 'niezdefiniowany') return null;

  let ifValue = '';
  let ifUnit = '';
  if (vsel) {
    const vv = text(vsel);
    ifValue = vv === '*' ? '' : vv;
  } else {
    ifValue = text(val);
    ifUnit = text(un);
  }
  if (!ifValue) return null;

  return {
    type: 'if',
    parameter: parameterValue,
    operator: text(op) || '>',
    value: ifValue,
    unit: ifUnit,
    connector,
  } as IfStep;
}

function collectStepFromElement(steps: Step[], el: HTMLElement): void {
  if (el.classList.contains('step-block')) {
    const step = parseStepBlock(el);
    if (step) steps.push(step);
    return;
  }

  if (el.classList.contains('task-container')) {
    const step = parseTaskContainer(el);
    if (step) steps.push(step);
    return;
  }

  if (el.classList.contains('variable-container')) {
    steps.push(...parseVariableContainer(el));
    return;
  }

  const step = parseConditionGroup(el);
  if (step) steps.push(step);
}

function serializeScalarStep(type: string, value: string, indent: string): string {
  return `${indent}${type} ${q(value)}`;
}

function serializePairStep(type: string, left: string, right: string, indent: string): string {
  return `${indent}${type} ${q(left)} ${q(right)}`;
}

function serializeVariableStep(step: VarStep, indent: string): string {
  const parameter = sanitizeToken(step.parameter);
  const unit = normalizeUnit(step.unit || '');
  const payload = formatValueWithUnit(step.value ?? '', step.unit || '');
  const type = String(step.type || '').toLowerCase();

  if (type === 'get') return unit ? serializePairStep('GET', parameter, unit, indent) : `${indent}GET ${q(parameter)}`;
  if (type === 'val') return unit ? serializePairStep('VAL', parameter, unit, indent) : `${indent}VAL ${q(parameter)}`;
  if (type === 'set') return serializePairStep('SET', parameter, payload, indent);
  if (type === 'max') return serializePairStep('MAX', parameter, payload, indent);
  return serializePairStep('MIN', parameter, payload, indent);
}

// Step serializers - extracted to reduce CC
type StepSerializer = (step: Step, indent: string) => string[] | null;

const STEP_SERIALIZERS: Record<string, StepSerializer> = {
  'task': (step, indent) => renderLegacyTaskAsDslLines(step as TaskStep, indent),
  'log': (step, indent) => [serializeScalarStep('LOG', String((step as LogStep).message || ''), indent)],
  'alarm': (step, indent) => [serializeScalarStep('ALARM', String((step as AlarmStep).message || ''), indent)],
  'error': (step, indent) => [serializeScalarStep('ERROR', String((step as ErrorStep).message || ''), indent)],
  'save': (step, indent) => [serializeScalarStep('SAVE', sanitizeToken((step as SaveStep).parameter), indent)],
  'result': (step, indent) => [serializeScalarStep('RESULT', sanitizeToken((step as ResultStep).status), indent)],
  'repeat': (_step, indent) => [`${indent}REPEAT`],
  'dialog': (step, indent) => {
    const dialogStep = step as DialogStep;
    return [serializePairStep('DIALOG', sanitizeToken(dialogStep.parameter), sanitizeToken(dialogStep.message), indent)];
  },
  'out': (step, indent) => {
    const outStep = step as OutStep;
    return [serializePairStep('OUT', (outStep.outType || 'RESULT').toUpperCase(), sanitizeToken(outStep.value), indent)];
  },
  'get': (step, indent) => [serializeVariableStep(step as VarStep, indent)],
  'set': (step, indent) => [serializeVariableStep(step as VarStep, indent)],
  'max': (step, indent) => [serializeVariableStep(step as VarStep, indent)],
  'min': (step, indent) => [serializeVariableStep(step as VarStep, indent)],
  'val': (step, indent) => [serializeVariableStep(step as VarStep, indent)],
  'wait': (step, indent) => {
    const waitStep = step as { duration?: string; unit?: string };
    const payload = formatValueWithUnit(waitStep.duration || '', waitStep.unit || '');
    return payload ? [serializePairStep('SET', 'WAIT', payload, indent)] : [];
  },
  'func_call': (step, indent) => {
    const funcStep = step as FuncCallStep;
    const args = (funcStep.arguments || []).map((arg) => q(sanitizeToken(arg))).join(' ');
    const name = q(sanitizeToken(funcStep.name));
    return [args ? `${indent}FUNC ${name} ${args}` : `${indent}FUNC ${name}`];
  },
  'user': (step, indent) => {
    const userStep = step as UserStep;
    return [serializePairStep('USER', sanitizeToken(userStep.action), sanitizeToken(userStep.message), indent)];
  },
  'opt': (step, indent) => {
    const optStep = step as OptStep;
    return [serializePairStep('OPT', sanitizeToken(optStep.parameter), sanitizeToken(optStep.description), indent)];
  },
  'info': (step, indent) => {
    const infoStep = step as InfoStep;
    return [serializePairStep('INFO', sanitizeToken(infoStep.level), sanitizeToken(infoStep.message), indent)];
  },
  'else': (step, indent) => {
    const elseStep = step as ElseStep;
    return [serializePairStep('ELSE', (elseStep.actionType || 'ERROR').toUpperCase(), elseStep.actionMessage, indent)];
  },
  'END': (_step, indent) => [`${indent}END`],
};

function serializeStructuredStep(step: Step, indent: string): string[] | null {
  const type = String((step as { type?: string }).type || '');
  const serializer = STEP_SERIALIZERS[type];
  return serializer ? serializer(step, indent) : null;
}

function serializeIfStep(step: IfStep, indent: string, lastConn: '' | 'AND' | 'OR' | 'ELSE'): { lines: string[]; next: '' | 'AND' | 'OR' | 'ELSE' } {
  const parameter = sanitizeToken(step.parameter);
  const rawValue = String(step.value || '').trim();
  if (!parameter || !rawValue || rawValue === '*') {
    return { lines: [], next: '' };
  }

  const prefix = lastConn ? `${lastConn} IF` : 'IF';
  const payload = formatValueWithUnit(rawValue, step.unit || '');
  const line = `${indent}${prefix} ${q(parameter)} ${step.operator || '>'} ${q(payload)}`;
  const next = String(step.connector || '').toUpperCase();
  return {
    lines: [line],
    next: next === 'AND' || next === 'OR' || next === 'ELSE' ? (next as 'AND' | 'OR' | 'ELSE') : '',
  };
}

export function collectStepsFromContainer(container: HTMLElement): Step[] {
  const steps: Step[] = [];
  const nodes = container.querySelectorAll(':scope > .step-block, :scope > .step-nested, :scope > .task-container, :scope > .variable-container, :scope > .condition-group');
  const els = Array.prototype.slice.call(nodes) as HTMLElement[];

  els.forEach((el) => collectStepFromElement(steps, el));

  return steps;
}

export function collectGoalsFromDOM(doc: Document = document): Goal[] {
  const goals: Goal[] = [];
  const goalSections = doc.querySelectorAll('#goals-container .goal-section');

  goalSections.forEach((section) => {
    const goalSelect = section.querySelector('.goal-select') as HTMLSelectElement | null;
    const goalName = goalSelect?.value?.trim() || '';
    const stepsContainer = section.querySelector('.steps-container') as HTMLElement | null;
    const steps = stepsContainer ? collectStepsFromContainer(stepsContainer) : [];
    goals.push({ name: goalName, steps });
  });

  return goals;
}

export interface FuncDefinition {
  name: string;
  steps: Step[];
}

export function collectFuncsFromDOM(doc: Document = document): FuncDefinition[] {
  const funcs: FuncDefinition[] = [];
  const funcSections = doc.querySelectorAll('.func-section');

  funcSections.forEach((section) => {
    const nameInput = section.querySelector('.func-name-input') as HTMLInputElement | null;
    const funcName = nameInput?.value?.trim() || '';
    const stepsContainer = section.querySelector('.steps-container') as HTMLElement | null;
    const steps = stepsContainer ? collectStepsFromContainer(stepsContainer) : [];
    if (!funcName && steps.length === 0) return;
    funcs.push({ name: funcName, steps });
  });

  return funcs;
}

export function stepsToLines(steps: Step[], indent = ''): string[] {
  const lines: string[] = [];
  let lastConn: '' | 'AND' | 'OR' | 'ELSE' = '';

  for (const step of steps) {
    const type = String((step as { type?: string }).type || '');

    const serialized = serializeStructuredStep(step, indent);
    if (serialized) {
      lines.push(...serialized);
      lastConn = '';
      continue;
    }

    if (type === 'if') {
      const result = serializeIfStep(step as IfStep, indent, lastConn);
      lines.push(...result.lines);
      lastConn = result.next;
    }
  }

  return lines;
}

export function scenarioToDsl(name: string, goals: Goal[], _funcs?: FuncDefinition[]): string {
  const lines: string[] = [];
  const scenarioName = (name || 'Bez nazwy').trim();
  lines.push(`SCENARIO: ${scenarioName}`);
  lines.push('');

  for (const goal of goals) {
    lines.push(`GOAL: ${(goal?.name || '').trim()}`);
    const steps = Array.isArray(goal?.steps) ? goal.steps : [];
    lines.push(...stepsToLines(steps, '  '));
    lines.push('');
  }

  return lines.join('\n');
}

export function funcsToDsl(funcs: FuncDefinition[]): string {
  const lines: string[] = [];

  for (const func of funcs) {
    const fname = (func?.name || '').trim();
    if (!fname) continue;
    lines.push(`FUNC: ${fname}`);
    const steps = Array.isArray(func?.steps) ? func.steps : [];
    lines.push(...stepsToLines(steps, '  '));
    lines.push('');
  }

  return lines.join('\n');
}