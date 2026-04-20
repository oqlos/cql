// scenarios.library-helpers.ts
// Library parsing utilities for scenarios - extracted from scenarios.loader.ts

/** Library goal format: legacy `{name, code}` or structured `{name, steps}` */
export interface LibraryGoal {
  name: string;
  code?: string;
  steps?: any[];
}

/** Extract goals from library JSON column */
export function getLibraryGoals(library: string | object | null | undefined): LibraryGoal[] {
  if (!library) return [];
  try {
    const libObj = typeof library === 'string' ? JSON.parse(library) : library;
    if (libObj && Array.isArray(libObj.goals)) {
      return libObj.goals.filter((g: any) => g && typeof g.name === 'string');
    }
  } catch { /* silent */ }
  return [];
}

/** Parse library goals (with DSL code) to builder format (with structured steps) */
export function parseLibraryGoalsToBuilderFormat(
  libraryGoals: LibraryGoal[],
  parseDsl: (text: string) => { ok: boolean; errors: string[]; ast: any }
): any[] {
  const result: any[] = [];

  for (const goal of libraryGoals) {
    if (Array.isArray((goal as any)?.steps)) {
      result.push({ id: goal.name, name: goal.name, steps: (goal as any).steps });
      continue;
    }

    // Wrap goal code in GOAL block for parsing
    // Ensure all code lines are properly indented (DSL parser requires indentation for goal content)
    const codeLines = (goal.code || '').split('\n').map(line => {
      const trimmed = line.trim();
      if (!trimmed) return '';
      // Add indentation if line doesn't start with whitespace
      return line.match(/^\s/) ? line : `  ${line}`;
    }).join('\n');

    const dslText = `GOAL: ${goal.name}\n${codeLines}`;

    try {
      const parsed = parseDsl(dslText);
      if (parsed?.ok && parsed.ast?.goals?.length > 0) {
        // Use parsed goal with structured steps
        result.push(parsed.ast.goals[0]);
      } else {
        // Fallback: create goal with name only (no steps)
        result.push({ id: goal.name, name: goal.name, steps: [] });
      }
    } catch {
      // Fallback: create goal with name only
      result.push({ id: goal.name, name: goal.name, steps: [] });
    }
  }

  return result;
}

/** Generate DSL text from library goals for preview */
export function generateDslFromLibraryGoals(scenarioName: string, libraryGoals: LibraryGoal[]): string {
  const lines: string[] = [`SCENARIO: ${scenarioName}`, ''];

  for (const goal of libraryGoals) {
    lines.push(`GOAL: ${goal.name}`);
    if (goal.code) {
      // Indent each line of the goal code
      const codeLines = goal.code.split('\n').map(line => line.trim() ? `  ${line}` : '');
      lines.push(...codeLines);
    } else if (Array.isArray((goal as any)?.steps) && (goal as any).steps.length > 0) {
      // Fallback: generate from steps - simplified version
      try {
        for (const step of (goal as any).steps) {
          if (step && typeof step === 'object') {
            const stepLine = step.type ? `  ${step.type}: ${step.param || step.value || ''}` : '';
            if (stepLine.trim()) lines.push(stepLine);
          }
        }
      } catch { /* silent */ }
    }
    lines.push('');
  }

  return lines.join('\n');
}

/** Parse FUNC source to builder format */
export function parseFuncSourceToBuilderFormat(
  funcSrc: string | null | undefined,
  parseDsl: (text: string) => { ok: boolean; errors: string[]; ast: any }
): any[] {
  const src = String(funcSrc || '').trim();
  if (!src) return [];
  try {
    const parsed = parseDsl(src);
    if (parsed?.ok && Array.isArray(parsed.ast?.funcs)) {
      return parsed.ast.funcs;
    }
  } catch { /* silent */ }
  return [];
}
