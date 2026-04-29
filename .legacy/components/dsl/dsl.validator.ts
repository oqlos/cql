import { canonicalizeDslQuotes, formatDslLiteral } from './dsl.quotes';

import { normalizeQuotedDslLine } from './dsl.quote-utils';

export type DslRuleViolation = {
  ruleId: string;
  line: number;
  message: string;
  severity: 'error' | 'warning';
  suggestion?: string;
  fixedLine?: string;
};

export type DslValidateResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  violations: DslRuleViolation[];
  fixedText?: string;
};

// Shared pattern for "literal" value
const VALUE = '"([^"]*)"';

// Pre-compiled regex for validation
const RX = {
  ELSE_MSG: /^\s*ELSE\s+(ERROR|WARN|WARNING|INFO)\s*(?:"([^"]*)")?\s*$/i,
  ELSE_BLOCK: /^\s*ELSE\s*$/i,
  ELSE_INVALID: /^\s*ELSE\s+(?!ERROR|WARN|WARNING|INFO)\S+/i,
  IF_BRACKET_OP: /^\s*IF\s*"(.*?)"\s*\[(>=|<=|>|<|=)\]\s*"(.*?)"\s*$/i,
  SET: new RegExp(`^\\s*SET\\s*"([^"]*)"\\s*${VALUE}\\s*$`, 'i'),
  IF: new RegExp(`^\\s*IF\\s*"([^"]*)"\\s*(>=|<=|>|<|=)?\\s*${VALUE}\\s*$`, 'i'),
  GET: /^\s*GET\s*"(.*?)"(?:\s*"(.*?)")?\s*$/i,
  VAL: /^\s*VAL\s*"(.*?)"(?:\s*"(.*?)")?\s*$/i,
  MAX: new RegExp(`^\\s*MAX\\s*"([^"]*)"\\s*${VALUE}\\s*$`, 'i'),
  MIN: new RegExp(`^\\s*MIN\\s*"([^"]*)"\\s*${VALUE}\\s*$`, 'i'),
  GOAL: /^\s*GOAL:\s*(.+)$/i,
  OUT: new RegExp(`^\\s*OUT\\s*"(VAL|MAX|MIN|UNIT|GET|RESULT)"\\s*${VALUE}\\s*$`, 'i'),
  DIALOG: new RegExp(`^\\s*DIALOG\\s*"([^"]*)"\\s*${VALUE}\\s*$`, 'i'),
} as const;

/** Check if token is invalid placeholder */
const isBadToken = (s: string): boolean => {
  const t = String(s || '').trim();
  return !t || t === '*' || /^undefined$/i.test(t) || /^"\\s*"$/.test(t);
};

/** Create violation helper */
const violation = (
  ruleId: string, line: number, severity: 'error' | 'warning',
  message: string, suggestion?: string, fixedLine?: string
): DslRuleViolation => ({ ruleId, line, message, severity, suggestion, fixedLine });

// Known sensor/firmware variables that require GET declaration
const SENSOR_VARIABLES = new Set(['NC', 'WC', 'PC', 'TC', 'SC', 'P1', 'P2', 'T1', 'T2']);

type GoalTrackingState = {
  declaredVals: Set<string>;
  declaredMins: Set<string>;
  declaredMaxs: Set<string>;
  declaredGets: Set<string>;
  usedVars: Set<string>;
  startLine: number;
};

type ValidationState = {
  lines: string[];
  errors: string[];
  warnings: string[];
  violations: DslRuleViolation[];
  fixed: string[];
  goal: GoalTrackingState;
};

type ValidationLine = {
  line: string;
  normalized: string;
  lineNum: number;
  index: number;
};

type MissingEndIssue = { line: number; missing: number };

const q = (value: string) => formatDslLiteral(value);

function createGoalTrackingState(startLine: number = -1): GoalTrackingState {
  return {
    declaredVals: new Set<string>(),
    declaredMins: new Set<string>(),
    declaredMaxs: new Set<string>(),
    declaredGets: new Set<string>(),
    usedVars: new Set<string>(),
    startLine,
  };
}

