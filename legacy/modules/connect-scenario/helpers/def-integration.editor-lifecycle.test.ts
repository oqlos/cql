/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearDefEditorHighlightLayerContent,
  destroyDefEditorInstance,
  initializeDefEditorInstance,
  removeDefEditorHighlightLayers,
} from './def-integration.editor-lifecycle';

describe('def-integration.editor-lifecycle', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('returns null without creating an editor when the textarea is missing', () => {
    const createEditor = vi.fn();

    const editor = initializeDefEditorInstance({
      textareaId: 'scenario-def-editor',
      existingEditor: null,
      createEditor,
    });

    expect(editor).toBeNull();
    expect(createEditor).not.toHaveBeenCalled();
  });

  it('destroys the previous editor, clears the highlight layer, and creates a new editor', () => {
    document.body.innerHTML = `
      <textarea id="scenario-def-editor"></textarea>
      <div class="def-highlight-layer">old highlight</div>
    `;
    const existingEditor = { destroy: vi.fn() };
    const nextEditor = { destroy: vi.fn(), setValue: vi.fn() };
    const createEditor = vi.fn().mockReturnValue(nextEditor);

    const editor = initializeDefEditorInstance({
      textareaId: 'scenario-def-editor',
      existingEditor,
      createEditor,
    });

    expect(existingEditor.destroy).toHaveBeenCalledOnce();
    expect(document.querySelector('.def-highlight-layer')?.innerHTML).toBe('');
    expect(createEditor).toHaveBeenCalledWith('scenario-def-editor');
    expect(editor).toBe(nextEditor);
  });

  it('reports destroy and init errors through callbacks', () => {
    document.body.innerHTML = '<textarea id="scenario-def-editor"></textarea>';
    const destroyError = new Error('destroy failed');
    const initError = new Error('init failed');
    const onDestroyError = vi.fn();
    const onInitError = vi.fn();

    const editor = initializeDefEditorInstance({
      textareaId: 'scenario-def-editor',
      existingEditor: { destroy: vi.fn(() => { throw destroyError; }) },
      createEditor: vi.fn(() => { throw initError; }),
      onDestroyError,
      onInitError,
    });

    expect(editor).toBeNull();
    expect(onDestroyError).toHaveBeenCalledWith(destroyError);
    expect(onInitError).toHaveBeenCalledWith(initError);
  });

  it('clears the first highlight layer content and removes all highlight layers on demand', () => {
    document.body.innerHTML = `
      <div class="def-highlight-layer">first</div>
      <div class="def-highlight-layer">second</div>
    `;

    clearDefEditorHighlightLayerContent();

    const layersAfterClear = Array.from(document.querySelectorAll('.def-highlight-layer')) as HTMLElement[];
    expect(layersAfterClear.map((layer) => layer.innerHTML)).toEqual(['', 'second']);

    removeDefEditorHighlightLayers();

    expect(document.querySelectorAll('.def-highlight-layer')).toHaveLength(0);
  });

  it('returns null after destroying an editor instance', () => {
    const editor = { destroy: vi.fn() };

    expect(destroyDefEditorInstance(editor)).toBeNull();
    expect(editor.destroy).toHaveBeenCalledOnce();
  });
});