// scenarios.cqrs-loader.ts
// CQRS scenario loading - extracted from scenarios.loader.ts

import { getScenarioCQRS } from '../cqrs/singleton';
import { loadScenario } from '../cqrs/helpers';
import {
  getLibraryGoals,
  parseLibraryGoalsToBuilderFormat,
  parseFuncSourceToBuilderFormat,
  generateDslFromLibraryGoals
} from './scenarios.library-helpers';
import { updatePreview } from './scenarios.def-helpers';

export interface CqrsLoadResult {
  loaded: boolean;
  usedDsl: boolean;
  title: string;
  content?: { name: string; goals: any[]; funcs: any[] };
}

/** Load scenario from CQRS store */
export async function loadFromCQRS(
  id: string,
  ctx: {
    parseDsl: (text: string) => { ok: boolean; errors: string[]; ast: any };
    renderBuilderFromData: (data: { name?: string; goals?: any[]; funcs?: any[] }) => void;
    highlightDsl: (text: string) => string;
    validateDsl: () => void;
  }
): Promise<CqrsLoadResult> {
  try {
    await loadScenario({ id });
    const st = (getScenarioCQRS() as any)?.getState?.();
    const cur = st?.currentScenario;

    if (!cur || !cur.id) {
      return { loaded: false, usedDsl: false, title: '' };
    }

    // Update name input
    const nameInput = document.getElementById('scenario-name') as HTMLInputElement | null;
    if (nameInput) nameInput.value = cur.title || '';

    const funcSrc = (cur as any).func || (cur.content?.func || '');
    const parsedFuncs = parseFuncSourceToBuilderFormat(funcSrc, ctx.parseDsl);

    // Try to load from library.goals first (new format)
    const libraryGoals = getLibraryGoals(cur.library);
    if (libraryGoals.length > 0) {
      const parsedGoals = parseLibraryGoalsToBuilderFormat(libraryGoals, ctx.parseDsl);
      if (parsedGoals.length > 0) {
        ctx.renderBuilderFromData({ name: cur.title || '', goals: parsedGoals, funcs: parsedFuncs });

        // Generate DSL preview from library goals
        const dslPreview = generateDslFromLibraryGoals(cur.title || '', libraryGoals);
        const combinedPreview = String(funcSrc || '').trim()
          ? `${dslPreview}\n${String(funcSrc || '').trim()}`
          : dslPreview;

        updatePreview(combinedPreview, ctx.highlightDsl);
        try { ctx.validateDsl(); } catch { /* silent */ }

        return { loaded: true, usedDsl: true, title: cur.title || '' };
      }
    }

    // Fallback to deprecated dsl field
    const dslText = cur.dsl || (cur.content?.dsl || '');
    if (dslText && typeof dslText === 'string') {
      try {
        const res = ctx.parseDsl(dslText);
        if (res?.ok && res.ast && (Array.isArray((res.ast as any).goals) || Array.isArray((res.ast as any).funcs))) {
          const astFuncs = Array.isArray((res.ast as any).funcs) && (res.ast as any).funcs.length
            ? (res.ast as any).funcs
            : parsedFuncs;
          ctx.renderBuilderFromData({ name: cur.title || '', goals: (res.ast as any).goals || [], funcs: astFuncs || [] });

          updatePreview(dslText, ctx.highlightDsl);
          try { ctx.validateDsl(); } catch { /* silent */ }

          return { loaded: true, usedDsl: true, title: cur.title || '' };
        }
      } catch { /* silent */ }
    }

    // Fallback to content JSON
    if (cur.content && typeof cur.content === 'object') {
      ctx.renderBuilderFromData(cur.content);
      return { loaded: true, usedDsl: false, title: cur.title || '' };
    }

    return { loaded: false, usedDsl: false, title: cur.title || '' };
  } catch {
    return { loaded: false, usedDsl: false, title: '' };
  }
}
