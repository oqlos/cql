import { describe, expect, it, vi } from 'vitest';

import { hasDefLibraryBlock, replaceDefLibraryBlock } from './def-integration.library';
import {
  clearExpiredDefLibrarySyncSuppression,
  isDefLibrarySyncSuppressed,
  scheduleDefLibrarySync,
  syncDefLibraryFromUi,
} from './def-integration.library-sync';

describe('def-integration.library-sync', () => {
  it('detects active suppression and clears expired suppression markers', () => {
    const globalObject = { __suppressDefLibrarySyncUntil: 100 };

    expect(isDefLibrarySyncSuppressed(globalObject, 50)).toBe(true);
    expect(isDefLibrarySyncSuppressed(globalObject, 150)).toBe(false);

    clearExpiredDefLibrarySyncSuppression(globalObject, 150);

    expect('__suppressDefLibrarySyncUntil' in globalObject).toBe(false);
  });

  it('keeps the current timer when sync scheduling is suppressed', () => {
    const setTimeoutFn = vi.fn();
    const clearTimeoutFn = vi.fn();

    const timerId = scheduleDefLibrarySync({
      currentTimerId: 41,
      onSync: vi.fn(),
      now: () => 50,
      globalObject: { __suppressDefLibrarySyncUntil: 100 },
      setTimeoutFn,
      clearTimeoutFn,
    });

    expect(timerId).toBe(41);
    expect(setTimeoutFn).not.toHaveBeenCalled();
    expect(clearTimeoutFn).not.toHaveBeenCalled();
  });

  it('clears the previous timer and schedules a debounced sync callback', () => {
    const clearTimeoutFn = vi.fn();
    const onSync = vi.fn();
    let scheduledCallback: (() => void) | undefined;
    const setTimeoutFn = vi.fn((callback: () => void, delayMs: number) => {
      scheduledCallback = callback;
      expect(delayMs).toBe(150);
      return 99;
    });

    const timerId = scheduleDefLibrarySync({
      currentTimerId: 41,
      onSync,
      globalObject: {},
      setTimeoutFn,
      clearTimeoutFn,
    });

    expect(timerId).toBe(99);
    expect(clearTimeoutFn).toHaveBeenCalledWith(41);
    expect(setTimeoutFn).toHaveBeenCalledOnce();

    scheduledCallback?.();
    expect(onSync).toHaveBeenCalledOnce();
  });

  it('updates the DEF library block, regenerating it first when missing', () => {
    let code = 'const before = 1;';
    const ensureLibraryBlock = vi.fn(() => {
      code = `const library = {\n  objects: [\"pump\"]\n};`;
    });
    const setEditorCode = vi.fn((nextCode: string) => {
      code = nextCode;
    });
    const updateDefLibraryFromCode = vi.fn();

    const changed = syncDefLibraryFromUi({
      getEditorCode: () => code,
      hasLibraryBlock: hasDefLibraryBlock,
      ensureLibraryBlock,
      getCurrentLibrary: () => ({ funcs: ['Setup'] }),
      buildUiLibrarySnapshot: () => ({
        objects: ['pump', 'valve'],
        functions: ['Set'],
        params: ['pressure'],
        units: ['bar'],
      }),
      replaceDefLibraryBlock,
      setEditorCode,
      updateDefLibraryFromCode,
      globalObject: {},
    });

    expect(changed).toBe(true);
    expect(ensureLibraryBlock).toHaveBeenCalledOnce();
    expect(setEditorCode).toHaveBeenCalledOnce();
    expect(code).toContain('"valve"');
    expect(code).toContain('"funcs"');
    expect(updateDefLibraryFromCode).toHaveBeenCalledWith(code);
  });

  it('skips syncing when DB source override is active', () => {
    const setEditorCode = vi.fn();

    const changed = syncDefLibraryFromUi({
      getEditorCode: () => `const library = {\n  objects: [\"pump\"]\n};`,
      hasLibraryBlock: hasDefLibraryBlock,
      getCurrentLibrary: () => ({}),
      buildUiLibrarySnapshot: () => ({
        objects: ['pump'],
        functions: ['Set'],
        params: ['pressure'],
        units: ['bar'],
      }),
      replaceDefLibraryBlock,
      setEditorCode,
      updateDefLibraryFromCode: vi.fn(),
      globalObject: { __dslLibrarySourceOverride: 'DB' },
    });

    expect(changed).toBe(false);
    expect(setEditorCode).not.toHaveBeenCalled();
  });

  it('clears expired suppression and avoids no-op updates', () => {
    const globalObject: Record<string, unknown> = {
      __suppressDefLibrarySyncUntil: 100,
    };

    const changed = syncDefLibraryFromUi({
      getEditorCode: () => `const library = {\n  \"objects\": [\n    \"pump\"\n  ],\n  \"functions\": [\n    \"Set\"\n  ],\n  \"params\": [\n    \"pressure\"\n  ],\n  \"units\": [\n    \"bar\"\n  ]\n};`,
      hasLibraryBlock: hasDefLibraryBlock,
      getCurrentLibrary: () => ({}),
      buildUiLibrarySnapshot: () => ({
        objects: ['pump'],
        functions: ['Set'],
        params: ['pressure'],
        units: ['bar'],
      }),
      replaceDefLibraryBlock,
      setEditorCode: vi.fn(),
      updateDefLibraryFromCode: vi.fn(),
      globalObject,
      now: () => 150,
    });

    expect(changed).toBe(false);
    expect('__suppressDefLibrarySyncUntil' in globalObject).toBe(false);
  });
});