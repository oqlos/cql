// func-editor-parser.ts
// Extracted from connect-scenario-func-editor.page.ts — FUNC parsing and validation

export interface FuncDefinition {
  name: string;
  steps: string[];
}

export function parseFuncDefinitions(text: string): FuncDefinition[] {
  const funcs: FuncDefinition[] = [];
  const lines = text.split('\n');
  let current: FuncDefinition | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const funcMatch = trimmed.match(/^FUNC:\s*(.+)$/i);
    if (funcMatch) {
      if (current) funcs.push(current);
      current = { name: funcMatch[1].trim(), steps: [] };
      continue;
    }

    if (current && trimmed) {
      current.steps.push(trimmed);
    }
  }

  if (current) funcs.push(current);
  return funcs;
}

export interface ValidationResult {
  valid: boolean;
  funcs: string[];
  errors: string[];
}

export function validateFunc(text: string): ValidationResult {
  const funcs: string[] = [];
  const errors: string[] = [];
  const lines = text.split('\n');
  let lineNum = 0;
  let currentFunc = '';

  for (const line of lines) {
    lineNum++;
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const funcMatch = trimmed.match(/^FUNC:\s*(.+)$/i);
    if (funcMatch) {
      currentFunc = funcMatch[1].trim();
      funcs.push(currentFunc);
      continue;
    }

    if (!currentFunc && trimmed) {
      errors.push(`Linia ${lineNum}: Instrukcja poza blokiem FUNC`);
    }

    const validStep = /^(TASK|SET |VAL |MIN |MAX |IF |WAIT |SAVE |LOG |ALARM |ERROR |STOP|PAUSE)/i.test(trimmed);
    if (currentFunc && !validStep) {
      errors.push(`Linia ${lineNum}: Nieznana składnia "${trimmed.substring(0, 30)}..."`);
    }
  }

  return { valid: errors.length === 0, funcs, errors };
}
