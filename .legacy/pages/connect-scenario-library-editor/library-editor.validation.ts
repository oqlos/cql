// frontend/src/pages/connect-scenario-library-editor/library-editor.validation.ts

import { escapeHtml } from '../../modules/shared/generic-grid/utils';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  goals: number;
  funcs: number;
  variables: string[];
  outDeclarations: Array<{ goal: string; type: string; value: string }>;
}

export interface GoalValidationResult {
  errors: string[];
  warnings: string[];
  variables: string[];
  outDeclarations: Array<{ goal: string; type: string; value: string }>;
}

/** Validate library JSON and DSL code */
export function validateLibraryJson(src: string): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    goals: 0,
    funcs: 0,
    variables: [],
    outDeclarations: []
  };

  try {
    const lib = JSON.parse(src);
    
    // Validate structure
    if (!lib || typeof lib !== 'object') {
      result.errors.push('JSON musi być obiektem');
      result.valid = false;
      return result;
    }

    // Check goals
    if (lib.goals && Array.isArray(lib.goals)) {
      result.goals = lib.goals.length;
      lib.goals.forEach((goal: any, idx: number) => {
        if (!goal.name) {
          result.errors.push(`GOAL[${idx}]: brak nazwy`);
          result.valid = false;
        }
        if (!goal.code && !goal.dsl) {
          result.warnings.push(`GOAL[${idx}] "${goal.name || '?'}": brak kodu DSL`);
        } else {
          // Validate DSL code
          const code = goal.code || goal.dsl || '';
          const goalValidation = validateGoalDsl(goal.name || `GOAL[${idx}]`, code);
          result.variables.push(...goalValidation.variables);
          result.outDeclarations.push(...goalValidation.outDeclarations);
          result.errors.push(...goalValidation.errors);
          result.warnings.push(...goalValidation.warnings);
          if (goalValidation.errors.length > 0) result.valid = false;
        }
      });
    } else {
      result.warnings.push('Brak zdefiniowanych celów (goals)');
    }

    // Check funcs
    if (lib.funcs && Array.isArray(lib.funcs)) {
      result.funcs = lib.funcs.length;
      lib.funcs.forEach((func: any, idx: number) => {
        if (!func.name) {
          result.errors.push(`FUNC[${idx}]: brak nazwy`);
          result.valid = false;
        }
        if (!func.code) {
          result.warnings.push(`FUNC[${idx}] "${func.name || '?'}": brak kodu`);
        }
      });
    }

    // Check library arrays
    const arrays = ['objects', 'functions', 'params', 'units'];
    arrays.forEach(arr => {
      if (lib[arr] && !Array.isArray(lib[arr])) {
        result.errors.push(`${arr} musi być tablicą`);
        result.valid = false;
      }
    });

  } catch (e: any) {
    result.errors.push(`Błąd parsowania JSON: ${e.message || e}`);
    result.valid = false;
  }

  return result;
}

/** Validate DSL code for a single goal */
export function validateGoalDsl(goalName: string, code: string): GoalValidationResult {
  const result: GoalValidationResult = {
    errors: [],
    warnings: [],
    variables: [],
    outDeclarations: []
  };

  const lines = code.split('\n');
  const setVars = new Set<string>();
  const usedVars = new Set<string>();
  let hasResult = false;
  let ifCount = 0;
  let elseCount = 0;
  let endCount = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Parse SET declarations
    const setMatch = trimmed.match(/^SET\s+\[([^\]]+)\]/i);
    if (setMatch) {
      setVars.add(setMatch[1]);
      result.variables.push(setMatch[1]);
    }

    // Parse GET declarations
    const getMatch = trimmed.match(/^GET\s+\[([^\]]+)\]/i);
    if (getMatch) {
      usedVars.add(getMatch[1]);
    }

    // Parse IF conditions
    if (/^IF\s+/i.test(trimmed)) {
      ifCount++;
      const ifVarMatch = trimmed.match(/IF\s+\[([^\]]+)\]/i);
      if (ifVarMatch) usedVars.add(ifVarMatch[1]);
    }

    // Parse ELSE
    if (/^ELSE\s*$/i.test(trimmed)) {
      elseCount++;
    }

    // Parse END / END IF / ENDIF
    if (/^(END|END\s+IF|ENDIF)\s*$/i.test(trimmed)) {
      endCount++;
    }

    // Parse OUT declarations
    const outMatch = trimmed.match(/^OUT\s+\[([^\]]+)\]\s+(.+)/i);
    if (outMatch) {
      const outType = outMatch[1].toUpperCase();
      const outValue = outMatch[2].replace(/^\[|\]$/g, '').trim();
      result.outDeclarations.push({ goal: goalName, type: outType, value: outValue });
      
      if (outType === 'RESULT') {
        hasResult = true;
      }
      
      // Check if OUT value references an undefined variable
      const varRef = outValue.match(/^\[?([^\]"]+)\]?$/);
      if (varRef && !setVars.has(varRef[1]) && !['OK', 'ERROR', 'mbar', 's', 'bar'].includes(varRef[1])) {
        // It's a variable reference, check if it's defined
        const varName = varRef[1].trim();
        if (varName && !/^\d/.test(varName) && !varName.includes(' ')) {
          usedVars.add(varName);
        }
      }
    }

    // Parse DIALOG
    const dialogMatch = trimmed.match(/^DIALOG\s+\[([^\]]+)\]/i);
    if (dialogMatch) {
      usedVars.add(dialogMatch[1]);
    }
  }

  // Warnings for missing OUT RESULT
  if (!hasResult) {
    result.warnings.push(`${goalName}: brak OUT [RESULT] - cel nie zwróci wyniku`);
  }

  // Warnings for IF without matching END
  if (ifCount > 0 && endCount === 0) {
    result.warnings.push(`${goalName}: IF bez END - dodaj END aby zamknąć blok warunkowy`);
  }

  // Warnings for IF without matching ELSE
  if (ifCount > 0 && elseCount === 0) {
    result.warnings.push(`${goalName}: IF bez ELSE - rozważ dodanie obsługi błędu`);
  }

  // Check for undefined variables
  for (const used of usedVars) {
    if (!setVars.has(used) && !['NC', 'SC', 'WC', 'timer', 'OK', 'ERROR'].includes(used)) {
      result.warnings.push(`${goalName}: zmienna [${used}] użyta bez SET`);
    }
  }

  return result;
}

