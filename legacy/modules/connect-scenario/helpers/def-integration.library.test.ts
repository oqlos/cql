import { describe, expect, it } from 'vitest';

import {
  addDefLibraryValue,
  buildUiSyncedDefLibrary,
  hasDefLibraryBlock,
  normalizeDefLibraryList,
  replaceDefLibraryBlock,
} from './def-integration.library';

describe('def-integration.library', () => {
  it('normalizes list values by trimming and deduplicating entries', () => {
    expect(normalizeDefLibraryList([' pompa 1 ', '', 'pompa 1', null, 'zawór 1'])).toEqual([
      'pompa 1',
      'zawór 1',
    ]);
  });

  it('merges UI datasets into the DEF library while preserving extra keys', () => {
    const merged = buildUiSyncedDefLibrary(
      {
        objects: ['pompa 1'],
        functions: ['Włącz'],
        params: ['ciśnienie'],
        units: ['bar'],
        funcs: ['Setup'],
        logs: ['Rozpoczynam test'],
      },
      {
        objects: ['zawór 1'],
        functions: ['Ustaw', 'Włącz'],
        params: ['czas'],
        units: ['s', 'bar'],
      },
    );

    expect(merged).toEqual({
      objects: ['pompa 1', 'zawór 1'],
      functions: ['Włącz', 'Ustaw'],
      params: ['ciśnienie', 'czas'],
      units: ['bar', 's'],
      funcs: ['Setup'],
      logs: ['Rozpoczynam test'],
    });
  });

  it('adds a single library value without dropping existing datasets', () => {
    const updated = addDefLibraryValue(
      {
        objects: ['pompa 1'],
        funcs: ['Setup'],
        operators: ['>', '<'],
      },
      'funcs',
      'Cleanup',
    );

    expect(updated).toEqual({
      objects: ['pompa 1'],
      funcs: ['Setup', 'Cleanup'],
      operators: ['>', '<'],
    });
  });

  it('detects and replaces the DEF library block in code', () => {
    const code = `const before = 1;\nconst library = {\n  objects: ["pompa 1"]\n};\nconst after = 2;`;

    expect(hasDefLibraryBlock(code)).toBe(true);

    const replaced = replaceDefLibraryBlock(code, {
      objects: ['pompa 1', 'zawór 1'],
      funcs: ['Setup'],
    });

    expect(replaced).toContain('const library = {');
    expect(replaced).toContain('"zawór 1"');
    expect(replaced).toContain('"funcs"');
    expect(replaced).toContain('const before = 1;');
    expect(replaced).toContain('const after = 2;');
  });
});