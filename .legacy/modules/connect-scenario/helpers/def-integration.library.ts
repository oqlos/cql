/**
 * Pure helpers for synchronizing the DEF `library` block with scenario UI state.
 */

export type DefUiLibrarySnapshot = {
  objects: string[];
  functions: string[];
  params: string[];
  units: string[];
};

const LIBRARY_BLOCK_RE = /const\s+library\s*=\s*\{[\s\S]*?\};/;

function toLibraryRecord(library: unknown): Record<string, unknown> {
  if (!library || typeof library !== 'object' || Array.isArray(library)) {
    return {};
  }
  return { ...(library as Record<string, unknown>) };
}

export function normalizeDefLibraryList(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));
}

export function hasDefLibraryBlock(code: string): boolean {
  return LIBRARY_BLOCK_RE.test(code);
}

function mergeDefLibraryLists(
  baseLibrary: unknown,
  updates: Record<string, string[]>,
): Record<string, unknown> {
  const nextLibrary = toLibraryRecord(baseLibrary);
  for (const [key, values] of Object.entries(updates)) {
    nextLibrary[key] = normalizeDefLibraryList(values);
  }
  return nextLibrary;
}

export function buildUiSyncedDefLibrary(
  baseLibrary: unknown,
  snapshot: DefUiLibrarySnapshot,
): Record<string, unknown> {
  const currentLibrary = toLibraryRecord(baseLibrary);
  return mergeDefLibraryLists(currentLibrary, {
    objects: [...normalizeDefLibraryList(currentLibrary.objects), ...snapshot.objects],
    functions: [...normalizeDefLibraryList(currentLibrary.functions), ...snapshot.functions],
    params: [...normalizeDefLibraryList(currentLibrary.params), ...snapshot.params],
    units: [...normalizeDefLibraryList(currentLibrary.units), ...snapshot.units],
  });
}

export function addDefLibraryValue(baseLibrary: unknown, key: string, value: string): Record<string, unknown> {
  const currentLibrary = toLibraryRecord(baseLibrary);
  return mergeDefLibraryLists(currentLibrary, {
    [key]: [...normalizeDefLibraryList(currentLibrary[key]), value],
  });
}

export function replaceDefLibraryBlock(code: string, library: unknown): string {
  return code.replace(LIBRARY_BLOCK_RE, `const library = ${JSON.stringify(toLibraryRecord(library), null, 2)};`);
}