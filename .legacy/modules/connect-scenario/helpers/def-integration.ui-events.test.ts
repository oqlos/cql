/** @vitest-environment jsdom */

import { describe, expect, it } from 'vitest';

import {
  isBuilderActionButtonTarget,
  isBuilderSelectTarget,
  shouldSyncDefLibraryForMutation,
} from './def-integration.ui-events';

describe('def-integration.ui-events', () => {
  it('detects builder select targets through closest matching', () => {
    document.body.innerHTML = `
      <div>
        <select class="object-select"><option>pompa 1</option></select>
        <select class="goal-select"><option>Goal A</option></select>
        <select class="other-select"><option>x</option></select>
      </div>
    `;

    const objectOption = document.querySelector('.object-select option') as HTMLElement;
    const goalSelect = document.querySelector('.goal-select') as HTMLElement;
    const otherSelect = document.querySelector('.other-select') as HTMLElement;

    expect(isBuilderSelectTarget(objectOption)).toBe(true);
    expect(isBuilderSelectTarget(goalSelect)).toBe(true);
    expect(isBuilderSelectTarget(otherSelect)).toBe(false);
  });

  it('detects builder action buttons for sync-triggering controls', () => {
    document.body.innerHTML = `
      <div>
        <button class="btn-add-object"><span class="inner">Add</span></button>
        <button data-action="clone-task"><span class="inner">Clone</span></button>
        <button class="btn-neutral"><span class="inner">Ignore</span></button>
      </div>
    `;

    const addInner = document.querySelector('.btn-add-object .inner') as HTMLElement;
    const cloneInner = document.querySelector('[data-action="clone-task"] .inner') as HTMLElement;
    const neutralInner = document.querySelector('.btn-neutral .inner') as HTMLElement;

    expect(isBuilderActionButtonTarget(addInner)).toBe(true);
    expect(isBuilderActionButtonTarget(cloneInner)).toBe(true);
    expect(isBuilderActionButtonTarget(neutralInner)).toBe(false);
  });

  it('matches builder mutations that should trigger DEF sync', () => {
    const select = document.createElement('select');
    const option = document.createElement('option');
    const div = document.createElement('div');

    expect(shouldSyncDefLibraryForMutation({ type: 'childList', target: div } as MutationRecord)).toBe(true);
    expect(shouldSyncDefLibraryForMutation({ type: 'attributes', target: select } as MutationRecord)).toBe(true);
    expect(shouldSyncDefLibraryForMutation({ type: 'attributes', target: option } as MutationRecord)).toBe(true);
    expect(shouldSyncDefLibraryForMutation({ type: 'attributes', target: div } as MutationRecord)).toBe(false);
    expect(shouldSyncDefLibraryForMutation({ type: 'characterData', target: div } as MutationRecord)).toBe(false);
  });
});