/**
 * scenarios.loader.ts
 * Scenario loading logic extracted from scenarios.page.ts
 */

import { ScenariosService } from './scenarios.service';
import type { ExecContext } from '../../../components/dsl';
import { loadFromCQRS } from './scenarios.cqrs-loader';
import { loadFromDB } from './scenarios.db-loader';

// Re-export for backward compatibility
export {
  getLibraryGoals,
  parseLibraryGoalsToBuilderFormat,
  generateDslFromLibraryGoals,
  parseFuncSourceToBuilderFormat
} from './scenarios.library-helpers';

/** Context for scenario loading callbacks */
export interface ScenarioLoaderContext {
  parseDsl: (text: string) => { ok: boolean; errors: string[]; ast: any };
  highlightDsl: (text: string) => string;
  renderBuilderFromData: (data: { name?: string; goals?: any[]; funcs?: any[] }) => void;
  validateDsl: () => void;
  updatePreview: () => void;
  initializeDragAndDrop: () => void;
  refreshBuilderOptions: () => void;
  fetchScenarioFromDBById: (id: string) => Promise<{ id: string; title: string; content?: any; library?: any; config?: any } | null>;
  writeScenarioIdToUrl: (id: string) => void;
  setLastScenarioName: (name: string) => void;
  setAllowTitlePatch: (allow: boolean) => void;
  setCurrentExecCtx: (ctx: ExecContext | null) => void;
  clearRenameTimer: () => void;
}

/**
 * Load a scenario by ID with all its content
 */
export async function loadScenarioById(id: string, ctx: ScenarioLoaderContext): Promise<void> {
  if (!id) return;
  
  // Cancel any pending rename and prevent title sync until load completes
  ctx.clearRenameTimer();
  ctx.setAllowTitlePatch(false);
  ScenariosService.setCurrentScenarioId(id);
  ctx.writeScenarioIdToUrl(id);

  // Phase 1: Try CQRS first
  const cqrsResult = await loadFromCQRS(id, {
    parseDsl: ctx.parseDsl,
    renderBuilderFromData: ctx.renderBuilderFromData,
    highlightDsl: ctx.highlightDsl,
    validateDsl: ctx.validateDsl
  });

  if (cqrsResult.loaded) {
    ctx.setLastScenarioName(cqrsResult.title);
    finalizeLoad(cqrsResult.usedDsl, ctx);
    return;
  }

  // Phase 2: Fallback to direct DB fetch
  const row = await ctx.fetchScenarioFromDBById(id);
  if (!row) return;

  const dbResult = await loadFromDB(id, row, {
    parseDsl: ctx.parseDsl,
    renderBuilderFromData: ctx.renderBuilderFromData,
    highlightDsl: ctx.highlightDsl,
    validateDsl: ctx.validateDsl,
    setCurrentExecCtx: ctx.setCurrentExecCtx
  });

  if (dbResult.loaded) {
    ctx.setLastScenarioName(dbResult.title);
  }

  finalizeLoad(dbResult.usedDsl, ctx);
}

/** Finalize the loading process */
function finalizeLoad(usedDsl: boolean, ctx: ScenarioLoaderContext): void {
  if (!usedDsl) ctx.updatePreview();
  ctx.initializeDragAndDrop();
  ctx.refreshBuilderOptions();
  ctx.setAllowTitlePatch(true);
}
