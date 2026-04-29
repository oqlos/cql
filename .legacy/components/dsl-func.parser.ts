// frontend/src/components/dsl/dsl-func.parser.ts
// Parser and expander for FUNC (reusable procedures) in DSL

export interface FuncDefinition {
  name: string;
  steps: FuncStep[];
}

export interface FuncStep {
  type: 'TASK' | 'SET' | 'IF' | 'MIN' | 'MAX' | 'VAL' | 'WAIT' | 'SAVE' | 'ERROR' | 'ALARM' | 'LOG' | 'STOP' | 'PAUSE';
  raw: string;
  parsed?: {
    action?: string;
    object?: string;
    variable?: string;
    value?: string;
    unit?: string;
    condition?: string;
    message?: string;
  };
}

export interface FuncLibrary {
  [name: string]: FuncDefinition;
}

type FuncStepParser = (line: string) => FuncStep | null;

function createFuncStep(type: FuncStep['type'], raw: string, parsed: NonNullable<FuncStep['parsed']>): FuncStep {
  return { type, raw, parsed };
}

function parseTaskStep(line: string): FuncStep | null {
  const match = line.match(/^TASK\s+\[([^\]]+)\]\s*\[([^\]]+)\]$/i);
  if (!match) return null;
  return createFuncStep('TASK', line, {
    action: match[1].trim(),
    object: match[2].trim(),
  });
}

function splitSetValue(value: string): { value: string; unit?: string } {
  const match = value.match(/^(.+?)\s*(s|ms|bar|mbar|%)?$/);
  return {
    value: match ? match[1].trim() : value.trim(),
    unit: match && match[2] ? match[2] : undefined,
  };
}

function parseSetStep(line: string): FuncStep | null {
  const match = line.match(/^SET\s*\[([^\]]+)\]\s*=\s*\[([^\]]+)\]$/i);
  if (!match) return null;
  const parsedValue = splitSetValue(match[2]);
  return createFuncStep('SET', line, {
    variable: match[1].trim(),
    value: parsedValue.value,
    unit: parsedValue.unit,
  });
}

function createVariableValueParser(type: Extract<FuncStep['type'], 'MIN' | 'MAX' | 'WAIT'>): FuncStepParser {
  const pattern = new RegExp(`^${type}\\s*\\[([^\\]]+)\\]\\s*=\\s*\\[([^\\]]+)\\]$`, 'i');
  return (line: string) => {
    const match = line.match(pattern);
    if (!match) return null;
    return createFuncStep(type, line, {
      variable: match[1].trim(),
      value: match[2].trim(),
    });
  };
}

function parseValStep(line: string): FuncStep | null {
  const match = line.match(/^VAL\s*\[([^\]]+)\]\s*\[([^\]]+)\]$/i);
  if (!match) return null;
  return createFuncStep('VAL', line, {
    variable: match[1].trim(),
    unit: match[2].trim(),
  });
}

function parseIfStep(line: string): FuncStep | null {
  const match = line.match(/^IF\s*\[([^\]]+)\]\s*([<>=!]+)\s*\[([^\]]+)\]$/i);
  if (!match) return null;
  return createFuncStep('IF', line, {
    condition: `${match[1]} ${match[2]} ${match[3]}`,
  });
}

function parseSaveStep(line: string): FuncStep | null {
  const match = line.match(/^SAVE\s*\[([^\]]+)\]$/i);
  if (!match) return null;
  return createFuncStep('SAVE', line, {
    variable: match[1].trim(),
  });
}

function createMessageParser(type: Extract<FuncStep['type'], 'ERROR' | 'ALARM' | 'LOG'>): FuncStepParser {
  const pattern = new RegExp(`^${type}\\s*\\[([^\\]]+)\\]$`, 'i');
  return (line: string) => {
    const match = line.match(pattern);
    if (!match) return null;
    return createFuncStep(type, line, {
      message: match[1].trim(),
    });
  };
}

function createOptionalMessageParser(type: Extract<FuncStep['type'], 'STOP' | 'PAUSE'>, fallback: string): FuncStepParser {
  const pattern = new RegExp(`^${type}(?:\\s*\\[([^\\]]+)\\])?$`, 'i');
  return (line: string) => {
    const match = line.match(pattern);
    if (!match) return null;
    return createFuncStep(type, line, {
      message: match[1]?.trim() || fallback,
    });
  };
}

function parseSimpleWaitStep(line: string): FuncStep | null {
  const match = line.match(/^WAIT\s*\[([^\]]+)\]$/i);
  if (!match) return null;
  return createFuncStep('WAIT', line, {
    value: match[1].trim(),
  });
}

const STEP_PARSERS: FuncStepParser[] = [
  parseTaskStep,
  parseSetStep,
  createVariableValueParser('MIN'),
  createVariableValueParser('MAX'),
  parseValStep,
  parseIfStep,
  createVariableValueParser('WAIT'),
  parseSaveStep,
  createMessageParser('ERROR'),
  createMessageParser('ALARM'),
  createMessageParser('LOG'),
  createOptionalMessageParser('STOP', 'Stopped'),
  createOptionalMessageParser('PAUSE', ''),
  parseSimpleWaitStep,
];

