import { ScenariosEvents } from './scenarios.events';
import { getScenarioCQRS } from '../cqrs/singleton';
import { ScenariosLibrary } from './scenarios.library';
import { setupUiBridge } from './scenarios.ui-bridge';
import { DslBuilderUI } from '../../../components/dsl-editor';
import type { ScenariosControllerCtx } from './scenarios.ui-types';
import {
  handleChange,
  handleLibraryChange,
  handleLibraryFilter,
  handleScenarioFilter,
  handleQuickAddKeydown
} from './scenarios.event-handlers';
import { handleClick } from './scenarios.click-handlers';
export type { ScenariosControllerCtx } from './scenarios.ui-types';

export function setupScenariosPage(container: HTMLElement, ctx: ScenariosControllerCtx): void {
  // Initial syntax highlight/preview
  try { ctx.updatePreview(); } catch { /* silent */ }
  
  // Initialize FUNC editor syntax highlighting
  try { DslBuilderUI.initializeFuncEditorHighlighting(container); } catch { /* silent */ }

  // Delegate UI wiring (buttons -> window events)
  ScenariosEvents.attach(container);

  // Bridge window-level UI events back to page methods (bind per-container)
  const bound = (container as HTMLElement);
  // Bump attribute to v2 to force a one-time rebind after update
  if (bound.getAttribute('data-scenarios-ui-bound-v2') !== '1') {
    bound.setAttribute('data-scenarios-ui-bound-v2', '1');
    setupUiBridge(container, ctx);
  }

  // Update preview and refresh options on input changes
  container.addEventListener('change', (ev) => handleChange(ev, ctx));
  container.addEventListener('input', () => ctx.updatePreview());

  // Initialize DnD and initial lists
  ctx.initializeDragAndDrop();
  ctx.renderScenarioList();
  ctx.renderSidebarLibrary();
  ctx.refreshBuilderOptions();
  ctx.fetchLibraryFromDB().then(() => { ctx.refreshBuilderOptions(); ctx.libraryRender(); }).catch(() => {});
  ctx.fetchVariablesFromDB().then(() => { ctx.refreshBuilderOptions(); }).catch(() => {});
  ScenariosLibrary.fetchActivitiesFromDB().then(() => { ctx.refreshBuilderOptions(); }).catch(() => {});

  // Load scenario by URL param if present
  try {
    const initialId = ctx.readScenarioIdFromUrl();
    if (initialId) { ctx.loadScenarioById(initialId); }
  } catch { /* silent */ }

  // Subscribe to library-related events to keep UI in sync
  try {
    const cqrs = getScenarioCQRS();
    cqrs?.eventBus.subscribe('LibraryItemAdded', () => { ctx.renderSidebarLibrary(); ctx.refreshBuilderOptions(); });
    cqrs?.eventBus.subscribe('LibraryItemDeleted', () => { ctx.renderSidebarLibrary(); ctx.refreshBuilderOptions(); });
    cqrs?.eventBus.subscribe('ActivityAdded', () => { ctx.refreshBuilderOptions(); });
    cqrs?.eventBus.subscribe('ActivityUpdated', () => { ctx.refreshBuilderOptions(); });
    cqrs?.eventBus.subscribe('ActivityDeleted', () => { ctx.refreshBuilderOptions(); });
  } catch { /* silent */ }

  // Library manager live filter/dataset switch
  container.addEventListener('input', (e) => handleLibraryFilter(e, ctx));
  container.addEventListener('change', (e) => handleLibraryChange(e, ctx));

  // Scenario filter
  container.addEventListener('input', (e) => handleScenarioFilter(e, ctx));

  // Quick add scenario name input
  container.addEventListener('keydown', (e) => handleQuickAddKeydown(e, ctx));

  // Scenario add / modal controls / library manager / list row interactions
  container.addEventListener('click', (e) => handleClick(e, ctx, toggle));

  // Helper to toggle modal
  const toggle = (selector: string, open: boolean) => {
    const el = document.querySelector(selector) as HTMLElement | null;
    if (!el) return; el.classList.toggle('hidden', !open);
  };
}
