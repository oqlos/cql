import type {
  DslAst,
  DslElseCondition,
  DslFunc,
  DslGoal,
  DslIfCondition,
  DslStep,
  DslTask,
} from './dsl.types';
import { parseDsl } from './dsl.parser';

function esc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

type SerializableStep = DslStep;
type XmlBlock = Pick<DslGoal, 'name' | 'tasks' | 'steps'> & { conditions?: Array<DslIfCondition | DslElseCondition> };
type XmlStepSerializer = (step: SerializableStep) => string[] | null;
type XmlStepParser = (element: Element) => SerializableStep | null;
type StepOfType<T extends DslStep['type']> = Extract<DslStep, { type: T }>;

const GOAL_INDENT = '  ';
const STEPS_INDENT = '    ';
const STEP_INDENT = '      ';
const STEP_CHILD_INDENT = '        ';

function isStepType<T extends DslStep['type']>(step: SerializableStep, type: T): step is StepOfType<T> {
  return step.type === type;
}

function buildXmlAttributes(attributes: Record<string, unknown>): string {
  return Object.entries(attributes)
    .filter(([, value]) => value !== undefined && value !== null && String(value) !== '')
    .map(([key, value]) => ` ${key}="${esc(String(value))}"`)
    .join('');
}

function buildValueWithUnit(value: unknown, unit?: string): string {
  const valueText = String(value ?? '').trim();
  const unitText = String(unit || '').trim();
  return unitText ? `${valueText} ${unitText}` : valueText;
}

function buildSelfClosingTag(indent: string, tag: string, attributes: Record<string, unknown>): string[] {
  return [`${indent}<${tag}${buildXmlAttributes(attributes)}/>`];
}

function serializeTaskStepXml(step: SerializableStep): string[] | null {
  if (!isStepType(step, 'task')) return null;
  const task = step;
  const parts = [`${STEP_INDENT}<task>`];
  parts.push(`${STEP_CHILD_INDENT}<action${buildXmlAttributes({ function: task.function, object: task.object })}/>`);
  for (const andStep of Array.isArray(task.ands) ? task.ands : []) {
    parts.push(`${STEP_CHILD_INDENT}<and${buildXmlAttributes({ function: andStep.function, object: andStep.object })}/>`);
  }
  parts.push(`${STEP_INDENT}</task>`);
  return parts;
}

function serializeIfStepXml(step: SerializableStep): string[] | null {
  if (!isStepType(step, 'if')) return null;
  return buildSelfClosingTag(STEP_INDENT, 'if', {
    parameter: step.parameter,
    operator: step.operator,
    value: step.value,
    unit: step.unit,
    connector: step.connector,
  });
}

function serializeElseStepXml(step: SerializableStep): string[] | null {
  if (!isStepType(step, 'else')) return null;
  if (!step.actionType && !step.actionMessage) return buildSelfClosingTag(STEP_INDENT, 'else', {});
  return buildSelfClosingTag(STEP_INDENT, 'else', {
    actionType: step.actionType || 'ERROR',
    actionMessage: step.actionMessage || '',
  });
}

function serializeParamStepXml(type: 'get' | 'val', step: SerializableStep): string[] | null {
  return isStepType(step, type)
    ? buildSelfClosingTag(STEP_INDENT, type, { parameter: step.parameter, unit: step.unit })
    : null;
}

function serializeValueStepXml(type: 'set' | 'max' | 'min', step: SerializableStep): string[] | null {
  return isStepType(step, type)
    ? buildSelfClosingTag(STEP_INDENT, type, { parameter: step.parameter, value: step.value, unit: step.unit })
    : null;
}

function serializeDeltaStepXml(type: 'delta_max' | 'delta_min', step: SerializableStep): string[] | null {
  return isStepType(step, type)
    ? buildSelfClosingTag(STEP_INDENT, type, { parameter: step.parameter, value: step.value, unit: step.unit, per: step.per })
    : null;
}

function serializeWaitStepXml(step: SerializableStep): string[] | null {
  return isStepType(step, 'wait')
    ? buildSelfClosingTag(STEP_INDENT, 'wait', { duration: step.duration, unit: step.unit })
    : null;
}

