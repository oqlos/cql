// frontend/src/modules/connect-scenario/helpers/scenarios.preview.ts
// Extracted from connect-scenario-scenarios.page.ts — DSL preview generation logic
import { getScenarioCQRS } from '../cqrs/singleton';
import { ScenariosService } from './scenarios.service';
import { DslTools } from '../../../components/dsl';
import { collectGoalsFromDOM, collectFuncsFromDOM, scenarioToDsl, funcsToDsl } from './scenarios.serializer';

export interface PreviewContext {
  getLastScenarioName(): string;
  setLastScenarioName(name: string): void;
  isAllowTitlePatch(): boolean;
  getRenameTimer(): any;
  setRenameTimer(t: any): void;
  dispatch(cmd: any): void;
  patchScenarioTitle(id: string, name: string): void;
}

export function updatePreview(ctx: PreviewContext): void {
  const preview = document.getElementById('scenario-preview');
  if (!preview) return;
  const scenarioName = (document.getElementById('scenario-name') as HTMLInputElement)?.value || 'Bez nazwy';
  try {
    const cqrs = getScenarioCQRS();
    const scenarioId = (ScenariosService.getCurrentScenarioId && ScenariosService.getCurrentScenarioId()) || undefined;
    if (scenarioName !== ctx.getLastScenarioName()) {
      if (ctx.isAllowTitlePatch()) {
        try { cqrs?.dispatch({ type: 'UpdateScenarioName', scenarioId, name: scenarioName }); } catch {
          // Non-blocking: preview updates should continue if title projection fails.
        }
        ctx.setLastScenarioName(scenarioName);
        try {
          const id = (ScenariosService.getCurrentScenarioId && ScenariosService.getCurrentScenarioId()) || '';
          if (id) {
            const row = document.querySelector(`tr.scenario-row[data-id="${id}"]`) as HTMLElement | null;
            if (row) {
              const nameTd = row.querySelector('td') as HTMLElement | null;
              if (nameTd) nameTd.textContent = scenarioName;
            }
            const cardTitle = document.querySelector(`#scenario-card-list .example-item[data-scenario-id="${id}"] strong`) as HTMLElement | null;
            if (cardTitle) cardTitle.textContent = scenarioName;
          }
        } catch {
          // Non-blocking: title DOM sync failure should not block model updates.
        }
        try {
          const timer = ctx.getRenameTimer();
          if (timer) clearTimeout(timer);
          ctx.setRenameTimer(setTimeout(() => {
            try {
              const id = (ScenariosService.getCurrentScenarioId && ScenariosService.getCurrentScenarioId()) || '';
              if (id) ctx.patchScenarioTitle(id, scenarioName);
            } catch {
              // Non-blocking: ignore debounce callback failures for delayed title patch.
            }
          }, 600));
        } catch {
          // Non-blocking: debouncer setup errors should not stop preview regeneration.
        }
      }
    }
  } catch {
    // Non-blocking: continue preview rendering even when metadata sync fails.
  }
  const goals = collectGoalsFromDOM();
  const funcs = collectFuncsFromDOM();
  const fullDsl = scenarioToDsl(scenarioName, goals);
  const funcEditorValue = ((document.getElementById('scenario-func-editor') as HTMLTextAreaElement | null)?.value || '').trim();
  const funcDsl = funcsToDsl(funcs) || funcEditorValue;
  const combinedDsl = funcDsl ? `${fullDsl}\n${funcDsl}` : fullDsl;
  try { preview.innerHTML = DslTools.highlightDsl(combinedDsl); } catch { preview.textContent = combinedDsl; }
  try { DslTools.validateDslInElement(combinedDsl, 'dsl-results'); } catch {
    // Non-blocking: preview stays useful even if validation widget throws.
  }
}
