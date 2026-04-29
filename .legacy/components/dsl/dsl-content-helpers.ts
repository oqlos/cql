// frontend/src/components/dsl/dsl-content-helpers.ts
// Content processing utilities moved from test-dsl

import { parseDsl } from './dsl.parser';
import { quoteDslValue as q } from './dsl.quotes';

/**
 * Ensure SCENARIO header exists; optionally inject title
 */
export function normalizeDsl(text: string, title?: string): string {
  const raw = String(text || '').trim();
  if (!raw) return title ? `SCENARIO: ${title}` : 'SCENARIO: scenario';
  const hasHeader = /^\s*SCENARIO\s*:/i.test(raw);
  return hasHeader ? raw : `SCENARIO: ${title || 'scenario'}\n${raw}`;
}

/**
 * Normalize a DSL/CQL line that uses single quotes so existing parsers can read it.
 * Keeps the line untouched when it already uses double quotes.
 */
export function normalizeQuotedDslLine(line: string): string {
  const raw = String(line || '');
  if (!raw.includes("'") || raw.includes('"')) return raw;
  return raw.replace(/'([^']*)'/g, '"$1"');
}

function normalizeActionTarget(raw: string): string {
  const value = String(raw || '').trim();
  if (!value) return '';
  const valveMatch = value.match(/(?:^|\b)(?:zaw[oó]r|bo)\s*0*(\d+)\b/i);
  if (valveMatch) return `zawór ${parseInt(valveMatch[1], 10)}`;
  if (/spr[eę]żarka|sprezarka|compressor/i.test(value)) return 'sprężarka';
  return value;
}

function isOffAction(action: string): boolean {
  return /(zamknij|wy[łl]ącz|wylacz|disable|off|stop)/i.test(String(action || '').trim());
}

type LegacyTaskLike = {
  function?: string;
  action?: string;
  object?: string;
  ands?: LegacyTaskLike[];
};

function isTimingAction(value: string): boolean {
  return /^(wait|delay|pause|timeout)$/i.test(String(value || '').trim());
}

function buildLegacySetLine(target: string, value: string, indent: string): string {
  return `${indent}SET ${q(target)} ${q(value)}`;
}

function getLegacyTaskFunctionName(task: Pick<LegacyTaskLike, 'function' | 'action'>): string {
  return String(task.function ?? task.action ?? '').trim();
}

function getLegacyTaskObjectName(task: Pick<LegacyTaskLike, 'object'>): string {
  return String(task.object ?? '').trim();
}

function renderLegacyTimingTask(functionName: string, rawObject: string, indent: string): string[] | null {
  if (!isTimingAction(functionName) && !isTimingAction(rawObject)) return null;

  const keyword = (isTimingAction(functionName) ? functionName : rawObject).trim().toLowerCase();
  const value = (isTimingAction(functionName) ? rawObject : functionName).trim();
  return value ? [buildLegacySetLine(keyword, value, indent)] : [];
}

function renderLegacyObjectTask(functionName: string, rawObject: string, indent: string): string[] | null {
  const objectName = normalizeActionTarget(rawObject);
  if (!objectName) return null;
  return [buildLegacySetLine(objectName, isOffAction(functionName) ? '0' : '1', indent)];
}

function renderLegacyFunctionTask(functionName: string, indent: string): string[] {
  return functionName ? [buildLegacySetLine(functionName, '1', indent)] : [];
}

function renderSingleLegacyTask(task: Pick<LegacyTaskLike, 'function' | 'action' | 'object'>, indent: string): string[] {
  const functionName = getLegacyTaskFunctionName(task);
  const rawObject = getLegacyTaskObjectName(task);

  if (!functionName && !rawObject) return [];

  return renderLegacyTimingTask(functionName, rawObject, indent)
    ?? renderLegacyObjectTask(functionName, rawObject, indent)
    ?? renderLegacyFunctionTask(functionName, indent);
}

function getLegacyTaskSequence(task: LegacyTaskLike): Array<Pick<LegacyTaskLike, 'function' | 'action' | 'object'>> {
  return [task, ...(Array.isArray(task.ands) ? task.ands : [])];
}

export function renderLegacyTaskAsDslLines(task: LegacyTaskLike, indent = '  '): string[] {
  return getLegacyTaskSequence(task).flatMap((entry) => renderSingleLegacyTask(entry, indent));
}

function buildConditionalLine(step: any, indent = '  '): string {
  const unit = String(step?.unit || '').trim();
  const value = String(step?.value ?? '').trim();
  return `${indent}IF ${q(String(step?.parameter || ''))} ${step?.operator || '='} ${q(`${value}${unit ? ` ${unit}` : ''}`)}`;
}

function buildElseLine(step: any, indent = '  '): string {
  return `${indent}ELSE ${(step?.actionType || 'ERROR').toString().toUpperCase()} ${q(String(step?.actionMessage || ''))}`;
}

function buildVariablePayload(value: string, unit: string): string {
  return unit ? `${value} ${unit}` : value;
}