function serializePumpStepXml(step: SerializableStep): string[] | null {
  return isStepType(step, 'pump')
    ? buildSelfClosingTag(STEP_INDENT, 'pump', { value: step.value, unit: step.unit, raw: step.raw })
    : null;
}

function serializeSampleStepXml(step: SerializableStep): string[] | null {
  return isStepType(step, 'sample')
    ? buildSelfClosingTag(STEP_INDENT, 'sample', { parameter: step.parameter, state: step.state, interval: step.interval })
    : null;
}

function serializeCalcStepXml(step: SerializableStep): string[] | null {
  return isStepType(step, 'calc')
    ? buildSelfClosingTag(STEP_INDENT, 'calc', { result: step.result, function: step.function, input: step.input })
    : null;
}

function serializeFunStepXml(step: SerializableStep): string[] | null {
  return isStepType(step, 'fun')
    ? buildSelfClosingTag(STEP_INDENT, 'fun', { result: step.result, expression: step.expression })
    : null;
}

function serializeMessageStepXml(type: 'log' | 'alarm' | 'error', step: SerializableStep): string[] | null {
  return isStepType(step, type) ? buildSelfClosingTag(STEP_INDENT, type, { message: step.message }) : null;
}

function serializeSaveStepXml(step: SerializableStep): string[] | null {
  return isStepType(step, 'save') ? buildSelfClosingTag(STEP_INDENT, 'save', { parameter: step.parameter }) : null;
}

function serializeFuncCallStepXml(step: SerializableStep): string[] | null {
  if (!isStepType(step, 'func_call')) return null;
  const args = Array.isArray(step.arguments) ? step.arguments : [];
  if (!args.length) return buildSelfClosingTag(STEP_INDENT, 'func_call', { name: step.name });
  const parts = [`${STEP_INDENT}<func_call${buildXmlAttributes({ name: step.name })}>`];
  for (const arg of args) parts.push(`${STEP_CHILD_INDENT}<argument${buildXmlAttributes({ value: arg })}/>`);
  parts.push(`${STEP_INDENT}</func_call>`);
  return parts;
}

function serializeUserStepXml(step: SerializableStep): string[] | null {
  return isStepType(step, 'user')
    ? buildSelfClosingTag(STEP_INDENT, 'user', { action: step.action, message: step.message })
    : null;
}

function serializeResultStepXml(step: SerializableStep): string[] | null {
  return isStepType(step, 'result') ? buildSelfClosingTag(STEP_INDENT, 'result', { status: step.status }) : null;
}

function serializeOptStepXml(step: SerializableStep): string[] | null {
  return isStepType(step, 'opt')
    ? buildSelfClosingTag(STEP_INDENT, 'opt', { parameter: step.parameter, description: step.description })
    : null;
}

function serializeInfoStepXml(step: SerializableStep): string[] | null {
  return isStepType(step, 'info')
    ? buildSelfClosingTag(STEP_INDENT, 'info', { level: step.level, message: step.message })
    : null;
}

function serializeRepeatStepXml(step: SerializableStep): string[] | null {
  return isStepType(step, 'repeat') ? buildSelfClosingTag(STEP_INDENT, 'repeat', {}) : null;
}

function serializeEndStepXml(step: SerializableStep): string[] | null {
  return isStepType(step, 'end') ? buildSelfClosingTag(STEP_INDENT, 'end', {}) : null;
}

function serializeOutStepXml(step: SerializableStep): string[] | null {
  return isStepType(step, 'out')
    ? buildSelfClosingTag(STEP_INDENT, 'out', { outType: step.outType, value: step.value })
    : null;
}

function serializeDialogStepXml(step: SerializableStep): string[] | null {
  return isStepType(step, 'dialog')
    ? buildSelfClosingTag(STEP_INDENT, 'dialog', { parameter: step.parameter, message: step.message })
    : null;
}

