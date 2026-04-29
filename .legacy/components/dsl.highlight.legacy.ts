// frontend/src/components/dsl/dsl.highlight.ts

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
  TASK_ACTION: new RegExp(`^(\\s*)TASK\\s+${P.VAR}\\s*${P.VALUE}\\s*$`, 'i'),
  TASK_LEGACY: /^(\s*)TASK\s*:?\s*(.+)$/i,
  PUMP: new RegExp(`^(\\s*)(?:((?:PUMP))\\s*"([^"]+)"|((?:SET))\\s*"((?:PUMP|pump|POMPA|pompa))"\\s*"([^"]+)")\\s*$`, 'i'),
  GET: new RegExp(`^(\\s*)GET\\s*${P.VAR}(?:\\s*${P.VAR})?\\s*$`, 'i'),
  OUT: new RegExp(`^(\\s*)OUT\\s*"(VAL|MAX|MIN|UNIT|GET|RESULT)"\\s*${P.VALUE}\\s*$`, 'i'),
  VAL: new RegExp(`^(\\s*)VAL\\s*${P.VAR}(?:\\s*${P.VAR})?\\s*$`, 'i'),
  SET: new RegExp(`^(\\s*)SET\\s*${P.VAR}\\s*${P.VALUE}\\s*$`, 'i'),
  MAX_MIN: new RegExp(`^(\\s*)(MAX|MIN)\\s*${P.VAR}\\s*${P.VALUE}\\s*$`, 'i'),
  ARROW: new RegExp(`^(\\s*)→\\s*([^"]+?)\\s*${P.VAR}\\s*$`),
  AND_FN: new RegExp(`^(\\s*)AND\\s+([^"]+?)\\s*${P.VAR}\\s*$`, 'i'),
  COND_IF_INFIX: new RegExp(`^(\\s*)(AND|OR|ELSE)\\s+IF\\s*${P.VAR}\\s*${P.OP}\\s*${P.VAR}\\s*$`, 'i'),
  COND_IF_PAREN: new RegExp(`^(\\s*)(AND|OR|ELSE)\\s+IF\\s*${P.VAR}\\s*${P.OP_PAREN}\\s*${P.VAR}\\s*$`, 'i'),
  COND_IF_BRACKET: new RegExp(`^(\\s*)(AND|OR|ELSE)\\s+IF\\s*${P.VAR}\\s*${P.OP_BRACKET}\\s*${P.VAR}\\s*$`, 'i'),
  // Compound IF: IF "var" > "val" OR IF "var2" < "val2"
  IF_COMPOUND_OR_IF: new RegExp(`^(\\s*)IF\\s*${P.VAR}\\s*${P.OP}\\s*${P.VAR}\\s+OR\\s+IF\\s*${P.VAR}\\s*${P.OP}\\s*${P.VAR}\\s*$`, 'i'),
  // Compound IF without second IF: IF "var" > "val" OR "var2" < "val2"
  IF_COMPOUND: new RegExp(`^(\\s*)IF\\s*${P.VAR}\\s*${P.OP}\\s*${P.VAR}\\s+OR\\s*${P.VAR}\\s*${P.OP}\\s*${P.VAR}\\s*$`, 'i'),
  IF_INFIX: new RegExp(`^(\\s*)IF\\s*${P.VAR}\\s*${P.OP}\\s*${P.VALUE}(?:\\s+TO\\s*${P.VAR})?\\s*$`, 'i'),
  IF_NO_OP: new RegExp(`^(\\s*)IF\\s*${P.VAR}\\s*${P.VALUE}\\s*$`, 'i'),
  IF_PAREN: new RegExp(`^(\\s*)IF\\s*${P.VAR}\\s*${P.OP_PAREN}\\s*${P.VAR}(?:\\s+TO\\s*${P.VAR})?\\s*$`, 'i'),
  IF_BRACKET: new RegExp(`^(\\s*)IF\\s*${P.VAR}\\s*${P.OP_BRACKET}\\s*${P.VAR}(?:\\s+TO\\s*${P.VAR})?\\s*$`, 'i'),
  ELSE_MSG: /^(\s*)ELSE\s+(ERROR|WARNING|INFO|GOAL)\s+\"(.*)\"\s*$/i,
  ELSE: /^(\s*)ELSE\s*$/i,
  WAIT: new RegExp(`^(\\s*)(?:((?:WAIT))\\s*"([^"]+)"|((?:SET))\\s*"((?:WAIT|wait))"\\s*"([^"]+)")\\s*$`, 'i'),
  LOG: new RegExp(`^(\\s*)LOG\\s*${P.VAR}\\s*$`, 'i'),
  ALARM: new RegExp(`^(\\s*)ALARM\\s*${P.VAR}\\s*$`, 'i'),
  ERROR: new RegExp(`^(\\s*)ERROR\\s*${P.VAR}\\s*$`, 'i'),
  SAVE: new RegExp(`^(\\s*)SAVE\\s*${P.VAR}\\s*$`, 'i'),
  FUNC_CALL: new RegExp(`^(\\s*)FUNC\\s*${P.VAR}((?:\\s*(?:${P.VAR}))*)\\s*$`, 'i'),
  USER: new RegExp(`^(\\s*)USER\\s*${P.VAR}\\s*${P.VAR}\\s*$`, 'i'),
  DIALOG: new RegExp(`^(\\s*)DIALOG\\s*${P.VAR}\\s*${P.VALUE}\\s*$`, 'i'),
  DIALOG_SINGLE: new RegExp(`^(\\s*)DIALOG\\s*${P.VAR}\\s*$`, 'i'),
  RESULT: new RegExp(`^(\\s*)RESULT\\s*${P.VAR}\\s*$`, 'i'),
  // OPT command removed - no longer used
  INFO: new RegExp(`^(\\s*)INFO\\s*${P.VAR}\\s*${P.VALUE}?\\s*$`, 'i'),
  REPEAT: /^(\s*)REPEAT\s*$/i,
  CONTROL: /^(\s*)(STOP|PAUSE)\s*$/i,
  END: /^(\s*)END\s*$/i,
} as const;

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
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) return str(val.slice(1, -1));
  return str(val);
}

