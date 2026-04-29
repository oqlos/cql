import {
  isBuilderActionButtonTarget,
  isBuilderSelectTarget,
  shouldSyncDefLibraryForMutation,
} from './def-integration.ui-events';

type MutationObserverLike = Pick<MutationObserver, 'observe' | 'disconnect'>;

type DefSaveRequestedEvent = CustomEvent<{ defCode: string }>;

export type BindDefIntegrationEventHandlersOptions = {
  documentRoot?: Document;
  windowRoot?: Window;
  previewElement?: HTMLElement | null;
  goalsContainer?: HTMLElement | null;
  isAutoRefreshEnabled: () => boolean;
  onScheduleSyncDefLibrary: () => void;
  onDefSourceToggle: (checkbox: HTMLInputElement) => void;
  onAddToDef: (defKey: string, selectClass: string, button: HTMLButtonElement) => void;
  onSaveDefRequested: (defCode: string) => void;
  onImportFromDatabase: () => void;
  onDefLibraryUpdated: () => void;
  onRunRuntime: () => void;
  onRunConsole: () => void;
  createMutationObserver?: (callback: MutationCallback) => MutationObserverLike;
};

export function bindDefIntegrationEventHandlers(
  options: BindDefIntegrationEventHandlersOptions,
): () => void {
  const documentRoot = options.documentRoot ?? document;
  const windowRoot = options.windowRoot ?? window;
  const createMutationObserver = options.createMutationObserver ?? ((callback) => new MutationObserver(callback));
  const cleanup: Array<() => void> = [];

  const handleDocumentChange = (event: Event) => {
    const target = event.target as HTMLElement | null;
    if (isBuilderSelectTarget(target)) {
      options.onScheduleSyncDefLibrary();
    }
    if (target?.id === 'def-source-toggle') {
      options.onDefSourceToggle(target as HTMLInputElement);
    }
  };

  const handleDocumentClick = (event: Event) => {
    const target = event.target as HTMLElement | null;
    if (isBuilderActionButtonTarget(target)) {
      options.onScheduleSyncDefLibrary();
    }

    const button = target?.closest?.('.btn-add-to-def') as HTMLButtonElement | null;
    if (!button) return;

    event.preventDefault();
    options.onAddToDef(button.dataset.defKey || 'params', button.dataset.selectClass || '', button);
  };

  const handleScenarioUi = () => {
    options.onScheduleSyncDefLibrary();
  };

  const handleDefSaveRequested = (event: Event) => {
    const defCode = (event as DefSaveRequestedEvent).detail?.defCode;
    options.onSaveDefRequested(defCode);
  };

  const handleDefImportRequested = () => {
    options.onImportFromDatabase();
  };

  const handleDefLibraryUpdated = () => {
    options.onDefLibraryUpdated();
  };

  documentRoot.addEventListener('change', handleDocumentChange);
  documentRoot.addEventListener('click', handleDocumentClick);
  documentRoot.addEventListener('defSaveRequested', handleDefSaveRequested as EventListener);
  documentRoot.addEventListener('defImportRequested', handleDefImportRequested);
  documentRoot.addEventListener('defLibraryUpdated', handleDefLibraryUpdated);
  windowRoot.addEventListener('scenarios:ui', handleScenarioUi as EventListener);

  cleanup.push(() => documentRoot.removeEventListener('change', handleDocumentChange));
  cleanup.push(() => documentRoot.removeEventListener('click', handleDocumentClick));
  cleanup.push(() => documentRoot.removeEventListener('defSaveRequested', handleDefSaveRequested as EventListener));
  cleanup.push(() => documentRoot.removeEventListener('defImportRequested', handleDefImportRequested));
  cleanup.push(() => documentRoot.removeEventListener('defLibraryUpdated', handleDefLibraryUpdated));
  cleanup.push(() => windowRoot.removeEventListener('scenarios:ui', handleScenarioUi as EventListener));

  if (options.previewElement) {
    const previewObserver = createMutationObserver(() => {
      if (options.isAutoRefreshEnabled()) {
        options.onRunRuntime();
      }
      options.onRunConsole();
      options.onScheduleSyncDefLibrary();
    });
    previewObserver.observe(options.previewElement, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    cleanup.push(() => previewObserver.disconnect());
  }

  try {
    if (options.goalsContainer) {
      const builderObserver = createMutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (!shouldSyncDefLibraryForMutation(mutation)) continue;
          options.onScheduleSyncDefLibrary();
          break;
        }
      });
      builderObserver.observe(options.goalsContainer, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['value'],
      });
      cleanup.push(() => builderObserver.disconnect());
    }
  } catch {
    /* silent */
  }

  return () => {
    cleanup.forEach((teardown) => teardown());
  };
}