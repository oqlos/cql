import { renderLegacyTaskAsDslLines } from '../../../components/dsl/dsl-content-helpers';
import { quoteDslValue as q } from '../../../components/dsl/dsl.quotes';

const GOAL_STEP_INDENT = '  ';

type GoalContent = { dsl: string; goals: string[] };
type StepSerializer = (step: HTMLElement) => string[] | null;

function getSelectValue(step: HTMLElement, selector: string): string {
  return (step.querySelector(selector) as HTMLSelectElement | null)?.value || '';
}

function getInputValue(step: HTMLElement, selector: string): string {
  return (step.querySelector(selector) as HTMLInputElement | null)?.value || '';
}

function getTextContent(step: HTMLElement, selector: string): string {
  return (step.querySelector(selector) as HTMLElement | null)?.textContent || '';
}

function serializeVariableAction(kind: string, param: string, value: string, unit: string): string[] {
  if (!param) return [];
  if (kind === 'GET') return [`${GOAL_STEP_INDENT}GET ${q(param)}${unit ? ` ${q(unit)}` : ''}`];
  if (kind === 'VAL') return [`${GOAL_STEP_INDENT}VAL ${q(param)}${unit ? ` ${q(unit)}` : ''}`];
  const right = unit ? `${value} ${unit}` : value;
  return [`${GOAL_STEP_INDENT}${kind} ${q(param)} ${q(right)}`];
}

function isInvalidConditionToken(value: string): boolean {
  return !value || value.trim() === '' || value.trim() === 'niezdefiniowany';
}

function serializeSetActionBlock(step: HTMLElement): string[] | null {
  if (!step.classList.contains('set-action-block')) return null;
  const action = getSelectValue(step, '.task-action-select');
  const object = getSelectValue(step, '.task-object-select');
  return action && object
    ? renderLegacyTaskAsDslLines({ function: action, object }, GOAL_STEP_INDENT)
    : [];
}

function serializeWaitBlock(step: HTMLElement): string[] | null {
  if (!step.classList.contains('wait-block')) return null;
  const waitAction = (getSelectValue(step, '.task-wait-select') || 'wait').toLowerCase();
  const duration = getInputValue(step, '.wait-duration-input');
  return duration ? [`${GOAL_STEP_INDENT}SET ${q(waitAction.toUpperCase())} ${q(duration)}`] : [];
}

function serializeTaskContainer(step: HTMLElement): string[] | null {
  if (!step.classList.contains('task-container')) return null;
  const builder = step.querySelector('.sentence-builder') as HTMLElement | null;
  if (!builder) return [];
  const rows = Array.from(builder.querySelectorAll('.sentence-part')) as HTMLElement[];
  return rows.flatMap((row) => {
    if (row.querySelector('.btn-add-and')) return [];
    const fn = getSelectValue(row, '.function-select').trim();
    const object = getSelectValue(row, '.object-select').trim();
    return fn && object
      ? renderLegacyTaskAsDslLines({ function: fn, object }, GOAL_STEP_INDENT)
      : [];
  });
}

function serializeVariableBlock(step: HTMLElement): string[] | null {
  if (!step.classList.contains('variable-block')) return null;
  const kind = (step.dataset.varKind || 'SET').toUpperCase();
  const param = getSelectValue(step, '.param-select');
  const value = getInputValue(step, '.value-input');
  const unit = getTextContent(step, '.unit-label');
  return serializeVariableAction(kind, param, value, unit);
}

function serializeConditionGroup(step: HTMLElement): string[] | null {
  if (!step.classList.contains('condition-group')) return null;
  const type = step.dataset.conditionType || '';
  if (type === 'else') {
    const actionType = getSelectValue(step, '.action-type-select') || 'ERROR';
    const message = getInputValue(step, '.message-input');
    return [`${GOAL_STEP_INDENT}ELSE ${actionType} ${q(message)}`];
  }

  const rawParam = getSelectValue(step, '.param-select');
  const rawOperator = getSelectValue(step, '.operator-select') || '>';
  const rawVariable = getSelectValue(step, '.variable-select');
  const param = isInvalidConditionToken(rawParam) ? '' : rawParam.trim();
  const operator = isInvalidConditionToken(rawOperator) ? '>' : rawOperator.trim();
  const variable = isInvalidConditionToken(rawVariable) ? '' : rawVariable.trim();
  return param && variable ? [`${GOAL_STEP_INDENT}IF ${q(param)} ${operator} ${q(variable)}`] : [];
}

