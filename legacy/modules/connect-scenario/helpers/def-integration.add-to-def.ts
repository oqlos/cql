import {
  addDefLibraryValue,
  hasDefLibraryBlock,
  normalizeDefLibraryList,
  replaceDefLibraryBlock,
} from './def-integration.library';

export const ADD_TO_DEF_MISSING_EDITOR_MESSAGE = '❌ Nie znaleziono edytora DEF';
export const ADD_TO_DEF_MISSING_LIBRARY_MESSAGE = '❌ Brak sekcji library w DEF';
export const ADD_TO_DEF_ERROR_MESSAGE = '❌ Błąd dodawania do DEF';

type AddToDefUpdateInput = {
  code: string;
  library: unknown;
  defKey: string;
  newValue: string;
};

type AddToDefUpdateSuccess = {
  ok: true;
  nextCode: string;
  nextLibrary: Record<string, unknown>;
};

type AddToDefUpdateFailure = {
  ok: false;
  errorMessage: string;
};

export type AddToDefUpdateResult = AddToDefUpdateSuccess | AddToDefUpdateFailure;

const DEF_ITEM_LABELS: Record<string, string> = {
  objects: 'obiekt',
  functions: 'funkcję',
  params: 'parametr',
  units: 'jednostkę',
  goals: 'aktywność',
  operators: 'operator',
  funcs: 'procedurę FUNC',
};

const SELECT_CLASS_LIBRARY_KEYS: Array<{ token: string; key: string }> = [
  { token: 'func-call', key: 'funcs' },
  { token: 'object', key: 'objects' },
  { token: 'function', key: 'functions' },
  { token: 'param', key: 'params' },
  { token: 'unit', key: 'units' },
];

function toLibraryRecord(library: unknown): Record<string, unknown> {
  if (!library || typeof library !== 'object' || Array.isArray(library)) {
    return {};
  }
  return library as Record<string, unknown>;
}

export function buildAddToDefPromptMessage(defKey: string, lang: 'pl' | 'en' = 'pl'): string {
  const label = DEF_ITEM_LABELS[defKey] || (lang === 'pl' ? 'pozycję' : 'item');
  return lang === 'pl'
    ? `Podaj nazwę nowej pozycji (${label}):`
    : `Enter new item name (${label}):`;
}

export function buildAddToDefSuccessMessage(newValue: string): string {
  return `✅ Dodano "${newValue}" do biblioteki DEF`;
}

export function resolveAddToDefLibraryKey(selectClass: string): string {
  const normalizedClass = String(selectClass || '').trim();
  return SELECT_CLASS_LIBRARY_KEYS.find(({ token }) => normalizedClass.includes(token))?.key || '';
}

export function resolveAddToDefOptions(library: unknown, selectClass: string, newValue: string): string[] {
  const key = resolveAddToDefLibraryKey(selectClass);
  const currentLibrary = toLibraryRecord(library);
  const options = key ? normalizeDefLibraryList(currentLibrary[key]) : [];

  if (!newValue) return options;
  return options.includes(newValue) ? options : [...options, newValue];
}

export function createAddToDefSelect(selectClass: string, options: string[], selectedValue: string): HTMLSelectElement {
  const select = document.createElement('select');
  select.className = `${selectClass} rounded-4`;

  for (const optionValue of options) {
    const option = document.createElement('option');
    option.value = optionValue;
    option.textContent = optionValue;
    option.selected = optionValue === selectedValue;
    select.appendChild(option);
  }

  return select;
}

export function updateAddToDefCode(input: AddToDefUpdateInput): AddToDefUpdateResult {
  const code = String(input.code || '');
  if (!hasDefLibraryBlock(code)) {
    return {
      ok: false,
      errorMessage: ADD_TO_DEF_MISSING_LIBRARY_MESSAGE,
    };
  }

  const nextLibrary = addDefLibraryValue(toLibraryRecord(input.library), input.defKey, input.newValue);
  const nextCode = replaceDefLibraryBlock(code, nextLibrary);

  return {
    ok: true,
    nextCode,
    nextLibrary,
  };
}

export function replaceAddToDefButtonWithSelect(
  button: HTMLButtonElement,
  library: unknown,
  selectClass: string,
  newValue: string,
): void {
  const options = resolveAddToDefOptions(library, selectClass, newValue);
  const select = createAddToDefSelect(selectClass, options, newValue);
  button.replaceWith(select);
}