function createValidationState(text: string): ValidationState {
  const lines = (text || '').split(/\r?\n/);
  return {
    lines,
    errors: [],
    warnings: [],
    violations: [],
    fixed: lines.slice(),
    goal: createGoalTrackingState(),
  };
}

function addError(state: ValidationState, item: DslRuleViolation): void {
  state.violations.push(item);
  state.errors.push(`Linia ${item.line}: ${item.message}`);
}

function addWarning(state: ValidationState, item: DslRuleViolation): void {
  state.violations.push(item);
  state.warnings.push(`Linia ${item.line}: ${item.message}`);
}

function trackSensorUsage(state: ValidationState, ...values: string[]): void {
  values.forEach((value) => {
    const normalized = String(value || '').trim();
    if (normalized && SENSOR_VARIABLES.has(normalized)) {
      state.goal.usedVars.add(normalized);
    }
  });
}

function insertGetDeclaration(state: ValidationState, variableName: string): void {
  if (state.goal.startLine < 0) return;
  const getLine = `  GET ${q(variableName)}`;
  let insertIdx = state.goal.startLine + 1;
  while (insertIdx < state.fixed.length && !state.fixed[insertIdx].trim()) insertIdx++;
  state.fixed.splice(insertIdx, 0, getLine);
}

function flushMissingGetDeclarations(state: ValidationState): void {
  for (const usedVar of state.goal.usedVars) {
    if (!SENSOR_VARIABLES.has(usedVar) || state.goal.declaredGets.has(usedVar) || state.goal.startLine < 0) {
      continue;
    }

    addWarning(state, violation(
      'missing_get_declaration',
      state.goal.startLine + 1,
      'warning',
      `Zmienna czujnika "${usedVar}" użyta bez deklaracji GET.`,
      `Dodaj: GET ${q(usedVar)} przed użyciem zmiennej.`,
    ));
    insertGetDeclaration(state, usedVar);
  }
}

function startNewGoal(state: ValidationState, lineIndex: number): void {
  flushMissingGetDeclarations(state);
  state.goal = createGoalTrackingState(lineIndex);
}

function flushMissingGoalEnds(
  inGoal: boolean,
  currentGoalLine: number,
  depth: number,
  output: string[],
  issues: MissingEndIssue[],
): number {
  if (!inGoal || depth <= 0) return 0;
  issues.push({ line: currentGoalLine, missing: depth });
  for (let index = 0; index < depth; index++) output.push('  END');
  return 0;
}

function ensureEndBlocks(srcLines: string[]): { fixedLines: string[]; issues: MissingEndIssue[] } {
  const fixedLines: string[] = [];
  const issues: MissingEndIssue[] = [];
  let inGoal = false;
  let currentGoalLine = 1;
  let depth = 0;

  for (const line of srcLines) {
    const text = String(line || '');
    const trimmed = text.trim();
    const upper = trimmed.toUpperCase();

    if (RX.GOAL.test(text)) {
      depth = flushMissingGoalEnds(inGoal, currentGoalLine, depth, fixedLines, issues);
      inGoal = true;
      currentGoalLine = fixedLines.length + 1;
      fixedLines.push(text);
      continue;
    }

    if (inGoal && upper.startsWith('IF ')) {
      depth++;
      fixedLines.push(text);
      continue;
    }

    if (inGoal && upper === 'END') {
      if (depth > 0) depth--;
      fixedLines.push(text);
      continue;
    }

    fixedLines.push(text);
  }

  flushMissingGoalEnds(inGoal, currentGoalLine, depth, fixedLines, issues);
  return { fixedLines, issues };
}

function handleGoalLine(state: ValidationState, context: ValidationLine): boolean {
  if (!RX.GOAL.test(context.normalized)) return false;
  startNewGoal(state, context.index);
  return true;
}