function appendVariableEntries(lines: string[], variables: any[], indent = '  '): void {
  for (const entry of variables) {
    const action = String(entry?.action || 'GET').toUpperCase();
    const parameter = String(entry?.parameter || '');
    const value = String(entry?.value ?? '').trim();
    const unit = String(entry?.unit || '').trim();
    if (!parameter) continue;

    if (action === 'GET') {
      lines.push(`${indent}GET ${q(parameter)}${unit ? ` ${q(unit)}` : ''}`);
      continue;
    }

    if (action === 'SET' || action === 'MAX' || action === 'MIN') {
      lines.push(`${indent}${action} ${q(parameter)} ${q(buildVariablePayload(value, unit))}`);
    }
  }
}

function appendVariableGroups(lines: string[], variableGroups: any[], indent = '  '): void {
  for (const group of variableGroups) {
    const variables = Array.isArray(group?.variables) ? group.variables : [];
    appendVariableEntries(lines, variables, indent);
  }
}

function appendConditionLines(lines: string[], conditions: any[], indent = '  '): void {
  for (const condition of conditions) {
    const type = String(condition?.type || '').toLowerCase();
    if (type === 'if') {
      lines.push(buildConditionalLine(condition, indent));
    } else if (type === 'else') {
      lines.push(buildElseLine(condition, indent));
    }
  }
}

function appendTaskRange(lines: string[], tasks: any[], startIndex = 0, endIndex = tasks.length): void {
  for (let index = startIndex; index < endIndex; index++) {
    lines.push(...renderLegacyTaskAsDslLines(tasks[index], '  '));
  }
}

function findFirstOffTaskIndex(tasks: any[]): number {
  return tasks.findIndex((task) => {
    const name = String(task?.function || '').toLowerCase();
    return name.includes('wyłącz') || name.includes('wylacz') || name.includes('off');
  });
}

function appendStructuredGoalSteps(lines: string[], goal: any): void {
  const steps = Array.isArray(goal?.steps) ? goal.steps : [];
  for (const step of steps) {
    const type = String(step?.type || '').toLowerCase();
    if (type === 'task') {
      lines.push(...renderLegacyTaskAsDslLines(step, '  '));
    } else if (type === 'if') {
      lines.push(buildConditionalLine(step));
    } else if (type === 'else') {
      lines.push(buildElseLine(step));
    } else if (type === 'variable') {
      const variables = Array.isArray(step?.variables) ? step.variables : [];
      appendVariableEntries(lines, variables);
    }
  }
}

function appendLegacyGoalContent(lines: string[], goal: any): void {
  const tasks = Array.isArray(goal?.tasks) ? goal.tasks : [];
  const variableGroups = Array.isArray(goal?.variables) ? goal.variables : [];
  const conditions = Array.isArray(goal?.conditions) ? goal.conditions : [];
  const splitIndex = findFirstOffTaskIndex(tasks);

  if (splitIndex >= 0) {
    appendTaskRange(lines, tasks, 0, splitIndex);
    appendVariableGroups(lines, variableGroups);
    appendConditionLines(lines, conditions);
    appendTaskRange(lines, tasks, splitIndex);
    return;
  }

  appendTaskRange(lines, tasks);
  appendVariableGroups(lines, variableGroups);
  appendConditionLines(lines, conditions);
}

function appendGoalDsl(lines: string[], goal: any): void {
  const goalName = String(goal?.name || 'GOAL');
  lines.push(`GOAL: ${goalName}`);

  const steps = Array.isArray(goal?.steps) ? goal.steps : [];
  if (steps.length > 0) {
    appendStructuredGoalSteps(lines, goal);
  } else {
    appendLegacyGoalContent(lines, goal);
  }

  lines.push('');
}

function buildScenarioDslLines(content: any, title?: string): string[] {
  const lines: string[] = [`SCENARIO: ${title || 'scenario'}`];
  const goals = Array.isArray(content?.goals) ? content.goals : [];
  if (!goals.length) return lines;
  goals.forEach((goal: any) => appendGoalDsl(lines, goal));
  return lines;
}

/**
 * Build DSL string from scenario.content (prefer content.dsl, fallback to JSON goals)
 */
export function dslFromScenarioContent(content: any, title?: string): string {
  try {
    const dsl = (content && typeof content === 'object') ? String(content.dsl || '').trim() : '';
    if (dsl) return normalizeDsl(dsl, title);
  } catch { /* silent */ }
  try {
    return buildScenarioDslLines(content, title).join('\n');
  } catch { /* silent */ }
  return buildScenarioDslLines(null, title).join('\n');
}

/**
 * Extract goal names from content
 */
export function goalsFromContent(content: any, title?: string): string[] {
  try {
    const text = dslFromScenarioContent(content, title);
    const res = parseDsl(text);
    if (res.ok) return res.ast.goals.map((g: any) => g.name);
  } catch { /* silent */ }
  return [];
}