const XML_STEP_SERIALIZERS: XmlStepSerializer[] = [
  serializeTaskStepXml,
  serializeIfStepXml,
  serializeElseStepXml,
  serializeFuncCallStepXml,
  (step) => serializeParamStepXml('get', step),
  (step) => serializeParamStepXml('val', step),
  (step) => serializeValueStepXml('set', step),
  (step) => serializeValueStepXml('max', step),
  (step) => serializeValueStepXml('min', step),
  (step) => serializeDeltaStepXml('delta_max', step),
  (step) => serializeDeltaStepXml('delta_min', step),
  serializeWaitStepXml,
  serializePumpStepXml,
  serializeSampleStepXml,
  serializeCalcStepXml,
  serializeFunStepXml,
  (step) => serializeMessageStepXml('log', step),
  (step) => serializeMessageStepXml('alarm', step),
  (step) => serializeMessageStepXml('error', step),
  serializeSaveStepXml,
  serializeUserStepXml,
  serializeResultStepXml,
  serializeOptStepXml,
  serializeInfoStepXml,
  serializeRepeatStepXml,
  serializeDialogStepXml,
  serializeOutStepXml,
  serializeEndStepXml,
];

function renderStructuredStepXml(step: SerializableStep): string[] {
  for (const serializer of XML_STEP_SERIALIZERS) {
    const xmlLines = serializer(step);
    if (xmlLines !== null) return xmlLines;
  }
  return [];
}

function renderLegacyBlockStepsXml(block: XmlBlock): string[] {
  const lines: string[] = [];
  for (const task of (block.tasks || []) as DslTask[]) lines.push(...renderStructuredStepXml({ ...task, type: 'task' }));
  for (const condition of block.conditions || []) lines.push(...renderStructuredStepXml(condition));
  return lines;
}

function buildBlockXml(tagName: 'goal' | 'func', block: XmlBlock): string[] {
  const parts = [`${GOAL_INDENT}<${tagName}${buildXmlAttributes({ name: block.name })}>`, `${STEPS_INDENT}<steps>`];
  const stepLines = Array.isArray(block.steps) && block.steps.length > 0
    ? block.steps.flatMap((step) => renderStructuredStepXml(step))
    : renderLegacyBlockStepsXml(block);
  parts.push(...stepLines);
  parts.push(`${STEPS_INDENT}</steps>`, `${GOAL_INDENT}</${tagName}>`);
  return parts;
}

export function astToXml(ast: DslAst): string {
  const parts: string[] = ['<?xml version="1.0" encoding="UTF-8"?>', `<dsl${buildXmlAttributes({ scenario: ast.scenario })}>`];
  for (const goal of ast.goals as DslGoal[]) parts.push(...buildBlockXml('goal', goal));
  for (const func of (ast.funcs || []) as DslFunc[]) parts.push(...buildBlockXml('func', func));
  parts.push('</dsl>');
  return parts.join('\n');
}

export function dslToXml(text: string): { ok: boolean; xml?: string; errors?: string[] } {
  const parsed = parseDsl(text);
  if (!parsed.ok) return { ok: false, errors: parsed.errors };
  const xml = astToXml(parsed.ast as DslAst);
  return { ok: true, xml };
}

function getDirectChildren(element: Element, tagName?: string): Element[] {
  const children = Array.from(element.children) as Element[];
  return tagName
    ? children.filter((child) => child.tagName.toLowerCase() === tagName.toLowerCase())
    : children;
}

function getFirstDirectChild(element: Element, tagName: string): Element | null {
  return getDirectChildren(element, tagName)[0] || null;
}

function getAttributeValue(element: Element, name: string): string {
  return element.getAttribute(name) || '';
}

function parseTaskElement(element: Element): SerializableStep | null {
  const action = getFirstDirectChild(element, 'action');
  if (!action) return null;
  const ands = getDirectChildren(element, 'and').map((andElement) => ({
    function: getAttributeValue(andElement, 'function'),
    object: getAttributeValue(andElement, 'object'),
  }));
  return {
    type: 'task',
    function: getAttributeValue(action, 'function'),
    object: getAttributeValue(action, 'object'),
    ands,
  };
}

function parseIfElement(element: Element): SerializableStep {
  const unit = getAttributeValue(element, 'unit');
  return {
    type: 'if',
    parameter: getAttributeValue(element, 'parameter'),
    operator: (getAttributeValue(element, 'operator') || '>') as DslIfCondition['operator'],
    value: getAttributeValue(element, 'value'),
    ...(unit ? { unit } : {}),
  };
}

