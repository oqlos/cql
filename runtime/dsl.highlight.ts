// frontend/src/components/dsl/dsl.highlight.refactored.ts
// Refactored from CC=64 → CC~10 using rules-based approach

import { normalizeQuotedDslLine } from './dsl.quote-utils';

// Shared patterns — canonical single-quote DSL with backward compatibility for double quotes
const P = {
  VAR: '"([^"]*)"',
  VALUE: '"([^"]*)"',
  OP: '(>=|<=|>|<|=|!=)',
  OP_BRACKET: '\\[(>=|<=|>|<|=)\\]',
  OP_PAREN: '\\((>=|<=|>|<|=)\\)',
};

// Pre-compiled regex for highlighting
const RX = {
  SCENARIO: /^\s*SCENARIO:\s*(.+)$/i,
  GOAL: /^\s*GOAL:\s*(.+)$/i,
  FUNC_DEF: /^\s*FUNC:\s*(.+)$/i,
  TASK_NUM: /^(\s*)TASK\s+(\d+)\s*:\s*$/i,
  TASK_ACTION: new RegExp(`^(\\s*)TASK\\s+${P.VAR}\\s*${P.VALUE}\s*$`, 'i'),
  TASK_LEGACY: /^(\s*)TASK\s*:?\s*(.+)$/i,
  PUMP: new RegExp(`^(\\s*)(?:((?:PUMP))\\s*"([^"]+)"|((?:SET))\\s*"((?:PUMP|pump|POMPA|pompa))"\\s*"([^"]+)")\s*$`, 'i'),
  GET: new RegExp(`^(\\s*)GET\\s*${P.VAR}(?:\\s*${P.VAR})?\s*$`, 'i'),
  OUT: new RegExp(`^(\\s*)OUT\\s*"(VAL|MAX|MIN|UNIT|GET|RESULT)"\\s*${P.VALUE}\s*$`, 'i'),
  VAL: new RegExp(`^(\\s*)VAL\\s*${P.VAR}(?:\\s*${P.VAR})?\s*$`, 'i'),
  SET: new RegExp(`^(\\s*)SET\\s*${P.VAR}\\s*${P.VALUE}\s*$`, 'i'),
  MAX_MIN: new RegExp(`^(\\s*)(MAX|MIN)\\s*${P.VAR}\\s*${P.VALUE}\s*$`, 'i'),
  ARROW: new RegExp(`^(\\s*)→\\s*([^"]+?)\\s*${P.VAR}\s*$`),
  AND_FN: new RegExp(`^(\\s*)AND\\s+([^"]+?)\\s*${P.VAR}\s*$`, 'i'),
  COND_IF_INFIX: new RegExp(`^(\\s*)(AND|OR|ELSE)\\s+IF\\s*${P.VAR}\\s*${P.OP}\\s*${P.VAR}\s*$`, 'i'),
  COND_IF_PAREN: new RegExp(`^(\\s*)(AND|OR|ELSE)\\s+IF\\s*${P.VAR}\\s*${P.OP_PAREN}\\s*${P.VAR}\s*$`, 'i'),
  COND_IF_BRACKET: new RegExp(`^(\\s*)(AND|OR|ELSE)\\s+IF\\s*${P.VAR}\\s*${P.OP_BRACKET}\\s*${P.VAR}\s*$`, 'i'),
  IF_COMPOUND_OR_IF: new RegExp(`^(\\s*)IF\\s*${P.VAR}\\s*${P.OP}\\s*${P.VAR}\\s+OR\\s+IF\\s*${P.VAR}\\s*${P.OP}\\s*${P.VAR}\s*$`, 'i'),
  IF_COMPOUND: new RegExp(`^(\\s*)IF\\s*${P.VAR}\\s*${P.OP}\\s*${P.VAR}\\s+OR\\s*${P.VAR}\\s*${P.OP}\\s*${P.VAR}\s*$`, 'i'),
  IF_INFIX: new RegExp(`^(\\s*)IF\\s*${P.VAR}\\s*${P.OP}\\s*${P.VALUE}(?:\\s+TO\\s*${P.VAR})?\s*$`, 'i'),
  IF_NO_OP: new RegExp(`^(\\s*)IF\\s*${P.VAR}\\s*${P.VALUE}\s*$`, 'i'),
  IF_PAREN: new RegExp(`^(\\s*)IF\\s*${P.VAR}\\s*${P.OP_PAREN}\\s*${P.VAR}(?:\\s+TO\\s*${P.VAR})?\s*$`, 'i'),
  IF_BRACKET: new RegExp(`^(\\s*)IF\\s*${P.VAR}\\s*${P.OP_BRACKET}\\s*${P.VAR}(?:\\s+TO\\s*${P.VAR})?\s*$`, 'i'),
  ELSE_MSG: /^(\s*)ELSE\s+(ERROR|WARNING|INFO|GOAL)\s+\"(.*)\"\s*$/i,
  ELSE: /^(\s*)ELSE\s*$/i,
  WAIT: new RegExp(`^(\\s*)(?:((?:WAIT))\\s*"([^"]+)"|((?:SET))\\s*"((?:WAIT|wait))"\\s*"([^"]+)")\s*$`, 'i'),
  LOG: new RegExp(`^(\\s*)LOG\\s*${P.VAR}\s*$`, 'i'),
  ALARM: new RegExp(`^(\\s*)ALARM\\s*${P.VAR}\s*$`, 'i'),
  ERROR: new RegExp(`^(\\s*)ERROR\\s*${P.VAR}\s*$`, 'i'),
  SAVE: new RegExp(`^(\\s*)SAVE\\s*${P.VAR}\s*$`, 'i'),
  FUNC_CALL: new RegExp(`^(\\s*)FUNC\\s*${P.VAR}((?:\\s*(?:${P.VAR}))*)\s*$`, 'i'),
  USER: new RegExp(`^(\\s*)USER\\s*${P.VAR}\\s*${P.VAR}\s*$`, 'i'),
  DIALOG: new RegExp(`^(\\s*)DIALOG\\s*${P.VAR}\\s*${P.VALUE}\s*$`, 'i'),
  DIALOG_SINGLE: new RegExp(`^(\\s*)DIALOG\\s*${P.VAR}\s*$`, 'i'),
  RESULT: new RegExp(`^(\\s*)RESULT\\s*${P.VAR}\s*$`, 'i'),
  INFO: new RegExp(`^(\\s*)INFO\\s*${P.VAR}\\s*${P.VALUE}?\s*$`, 'i'),
  REPEAT: /^(\s*)REPEAT\s*$/i,
  CONTROL: /^(\s*)(STOP|PAUSE)\s*$/i,
  END: /^(\s*)END\s*$/i,
} as const;

