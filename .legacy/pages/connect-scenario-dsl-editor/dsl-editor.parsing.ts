// frontend/src/pages/connect-scenario-dsl-editor/dsl-editor.parsing.ts

export interface GoalStructure {
  name: string;
  outputs: {
    val: string | null;
    max: string | null;
    min: string | null;
    result: string;
  };
  options: Array<{ name: string; description: string }>;
}

/** Generate DSL text from library.goals */
export function generateDslFromLibrary(_title: string, library: any): string {
  // Parse library if it's a JSON string
  let libObj = library;
  if (typeof library === 'string') {
    try { libObj = JSON.parse(library); } catch { libObj = null; }
  }
  const goals = libObj?.goals || [];
  if (!goals.length) return '';
  
  const lines: string[] = [];
  for (const goal of goals) {
    lines.push(`GOAL: ${goal.name || 'Unnamed'}`);
    if (goal.code) {
      const codeLines = goal.code.split('\n').map((line: string) => line.trim() ? `  ${line}` : '');
      lines.push(...codeLines);
    }
    lines.push('');
  }
  return lines.join('\n');
}

/** Extract goals with full code for library.goals format */
export function extractGoalsWithCode(dsl: string): Array<{ name: string; code: string }> {
  const goals: Array<{ name: string; code: string }> = [];
  const lines = dsl.split('\n');
  let currentGoal: { name: string; codeLines: string[] } | null = null;
  
  for (const line of lines) {
    const goalMatch = line.match(/^\s*GOAL:\s*(.+)$/i);
    if (goalMatch) {
      // Save previous goal
      if (currentGoal) {
        goals.push({ name: currentGoal.name, code: currentGoal.codeLines.join('\n') });
      }
      currentGoal = { name: goalMatch[1].trim(), codeLines: [] };
      continue;
    }
    
    // Skip SCENARIO line
    if (line.match(/^\s*SCENARIO:/i)) continue;
    
    // Add line to current goal's code (if we have a current goal)
    if (currentGoal && line.trim()) {
      // Remove leading 2 spaces if present (standard DSL indentation)
      const codeLine = line.startsWith('  ') ? line.slice(2) : line;
      currentGoal.codeLines.push(codeLine);
    }
  }
  
  // Don't forget the last goal
  if (currentGoal) {
    goals.push({ name: currentGoal.name, code: currentGoal.codeLines.join('\n') });
  }
  
  return goals;
}

/** Parse DSL and extract GOAL structure with OUT/OPT fields */
export function parseGoalStructure(dsl: string): GoalStructure[] {
  const goals: GoalStructure[] = [];
  const lines = dsl.split('\n');
  let currentGoal: GoalStructure | null = null;
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // New GOAL
    const goalMatch = trimmed.match(/^GOAL:\s*(.*)$/i);
    if (goalMatch) {
      if (currentGoal) goals.push(currentGoal);
      currentGoal = {
        name: goalMatch[1].trim() || '(bez nazwy)',
        outputs: { val: null, max: null, min: null, result: 'ERROR' },
        options: []
      };
      continue;
    }
    
    if (!currentGoal) continue;
    
    // OUT [VAL] [variable]
    const outValMatch = trimmed.match(/^OUT\s+\[VAL\]\s*\[([^\]]+)\]/i);
    if (outValMatch) {
      currentGoal.outputs.val = outValMatch[1];
      continue;
    }
    
    // OUT [MAX] [variable]
    const outMaxMatch = trimmed.match(/^OUT\s+\[MAX\]\s*\[([^\]]+)\]/i);
    if (outMaxMatch) {
      currentGoal.outputs.max = outMaxMatch[1];
      continue;
    }
    
    // OUT [MIN] [variable]
    const outMinMatch = trimmed.match(/^OUT\s+\[MIN\]\s*\[([^\]]+)\]/i);
    if (outMinMatch) {
      currentGoal.outputs.min = outMinMatch[1];
      continue;
    }
    
    // OUT [RESULT] "value"
    const outResultMatch = trimmed.match(/^OUT\s+\[RESULT\]\s*"([^"]*)"/i);
    if (outResultMatch) {
      currentGoal.outputs.result = outResultMatch[1];
      continue;
    }
    
    // OPT [variable] "description"
    const optMatch = trimmed.match(/^OPT\s+\[([^\]]+)\]\s*"([^"]*)"/i);
    if (optMatch) {
      currentGoal.options.push({ name: optMatch[1], description: optMatch[2] });
      continue;
    }
  }
  
  if (currentGoal) goals.push(currentGoal);
  return goals;
}

/** Extract executable steps from DSL code */
export function extractStepsFromDsl(dsl: string): string[] {
  const lines = dsl.split('\n').filter(l => l.trim() && !l.trim().startsWith('//') && !l.trim().startsWith('#'));
  const steps: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    // Match all DSL keywords
    if (trimmed.startsWith('GOAL:') || trimmed.startsWith('TASK') || 
        trimmed.startsWith('SET ') || trimmed.startsWith('GET ') ||
        trimmed.startsWith('IF ') || trimmed.startsWith('WHEN ') ||
        trimmed.startsWith('ELSE') || trimmed.startsWith('END') ||
        trimmed.startsWith('OUT ') || trimmed.startsWith('INFO ') ||
        trimmed.startsWith('DIALOG ') || trimmed.startsWith('WAIT ') ||
        trimmed.match(/^OR\s+IF/i)) {
      steps.push(trimmed);
    }
  }
  return steps.length > 0 ? steps : ['Wykonanie scenariusza'];
}