function parseElseElement(element: Element): SerializableStep {
  if (!element.hasAttribute('actionType') && !element.hasAttribute('actionMessage')) return { type: 'else' };
  return {
    type: 'else',
    actionType: (getAttributeValue(element, 'actionType') || 'ERROR') as DslElseCondition['actionType'],
    actionMessage: getAttributeValue(element, 'actionMessage'),
  };
}

function parseParamStep(type: 'get' | 'val', element: Element): SerializableStep {
  const unit = getAttributeValue(element, 'unit');
  return {
    type,
    parameter: getAttributeValue(element, 'parameter'),
    ...(unit ? { unit } : {}),
  };
}

function parseValueStep(type: 'set' | 'max' | 'min', element: Element): SerializableStep {
  const unit = getAttributeValue(element, 'unit');
  return {
    type,
    parameter: getAttributeValue(element, 'parameter'),
    value: getAttributeValue(element, 'value'),
    ...(unit ? { unit } : {}),
  };
}

function parseDeltaStep(type: 'delta_max' | 'delta_min', element: Element): SerializableStep {
  const unit = getAttributeValue(element, 'unit');
  const per = getAttributeValue(element, 'per');
  return {
    type,
    parameter: getAttributeValue(element, 'parameter'),
    value: getAttributeValue(element, 'value'),
    ...(unit ? { unit } : {}),
    ...(per ? { per } : {}),
  };
}

function parseWaitElement(element: Element): SerializableStep {
  const unit = getAttributeValue(element, 'unit');
  return { type: 'wait', duration: getAttributeValue(element, 'duration'), ...(unit ? { unit } : {}) };
}

function parsePumpElement(element: Element): SerializableStep {
  const value = getAttributeValue(element, 'value');
  const unit = getAttributeValue(element, 'unit');
  const raw = getAttributeValue(element, 'raw') || buildValueWithUnit(value, unit);
  return { type: 'pump', value, raw, ...(unit ? { unit } : {}) };
}

function parseSampleElement(element: Element): SerializableStep {
  const interval = getAttributeValue(element, 'interval');
  return {
    type: 'sample',
    parameter: getAttributeValue(element, 'parameter'),
    state: (getAttributeValue(element, 'state') || 'START') as 'START' | 'STOP',
    ...(interval ? { interval } : {}),
  };
}

function parseCalcElement(element: Element): SerializableStep {
  return {
    type: 'calc',
    result: getAttributeValue(element, 'result'),
    function: (getAttributeValue(element, 'function') || 'AVG') as 'AVG' | 'SUM' | 'MIN' | 'MAX' | 'COUNT' | 'STDDEV',
    input: getAttributeValue(element, 'input'),
  };
}

function extractExpressionVariables(expression: string): string[] {
  const variables: string[] = [];
  const matches = expression.matchAll(/"([^"]+)"|\[([^\]]+)\]/g);
  for (const match of matches) variables.push((match[1] || match[2] || '').trim());
  return variables;
}

function parseFunElement(element: Element): SerializableStep {
  const expression = getAttributeValue(element, 'expression');
  return {
    type: 'fun',
    result: getAttributeValue(element, 'result'),
    expression,
    variables: extractExpressionVariables(expression),
  };
}

function parseMessageElement(type: 'log' | 'alarm' | 'error', element: Element): SerializableStep {
  return { type, message: getAttributeValue(element, 'message') };
}

function parseSaveElement(element: Element): SerializableStep {
  return { type: 'save', parameter: getAttributeValue(element, 'parameter') };
}

function parseFuncCallElement(element: Element): SerializableStep {
  const argumentsList = getDirectChildren(element, 'argument').map((arg) => getAttributeValue(arg, 'value')).filter(Boolean);
  return {
    type: 'func_call',
    name: getAttributeValue(element, 'name'),
    ...(argumentsList.length ? { arguments: argumentsList } : {}),
  };
}

function parseUserElement(element: Element): SerializableStep {
  return { type: 'user', action: getAttributeValue(element, 'action'), message: getAttributeValue(element, 'message') };
}