function handleElseLine(state: ValidationState, context: ValidationLine): boolean {
  if (RX.ELSE_BLOCK.test(context.normalized) || RX.ELSE_MSG.test(context.normalized)) return true;
  if (!RX.ELSE_INVALID.test(context.normalized)) return false;

  addError(state, violation(
    'else_invalid',
    context.lineNum,
    'error',
    'ELSE wymaga typu akcji (ERROR/WARN/INFO).',
    `Użyj: ELSE ERROR ${q('komunikat')} lub ELSE WARN ${q('komunikat')}`,
  ));
  state.fixed[context.index] = `ELSE ERROR ${q('Błąd')}`;
  return true;
}

function handleBracketedIfLine(state: ValidationState, context: ValidationLine): boolean {
  const match = context.normalized.match(RX.IF_BRACKET_OP);
  if (!match) return false;

  const [, param, op, value] = match.map((item) => (item || '').trim());
  const preferred = `IF ${q(param)} ${op} ${q(value)}`;
  if (preferred !== context.line) {
    addWarning(state, violation(
      'operator_no_brackets',
      context.lineNum,
      'warning',
      'Preferowany zapis operatora bez nawiasów kwadratowych.',
      preferred,
      preferred,
    ));
    state.fixed[context.index] = preferred;
  }

  if (isBadToken(param) || isBadToken(value)) {
    const which = isBadToken(param) && isBadToken(value)
      ? 'parametr i wartość'
      : (isBadToken(param) ? 'parametr' : 'wartość');
    addError(state, violation(
      'no_placeholder_or_undefined',
      context.lineNum,
      'error',
      `Niedozwolone użycie placeholdera "*" lub undefined (${which}) w IF.`,
      'Wybierz konkretną zmienną/cel; usuń placeholdery.',
    ));
  }
  return true;
}

function handleIfLine(state: ValidationState, context: ValidationLine): boolean {
  const match = context.normalized.match(RX.IF);
  if (!match) return false;

  const param = (match[1] || '').trim();
  const value = (match[3] || '').trim();
  trackSensorUsage(state, param, value);

  if (isBadToken(param) || isBadToken(value)) {
    const which = isBadToken(param) && isBadToken(value)
      ? 'parametr i wartość'
      : (isBadToken(param) ? 'parametr' : 'wartość');
    addError(state, violation(
      'no_placeholder_or_undefined',
      context.lineNum,
      'error',
      `Niedozwolone użycie placeholdera "*" lub undefined (${which}) w IF.`,
      'Wybierz konkretną zmienną/cel; usuń placeholdery.',
    ));
  }
  return true;
}

function trackCompoundIfUsage(state: ValidationState, normalizedLine: string): void {
  const compoundIfMatch = normalizedLine.match(/IF\s*\[([^\]]+)\].*OR.*\[([^\]]+)\]/i);
  if (!compoundIfMatch) return;
  trackSensorUsage(state, compoundIfMatch[1] || '', compoundIfMatch[2] || '');
}

function handleSetLine(state: ValidationState, context: ValidationLine): boolean {
  const match = context.normalized.match(RX.SET);
  if (!match) return false;

  const param = (match[1] || '').trim();
  const value = (match[2] || '').trim();
  if (isBadToken(param)) {
    addError(state, violation(
      'no_placeholder_or_undefined',
      context.lineNum,
      'error',
      'Niedozwolony parametr "*" lub undefined w SET.',
      'Podaj prawidłową nazwę zmiennej.',
    ));
  }
  if (isBadToken(value)) {
    addError(state, violation(
      'no_placeholder_or_undefined',
      context.lineNum,
      'error',
      'Niedozwolona wartość "*" lub undefined w SET.',
      'Podaj konkretną wartość, np. 9 s',
    ));
  }
  if (!value) {
    addError(state, violation(
      'set_value_required',
      context.lineNum,
      'error',
      'SET wymaga wartości.',
      `Dodaj wartość, np. SET ${q('ciśnienie')} ${q('6.0 mbar')}`,
    ));
  }
  return true;
}