/**
 * Parse FUNC definitions from the func column content
 * 
 * Format:
 * FUNC: Odpowietrzenie systemu
 *   TASK [Wyłącz] [pompa 1]
 *   TASK [Wyłącz] [zawór 1]
 *   TASK [Wyłącz] [zawór 2]
 * 
 * FUNC: Wytworzyć podciśnienie
 *   TASK [Włącz] [pompa 1]
 *   SET [czas] = [10 s]
 */
export function parseFuncDefinitions(funcSource: string): FuncLibrary {
  const library: FuncLibrary = {};
  
  if (!funcSource || typeof funcSource !== 'string') {
    return library;
  }
  
  const lines = funcSource.split('\n');
  let currentFunc: FuncDefinition | null = null;
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    
    // Check for FUNC: definition start
    const funcMatch = trimmed.match(/^FUNC:\s*(.+)$/i);
    if (funcMatch) {
      // Save previous function if exists
      if (currentFunc) {
        library[currentFunc.name] = currentFunc;
      }
      
      currentFunc = {
        name: funcMatch[1].trim(),
        steps: []
      };
      continue;
    }
    
    // If we're inside a FUNC definition, parse steps
    if (currentFunc) {
      const step = parseStep(trimmed);
      if (step) {
        currentFunc.steps.push(step);
      }
    }
  }
  
  // Save last function
  if (currentFunc) {
    library[currentFunc.name] = currentFunc;
  }
  
  return library;
}

/**
 * Parse a single step line
 */
function parseStep(line: string): FuncStep | null {
  for (const parser of STEP_PARSERS) {
    const step = parser(line);
    if (step) return step;
  }

  return null;
}

/**
 * Expand FUNC calls in DSL to their constituent steps
 * 
 * Input:
 * GOAL: Test szczelności
 *   FUNC: Wytworzyć podciśnienie
 *   VAL [ciśnienie] [bar]
 * 
 * Output:
 * GOAL: Test szczelności
 *   TASK [Włącz] [pompa 1]
 *   SET [czas] = [10 s]
 *   VAL [ciśnienie] [bar]
 */
export function expandFuncCalls(dslSource: string, library: FuncLibrary): string {
  if (!dslSource || typeof dslSource !== 'string') {
    return dslSource;
  }
  
  const lines = dslSource.split('\n');
  const output: string[] = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Check for FUNC: call (not definition - those have steps following)
    const funcCallMatch = trimmed.match(/^FUNC:\s*(.+)$/i);
    if (funcCallMatch) {
      const funcName = funcCallMatch[1].trim();
      const func = library[funcName];
      
      if (func && func.steps.length > 0) {
        // Get indentation from original line
        const indent = line.match(/^(\s*)/)?.[1] || '  ';
        
        // Add comment showing expansion
        output.push(`${indent}# >>> FUNC: ${funcName}`);
        
        // Expand to constituent steps
        for (const step of func.steps) {
          output.push(`${indent}${step.raw}`);
        }
        
        output.push(`${indent}# <<< END FUNC: ${funcName}`);
      } else {
        // FUNC not found - keep original line with warning
        output.push(line);
        output.push(`${line.match(/^(\s*)/)?.[1] || ''}# WARNING: FUNC "${funcName}" not found in library`);
      }
    } else {
      output.push(line);
    }
  }
  
  return output.join('\n');
}

/**
 * Get list of FUNC names from library
 */
export function getFuncNames(library: FuncLibrary): string[] {
  return Object.keys(library);
}

/**
 * Validate FUNC calls in DSL against library
 */
export function validateFuncCalls(dslSource: string, library: FuncLibrary): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!dslSource) {
    return { valid: true, errors };
  }
  
  const lines = dslSource.split('\n');
  let lineNum = 0;
  
  for (const line of lines) {
    lineNum++;
    const trimmed = line.trim();
    
    const funcCallMatch = trimmed.match(/^FUNC:\s*(.+)$/i);
    if (funcCallMatch) {
      const funcName = funcCallMatch[1].trim();
      if (!library[funcName]) {
        errors.push(`Line ${lineNum}: FUNC "${funcName}" is not defined`);
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Generate FUNC definitions from common step patterns
 */
export function generateFuncFromSteps(name: string, steps: FuncStep[]): string {
  const lines: string[] = [`FUNC: ${name}`];
  
  for (const step of steps) {
    lines.push(`  ${step.raw}`);
  }
  
  return lines.join('\n');
}

// Export singleton for global access
let globalFuncLibrary: FuncLibrary = {};

export function setGlobalFuncLibrary(library: FuncLibrary): void {
  globalFuncLibrary = library;
  try {
    (globalThis as any).__funcLibrary = library;
  } catch { /* silent */ }
}

export function getGlobalFuncLibrary(): FuncLibrary {
  return globalFuncLibrary;
}

export function loadFuncLibraryFromSource(funcSource: string): FuncLibrary {
  const library = parseFuncDefinitions(funcSource);
  setGlobalFuncLibrary(library);
  return library;
}
