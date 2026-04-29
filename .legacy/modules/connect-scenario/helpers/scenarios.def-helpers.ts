// scenarios.def-helpers.ts
// DEF runtime and MAP loading utilities - extracted from scenarios.loader.ts

import { createExecContextFromDef } from '../../../components/dsl';
import type { ExecContext } from '../../../components/dsl';

/** Load MAP overrides from string */
export function loadMapOverrides(mapSrc: string | null | undefined): Record<string, any> {
  if (!mapSrc || typeof mapSrc !== 'string' || !mapSrc.trim()) {
    return {};
  }

  try {
    return JSON.parse(mapSrc);
  } catch {
    // Fallback: try to evaluate as JS module
    try {
      const exportsObj: any = {};
      const moduleObj: any = { exports: exportsObj };
      const f = new Function('module', 'exports', `'use strict';\n${mapSrc}\n;return (typeof module!=='undefined'&&module.exports)||exports;`);
      return f(moduleObj, exportsObj);
    } catch {
      return {};
    }
  }
}

/** Set up DEF execution context from row data */
export function setupDefContext(row: any): { execCtx: ExecContext | null; defSrc: string } {
  let defSrc = '';

  try {
    const objSrc = (row as any).obj || (row as any)?.content?.obj || '';
    if (objSrc && typeof objSrc === 'string') {
      try { createExecContextFromDef(objSrc); } catch { /* silent */ }
    }

    defSrc = (row as any).def || (row as any)?.content?.def || '';

    // Set up MAP
    const mapSrc = (row as any).map || (row as any)?.content?.map || '';
    try {
      (globalThis as any).__scenarioMap = loadMapOverrides(mapSrc);
    } catch { /* silent */ }

    return {
      execCtx: defSrc && typeof defSrc === 'string' ? createExecContextFromDef(defSrc) : null,
      defSrc
    };
  } catch {
    return { execCtx: null, defSrc: '' };
  }
}

/** Update DEF-related UI elements */
export function updateDefUiElements(defSrc: string, mapSrc: string): void {
  // Update MAP editor
  try {
    const mapTa = document.getElementById('scenario-map-editor') as HTMLTextAreaElement | null;
    if (mapTa) mapTa.value = String(mapSrc || '');
  } catch { /* silent */ }

  // Update DEF editor
  try {
    const ta = document.getElementById('scenario-def-editor') as HTMLTextAreaElement | null;
    if (ta) ta.value = String(defSrc || '');
    const badge = document.getElementById('def-source-badge') as HTMLElement | null;
    if (badge) badge.textContent = defSrc ? 'Źródło: DEF' : 'Źródło: DB';
  } catch { /* silent */ }
}

/** Load FUNC content and update editor */
export function updateFuncEditor(funcSrc: string): void {
  try {
    const funcTa = document.getElementById('scenario-func-editor') as HTMLTextAreaElement | null;
    if (funcTa) {
      funcTa.value = String(funcSrc || '');
      // Trigger input event to update syntax highlighting
      funcTa.dispatchEvent(new Event('input', { bubbles: true }));
    }
  } catch { /* silent */ }
}

/** Update preview with DSL text */
export function updatePreview(dslText: string, highlightDsl: (text: string) => string): void {
  try {
    const preview = document.getElementById('scenario-preview');
    if (preview) preview.innerHTML = highlightDsl(dslText);
  } catch { /* silent */ }
}

/** Update DEF integration with scenario ID */
export function updateDefIntegration(scenarioId: string): void {
  try {
    const defIntegration = (globalThis as any).getDefIntegration?.();
    if (defIntegration) {
      defIntegration.setScenarioId(scenarioId);
    }
  } catch { /* silent */ }
}
