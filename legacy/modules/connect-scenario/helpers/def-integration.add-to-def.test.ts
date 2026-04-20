/** @vitest-environment jsdom */

import { describe, expect, it } from 'vitest';

import {
  ADD_TO_DEF_MISSING_LIBRARY_MESSAGE,
  buildAddToDefPromptMessage,
  buildAddToDefSuccessMessage,
  createAddToDefSelect,
  replaceAddToDefButtonWithSelect,
  resolveAddToDefLibraryKey,
  resolveAddToDefOptions,
  updateAddToDefCode,
} from './def-integration.add-to-def';

describe('def-integration.add-to-def', () => {
  it('builds Polish prompt messages for known and unknown DEF keys', () => {
    expect(buildAddToDefPromptMessage('functions')).toBe('Podaj nazwę nowej pozycji (funkcję):');
    expect(buildAddToDefPromptMessage('unknown')).toBe('Podaj nazwę nowej pozycji (pozycję):');
    expect(buildAddToDefSuccessMessage('Nowa funkcja')).toBe('✅ Dodano "Nowa funkcja" do biblioteki DEF');
  });

  it('resolves select classes to the correct DEF library keys', () => {
    expect(resolveAddToDefLibraryKey('object-select')).toBe('objects');
    expect(resolveAddToDefLibraryKey('func-call-select')).toBe('funcs');
    expect(resolveAddToDefLibraryKey('function-select')).toBe('functions');
    expect(resolveAddToDefLibraryKey('param-select')).toBe('params');
    expect(resolveAddToDefLibraryKey('unit-select')).toBe('units');
    expect(resolveAddToDefLibraryKey('goal-select')).toBe('');
  });

  it('resolves replacement options from the matching library dataset and appends the new value once', () => {
    const library = {
      objects: ['pompa 1'],
      funcs: ['Setup'],
      functions: ['Włącz'],
      params: ['ciśnienie'],
      units: ['bar'],
    };

    expect(resolveAddToDefOptions(library, 'func-call-select', 'Cleanup')).toEqual(['Setup', 'Cleanup']);
    expect(resolveAddToDefOptions(library, 'function-select', 'Włącz')).toEqual(['Włącz']);
    expect(resolveAddToDefOptions(library, 'unknown-select', 'Nowa')).toEqual(['Nowa']);
  });

  it('creates a select element with the expected classes and selected option', () => {
    const select = createAddToDefSelect('function-select', ['Włącz', 'Ustaw'], 'Ustaw');

    expect(select.className).toBe('function-select rounded-4');
    expect(Array.from(select.options).map((option) => option.value)).toEqual(['Włącz', 'Ustaw']);
    expect(select.value).toBe('Ustaw');
  });

  it('updates the DEF code by adding the new value to the library block', () => {
    const result = updateAddToDefCode({
      code: `const library = {\n  objects: ["pompa 1"],\n  funcs: ["Setup"]\n};`,
      library: {
        objects: ['pompa 1'],
        funcs: ['Setup'],
      },
      defKey: 'funcs',
      newValue: 'Cleanup',
    });

    expect(result).toEqual({
      ok: true,
      nextCode: expect.stringContaining('"Cleanup"'),
      nextLibrary: {
        objects: ['pompa 1'],
        funcs: ['Setup', 'Cleanup'],
      },
    });
    if (result.ok) {
      expect(result.nextCode).toContain('"objects"');
      expect(result.nextCode).toContain('"funcs"');
    }
  });

  it('reports a missing library block before attempting the add-to-def update', () => {
    expect(updateAddToDefCode({
      code: 'const before = 1;',
      library: {},
      defKey: 'functions',
      newValue: 'Ustaw',
    })).toEqual({
      ok: false,
      errorMessage: ADD_TO_DEF_MISSING_LIBRARY_MESSAGE,
    });
  });

  it('replaces the add button with a select built from the updated library values', () => {
    document.body.innerHTML = '<button class="btn-add-to-def">Dodaj</button>';
    const button = document.querySelector('button') as HTMLButtonElement;

    replaceAddToDefButtonWithSelect(button, { functions: ['Włącz'] }, 'function-select', 'Ustaw');

    const select = document.querySelector('select') as HTMLSelectElement | null;
    expect(select).not.toBeNull();
    expect(select?.className).toBe('function-select rounded-4');
    expect(Array.from(select?.options || []).map((option) => option.value)).toEqual(['Włącz', 'Ustaw']);
    expect(select?.value).toBe('Ustaw');
  });
});