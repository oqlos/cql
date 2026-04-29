// frontend/src/pages/connect-scenario-library-editor/library-editor.events.ts
// Extracted from library-editor.page.ts — event binding for the Library Editor page

import { getActionHandler } from './library-editor.action-handlers';

export interface LibraryEditorEventContext {
  switchToScenario(id: string): void;
  renderScenariosList(): void;
  showAddScenarioModal(): void;
  createNewScenario(): void;
  highlightSource(code: string, container: HTMLElement): void;
  updateUrlWithTab(tabName: string): void;
  setCurrentTab(tab: string): void;
  updateSourceEditor(): void;
  renderDefaults(): void;
  renderGoalsOrderOnly(): void;
  addItem(type: string): void;
  addFunc(): void;
  addGoal(): void;
  addOptDefault(): void;
  addDefault(): void;
  scanDefaultsFromDsl(): void;
  exportDslToFile(): void;
  copyAllDsl(): void;
  deleteDefault(index: number): void;
  editItem(type: string, index: number): void;
  deleteItem(type: string, index: number): void;
  deleteFunc(index: number): void;
  deleteGoal(index: number): void;
  convertGoalToFunc(index: number): void;
  convertFuncToGoal(index: number): void;
  showFuncSelectionModal(goalIndex: number): void;
  addFuncToGoal(goalIndex: number, funcIndex: number): void;
  moveGoal(index: number, direction: -1 | 1): void;
  editOptDefault(name: string): void;
  deleteOptDefault(name: string): void;
  addObjectFunctionMapping(obj: string): void;
  removeObjectFunctionMapping(obj: string, fn: string): void;
  addParamUnitMapping(param: string): void;
  removeParamUnitMapping(param: string, unit: string): void;
  syncGoalsConfigFromDsl(): void;
  editGoalConfigOpt(goalName: string, optName: string): void;
  toggleGoalConfigEnabled(idx: number): void;
  moveGoalConfig(idx: number, direction: -1 | 1): void;
  restoreCodeModal(): void;
  parseDefFromCode(src: string): void;
  renderAll(): void;
  scheduleAutosave(): void;
  validateLibraryJson(src: string): { valid: boolean; errors: string[]; warnings: string[]; goals: number; funcs: number; variables: string[]; outDeclarations: any[] };
  showValidationResults(validation: any): void;
  saveDef(): void;
  importFromDB(): void;
  showCodePreview(): void;
}

/**
 * Bind all DOM event listeners for the Library Editor page.
 * Call once after initial render.
 */
export function bindLibraryEditorEvents(container: HTMLElement, ctx: LibraryEditorEventContext): void {
  // Scenario list - click to switch
  container.addEventListener('click', (e) => {
    const row = (e.target as HTMLElement).closest('.scenario-row') as HTMLElement;
    if (row && row.dataset.id) {
      ctx.switchToScenario(row.dataset.id);
    }
  });

  // Scenario filter input
  const filterInput = document.getElementById('def-scenario-filter') as HTMLInputElement;
  if (filterInput) {
    filterInput.addEventListener('input', () => {
      ctx.renderScenariosList();
    });
  }

  const sortSelect = document.getElementById('scenario-sort') as HTMLSelectElement | null;
  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      ctx.renderScenariosList();
    });
  }

  // Add scenario button
  const addScenarioBtn = document.getElementById('def-add-scenario-btn');
  if (addScenarioBtn) {
    addScenarioBtn.addEventListener('click', () => ctx.showAddScenarioModal());
  }

  // Save new scenario button
  const saveNewBtn = document.getElementById('scenario-save-new');
  if (saveNewBtn) {
    saveNewBtn.addEventListener('click', () => ctx.createNewScenario());
  }

  // Modal close buttons
  container.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.matches('[data-modal-close]') || target.closest('[data-modal-close]')) {
      document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
    }
  });

  // Tab switching
  container.addEventListener('click', (e) => {
    const tab = (e.target as HTMLElement).closest('.def-tab') as HTMLElement;
    if (tab) {
      const tabName = tab.dataset.tab as any;
      if (tabName) {
        ctx.setCurrentTab(tabName);
        container.querySelectorAll('.def-tab').forEach(t => t.classList.remove('active'));
        container.querySelectorAll('.def-tab-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        container.querySelector(`[data-tab-content="${tabName}"]`)?.classList.add('active');

        // Update URL with current tab
        ctx.updateUrlWithTab(tabName);

        // When switching to source tab, populate the editor
        if (tabName === 'source') {
          ctx.updateSourceEditor();
        } else if (tabName === 'defaults') {
          ctx.renderDefaults();
        } else if (tabName === 'goals-order') {
          ctx.renderGoalsOrderOnly();
        }
      }
    }
  });

  // Source editor input - sync highlight with textarea
  const sourceEditor = document.getElementById('def-source-editor') as HTMLTextAreaElement;
  const sourceHighlight = document.getElementById('def-source-highlight');
  if (sourceEditor && sourceHighlight) {
    sourceEditor.addEventListener('input', () => {
      ctx.highlightSource(sourceEditor.value, sourceHighlight);
    });
  }

  // Actions - delegated to action handler registry (refactored from large switch)
  container.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const action = target.dataset.action || target.closest('[data-action]')?.getAttribute('data-action');

    if (!action) return;

    const handler = getActionHandler(action);
    if (handler) {
      handler(target, ctx);
    }
  });

  // Sidebar buttons
  document.getElementById('def-save-all')?.addEventListener('click', () => ctx.saveDef());
  document.getElementById('def-import-db')?.addEventListener('click', () => ctx.importFromDB());
  document.getElementById('def-export-code')?.addEventListener('click', () => ctx.showCodePreview());
}
