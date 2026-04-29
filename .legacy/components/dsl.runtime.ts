// frontend/src/components/dsl/dsl.runtime.ts
// Build an ExecContext from DEF (JavaScript) source stored alongside a scenario.

import type { ExecContext } from './dsl.types';
import { createConsoleShim, extractLibrary } from './dsl.runtime.helpers';
import { buildRunTask, buildGetter } from './dsl.runtime.task-builder';

export function createExecContextFromDef(defSource: string): ExecContext {
  if (!defSource || typeof defSource !== 'string') return { getParamValue: () => null };

  const logs: string[] = [];
  const consoleShim = createConsoleShim(logs);

  const exportsObj: any = {};
  const moduleObj: any = { exports: exportsObj };

  let runtime: any = {};
  try {
    // eslint-disable-next-line no-new-func
    const factory = new Function(
      'exports', 'module', 'console', 'globalThis', 'window',
      `'use strict';\n` + defSource + `\n;return (typeof module!=='undefined' && module.exports) || exports;`
    );
    const ret = factory(exportsObj, moduleObj, consoleShim, globalThis, (typeof window !== 'undefined' ? window : undefined));
    runtime = (ret && typeof ret === 'object') ? ret : (moduleObj.exports || exportsObj) || {};
    try {
      const library = extractLibrary(runtime);
      (globalThis as any).__scenarioDefLibrary = library;
    } catch { /* silent */ }
  } catch {
    // Evaluation failed; return null-context
    return { getParamValue: () => null };
  }

  // Derive getParamValue from runtime
  let getter = buildGetter(runtime);

  // Build runTask executor using DEF mappings if present
  const runTask = buildRunTask(runtime);

  if (!getter) getter = () => null;
  const ctx: ExecContext = { getParamValue: getter, runTask: runTask || undefined };
  try { (globalThis as any).__currentExecCtx = ctx; } catch { /* silent */ }
  return ctx;
}
