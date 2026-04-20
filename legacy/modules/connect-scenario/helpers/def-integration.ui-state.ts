export type DefIntegrationNotificationType = 'success' | 'warning' | 'error' | 'info';

type DefSourceUiState = {
  badgeText: string;
  badgeClassName: string;
  notificationMessage: string;
  sourceOverride: string;
};

type DefSourceUiElements = {
  badge?: HTMLElement | null;
  toggle?: HTMLInputElement | null;
};

const DEF_SOURCE_UI_STATE: Record<'def' | 'db', DefSourceUiState> = {
  def: {
    badgeText: 'Źródło: DEF',
    badgeClassName: 'badge badge-success',
    notificationMessage: '✅ Używanie biblioteki DEF',
    sourceOverride: '',
  },
  db: {
    badgeText: 'Źródło: DB',
    badgeClassName: 'badge badge-secondary',
    notificationMessage: '📚 Używanie biblioteki DB',
    sourceOverride: 'DB',
  },
};

export function getDefSourceUiState(useDef: boolean): DefSourceUiState {
  return useDef ? DEF_SOURCE_UI_STATE.def : DEF_SOURCE_UI_STATE.db;
}

export function applyDefSourceUiState(elements: DefSourceUiElements, useDef: boolean): void {
  const state = getDefSourceUiState(useDef);

  if (elements.badge) {
    elements.badge.textContent = state.badgeText;
    elements.badge.className = state.badgeClassName;
  }

  if (elements.toggle) {
    elements.toggle.checked = useDef;
  }
}

export function setDefSourceOverride(useDef: boolean): void {
  (globalThis as any).__dslLibrarySourceOverride = getDefSourceUiState(useDef).sourceOverride;
}

export function refreshDefIntegrationSelectlists(): void {
  try {
    if (typeof (globalThis as any).refreshBuilderOptions === 'function') {
      (globalThis as any).refreshBuilderOptions();
    }

    document.dispatchEvent(new CustomEvent('selectListsRefresh'));
  } catch {
    // ignore helper refresh errors
  }
}

export function showDefIntegrationNotification(
  message: string,
  type: DefIntegrationNotificationType,
): void {
  try {
    if (typeof (globalThis as any).notifyBottomLine === 'function') {
      (globalThis as any).notifyBottomLine(message, type, 3000);
      return;
    }
  } catch {
    // ignore notification errors
  }
}