function handleGetLine(state: ValidationState, context: ValidationLine): boolean {
  const match = context.normalized.match(RX.GET);
  if (!match) return false;

  const param = (match[1] || '').trim();
  const unit = (match[2] || '').trim();
  if (isBadToken(param)) {
    addError(state, violation(
      'no_placeholder_or_undefined',
      context.lineNum,
      'error',
      'Niedozwolony parametr "*" lub undefined w GET.',
      'Wybierz konkretną zmienną.',
    ));
  } else {
    state.goal.declaredGets.add(param);
  }
  if (unit && isBadToken(unit)) {
    addError(state, violation(
      'no_placeholder_or_undefined',
      context.lineNum,
      'error',
      'Niedozwolona jednostka "*" lub undefined w GET.',
      'Wybierz poprawną jednostkę lub pomiń ją.',
    ));
  }
  return true;
}

function handleValLine(state: ValidationState, context: ValidationLine): boolean {
  const match = context.normalized.match(RX.VAL);
  if (!match) return false;

  const param = (match[1] || '').trim();
  const unit = (match[2] || '').trim();
  if (isBadToken(param)) {
    addError(state, violation(
      'no_placeholder_or_undefined',
      context.lineNum,
      'error',
      'Niedozwolony parametr "*" lub undefined w VAL.',
      'Wybierz konkretną zmienną.',
    ));
  } else if (state.goal.declaredVals.has(param)) {
    addWarning(state, violation(
      'duplicate_val',
      context.lineNum,
      'warning',
      `VAL "${param}" już zadeklarowane w tym GOAL. Zamieniono na GET.`,
      'VAL może być użyte tylko raz dla danego parametru w GOAL.',
    ));
    state.fixed[context.index] = unit ? `  GET ${q(param)} ${q(unit)}` : `  GET ${q(param)}`;
  } else {
    state.goal.declaredVals.add(param);
  }

  if (unit && isBadToken(unit)) {
    addError(state, violation(
      'no_placeholder_or_undefined',
      context.lineNum,
      'error',
      'Niedozwolona jednostka "*" lub undefined w VAL.',
      'Wybierz poprawną jednostkę lub pomiń ją.',
    ));
  }
  return true;
}

function handleLimitLine(
  state: ValidationState,
  context: ValidationLine,
  action: 'MAX' | 'MIN',
  regex: RegExp,
  declared: Set<string>,
): boolean {
  const match = context.normalized.match(regex);
  if (!match) return false;

  const param = (match[1] || '').trim();
  const value = (match[2] || '').trim();
  if (isBadToken(param) || isBadToken(value)) {
    const which = isBadToken(param) && isBadToken(value)
      ? 'parametr i wartość'
      : (isBadToken(param) ? 'parametr' : 'wartość');
    addError(state, violation(
      'no_placeholder_or_undefined',
      context.lineNum,
      'error',
      `Niedozwolone użycie "*" lub undefined (${which}) w ${action}.`,
      'Podaj prawidłową nazwę i wartość.',
    ));
    return true;
  }

  if (declared.has(param)) {
    addWarning(state, violation(
      action === 'MAX' ? 'duplicate_max' : 'duplicate_min',
      context.lineNum,
      'warning',
      `${action} "${param}" już zadeklarowane w tym GOAL. Zamieniono na SET.`,
      `${action} może być użyte tylko raz dla danego parametru w GOAL.`,
    ));
    state.fixed[context.index] = `  SET ${q(param)} ${q(value)}`;
    return true;
  }

  declared.add(param);
  return true;
}

function handleOutLine(state: ValidationState, context: ValidationLine): boolean {
  const match = context.normalized.match(RX.OUT);
  if (!match) return false;

  const outType = (match[1] || '').trim().toUpperCase();
  const varName = (match[2] || '').trim();
  if (outType === 'VAL') trackSensorUsage(state, varName);
  if (isBadToken(varName)) {
    addError(state, violation(
      'no_placeholder_or_undefined',
      context.lineNum,
      'error',
      'Niedozwolona zmienna "*" lub undefined w OUT.',
      'Podaj prawidłową nazwę zmiennej.',
    ));
  }
  return true;
}

