const BUILDER_SELECT_SELECTOR = 'select.object-select, select.function-select, select.param-select, select.unit-select, select.goal-select, select.variable-select';

const BUILDER_ACTION_BUTTON_SELECTOR = [
  'button.btn-add-object',
  'button.btn-remove-object',
  'button.btn-add-function',
  'button.btn-remove-function',
  '.btn-add-and',
  '.btn-delete-and',
  '.btn-add-var',
  '.btn-delete-var',
  '[data-action="add-get"]',
  '[data-action="add-set"]',
  '[data-action="add-max"]',
  '[data-action="add-min"]',
  '[data-action="add-condition"]',
  '[data-action="delete-condition"]',
  '[data-action="clone-task"]',
  '[data-action="delete-task"]',
].join(', ');

function canUseClosest(target: HTMLElement | null): target is HTMLElement & { closest: NonNullable<HTMLElement['closest']> } {
  return !!target && typeof target.closest === 'function';
}

export function isBuilderSelectTarget(target: HTMLElement | null): boolean {
  return canUseClosest(target) ? !!target.closest(BUILDER_SELECT_SELECTOR) : false;
}

export function isBuilderActionButtonTarget(target: HTMLElement | null): boolean {
  return canUseClosest(target) ? !!target.closest(BUILDER_ACTION_BUTTON_SELECTOR) : false;
}

export function shouldSyncDefLibraryForMutation(mutation: Pick<MutationRecord, 'type' | 'target'>): boolean {
  if (mutation.type === 'childList') return true;
  if (mutation.type !== 'attributes') return false;

  const target = mutation.target as HTMLElement | null;
  return !!target && !!target.matches && (target.matches('select') || target.matches('option'));
}