function serializeInfoBlock(step: HTMLElement): string[] | null {
  if (!step.classList.contains('info-block')) return null;
  const level = getSelectValue(step, '.info-level-select') || 'INFO';
  const message = getInputValue(step, '.info-message-input');
  return [`${GOAL_STEP_INDENT}INFO ${q(level)} ${q(message)}`];
}

function serializeResultBlock(step: HTMLElement): string[] | null {
  if (!step.classList.contains('result-block')) return null;
  const status = getSelectValue(step, '.result-select') || 'OK';
  return [`${GOAL_STEP_INDENT}RESULT ${q(status)}`];
}

function serializeLogBlock(step: HTMLElement): string[] | null {
  if (!step.classList.contains('log-block')) return null;
  const message = getSelectValue(step, '.log-select');
  return message ? [`${GOAL_STEP_INDENT}LOG "${message}"`] : [];
}

function serializeFuncCallBlock(step: HTMLElement): string[] | null {
  if (!step.classList.contains('func-call-block')) return null;
  const funcName = getSelectValue(step, '.func-call-select');
  return funcName ? [`${GOAL_STEP_INDENT}FUNC ${q(funcName)}`] : [];
}

function serializeOutBlock(step: HTMLElement): string[] | null {
  if (!step.classList.contains('out-block')) return null;
  const outType = getSelectValue(step, '.out-type-select') || 'RESULT';
  const value = getInputValue(step, '.out-value-input') || getSelectValue(step, '.out-value-select');
  return [`${GOAL_STEP_INDENT}OUT ${q(outType)} ${q(value)}`];
}

function serializeDialogBlock(step: HTMLElement): string[] | null {
  if (!step.classList.contains('dialog-block')) return null;
  const param = getSelectValue(step, '.dialog-param-select');
  const message = getInputValue(step, '.dialog-message-input');
  return [`${GOAL_STEP_INDENT}DIALOG ${q(param)} ${q(message)}`];
}

function serializeRepeatBlock(step: HTMLElement): string[] | null {
  return step.classList.contains('repeat-block') ? [`${GOAL_STEP_INDENT}REPEAT`] : null;
}

function serializeEndBlock(step: HTMLElement): string[] | null {
  return step.classList.contains('end-block') ? [`${GOAL_STEP_INDENT}END`] : null;
}

function serializeVariableContainer(step: HTMLElement): string[] | null {
  if (!step.classList.contains('variable-container')) return null;
  const builder = step.querySelector('.variable-builder') as HTMLElement | null;
  if (!builder) return [];
  const containerKind = step.dataset.varKind || '';
  const rows = Array.from(builder.querySelectorAll('.var-row')) as HTMLElement[];
  return rows.flatMap((row) => {
    const action = (row.getAttribute('data-kind') || getSelectValue(row, '.action-select') || containerKind || 'SET').trim().toUpperCase();
    const param = getSelectValue(row, '.param-select').trim();
    const value = getInputValue(row, '.value-input').trim();
    const unit = getSelectValue(row, '.unit-select').trim();
    return serializeVariableAction(action, param, value, unit);
  });
}

const STEP_SERIALIZERS: StepSerializer[] = [
  serializeSetActionBlock,
  serializeWaitBlock,
  serializeTaskContainer,
  serializeVariableBlock,
  serializeConditionGroup,
  serializeInfoBlock,
  serializeResultBlock,
  serializeLogBlock,
  serializeFuncCallBlock,
  serializeOutBlock,
  serializeDialogBlock,
  serializeRepeatBlock,
  serializeEndBlock,
  serializeVariableContainer,
];

function serializeGoalStep(step: HTMLElement): string[] {
  for (const serializer of STEP_SERIALIZERS) {
    const lines = serializer(step);
    if (lines !== null) return lines;
  }
  return [];
}

function buildGoalDslLines(goalSection: HTMLElement): string[] {
  const stepsContainer = goalSection.querySelector('.steps-container');
  if (!stepsContainer) return [];
  const steps = Array.from(stepsContainer.children) as HTMLElement[];
  return steps.flatMap((step) => serializeGoalStep(step));
}

export function buildGoalContentFromSection(goalSection: HTMLElement | null, goalName: string): GoalContent | null {
  if (!goalSection) return null;
  try {
    return {
      dsl: [`GOAL: ${goalName}`, ...buildGoalDslLines(goalSection)].join('\n'),
      goals: [goalName],
    };
  } catch {
    return null;
  }
}
