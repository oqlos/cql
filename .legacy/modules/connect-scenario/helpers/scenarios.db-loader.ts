// scenarios.db-loader.ts
// Direct DB scenario loading - extracted from scenarios.loader.ts

import {
  getLibraryGoals,
  parseLibraryGoalsToBuilderFormat,
  parseFuncSourceToBuilderFormat,
  generateDslFromLibraryGoals
} from './scenarios.library-helpers';
import {
  setupDefContext,
  updateDefUiElements,
  updateFuncEditor,
  updatePreview,
  updateDefIntegration
} from './scenarios.def-helpers';
import type { ExecContext } from '../../../components/dsl';

export interface DbLoadResult {
  loaded: boolean;
  usedDsl: boolean;
  title: string;
}

/** Load scenario from direct DB fetch */
export async function loadFromDB(
  id: string,
  row: any,
  ctx: {
    parseDsl: (text: string) => { ok: boolean; errors: string[]; ast: any };
    renderBuilderFromData: (data: { name?: string; goals?: any[]; funcs?: any[] }) => void;
    highlightDsl: (text: string) => string;
    validateDsl: () => void;
    setCurrentExecCtx: (ctx: ExecContext | null) => void;
  }
): Promise<DbLoadResult> {
  const nameInput = document.getElementById('scenario-name') as HTMLInputElement | null;
  if (nameInput) nameInput.value = row.title || '';

  let funcSrc = '';
  const parsedFuncs = parseFuncSourceToBuilderFormat(
    (row as any).func || (row as any)?.content?.func || '',
    ctx.parseDsl
  );

  // Prepare DEF runtime context
  const { execCtx, defSrc } = setupDefContext(row);
  ctx.setCurrentExecCtx(execCtx);

  const mapSrc = (row as any).map || (row as any)?.content?.map || '';
  updateDefUiElements(defSrc, mapSrc);

  // Load FUNC content
  funcSrc = (row as any).func || (row as any)?.content?.func || '';
  updateFuncEditor(funcSrc);

  // Update DEF integration
  updateDefIntegration(id);

  // Try to load from library.goals first (new format)
  const libraryGoals = getLibraryGoals((row as any).library);
  if (libraryGoals.length > 0) {
    const parsedGoals = parseLibraryGoalsToBuilderFormat(libraryGoals, ctx.parseDsl);
    if (parsedGoals.length > 0) {
      ctx.renderBuilderFromData({ name: row.title || '', goals: parsedGoals, funcs: parsedFuncs });

      // Generate DSL preview from library goals
      const dslPreview = generateDslFromLibraryGoals(row.title || '', libraryGoals);
      const combinedPreview = String(funcSrc || '').trim()
        ? `${dslPreview}\n${String(funcSrc || '').trim()}`
        : dslPreview;

      updatePreview(combinedPreview, ctx.highlightDsl);
      try { ctx.validateDsl(); } catch { /* silent */ }

      return { loaded: true, usedDsl: true, title: row.title || '' };
    }
  }

  // Fallback to deprecated dsl field
  const dslText = (row as any).dsl || (row as any)?.content?.dsl || '';
  if (dslText && typeof dslText === 'string') {
    try {
      const res = ctx.parseDsl(dslText);
      if (res?.ok && res.ast && (Array.isArray((res.ast as any).goals) || Array.isArray((res.ast as any).funcs))) {
        const astFuncs = Array.isArray((res.ast as any).funcs) && (res.ast as any).funcs.length
          ? (res.ast as any).funcs
          : parsedFuncs;
        ctx.renderBuilderFromData({ name: row.title || '', goals: (res.ast as any).goals || [], funcs: astFuncs || [] });

        updatePreview(dslText, ctx.highlightDsl);
        try { ctx.validateDsl(); } catch { /* silent */ }

        return { loaded: true, usedDsl: true, title: row.title || '' };
      }
    } catch { /* silent */ }

    // Fill DSL preview from dsl field
    updatePreview(dslText, ctx.highlightDsl);
    try { ctx.validateDsl(); } catch { /* silent */ }
  }

  // Fallback to content JSON
  if (row.content && typeof row.content === 'object') {
    ctx.renderBuilderFromData(row.content);
    return { loaded: true, usedDsl: false, title: row.title || '' };
  }

  return { loaded: false, usedDsl: false, title: row.title || '' };
}
