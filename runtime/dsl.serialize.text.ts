import type { DslAst, DslElseCondition, DslGoal, DslIfCondition, DslStep, DslTask, DslFunc } from './dsl.types';
import { renderLegacyTaskAsDslLines } from './dsl-content-helpers';
import { canonicalizeDslLineQuotes, quoteDslValue as q } from './dsl.quotes';

type DslBlock = Pick<DslGoal, 'name' | 'tasks' | 'steps'> & { conditions?: Array<DslIfCondition | DslElseCondition> };
type SerializableStep = DslStep;
type StepSerializer = (step: SerializableStep) => string[] | null;
type StepOfType<T extends DslStep['type']> = Extract<DslStep, { type: T }>;

const STEP_INDENT = '  ';

function buildValueWithUnit(value: unknown, unit?: string): string {
  const valueText = String(value ?? '').trim();
  const unitText = String(unit || '').trim();
  return unitText ? `${valueText} ${unitText}` : valueText;
}

function isStepType<T extends DslStep['type']>(step: SerializableStep, type: T): step is StepOfType<T> {
  return step.type === type;
}

function serializeTaskStep(step: SerializableStep): string[] | null {
  return isStepType(step, 'task') ? renderLegacyTaskAsDslLines(step, STEP_INDENT) : null;
}

function serializeIfStep(step: SerializableStep): string[] | null {
  if (!isStepType(step, 'if')) return null;
  return [`${STEP_INDENT}IF ${q(step.parameter)} ${step.operator} ${q(buildValueWithUnit(step.value, step.unit))}`];
}

function serializeElseStep(step: SerializableStep): string[] | null {
  if (!isStepType(step, 'else')) return null;
  if (!step.actionType && !step.actionMessage) return [`${STEP_INDENT}ELSE`];
  return [`${STEP_INDENT}ELSE ${String(step.actionType || 'ERROR').toUpperCase()} ${q(step.actionMessage || '')}`];
}

function serializeParamQueryStep(type: 'get' | 'val', keyword: string, step: SerializableStep): string[] | null {
  if (!isStepType(step, type)) return null;
  const parameter = String(step.parameter || '');
  const unit = String(step.unit || '');
  return [unit ? `${STEP_INDENT}${keyword} ${q(parameter)} ${q(unit)}` : `${STEP_INDENT}${keyword} ${q(parameter)}`];
}

function serializeValueStep(type: 'set' | 'max' | 'min', keyword: string, step: SerializableStep): string[] | null {
  if (!isStepType(step, type)) return null;
  return [`${STEP_INDENT}${keyword} ${q(String(step.parameter || ''))} ${q(buildValueWithUnit(step.value, step.unit))}`];
}

function serializeDeltaStep(type: 'delta_max' | 'delta_min', keyword: string, step: SerializableStep): string[] | null {
  if (!isStepType(step, type)) return null;
  const per = String(step.per || '').trim();
  const perText = per ? ` PER ${q(per)}` : '';
  return [`${STEP_INDENT}${keyword} ${q(String(step.parameter || ''))} ${q(buildValueWithUnit(step.value, step.unit))}${perText}`];
}

function serializeWaitStep(step: SerializableStep): string[] | null {
  return isStepType(step, 'wait')
    ? [`${STEP_INDENT}SET ${q('WAIT')} ${q(buildValueWithUnit(step.duration, step.unit))}`]
    : null;
}

function serializePumpStep(step: SerializableStep): string[] | null {
  return isStepType(step, 'pump')
    ? [`${STEP_INDENT}SET ${q('POMPA')} ${q(buildValueWithUnit(step.value, step.unit))}`]
    : null;
}

function serializeSampleStep(step: SerializableStep): string[] | null {
  if (!isStepType(step, 'sample')) return null;
  const interval = String(step.interval || '').trim();
  return [`${STEP_INDENT}SAMPLE ${q(String(step.parameter || ''))} ${q(String(step.state || 'START').toUpperCase())}${interval ? ` ${q(interval)}` : ''}`];
}

function serializeCalcStep(step: SerializableStep): string[] | null {
  return isStepType(step, 'calc')
    ? [`${STEP_INDENT}CALC ${q(String(step.result || ''))} = ${q(String(step.function || ''))} ${q(String(step.input || ''))}`]
    : null;
}

function serializeFunStep(step: SerializableStep): string[] | null {
  if (!isStepType(step, 'fun')) return null;
  return [`${STEP_INDENT}FUN ${q(String(step.result || ''))} = ${canonicalizeDslLineQuotes(String(step.expression || ''))}`];
}

function serializeMessageStep(type: 'log' | 'alarm' | 'error', keyword: string, step: SerializableStep): string[] | null {
  return isStepType(step, type) ? [`${STEP_INDENT}${keyword} ${q(String(step.message || ''))}`] : null;
}

function serializeSaveStep(step: SerializableStep): string[] | null {
  return isStepType(step, 'save') ? [`${STEP_INDENT}SAVE ${q(String(step.parameter || ''))}`] : null;
}

