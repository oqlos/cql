type DefEditorLike = {
  destroy: () => void;
};

type DefEditorDocument = Pick<Document, 'getElementById' | 'querySelector' | 'querySelectorAll'>;

type InitializeDefEditorInstanceOptions<TEditor extends DefEditorLike> = {
  textareaId: string;
  existingEditor: TEditor | null;
  createEditor: (textareaId: string) => TEditor;
  documentRoot?: DefEditorDocument;
  onDestroyError?: (error: unknown) => void;
  onInitError?: (error: unknown) => void;
};

export function destroyDefEditorInstance<TEditor extends DefEditorLike | null>(
  editor: TEditor,
  onError?: (error: unknown) => void,
): null {
  if (!editor) return null;

  if (!onError) {
    editor.destroy();
    return null;
  }

  try {
    editor.destroy();
  } catch (error) {
    onError(error);
  }

  return null;
}

export function clearDefEditorHighlightLayerContent(
  documentRoot: DefEditorDocument = document,
): void {
  const existingLayer = documentRoot.querySelector('.def-highlight-layer') as HTMLElement | null;
  if (existingLayer) {
    existingLayer.innerHTML = '';
  }
}

export function removeDefEditorHighlightLayers(
  documentRoot: DefEditorDocument = document,
  onError?: (error: unknown) => void,
): void {
  const layers = Array.from(documentRoot.querySelectorAll('.def-highlight-layer')) as HTMLElement[];

  for (const layer of layers) {
    if (!onError) {
      layer.innerHTML = '';
      layer.remove();
      continue;
    }

    try {
      layer.innerHTML = '';
      layer.remove();
    } catch (error) {
      onError(error);
    }
  }
}

export function initializeDefEditorInstance<TEditor extends DefEditorLike>(
  options: InitializeDefEditorInstanceOptions<TEditor>,
): TEditor | null {
  const documentRoot = options.documentRoot ?? document;
  const textarea = documentRoot.getElementById(options.textareaId) as HTMLTextAreaElement | null;
  if (!textarea) return null;

  destroyDefEditorInstance(options.existingEditor, options.onDestroyError);
  clearDefEditorHighlightLayerContent(documentRoot);

  try {
    return options.createEditor(options.textareaId);
  } catch (error) {
    options.onInitError?.(error);
    return null;
  }
}