/** Show validation results in a fixed panel */
export function showValidationResults(validation: ValidationResult): void {
  let panel = document.getElementById('validation-results-panel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'validation-results-panel';
    panel.className = 'validation-panel';
    panel.style.cssText = 'position:fixed;bottom:20px;right:20px;width:400px;max-height:400px;overflow-y:auto;background:var(--panel-bg);border:1px solid var(--border);border-radius:8px;padding:16px;z-index:1000;box-shadow:0 4px 12px rgba(0,0,0,0.3);';
    document.body.appendChild(panel);
  }

  const statusIcon = validation.valid ? '✅' : '❌';
  const statusText = validation.valid ? 'Walidacja OK' : 'Błędy walidacji';
  const statusColor = validation.valid ? 'var(--success)' : 'var(--danger)';

  let html = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
      <h4 style="margin:0;color:${statusColor};">${statusIcon} ${statusText}</h4>
      <button id="close-validation-panel" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:18px;">✕</button>
    </div>
    <div style="font-size:13px;color:var(--text-muted);margin-bottom:12px;">
      📊 ${validation.goals} celów, ${validation.funcs} procedur, ${validation.variables.length} zmiennych
    </div>
  `;

  if (validation.errors.length > 0) {
    html += `<div style="margin-bottom:12px;"><strong style="color:var(--danger);">❌ Błędy (${validation.errors.length}):</strong><ul style="margin:4px 0 0 16px;padding:0;">`;
    validation.errors.forEach(e => { html += `<li style="color:var(--danger);font-size:12px;margin:2px 0;">${escapeHtml(e)}</li>`; });
    html += '</ul></div>';
  }

  if (validation.warnings.length > 0) {
    html += `<div style="margin-bottom:12px;"><strong style="color:var(--warning);">⚠️ Ostrzeżenia (${validation.warnings.length}):</strong><ul style="margin:4px 0 0 16px;padding:0;">`;
    validation.warnings.forEach(w => { html += `<li style="color:var(--warning);font-size:12px;margin:2px 0;">${escapeHtml(w)}</li>`; });
    html += '</ul></div>';
  }

  if (validation.outDeclarations.length > 0) {
    html += `<div><strong style="color:var(--accent);">📤 OUT declarations:</strong><ul style="margin:4px 0 0 16px;padding:0;">`;
    const byGoal = new Map<string, Array<{ type: string; value: string }>>();
    validation.outDeclarations.forEach(o => {
      if (!byGoal.has(o.goal)) byGoal.set(o.goal, []);
      byGoal.get(o.goal)!.push({ type: o.type, value: o.value });
    });
    byGoal.forEach((outs, goal) => {
      html += `<li style="color:var(--accent);font-size:12px;margin:4px 0;"><strong>${escapeHtml(goal)}:</strong> `;
      html += outs.map(o => `${o.type}=${escapeHtml(o.value)}`).join(', ');
      html += '</li>';
    });
    html += '</ul></div>';
  }

  panel.innerHTML = html;

  document.getElementById('close-validation-panel')?.addEventListener('click', () => { panel?.remove(); });
  setTimeout(() => { panel?.remove(); }, 30000);
}
