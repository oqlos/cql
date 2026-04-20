/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  applyDefSourceUiState,
  getDefSourceUiState,
  refreshDefIntegrationSelectlists,
  setDefSourceOverride,
  showDefIntegrationNotification,
} from './def-integration.ui-state';

describe('def-integration.ui-state', () => {
  beforeEach(() => {
    delete (globalThis as any).__dslLibrarySourceOverride;
    delete (globalThis as any).refreshBuilderOptions;
    delete (globalThis as any).notifyBottomLine;
    document.body.innerHTML = '';
  });

  it('returns the expected badge and notification state for DEF and DB sources', () => {
    expect(getDefSourceUiState(true)).toEqual({
      badgeText: 'Źródło: DEF',
      badgeClassName: 'badge badge-success',
      notificationMessage: '✅ Używanie biblioteki DEF',
      sourceOverride: '',
    });

    expect(getDefSourceUiState(false)).toEqual({
      badgeText: 'Źródło: DB',
      badgeClassName: 'badge badge-secondary',
      notificationMessage: '📚 Używanie biblioteki DB',
      sourceOverride: 'DB',
    });
  });

  it('applies badge and toggle state and stores the source override', () => {
    const badge = document.createElement('span');
    const toggle = document.createElement('input');
    toggle.type = 'checkbox';

    applyDefSourceUiState({ badge, toggle }, true);
    setDefSourceOverride(true);

    expect(badge.textContent).toBe('Źródło: DEF');
    expect(badge.className).toBe('badge badge-success');
    expect(toggle.checked).toBe(true);
    expect((globalThis as any).__dslLibrarySourceOverride).toBe('');

    applyDefSourceUiState({ badge, toggle }, false);
    setDefSourceOverride(false);

    expect(badge.textContent).toBe('Źródło: DB');
    expect(badge.className).toBe('badge badge-secondary');
    expect(toggle.checked).toBe(false);
    expect((globalThis as any).__dslLibrarySourceOverride).toBe('DB');
  });

  it('refreshes builder options and dispatches the selectListsRefresh event', () => {
    const refreshBuilderOptions = vi.fn();
    const onRefreshEvent = vi.fn();

    (globalThis as any).refreshBuilderOptions = refreshBuilderOptions;
    document.addEventListener('selectListsRefresh', onRefreshEvent);

    refreshDefIntegrationSelectlists();

    expect(refreshBuilderOptions).toHaveBeenCalledOnce();
    expect(onRefreshEvent).toHaveBeenCalledOnce();
  });

  it('forwards notifications to notifyBottomLine when available', () => {
    const notifyBottomLine = vi.fn();
    (globalThis as any).notifyBottomLine = notifyBottomLine;

    showDefIntegrationNotification('Saved', 'success');

    expect(notifyBottomLine).toHaveBeenCalledWith('Saved', 'success', 3000);
  });
});