export function highlightDsl(text: string): string {
  const lines = (text || '').split(/\r?\n/);
  const out: string[] = [];

  for (let line of lines) {
    const isSingleQuoted = line.includes("'") && !line.includes('"');
    currentQuote = isSingleQuoted ? "'" : '"';
    const normalizedLine = normalizeQuotedDslLine(line);
    const indent = (normalizedLine.match(/^\s*/) || [''])[0];
    let m: RegExpMatchArray | null;

    if (!normalizedLine.trim()) { out.push(''); continue; }
    if (/^\s*#/.test(normalizedLine)) { out.push(esc(line)); continue; }

    // SCENARIO / GOAL / FUNC definition
    if ((m = normalizedLine.match(RX.SCENARIO))) {
      out.push(`${indent}${kw('SCENARIO:')} ${esc(m[1])}`);
      continue;
    }
    if ((m = normalizedLine.match(RX.GOAL))) {
      out.push(`${indent}${kw('GOAL:')} <span class="dsl-goal">${esc(m[1])}</span>`);
      continue;
    }
    if ((m = normalizedLine.match(RX.FUNC_DEF))) {
      out.push(`${indent}${kw('FUNC:', 'dsl-func')} <span class="dsl-func-name">${esc(m[1])}</span>`);
      continue;
    }

    // TASK variants
    if ((m = normalizedLine.match(RX.TASK_NUM))) {
      out.push(`${m[1]}${kw('TASK')} <span class="dsl-num">${esc(m[2])}</span>:`);
      continue;
    }
    if ((m = normalizedLine.match(RX.TASK_ACTION))) {
      out.push(`${m[1]}${kw('TASK')} ${br(m[2])} ${highlightValue(m[3])}`);
      continue;
    }
    if ((m = normalizedLine.match(RX.TASK_LEGACY))) {
      let body = escHtml(m[2]).replace(/\bAND\b/gi, kw('AND'));
      body = body.replace(/"([^"]+)"/g, '<span class="dsl-br">&#39;$1&#39;</span>');
      body = body.replace(/\[([^\]]+)\]/g, '<span class="dsl-br">[$1]</span>');
      out.push(`${m[1]}${kw('TASK')} ${body}`);
      continue;
    }
    if ((m = normalizedLine.match(RX.PUMP))) {
      if (m[2] && m[3]) {
        out.push(`${m[1]}${kw(m[2].toUpperCase())} ${str(m[3])}`);
      } else {
        out.push(`${m[1]}${kw((m[4] || 'SET').toUpperCase())} ${br(m[5] || 'PUMP')} ${str(m[6] || '')}`);
      }
      continue;
    }

    // WAIT (before SET so SET "WAIT" is handled here)
    if ((m = normalizedLine.match(RX.WAIT))) {
      if (m[2] && m[3]) {
        out.push(`${m[1]}${kw(m[2].toUpperCase())} ${str(m[3])}`);
      } else {
        out.push(`${m[1]}${kw((m[4] || 'SET').toUpperCase())} ${br(m[5] || 'WAIT')} ${str(m[6] || '')}`);
      }
      continue;
    }

    // GET / VAL / SET / OUT
    if ((m = normalizedLine.match(RX.GET))) {
      const unit = m[3] ? ` ${br(m[3])}` : '';
      out.push(`${m[1]}${kw('GET')} ${br(m[2])}${unit}`);
      continue;
    }
    if ((m = normalizedLine.match(RX.OUT))) {
      out.push(`${m[1]}${kw('OUT', 'dsl-out')} ${br(m[2].toUpperCase())} ${highlightValue(m[3])}`);
      continue;
    }
    if ((m = normalizedLine.match(RX.VAL))) {
      const unit = m[3] ? ` ${br(m[3])}` : '';
      out.push(`${m[1]}${kw('VAL')} ${br(m[2])}${unit}`);
      continue;
    }
    if ((m = normalizedLine.match(RX.SET))) {
      out.push(`${m[1]}${kw('SET')} ${br(m[2])} ${highlightValue(m[3])}`);
      continue;
    }
    if ((m = normalizedLine.match(RX.MAX_MIN))) {
      out.push(`${m[1]}${kw(m[2].toUpperCase())} ${br(m[3])} ${str(m[4])}`);
      continue;
    }

    // Arrow and AND function
    if ((m = normalizedLine.match(RX.ARROW))) {
      out.push(`${m[1]}<span class="dsl-arrow">→</span> <span class="dsl-fn">${esc(m[2])}</span> ${br(m[3])}`);
      continue;
    }
    if ((m = normalizedLine.match(RX.AND_FN))) {
      out.push(`${m[1]}${kw('AND')} <span class="dsl-fn">${esc(m[2])}</span> ${br(m[3])}`);
      continue;
    }

    // Conditional IF (AND/OR/ELSE IF)
    if ((m = normalizedLine.match(RX.COND_IF_INFIX))) {
      out.push(`${m[1]}${kw(m[2].toUpperCase())} ${kw('IF')} ${br(m[3])} ${op(m[4])} ${br(m[5])}`);
      continue;
    }
    if ((m = normalizedLine.match(RX.COND_IF_PAREN)) || (m = normalizedLine.match(RX.COND_IF_BRACKET))) {
      out.push(`${m[1]}${kw(m[2].toUpperCase())} ${kw('IF')} ${br(m[3])} ${op(`[${m[4]}]`)} ${br(m[5])}`);
      continue;
    }

    // IF variants
    // Compound IF: IF [var] > [val] OR IF [var2] < [val2]
    if ((m = normalizedLine.match(RX.IF_COMPOUND_OR_IF))) {
      out.push(`${m[1]}${kw('IF')} ${br(m[2])} ${op(m[3])} ${br(m[4])} ${kw('OR')} ${kw('IF')} ${br(m[5])} ${op(m[6])} ${br(m[7])}`);
      continue;
    }
    // Compound IF without second IF: IF [var] > [val] OR [var2] < [val2]
    if ((m = normalizedLine.match(RX.IF_COMPOUND))) {
      out.push(`${m[1]}${kw('IF')} ${br(m[2])} ${op(m[3])} ${br(m[4])} ${kw('OR')} ${br(m[5])} ${op(m[6])} ${br(m[7])}`);
      continue;
    }
    if ((m = normalizedLine.match(RX.IF_INFIX))) {
      const to = m[5] ? ` ${kw('TO')} ${br(m[5])}` : '';
      out.push(`${m[1]}${kw('IF')} ${br(m[2])} ${op(m[3])} ${highlightValue(m[4])}${to}`);
      continue;
    }
    if ((m = normalizedLine.match(RX.IF_NO_OP))) {
      out.push(`${m[1]}${kw('IF')} ${br(m[2])} ${highlightValue(m[3])}`);
      continue;
    }
    if ((m = normalizedLine.match(RX.IF_PAREN)) || (m = normalizedLine.match(RX.IF_BRACKET))) {
      const to = m[5] ? ` ${kw('TO')} ${br(m[5])}` : '';
      out.push(`${m[1]}${kw('IF')} ${br(m[2])} ${op(`[${m[3]}]`)} ${br(m[4])}${to}`);
      continue;
    }

    // ELSE
    if ((m = normalizedLine.match(RX.ELSE_MSG))) {
      out.push(`${m[1]}${kw('ELSE')} <span class="dsl-type">${esc(m[2].toUpperCase())}</span> ${str(m[3])}`);
      continue;
    }
    if ((m = normalizedLine.match(RX.ELSE))) {
      out.push(`${m[1]}${kw('ELSE', 'dsl-else')}`);
      continue;
    }

    // Simple commands: LOG, ALARM, ERROR, SAVE, RESULT
    if ((m = normalizedLine.match(RX.LOG))) { out.push(`${m[1]}${kw('LOG', 'dsl-log')} ${br(m[2])}`); continue; }
    if ((m = normalizedLine.match(RX.ALARM))) { out.push(`${m[1]}${kw('ALARM', 'dsl-alarm')} ${br(m[2])}`); continue; }
    if ((m = normalizedLine.match(RX.ERROR))) { out.push(`${m[1]}${kw('ERROR', 'dsl-error')} ${br(m[2])}`); continue; }
    if ((m = normalizedLine.match(RX.SAVE))) { out.push(`${m[1]}${kw('SAVE')} ${br(m[2])}`); continue; }
    if ((m = normalizedLine.match(RX.RESULT))) { out.push(`${m[1]}${kw('RESULT', 'dsl-result')} ${br(m[2])}`); continue; }

    // FUNC call
    if ((m = normalizedLine.match(RX.FUNC_CALL))) {
      // Process args in single pass
      const args = (m[3] || '').replace(/"([^"]*)"/g, (_match, strVal) => {
        return ` ${br(strVal)}`;
      });
      out.push(`${m[1]}${kw('FUNC', 'dsl-func')} ${br(m[2])}${args}`);
      continue;
    }

    // USER / DIALOG / OPT / INFO
    if ((m = normalizedLine.match(RX.USER))) {
      out.push(`${m[1]}${kw('USER', 'dsl-user')} ${br(m[2])} ${br(m[3])}`);
      continue;
    }
    if ((m = normalizedLine.match(RX.DIALOG))) {
      out.push(`${m[1]}${kw('DIALOG', 'dsl-dialog')} ${br(m[2])} ${highlightValue(m[3])}`);
      continue;
    }
    if ((m = normalizedLine.match(RX.DIALOG_SINGLE))) {
      out.push(`${m[1]}${kw('DIALOG', 'dsl-dialog')} ${str(m[2])}`);
      continue;
    }
    // OPT command removed - no longer used
    if ((m = normalizedLine.match(RX.INFO))) {
      const msg = m[3] ? ` ${highlightValue(m[3])}` : '';
      out.push(`${m[1]}${kw('INFO', 'dsl-info')} ${br(m[2])}${msg}`);
      continue;
    }

    // Control: REPEAT, STOP, PAUSE, END
    if ((m = normalizedLine.match(RX.REPEAT))) { out.push(`${m[1]}${kw('REPEAT', 'dsl-repeat')}`); continue; }
    if ((m = normalizedLine.match(RX.CONTROL))) { out.push(`${m[1]}${kw(m[2].toUpperCase(), 'dsl-control')}`); continue; }
    if ((m = normalizedLine.match(RX.END))) { out.push(`${m[1]}${kw('END', 'dsl-end')}`); continue; }

    out.push(esc(line));
  }
  return out.join('\n');
}