function parseResultElement(element: Element): SerializableStep {
  return { type: 'result', status: getAttributeValue(element, 'status') };
}

function parseOptElement(element: Element): SerializableStep {
  return { type: 'opt', parameter: getAttributeValue(element, 'parameter'), description: getAttributeValue(element, 'description') };
}

function parseInfoElement(element: Element): SerializableStep {
  return { type: 'info', level: getAttributeValue(element, 'level'), message: getAttributeValue(element, 'message') };
}

function parseRepeatElement(): SerializableStep {
  return { type: 'repeat' };
}

function parseEndElement(): SerializableStep {
  return { type: 'end' };
}

function parseOutElement(element: Element): SerializableStep {
  return { type: 'out', outType: getAttributeValue(element, 'outType'), value: getAttributeValue(element, 'value') };
}

function parseDialogElement(element: Element): SerializableStep {
  return { type: 'dialog', parameter: getAttributeValue(element, 'parameter'), message: getAttributeValue(element, 'message') };
}

const XML_STEP_PARSERS: Record<string, XmlStepParser> = {
  task: parseTaskElement,
  if: parseIfElement,
  else: parseElseElement,
  get: (element) => parseParamStep('get', element),
  val: (element) => parseParamStep('val', element),
  set: (element) => parseValueStep('set', element),
  max: (element) => parseValueStep('max', element),
  min: (element) => parseValueStep('min', element),
  delta_max: (element) => parseDeltaStep('delta_max', element),
  delta_min: (element) => parseDeltaStep('delta_min', element),
  wait: parseWaitElement,
  pump: parsePumpElement,
  sample: parseSampleElement,
  calc: parseCalcElement,
  fun: parseFunElement,
  log: (element) => parseMessageElement('log', element),
  alarm: (element) => parseMessageElement('alarm', element),
  error: (element) => parseMessageElement('error', element),
  save: parseSaveElement,
  func_call: parseFuncCallElement,
  user: parseUserElement,
  result: parseResultElement,
  opt: parseOptElement,
  info: parseInfoElement,
  repeat: () => parseRepeatElement(),
  end: () => parseEndElement(),
  out: parseOutElement,
  dialog: parseDialogElement,
};

function parseStepElement(element: Element): SerializableStep | null {
  const parser = XML_STEP_PARSERS[element.tagName.toLowerCase()];
  return parser ? parser(element) : null;
}

function parseBlockSteps(element: Element): SerializableStep[] {
  const stepsElement = getFirstDirectChild(element, 'steps');
  if (!stepsElement) return [];
  return getDirectChildren(stepsElement)
    .map((child) => parseStepElement(child))
    .filter((step): step is SerializableStep => step !== null);
}

function parseGoalElement(element: Element): DslGoal {
  return {
    name: getAttributeValue(element, 'name'),
    tasks: [],
    conditions: [],
    steps: parseBlockSteps(element) as DslStep[],
  };
}

function parseFuncElement(element: Element): DslFunc {
  return {
    name: getAttributeValue(element, 'name'),
    tasks: [],
    steps: parseBlockSteps(element) as DslStep[],
  };
}

export function xmlToAst(xml: string): { ok: boolean; ast?: DslAst; errors?: string[] } {
  try {
    const doc = typeof DOMParser !== 'undefined' ? new DOMParser().parseFromString(xml, 'application/xml') : null;
    if (!doc) return { ok: false, errors: ['DOMParser not available in this environment'] };
    if (doc.querySelector('parsererror')) return { ok: false, errors: ['Invalid XML document'] };
    const root = doc.documentElement;
    if (!root || root.tagName.toLowerCase() !== 'dsl') return { ok: false, errors: ['Missing <dsl> root'] };

    const goals = getDirectChildren(root, 'goal').map((goal) => parseGoalElement(goal));
    const funcs = getDirectChildren(root, 'func').map((func) => parseFuncElement(func));
    const ast: DslAst = {
      scenario: getAttributeValue(root, 'scenario'),
      goals,
      ...(funcs.length ? { funcs } : {}),
    };
    return { ok: true, ast };
  } catch (e: any) {
    return { ok: false, errors: ['Failed to parse XML', String(e?.message || e)] };
  }
}