function handleDialogLine(state: ValidationState, context: ValidationLine): boolean {
  const match = context.normalized.match(RX.DIALOG);
  if (!match) return false;

  const varName = (match[1] || '').trim();
  const prompt = (match[2] || '').trim();
  if (isBadToken(varName)) {
    addError(state, violation(
      'no_placeholder_or_undefined',
      context.lineNum,
      'error',
      'Niedozwolona zmienna "*" lub undefined w DIALOG.',
      'Podaj prawidłową nazwę zmiennej.',
    ));
  }
  if (!prompt) {
    addError(state, violation(
      'dialog_prompt_required',
      context.lineNum,
      'error',
      'DIALOG wymaga tekstu pytania.',
      `Dodaj pytanie, np. DIALOG ${q('Potwierdzenie')} ${q('Sprawdź stan maski')}`,
    ));
  }
  return true;
}

function validateDslLine(state: ValidationState, context: ValidationLine): void {
  if (handleGoalLine(state, context)) return;
  if (handleElseLine(state, context)) return;
  if (handleBracketedIfLine(state, context)) return;

  const directIfHandled = handleIfLine(state, context);
  if (directIfHandled) return;
  trackCompoundIfUsage(state, context.normalized);

  if (handleSetLine(state, context)) return;
  if (handleGetLine(state, context)) return;
  if (handleValLine(state, context)) return;
  if (handleLimitLine(state, context, 'MAX', RX.MAX, state.goal.declaredMaxs)) return;
  if (handleLimitLine(state, context, 'MIN', RX.MIN, state.goal.declaredMins)) return;
  if (handleOutLine(state, context)) return;
  handleDialogLine(state, context);
}

function finalizeValidation(state: ValidationState): DslValidateResult {
  flushMissingGetDeclarations(state);

  const endRes = ensureEndBlocks(state.fixed);
  endRes.issues.forEach((item) => {
    addWarning(state, violation(
      'missing_end',
      item.line,
      'warning',
      `Brak END w bloku IF (dodano ${item.missing}× END).`,
      'Dodaj brakujące END aby domknąć IF/ELSE.',
    ));
  });

  return {
    ok: state.errors.length === 0,
    errors: state.errors,
    warnings: state.warnings,
    violations: state.violations,
    fixedText: canonicalizeDslQuotes(endRes.fixedLines.join('\n')),
  };
}

export function validateDslFormat(text: string): DslValidateResult {
  const state = createValidationState(text);

  state.lines.forEach((line, index) => {
    if (!line.trim()) return;
    validateDslLine(state, {
      line,
      normalized: normalizeQuotedDslLine(line),
      lineNum: index + 1,
      index,
    });
  });

  return finalizeValidation(state);
}

export const DefaultRules = [
  { id: 'else_invalid', desc: 'ELSE z niepoprawnym typem (dozwolone: samodzielne ELSE lub ELSE ERROR/WARN/INFO)' },
  { id: 'operator_no_brackets', desc: 'Operator IF bez nawiasów kwadratowych' },
  { id: 'set_value_required', desc: 'SET musi mieć wartość' },
  { id: 'missing_end', desc: 'Brak END domykającego blok IF/ELSE' },
  { id: 'no_placeholder_or_undefined', desc: 'Zakaz użycia * / undefined / [] w tokenach DSL' },
  { id: 'duplicate_val', desc: 'VAL może być użyte tylko raz w GOAL' },
  { id: 'duplicate_min', desc: 'MIN może być użyte tylko raz w GOAL' },
  { id: 'duplicate_max', desc: 'MAX może być użyte tylko raz w GOAL' },
  { id: 'dialog_prompt_required', desc: 'DIALOG wymaga tekstu pytania' },
  { id: 'missing_get_declaration', desc: 'Zmienna czujnika (NC, WC, PC, TC, SC) wymaga deklaracji GET przed użyciem' },
];
