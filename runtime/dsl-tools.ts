// frontend/src/components/dsl/dsl-tools.ts
// DSL utility functions moved from scenarios.page.ts

import { parseDsl } from './dsl.parser';
import { highlightDsl } from './dsl.highlight';
import { executeDsl } from './dsl.exec';
import type { ExecContext } from './dsl.types';
import { validateDslFormat } from './dsl.validator';
import { escapeHtml } from '../../utils/html.utils';
import { renderLegacyTaskAsDslLines } from './dsl-content-helpers';
import { normalizeDslLineQuotes, quoteDslValue as q } from './dsl.quotes';

export class DslTools {
  /**
   * Highlight DSL syntax in text
   */
  static highlightDsl(text: string): string {
    return highlightDsl(text);
  }

  /**
   * Console-style run: simulation + diagnostics/hints in one HTML block
   */
  static runDslConsole(text: string, ctx?: ExecContext): string {
    const sim = DslTools.runDsl(text, ctx);
    const diag = DslTools.detectIfConstantIssues(text);
    const parts: string[] = [];
    parts.push(`<div class="text-success">▶️ Symulacja:</div>`);
    parts.push(sim.replace(/^<div class="text-success">▶️ Symulacja:<\/div>/, '').trim());
    if (diag.errors.length || diag.warnings.length) {
      parts.push('<hr />');
      parts.push('<div class="text-warning">💡 Wskazówki:</div>');
      if (diag.errors.length) parts.push(`<ul class="text-danger">${diag.errors.map(e => `<li>${escapeHtml(e)}</li>`).join('')}</ul>`);
      if (diag.warnings.length) parts.push(`<ul class="text-warning">${diag.warnings.map(w => `<li>${escapeHtml(w)}</li>`).join('')}</ul>`);
    }
    return parts.join('\n');
  }