// Helper functions
function escHtml(str: string): string {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const esc = (s: string) => escHtml(String(s ?? ''));
const kw = (word: string, cls = '') => `<span class="dsl-kw${cls ? ' ' + cls : ''}">${esc(word)}</span>`;
let currentQuote: '"' | "'" = '"';
const br = (val: string) => `<span class="dsl-br">${currentQuote}${esc(val)}${currentQuote}</span>`;
const op = (val: string) => `<span class="dsl-op">${esc(val)}</span>`;
const str = (val: string) => `<span class="dsl-str">${currentQuote}${esc(val)}${currentQuote}</span>`;

function highlightValue(val: string): string {
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    return str(val.slice(1, -1));
  }
  return str(val);
}

// --- RULES-BASED HIGHLIGHTING (reduces CC from 64 to ~10) ---

type HighlightRule = {
  regex: RegExp;
  render: (m: RegExpMatchArray, line: string) => string;
};

const highlightRules: HighlightRule[] = [
  // Definition statements
  { regex: RX.SCENARIO, render: m => `${m[1] ?? ''}${kw('SCENARIO:')} ${esc(m[1])}` },
  { regex: RX.GOAL, render: m => `${m[1] ?? ''}${kw('GOAL:')} <span class="dsl-goal">${esc(m[1])}</span>` },
  { regex: RX.FUNC_DEF, render: m => `${m[1] ?? ''}${kw('FUNC:', 'dsl-func')} <span class="dsl-func-name">${esc(m[1])}</span>` },

  // Tasks
  { regex: RX.TASK_NUM, render: m => `${m[1]}${kw('TASK')} <span class="dsl-num">${esc(m[2])}</span>:` },
  { regex: RX.TASK_ACTION, render: m => `${m[1]}${kw('TASK')} ${br(m[2])} ${highlightValue(m[3])}` },
  {
    regex: RX.TASK_LEGACY,
    render: m => {
      let body = escHtml(m[2]).replace(/\bAND\b/gi, kw('AND'));
      body = body.replace(/"([^"]+)"/g, '<span class="dsl-br">&#39;$1&#39;</span>');
      body = body.replace(/\[([^\]]+)\]/g, '<span class="dsl-br">[$1]</span>');
      return `${m[1]}${kw('TASK')} ${body}`;
    },
  },

  // Pump/Wait (complex dual-form)
  {
    regex: RX.PUMP,
    render: m => {
      if (m[2] && m[3]) {
        return `${m[1]}${kw(m[2].toUpperCase())} ${str(m[3])}`;
      }
      return `${m[1]}${kw((m[4] || 'SET').toUpperCase())} ${br(m[5] || 'PUMP')} ${str(m[6] || '')}`;
    },
  },
  {
    regex: RX.WAIT,
    render: m => {
      if (m[2] && m[3]) {
        return `${m[1]}${kw(m[2].toUpperCase())} ${str(m[3])}`;
      }
      return `${m[1]}${kw((m[4] || 'SET').toUpperCase())} ${br(m[5] || 'WAIT')} ${str(m[6] || '')}`;
    },
  },

  // Variable operations
  { regex: RX.GET, render: m => { const unit = m[3] ? ` ${br(m[3])}` : ''; return `${m[1]}${kw('GET')} ${br(m[2])}${unit}`; } },
  { regex: RX.OUT, render: m => `${m[1]}${kw('OUT', 'dsl-out')} ${br(m[2].toUpperCase())} ${highlightValue(m[3])}` },
  { regex: RX.VAL, render: m => { const unit = m[3] ? ` ${br(m[3])}` : ''; return `${m[1]}${kw('VAL')} ${br(m[2])}${unit}`; } },
  { regex: RX.SET, render: m => `${m[1]}${kw('SET')} ${br(m[2])} ${highlightValue(m[3])}` },
  { regex: RX.MAX_MIN, render: m => `${m[1]}${kw(m[2].toUpperCase())} ${br(m[3])} ${str(m[4])}` },

  // Arrows and functions
  { regex: RX.ARROW, render: m => `${m[1]}<span class="dsl-arrow">→</span> <span class="dsl-fn">${esc(m[2])}</span> ${br(m[3])}` },
  { regex: RX.AND_FN, render: m => `${m[1]}${kw('AND')} <span class="dsl-fn">${esc(m[2])}</span> ${br(m[3])}` },

  // Conditional IF variants
  { regex: RX.COND_IF_INFIX, render: m => `${m[1]}${kw(m[2].toUpperCase())} ${kw('IF')} ${br(m[3])} ${op(m[4])} ${br(m[5])}` },
  {
    regex: RX.COND_IF_PAREN,
    render: m => `${m[1]}${kw(m[2].toUpperCase())} ${kw('IF')} ${br(m[3])} ${op(`(${m[4]})`)} ${br(m[5])}`,
  },
  {
    regex: RX.COND_IF_BRACKET,
    render: m => `${m[1]}${kw(m[2].toUpperCase())} ${kw('IF')} ${br(m[3])} ${op(`[${m[4]}]`)} ${br(m[5])}`,
  },

  // IF variants
  {
    regex: RX.IF_COMPOUND_OR_IF,
    render: m => `${m[1]}${kw('IF')} ${br(m[2])} ${op(m[3])} ${br(m[4])} ${kw('OR')} ${kw('IF')} ${br(m[5])} ${op(m[6])} ${br(m[7])}`,
  },
  {
    regex: RX.IF_COMPOUND,
    render: m => `${m[1]}${kw('IF')} ${br(m[2])} ${op(m[3])} ${br(m[4])} ${kw('OR')} ${br(m[5])} ${op(m[6])} ${br(m[7])}`,
  },
  {
    regex: RX.IF_INFIX,
    render: m => { const to = m[5] ? ` ${kw('TO')} ${br(m[5])}` : ''; return `${m[1]}${kw('IF')} ${br(m[2])} ${op(m[3])} ${highlightValue(m[4])}${to}`; },
  },
  { regex: RX.IF_NO_OP, render: m => `${m[1]}${kw('IF')} ${br(m[2])} ${highlightValue(m[3])}` },
  {
    regex: RX.IF_PAREN,
    render: m => { const to = m[5] ? ` ${kw('TO')} ${br(m[5])}` : ''; return `${m[1]}${kw('IF')} ${br(m[2])} ${op(`(${m[3]})`)} ${br(m[4])}${to}`; },
  },
  {
    regex: RX.IF_BRACKET,
    render: m => { const to = m[5] ? ` ${kw('TO')} ${br(m[5])}` : ''; return `${m[1]}${kw('IF')} ${br(m[2])} ${op(`[${m[3]}]`)} ${br(m[4])}${to}`; },
  },

  // ELSE variants
  {
    regex: RX.ELSE_MSG,
    render: m => `${m[1]}${kw('ELSE')} <span class="dsl-type">${esc(m[2].toUpperCase())}</span> ${str(m[3])}`,
  },
  { regex: RX.ELSE, render: m => `${m[1]}${kw('ELSE', 'dsl-else')}` },

  // Simple commands (one-liners)
  { regex: RX.LOG, render: m => `${m[1]}${kw('LOG', 'dsl-log')} ${br(m[2])}` },
  { regex: RX.ALARM, render: m => `${m[1]}${kw('ALARM', 'dsl-alarm')} ${br(m[2])}` },
  { regex: RX.ERROR, render: m => `${m[1]}${kw('ERROR', 'dsl-error')} ${br(m[2])}` },
  { regex: RX.SAVE, render: m => `${m[1]}${kw('SAVE')} ${br(m[2])}` },
  { regex: RX.RESULT, render: m => `${m[1]}${kw('RESULT', 'dsl-result')} ${br(m[2])}` },

  // FUNC call
  {
    regex: RX.FUNC_CALL,
    render: m => {
      const args = (m[3] || '').replace(/"([^"]*)"/g, (_match, strVal) => ` ${br(strVal)}`);
      return `${m[1]}${kw('FUNC', 'dsl-func')} ${br(m[2])}${args}`;
    },
  },

  // User/Dialog/Info
  { regex: RX.USER, render: m => `${m[1]}${kw('USER', 'dsl-user')} ${br(m[2])} ${br(m[3])}` },
  { regex: RX.DIALOG, render: m => `${m[1]}${kw('DIALOG', 'dsl-dialog')} ${br(m[2])} ${highlightValue(m[3])}` },
  { regex: RX.DIALOG_SINGLE, render: m => `${m[1]}${kw('DIALOG', 'dsl-dialog')} ${str(m[2])}` },
  {
    regex: RX.INFO,
    render: m => { const msg = m[3] ? ` ${highlightValue(m[3])}` : ''; return `${m[1]}${kw('INFO', 'dsl-info')} ${br(m[2])}${msg}`; },
  },

  // Control flow
  { regex: RX.REPEAT, render: m => `${m[1]}${kw('REPEAT', 'dsl-repeat')}` },
  { regex: RX.CONTROL, render: m => `${m[1]}${kw(m[2].toUpperCase(), 'dsl-control')}` },
  { regex: RX.END, render: m => `${m[1]}${kw('END', 'dsl-end')}` },
];

/**
 * Highlight DSL code using rules-based approach (refactored from CC=64).
 * Complexity reduced by replacing ~30 if-else with declarative rules array.
 */
export function highlightDsl(text: string): string {
  const lines = (text || '').split(/\r?\n/);
  const out: string[] = [];

  for (const line of lines) {
    const isSingleQuoted = line.includes("'") && !line.includes('"');
    currentQuote = isSingleQuoted ? "'" : '"';
    const normalizedLine = normalizeQuotedDslLine(line);
    const indent = (normalizedLine.match(/^\s*/) || [''])[0];

    // Fast-path for empty/comment lines
    if (!normalizedLine.trim()) {
      out.push('');
      continue;
    }
    if (/^\s*#/.test(normalizedLine)) {
      out.push(esc(line));
      continue;
    }

    // Try rules in order (first match wins)
    let matched = false;
    for (const rule of highlightRules) {
      const m = normalizedLine.match(rule.regex);
      if (m) {
        out.push(rule.render(m, line));
        matched = true;
        break;
      }
    }

    // Fallback: plain escaped line
    if (!matched) {
      out.push(esc(line));
    }
  }

  return out.join('\n');
}
