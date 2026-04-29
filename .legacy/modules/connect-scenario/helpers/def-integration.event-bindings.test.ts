/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { bindDefIntegrationEventHandlers } from './def-integration.event-bindings';

describe('def-integration.event-bindings', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('binds delegated document and window events and removes them on cleanup', () => {
    document.body.innerHTML = [
      '<select class="object-select"><option selected>alpha</option></select>',
      '<input id="def-source-toggle" type="checkbox" checked />',
      '<button class="btn-add-object">Add object</button>',
      '<button class="btn-add-to-def" data-def-key="functions" data-select-class="function-select">Add DEF</button>',
    ].join('');

    const onScheduleSyncDefLibrary = vi.fn();
    const onDefSourceToggle = vi.fn();
    const onAddToDef = vi.fn();
    const onSaveDefRequested = vi.fn();
    const onImportFromDatabase = vi.fn();
    const onDefLibraryUpdated = vi.fn();

    const cleanup = bindDefIntegrationEventHandlers({
      isAutoRefreshEnabled: () => false,
      onScheduleSyncDefLibrary,
      onDefSourceToggle,
      onAddToDef,
      onSaveDefRequested,
      onImportFromDatabase,
      onDefLibraryUpdated,
      onRunRuntime: vi.fn(),
      onRunConsole: vi.fn(),
    });

    const builderSelect = document.querySelector('.object-select') as HTMLSelectElement;
    const toggle = document.getElementById('def-source-toggle') as HTMLInputElement;
    const builderActionButton = document.querySelector('.btn-add-object') as HTMLButtonElement;
    const addToDefButton = document.querySelector('.btn-add-to-def') as HTMLButtonElement;

    builderSelect.dispatchEvent(new Event('change', { bubbles: true }));
    toggle.dispatchEvent(new Event('change', { bubbles: true }));
    builderActionButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    addToDefButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    document.dispatchEvent(new CustomEvent('defSaveRequested', { detail: { defCode: 'DEF: saved' } }));
    document.dispatchEvent(new CustomEvent('defImportRequested'));
    document.dispatchEvent(new CustomEvent('defLibraryUpdated'));
    window.dispatchEvent(new CustomEvent('scenarios:ui'));

    expect(onScheduleSyncDefLibrary).toHaveBeenCalledTimes(3);
    expect(onDefSourceToggle).toHaveBeenCalledWith(toggle);
    expect(onAddToDef).toHaveBeenCalledWith('functions', 'function-select', addToDefButton);
    expect(onSaveDefRequested).toHaveBeenCalledWith('DEF: saved');
    expect(onImportFromDatabase).toHaveBeenCalledOnce();
    expect(onDefLibraryUpdated).toHaveBeenCalledOnce();

    cleanup();

    builderSelect.dispatchEvent(new Event('change', { bubbles: true }));
    toggle.dispatchEvent(new Event('change', { bubbles: true }));
    builderActionButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    document.dispatchEvent(new CustomEvent('defSaveRequested', { detail: { defCode: 'DEF: saved again' } }));
    window.dispatchEvent(new CustomEvent('scenarios:ui'));

    expect(onScheduleSyncDefLibrary).toHaveBeenCalledTimes(3);
    expect(onDefSourceToggle).toHaveBeenCalledTimes(1);
    expect(onSaveDefRequested).toHaveBeenCalledTimes(1);
  });

  it('wires preview and builder observers and forwards their callbacks', () => {
    const previewElement = document.createElement('div');
    const goalsContainer = document.createElement('div');
    const onScheduleSyncDefLibrary = vi.fn();
    const onRunRuntime = vi.fn();
    const onRunConsole = vi.fn();
    let autoRefreshEnabled = false;
    const observers: Array<{ callback: MutationCallback; observe: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }> = [];
    const createMutationObserver = (callback: MutationCallback) => {
      const observer = {
        observe: vi.fn(),
        disconnect: vi.fn(),
      };
      observers.push({ callback, observe: observer.observe, disconnect: observer.disconnect });
      return observer;
    };

    const cleanup = bindDefIntegrationEventHandlers({
      previewElement,
      goalsContainer,
      isAutoRefreshEnabled: () => autoRefreshEnabled,
      onScheduleSyncDefLibrary,
      onDefSourceToggle: vi.fn(),
      onAddToDef: vi.fn(),
      onSaveDefRequested: vi.fn(),
      onImportFromDatabase: vi.fn(),
      onDefLibraryUpdated: vi.fn(),
      onRunRuntime,
      onRunConsole,
      createMutationObserver,
    });

    expect(observers).toHaveLength(2);
    expect(observers[0].observe).toHaveBeenCalledWith(previewElement, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    expect(observers[1].observe).toHaveBeenCalledWith(goalsContainer, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['value'],
    });

    observers[0].callback([], {} as MutationObserver);
    expect(onRunRuntime).not.toHaveBeenCalled();
    expect(onRunConsole).toHaveBeenCalledOnce();
    expect(onScheduleSyncDefLibrary).toHaveBeenCalledOnce();

    autoRefreshEnabled = true;
    observers[0].callback([], {} as MutationObserver);
    observers[1].callback([{ type: 'childList', target: goalsContainer } as MutationRecord], {} as MutationObserver);

    expect(onRunRuntime).toHaveBeenCalledOnce();
    expect(onRunConsole).toHaveBeenCalledTimes(2);
    expect(onScheduleSyncDefLibrary).toHaveBeenCalledTimes(3);

    cleanup();

    expect(observers[0].disconnect).toHaveBeenCalledOnce();
    expect(observers[1].disconnect).toHaveBeenCalledOnce();
  });

  it('ignores builder mutations that do not match sync conditions', () => {
    const goalsContainer = document.createElement('div');
    const onScheduleSyncDefLibrary = vi.fn();
    const observers: Array<{ callback: MutationCallback }> = [];
    const createMutationObserver = (callback: MutationCallback) => {
      observers.push({ callback });
      return {
        observe: vi.fn(),
        disconnect: vi.fn(),
      };
    };

    bindDefIntegrationEventHandlers({
      goalsContainer,
      isAutoRefreshEnabled: () => false,
      onScheduleSyncDefLibrary,
      onDefSourceToggle: vi.fn(),
      onAddToDef: vi.fn(),
      onSaveDefRequested: vi.fn(),
      onImportFromDatabase: vi.fn(),
      onDefLibraryUpdated: vi.fn(),
      onRunRuntime: vi.fn(),
      onRunConsole: vi.fn(),
      createMutationObserver,
    });

    observers[0].callback([{ type: 'attributes', target: document.createElement('div') } as MutationRecord], {} as MutationObserver);

    expect(onScheduleSyncDefLibrary).not.toHaveBeenCalled();
  });
});