function serializeFuncCallStep(step: SerializableStep): string[] | null {
  if (!isStepType(step, 'func_call')) return null;
  const args = Array.isArray(step.arguments) ? step.arguments.map((value) => String(value || '').trim()).filter(Boolean) : [];
  const argText = args.map((value) => ` ${q(value)}`).join('');
  return [`${STEP_INDENT}FUNC ${q(String(step.name || ''))}${argText}`];
}

function serializeUserStep(step: SerializableStep): string[] | null {
  return isStepType(step, 'user')
    ? [`${STEP_INDENT}USER ${q(String(step.action || ''))} ${q(String(step.message || ''))}`]
    : null;
}

function serializeResultStep(step: SerializableStep): string[] | null {
  return isStepType(step, 'result') ? [`${STEP_INDENT}RESULT ${q(String(step.status || ''))}`] : null;
}

function serializeOptStep(step: SerializableStep): string[] | null {
  return isStepType(step, 'opt')
    ? [`${STEP_INDENT}OPT ${q(String(step.parameter || ''))} ${q(String(step.description || ''))}`]
    : null;
}

function serializeInfoStep(step: SerializableStep): string[] | null {
  return isStepType(step, 'info')
    ? [`${STEP_INDENT}INFO ${q(String(step.level || 'INFO').toUpperCase())} ${q(String(step.message || ''))}`]
    : null;
}

function serializeRepeatStep(step: SerializableStep): string[] | null {
  return isStepType(step, 'repeat') ? [`${STEP_INDENT}REPEAT`] : null;
}

function serializeEndStep(step: SerializableStep): string[] | null {
  return isStepType(step, 'end') ? [`${STEP_INDENT}END`] : null;
}

function serializeOutStep(step: SerializableStep): string[] | null {
  return isStepType(step, 'out')
    ? [`${STEP_INDENT}OUT ${q(String(step.outType || ''))} ${q(String(step.value || ''))}`]
    : null;
}

function serializeDialogStep(step: SerializableStep): string[] | null {
  return isStepType(step, 'dialog')
    ? [`${STEP_INDENT}DIALOG ${q(String(step.parameter || ''))} ${q(String(step.message || ''))}`]
    : null;
}

const STEP_SERIALIZERS: StepSerializer[] = [
  serializeTaskStep,
  serializeIfStep,
  serializeElseStep,
  (step) => serializeFuncCallStep(step),
  (step) => serializeParamQueryStep('get', 'GET', step),
  (step) => serializeParamQueryStep('val', 'VAL', step),
  (step) => serializeValueStep('set', 'SET', step),
  (step) => serializeValueStep('max', 'MAX', step),
  (step) => serializeValueStep('min', 'MIN', step),
  (step) => serializeDeltaStep('delta_max', 'DELTA_MAX', step),
  (step) => serializeDeltaStep('delta_min', 'DELTA_MIN', step),
  serializeWaitStep,
  serializePumpStep,
  serializeSampleStep,
  serializeCalcStep,
  serializeFunStep,
  (step) => serializeMessageStep('log', 'LOG', step),
  (step) => serializeMessageStep('alarm', 'ALARM', step),
  (step) => serializeMessageStep('error', 'ERROR', step),
  serializeSaveStep,
  serializeUserStep,
  serializeResultStep,
  serializeOptStep,
  serializeInfoStep,
  serializeRepeatStep,
  serializeDialogStep,
  serializeOutStep,
  serializeEndStep,
];

function renderStructuredStep(step: SerializableStep): string[] {
  for (const serializer of STEP_SERIALIZERS) {
    const lines = serializer(step);
    if (lines !== null) return lines;
  }
  return [];
}

function renderLegacyBlockContent(block: DslBlock): string[] {
  const lines: string[] = [];
  for (const task of (block.tasks || []) as DslTask[]) lines.push(...renderLegacyTaskAsDslLines(task, STEP_INDENT));
  for (const condition of block.conditions || []) lines.push(...renderStructuredStep(condition));
  return lines;
}

function buildBlockLines(header: string, block: DslBlock): string[] {
  const lines = [header];
  const structuredSteps = Array.isArray(block.steps) && block.steps.length > 0
    ? block.steps.flatMap((step) => renderStructuredStep(step))
    : renderLegacyBlockContent(block);
  lines.push(...structuredSteps);
  lines.push('');
  return lines;
}

function buildScenarioLines(ast: DslAst): string[] {
  const lines: string[] = [`SCENARIO: ${(ast.scenario || '').trim() || 'Bez nazwy'}`, ''];
  for (const goal of ast.goals as DslGoal[]) lines.push(...buildBlockLines(`GOAL: ${goal.name}`, goal));
  for (const func of (ast.funcs || []) as DslFunc[]) lines.push(...buildBlockLines(`FUNC: ${func.name}`, func));
  return lines;
}

export function astToDslText(ast: DslAst): string {
  return buildScenarioLines(ast).join('\n');
}

export function normalizeDslText(text: string): string {
  // Simple normalization: trim trailing spaces and ensure LF newlines
  return (text || '').replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '').trim() + '\n';
}