  // Refactored canonicalizeTasks patterns and helpers
  private static readonly CANON_PATTERNS = {
    arrow: /^\s*→\s*([^\[]+?)\s*\[([^\]]+)\]\s*$/,
    and: /^\s*AND\s+([^\[]+?)\s*\[([^\]]+)\]\s*$/i,
    goal: /^\s*GOAL:\s*(.+)$/i,
    scenario: /^\s*SCENARIO:\s*(.+)$/i,
    if: /^\s*(?:AND|OR|ELSE)?\s*IF\b/i,
    task: /^\s*TASK\b/i,
    taskWait: /^\s*TASK(?:\s*:|\s+\d+:|\s+)?\s*\[(WAIT|DELAY|PAUSE|TIMEOUT)\]\s*\[([^\]]+)\]\s*$/i,
    taskPairs: /\[([^\]]+)\]\s*\[([^\]]+)\]/g,
    taskPlain: /^\s*TASK(?::|\s+\d+:)?\s*/i,
  } as const;

  private static flushPendingActions(
    pending: Array<{ function: string; object: string }>,
    out: string[]
  ): void {
    for (const action of pending) {
      out.push(...renderLegacyTaskAsDslLines(action, '  '));
    }
    pending.length = 0;
  }

  private static processTaskLine(ln: string, out: string[]): boolean {
    const indent = (ln.match(/^(\s*)/) || [])[1] || '  ';

    // Check for WAIT/DELAY/PAUSE/TIMEOUT tasks
    const waitMatch = ln.match(DslTools.CANON_PATTERNS.taskWait);
    if (waitMatch) {
      out.push(`${indent}SET ${q(waitMatch[1].trim().toUpperCase())} ${q(waitMatch[2].trim())}`);
      return true;
    }

    // Check for [function][object] pairs
    const pairs = Array.from(ln.matchAll(DslTools.CANON_PATTERNS.taskPairs));
    if (pairs.length) {
      for (const [, fn, obj] of pairs) {
        out.push(...renderLegacyTaskAsDslLines({ function: fn, object: obj }, indent));
      }
      return true;
    }

    // Plain task text
    const plain = ln.replace(DslTools.CANON_PATTERNS.taskPlain, '').trim();
    out.push(plain ? `${indent}SET ${q(plain)} ${q('1')}` : ln);
    return true;
  }

  private static processArrowLine(
    ln: string,
    pending: Array<{ function: string; object: string }>
  ): boolean {
    const m = ln.match(DslTools.CANON_PATTERNS.arrow);
    if (!m) return false;
    pending.push({
      function: String(m[1] || '').trim(),
      object: String(m[2] || '').trim()
    });
    return true;
  }

  private static processAndLine(
    ln: string,
    pending: Array<{ function: string; object: string }>,
    out: string[]
  ): boolean {
    const m = ln.match(DslTools.CANON_PATTERNS.and);
    if (!m) return false;
    const action = {
      function: String(m[1] || '').trim(),
      object: String(m[2] || '').trim()
    };
    if (pending.length) {
      pending.push(action);
    } else {
      out.push(...renderLegacyTaskAsDslLines(action, '  '));
    }
    return true;
  }

  /**
   * Convert legacy arrow/TASK actions into canonical `SET` / `WAIT` records.
   * Preserves SCENARIO, GOAL, IF/ELSE and other non-action content.
   * Refactored from CC=19 to CC~10.
   */
  static canonicalizeTasks(text: string): string {
    const lines = (text || '').split(/\r?\n/);
    const out: string[] = [];
    const pendingActions: Array<{ function: string; object: string }> = [];

    for (const ln of lines) {
      // Preserve structural lines - flush any pending actions first
      if (DslTools.CANON_PATTERNS.scenario.test(ln) ||
          DslTools.CANON_PATTERNS.goal.test(ln) ||
          DslTools.CANON_PATTERNS.if.test(ln)) {
        DslTools.flushPendingActions(pendingActions, out);
        out.push(ln);
        continue;
      }

      // Handle inline TASK definitions
      if (DslTools.CANON_PATTERNS.task.test(ln)) {
        DslTools.flushPendingActions(pendingActions, out);
        DslTools.processTaskLine(ln, out);
        continue;
      }

      // Handle arrow actions (→ function [object])
      if (DslTools.processArrowLine(ln, pendingActions)) continue;

      // Handle AND actions
      if (DslTools.processAndLine(ln, pendingActions, out)) continue;

      // Default: flush and pass through
      DslTools.flushPendingActions(pendingActions, out);
      out.push(ln);
    }

    DslTools.flushPendingActions(pendingActions, out);
    return out.join('\n');
  }

  /**
   * Perform auto-fix: stylistic fixes + canonical TASK conversion.
   * Returns fixed text (never throws).
   */
  static autoFixText(text: string): string {
    try {
      const fmt = validateDslFormat(text || '');
      const base = (fmt.fixedText && fmt.fixedText.trim()) ? fmt.fixedText : (text || '');
      const canon = DslTools.canonicalizeTasks(base);
      const ensured = DslTools.ensureIfUsesVariables(canon);
      return DslTools.sanitizePlaceholders(ensured);
    } catch {
      const canon = DslTools.canonicalizeTasks(text || '');
      const ensured = DslTools.ensureIfUsesVariables(canon);
      return DslTools.sanitizePlaceholders(ensured);
    }
  }

  /**
   * Parse DSL text and return result with errors/AST
   */
  static parseDsl(text: string): { ok: boolean; errors: string[]; ast: any } {
    return parseDsl(text);
  }

  /**
   * Validate DSL format and return HTML output for display
   */
  static validateDsl(text: string): string {
    try {
      const fmt = validateDslFormat(text);
      const src = (fmt.fixedText && fmt.fixedText.trim()) ? fmt.fixedText : text;
      const res = DslTools.parseDsl(src);

      if (!res.ok) {
        return DslTools.buildSyntaxErrorHtml(fmt, res.errors);
      }

      return DslTools.buildValidationSuccessHtml(fmt, src, res);
    } catch {
      return '<div class="text-danger">❌ Błąd walidatora</div>';
    }
  }

  private static buildSyntaxErrorHtml(fmt: any, errors: string[]): string {
    let html = '';
    if (!fmt.ok) {
      html += `<div class="text-danger">❌ Błędy formatu DSL:</div>`;
      if (fmt.errors?.length) html += `<ul>${fmt.errors.map((e: string) => `<li>${escapeHtml(e)}</li>`).join('')}</ul>`;
    }
    if (fmt.warnings?.length) {
      html += `<div class="text-warning">⚠️ Ostrzeżenia formatu DSL:</div>`;
      html += `<ul>${fmt.warnings.map((w: string) => `<li>${escapeHtml(w)}</li>`).join('')}</ul>`;
    }
    html += `<div class="text-danger">❌ Błędy składni:</div><ul>${errors.map(e => `<li>${escapeHtml(e)}</li>`).join('')}</ul>`;
    return html;
  }

  // HTML builder helpers for buildValidationSuccessHtml
  private static buildFormatErrorsHtml(fmt: any): string {
    if (!fmt.ok && fmt.errors?.length) {
      return `<div class="text-danger">❌ Błędy formatu DSL:</div><ul>${fmt.errors.map((e: string) => `<li>${escapeHtml(e)}</li>`).join('')}</ul>`;
    }
    return '';
  }

  private static buildFormatWarningsHtml(fmt: any): string {
    if (fmt.warnings?.length) {
      return `<div class="text-warning">⚠️ Ostrzeżenia formatu DSL:</div><ul>${fmt.warnings.map((w: string) => `<li>${escapeHtml(w)}</li>`).join('')}</ul>`;
    }
    return '';
  }

  private static buildVariableIssuesHtml(extra: { errors: string[]; warnings: string[] }): string {
    let html = '';
    if (extra.errors.length) {
      html += `<div class="text-danger">❌ Błędy (IF i zmienne):</div><ul>${extra.errors.map((e: string) => `<li>${escapeHtml(e)}</li>`).join('')}</ul>`;
    }
    if (extra.warnings.length) {
      html += `<div class="text-warning">⚠️ Ostrzeżenia (IF i zmienne):</div><ul>${extra.warnings.map((w: string) => `<li>${escapeHtml(w)}</li>`).join('')}</ul>`;
    }
    return html;
  }

  private static buildFixesHtml(fmt: any, extra: { errors: string[]; warnings: string[] }, src: string, fixed: string): string {
    let html = '';
    const hasVariableIssues = extra.errors.length || extra.warnings.length;

    if (hasVariableIssues && fixed.trim() !== src.trim()) {
      html += `<div class="text-muted">Proponowana korekta (Auto-fix IF→zmienna):</div><pre class="preview-code">${DslTools.highlightDsl(fixed)}</pre>`;
    }
    if (fmt.warnings?.length && fmt.fixedText && fmt.fixedText.trim() !== src.trim()) {
      html += `<div class="text-muted">Proponowana korekta (Auto-fix duplikaty):</div><pre class="preview-code">${DslTools.highlightDsl(fmt.fixedText)}</pre>`;
    }
    return html;
  }

  private static buildValidationSuccessHtml(fmt: any, src: string, res: any): string {
    const extra = DslTools.detectIfConstantIssues(src);
    const fixed = DslTools.sanitizePlaceholders(DslTools.ensureIfUsesVariables(src));

    let html = DslTools.buildFormatErrorsHtml(fmt);
    html += DslTools.buildFormatWarningsHtml(fmt);
    html += DslTools.buildVariableIssuesHtml(extra);
    html += DslTools.buildFixesHtml(fmt, extra, src, fixed);

    // Success message if no issues
    const hasNoIssues = !extra.errors.length && !extra.warnings.length && !fmt.warnings?.length && !html;
    if (hasNoIssues) {
      return `<div class="text-success">✅ DSL poprawny. GOALS: ${res.ast.goals.length}</div>`;
    }

    return html || '<div class="text-success">✅ Brak problemów</div>';
  }

  /**
   * Execute DSL and return formatted simulation output
   */
  static runDsl(text: string, ctx?: ExecContext): string {
    const exec = executeDsl(text, ctx);
    if (!exec.ok) {
      return `<div class="text-danger">❌ Nie można uruchomić – najpierw popraw błędy:</div><ul>${exec.errors.map(e => `<li>${escapeHtml(e)}</li>`).join('')}</ul>`;
    }
    const lines: string[] = [];
    let taskNum = 1;
    for (const step of (exec as any).plan as any[]) {
      const { line, taskNum: newTaskNum } = DslTools.renderStep(step, taskNum, q);
      if (Array.isArray(line)) {
        lines.push(...line);
      } else if (line) {
        lines.push(line);
      }
      taskNum = step.kind === 'goal' ? 1 : newTaskNum;
    }
    return `<div class="text-success">▶️ Symulacja:</div><pre class="mono small">${escapeHtml(lines.join('\n'))}</pre>`;
  }

  /**
   * Validate DSL text and update output element
   */
  static validateDslInElement(text: string, outputElementId: string): void {
    const out = document.getElementById(outputElementId);
    if (!out) return;
    out.innerHTML = DslTools.validateDsl(text);
  }

  /**
   * Run DSL simulation and update output element
   */
  static runDslInElement(text: string, outputElementId: string): void {
    const out = document.getElementById(outputElementId);
    if (!out) return;
    out.innerHTML = DslTools.runDsl(text);
  }

  /**
   * Get preview text from element
   */
  static getPreviewText(elementId: string = 'scenario-preview'): string {
    const el = document.getElementById(elementId);
    return (el?.textContent || '').trim();
  }

  // Refactored ensureIfUsesVariables - extracted from CC=31 to CC~10
  private static readonly IF_PATTERNS = {
    goal: /^\s*GOAL:\s*(.+)\s*$/i,
    get: /^\s*GET\s*"([^"]+)"(?:\s*"([^"]+)")?\s*$/i,
    set: /^\s*SET\s*"([^"]+)"\s*"([^"]+)"\s*$/i,
    max: /^\s*MAX\s*"([^"]+)"\s*"([^"]+)"\s*$/i,
    min: /^\s*MIN\s*"([^"]+)"\s*"([^"]+)"\s*$/i,
    if: /^\s*(?:AND\s+|OR\s+)?IF\s*"([^"]+)"\s*(>=|<=|>|<|=)\s*"([^"]+)"\s*$/i,
  } as const;

  private static isNumericValue(s: string): boolean {
    return /^-?\d+(?:[.,]\d+)?(?:\s+.+)?$/.test((s || '').trim());
  }

  private static handleTimerCondition(
    op: string,
    vars: Set<string>,
    out: string[],
    timerVar: 'timer' | 'czas',
    value?: string
  ): void {
    if (timerVar === 'czas' && value && !vars.has('czas')) {
      out.push(`  SET ${q('czas')} ${q(value)}`);
      vars.add('czas');
    }
    if (!vars.has('timer')) {
      out.push(`  SET ${q('timer')} ${q('0 s')}`);
      vars.add('timer');
    }
    out.push(`  IF ${q('timer')} ${op} ${q('czas')}`);
  }

  private static processVariableLine(
    normalizedLn: string,
    currentGoal: string | null,
    goalVars: Record<string, Set<string>>,
    pattern: RegExp,
    out: string[],
    originalLn: string
  ): boolean {
    const m = normalizedLn.match(pattern);
    if (m && currentGoal) {
      goalVars[currentGoal].add(m[1].trim());
    }
    out.push(originalLn);
    return !!m;
  }

  private static ensureIfUsesVariables(text: string): string {
    const lines = (text || '').split(/\r?\n/);
    const out: string[] = [];
    let currentGoal: string | null = null;
    const goalVars: Record<string, Set<string>> = {};

    for (const ln of lines) {
      const normalizedLn = normalizeDslLineQuotes(ln);

      // Handle GOAL definition
      const goalMatch = ln.match(DslTools.IF_PATTERNS.goal);
      if (goalMatch) {
        currentGoal = goalMatch[1].trim();
        if (!goalVars[currentGoal]) goalVars[currentGoal] = new Set();
        out.push(ln);
        continue;
      }

      // Handle variable declarations (GET, SET, MAX, MIN)
      if (DslTools.processVariableLine(normalizedLn, currentGoal, goalVars, DslTools.IF_PATTERNS.get, out, ln)) continue;
      if (DslTools.processVariableLine(normalizedLn, currentGoal, goalVars, DslTools.IF_PATTERNS.set, out, ln)) continue;
      if (DslTools.processVariableLine(normalizedLn, currentGoal, goalVars, DslTools.IF_PATTERNS.max, out, ln)) continue;
      if (DslTools.processVariableLine(normalizedLn, currentGoal, goalVars, DslTools.IF_PATTERNS.min, out, ln)) continue;

      // Handle IF conditions with timer logic
      const ifMatch = normalizedLn.match(DslTools.IF_PATTERNS.if);
      if (ifMatch) {
        const param = ifMatch[1].trim();
        const op = ifMatch[2].trim();
        const value = ifMatch[3].trim();
        const goal = currentGoal || '';
        const vars = goalVars[goal] || new Set<string>();

        // Case 1: IF "czas" = "czas" → use timer variable
        if (param.toLowerCase() === 'czas' && value.toLowerCase() === 'czas') {
          DslTools.handleTimerCondition(op, vars, out, 'timer');
          continue;
        }

        // Case 2: IF "czas" = "10s" → set czas value then use timer
        if (DslTools.isNumericValue(value) && param.toLowerCase() === 'czas') {
          DslTools.handleTimerCondition(op, vars, out, 'czas', value);
          continue;
        }

        out.push(ln);
        continue;
      }

      out.push(ln);
    }

    return out.join('\n');
  }

  // Refactored detectIfConstantIssues patterns
  private static readonly DETECT_PATTERNS = {
    goal: /^\s*GOAL:\s*(.+)\s*$/i,
    var: /^\s*(GET|SET|MAX|MIN)\s*"([^"]+)"/i,
    if: /^\s*(?:AND\s+|OR\s+)?IF\s*"([^"]+)"\s*(>=|<=|>|<|=)\s*"([^"]+)"\s*$/i,
  } as const;

  private static isSelfReferencingTime(param: string, value: string): boolean {
    return param.toLowerCase() === 'czas' && value.toLowerCase() === 'czas';
  }

  private static createTimeWarning(lineNum: number, operator: string): string {
    return `Linia ${lineNum}: IF ${q('czas')} porównuje do ${q('czas')}. Rozważ użycie IF ${q('timer')} ${operator} ${q('czas')} z SET ${q('timer')} ${q('0 s')}.`;
  }

  private static detectIfConstantIssues(text: string): { errors: string[]; warnings: string[] } {
    const lines = (text || '').split(/\r?\n/);
    const errors: string[] = [];
    const warnings: string[] = [];
    let currentGoal: string | null = null;
    const goalVars: Record<string, Set<string>> = {};

    for (let i = 0; i < lines.length; i++) {
      const ln = lines[i];
      const normalizedLn = normalizeDslLineQuotes(ln);

      // Handle GOAL definition
      const goalMatch = ln.match(DslTools.DETECT_PATTERNS.goal);
      if (goalMatch) {
        currentGoal = goalMatch[1].trim();
        if (!goalVars[currentGoal]) goalVars[currentGoal] = new Set();
        continue;
      }

      // Track variable declarations
      const varMatch = normalizedLn.match(DslTools.DETECT_PATTERNS.var);
      if (varMatch && currentGoal) {
        goalVars[currentGoal].add(varMatch[2].trim());
        continue;
      }

      // Check IF conditions for issues
      const ifMatch = normalizedLn.match(DslTools.DETECT_PATTERNS.if);
      if (ifMatch) {
        const param = ifMatch[1].trim();
        const operator = ifMatch[2].trim();
        const value = ifMatch[3].trim();

        if (DslTools.isSelfReferencingTime(param, value)) {
          warnings.push(DslTools.createTimeWarning(i + 1, operator));
        }
      }
    }

    return { errors, warnings };
  }

  // Refactored sanitizePlaceholders helpers - extracted to reduce CC
  private static isPlaceholderInvalid(s: string): boolean {
    const t = String(s || '').trim();
    return !t || t === '*' || /^undefined$/i.test(t) || t === '[]' || t === '""' || t === "''";
  }

  private static normalizeValue(s: string): string {
    return String(s || '').trim();
  }

  private static stripValueWrappers(s: string): string {
    return DslTools.normalizeValue(s)
      .replace(/^\[(.*)\]$/, '$1')
      .replace(/^"(.*)"$/, '$1')
      .replace(/^'(.*)'$/, '$1')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private static ensureNumericWithUnit(v: string): string {
    const t = DslTools.normalizeValue(v);
    if (!/[0-9]/.test(t) && /[a-zA-Z°/%]/.test(t)) {
      return `0 ${t}`;
    }
    return t;
  }

  private static readonly SANITIZE_PATTERNS = {
    if: /^\s*(?:AND\s+|OR\s+)?IF\s*"([^"]*)"\s*(>=|<=|>|<|=)\s*"([^"]*)"\s*$/i,
    get: /^\s*GET\s*"([^"]*)"(?:\s*"([^"]*)")?\s*$/i,
    set: /^\s*SET\s*"([^"]*)"\s*"([^"]*)"\s*$/i,
    max: /^\s*MAX\s*"([^"]*)"\s*"([^"]*)"\s*$/i,
    min: /^\s*MIN\s*"([^"]*)"\s*"([^"]*)"\s*$/i,
  } as const;

  private static sanitizeIfCondition(m: RegExpMatchArray, out: string[]): boolean {
    const param = DslTools.stripValueWrappers(m[1]);
    const op = DslTools.normalizeValue(m[2]);
    const value = DslTools.stripValueWrappers(m[3]);

    if (DslTools.isPlaceholderInvalid(param) || DslTools.isPlaceholderInvalid(value)) {
      out.push(`  INFO ${q('WARNING')} ${q('Uzupełnij brakujące elementy warunku IF')}`);
      return true;
    }
    if (param.toLowerCase() === value.toLowerCase()) {
      out.push(`  INFO ${q('WARNING')} ${q('Warunek IF porównuje tę samą zmienną – uzupełnij zmienną progową')}`);
      return true;
    }
    out.push(`  IF ${q(param)} ${op} ${q(value)}`);
    return true;
  }

  private static sanitizeGetCommand(m: RegExpMatchArray, out: string[]): boolean {
    const param = DslTools.stripValueWrappers(m[1]);
    const unit = DslTools.normalizeValue(m[2] || '');

    if (DslTools.isPlaceholderInvalid(param)) {
      out.push(`  INFO ${q('WARNING')} ${q('Uzupełnij parametr GET')}`);
      return true;
    }
    if (unit && DslTools.isPlaceholderInvalid(unit)) {
      out.push(`  GET ${q(param)}`);
      return true;
    }
    out.push(unit ? `  GET ${q(param)} ${q(unit)}` : `  GET ${q(param)}`);
    return true;
  }

  private static sanitizeVariableCommand(
    m: RegExpMatchArray,
    out: string[],
    command: 'SET' | 'MAX' | 'MIN'
  ): boolean {
    const param = DslTools.stripValueWrappers(m[1]);
    let value = DslTools.stripValueWrappers(m[2]);
    value = DslTools.ensureNumericWithUnit(value);

    if (DslTools.isPlaceholderInvalid(param) || DslTools.isPlaceholderInvalid(value)) {
      out.push(`  INFO ${q('WARNING')} ${q(`Uzupełnij wartości w ${command}`)}`);
      return true;
    }
    out.push(`  ${command} ${q(param)} ${q(value)}`);
    return true;
  }

  /**
   * Sanitize placeholder tokens in DSL text produced by auto-fix.
   * - Rewrites IF/GET/SET/MAX/MIN with invalid tokens (*, [], undefined, empty) into WARN tasks.
   * - Drops invalid units in GET.
   * - Rewrites identity comparisons like IF [x] = [x] to WARN.
   * Refactored from CC=34 to CC~12.
   */
  private static sanitizePlaceholders(text: string): string {
    const lines = (text || '').split(/\r?\n/);
    const out: string[] = [];

    for (const ln of lines) {
      if (!ln.trim()) { out.push(ln); continue; }
      const normalizedLn = normalizeDslLineQuotes(ln);
      let m: RegExpMatchArray | null;

      // Try each command pattern
      if ((m = normalizedLn.match(DslTools.SANITIZE_PATTERNS.if))) {
        if (DslTools.sanitizeIfCondition(m, out)) continue;
      }
      if ((m = normalizedLn.match(DslTools.SANITIZE_PATTERNS.get))) {
        if (DslTools.sanitizeGetCommand(m, out)) continue;
      }
      if ((m = normalizedLn.match(DslTools.SANITIZE_PATTERNS.set))) {
        if (DslTools.sanitizeVariableCommand(m, out, 'SET')) continue;
      }
      if ((m = normalizedLn.match(DslTools.SANITIZE_PATTERNS.max))) {
        if (DslTools.sanitizeVariableCommand(m, out, 'MAX')) continue;
      }
      if ((m = normalizedLn.match(DslTools.SANITIZE_PATTERNS.min))) {
        if (DslTools.sanitizeVariableCommand(m, out, 'MIN')) continue;
      }

      out.push(ln);
    }
    return out.join('\n');
  }

  // Step rendering helpers - extracted from runDsl to reduce CC
  private static readonly stepRenderers: Record<string, (step: any, q: (s: string) => string) => string | string[]> = {
    goal: (step) => `GOAL: ${step.name}`,
    condition: (step, q) => {
      const c = step.condition;
      const status = (step.passed === true ? 'PASS' : step.passed === false ? 'FAIL' : 'UNKNOWN');
      return `  IF ${q(c.parameter)} ${c.operator} ${q(c.value)} => ${status}`;
    },
    else: (step, q) => `  ELSE ${step.else.actionType} ${q(step.else.actionMessage || '')}`,
    task: (step, q) => renderLegacyTaskAsDslLines(step.task, '  '),
    pump: (step, q) => {
      const raw = step.raw || `${step.value}${step.unit ? ` ${step.unit}` : ''}`.trim();
      return `  SET ${q('POMPA')} ${q(raw)}`;
    },
    func_call: (step, q) => {
      const args = Array.isArray(step.arguments) && step.arguments.length
        ? ` ${step.arguments.map((arg: string) => q(arg)).join(' ')}`
        : '';
      return `  FUNC ${q(step.name)}${args}`;
    },
    var: (step, q) => {
      const action = String(step.action || '').toUpperCase();
      const suffix = step.unit ? ` ${step.unit}` : '';
      const value = step.value !== undefined && step.value !== null ? `${step.value}${suffix}` : suffix.trim();
      const per = step.per ? ` PER ${q(step.per)}` : '';
      return `  ${action} ${q(step.parameter)}${value ? ` ${q(value)}` : ''}${per}`;
    },
    wait: (step, q) => `  SET ${q('WAIT')} ${q(`${step.duration}${step.unit ? ` ${step.unit}` : ''}`)}`,
    message: (step, q) => `  ${step.level} ${q(step.message)}`,
    save: (step, q) => `  SAVE ${q(step.parameter)}`,
    user: (step, q) => `  USER ${q(step.action)} ${q(step.message)}`,
    result: (step, q) => `  RESULT ${q(step.status)}`,
    opt: (step, q) => `  OPT ${q(step.parameter)} ${q(step.description)}`,
    repeat: () => '  REPEAT',
    sample: (step, q) => `  SAMPLE ${q(step.parameter)} ${q(step.state)}${step.interval ? ` ${q(step.interval)}` : ''}`,
    calc: (step, q) => `  CALC ${q(step.result)} = ${q(step.function)} ${q(step.input)} => ${step.value ?? 'UNKNOWN'}`,
    fun: (step, q) => `  FUN ${q(step.result)} = ${step.expression} => ${step.value ?? 'UNKNOWN'}`,
    end: () => '  END',
    out: (step, q) => `  OUT ${q(step.outType)} ${q(step.value)}`,
    dialog: (step, q) => `  DIALOG ${q(step.parameter)} ${q(step.message)}`,
    info: (step, q) => `  INFO ${q(step.level)} ${q(step.message)}`,
  };

  private static renderStep(step: any, taskNum: number, q: (s: string) => string): { line: string | string[]; taskNum: number } {
    const renderer = DslTools.stepRenderers[step.kind];
    if (!renderer) return { line: '', taskNum };

    const result = renderer(step, q);
    const isTask = step.kind === 'task';
    return { line: result, taskNum: isTask ? taskNum + 1 : taskNum };
  }
}
