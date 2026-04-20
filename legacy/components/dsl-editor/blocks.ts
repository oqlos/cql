// frontend/src/components/dsl-editor/blocks.ts

export type BlockType = 'task' | 'get' | 'set' | 'variable' | 'if' | 'else';

export function getBlockType(el: HTMLElement): BlockType | null {
  if (!el) return null;
  if (el.classList.contains('task-container')) return 'task';
  if (el.classList.contains('variable-container')) {
    const kind = String((el as any).dataset?.varKind || '').toLowerCase();
    const varMap: Record<string, BlockType> = { get: 'get', set: 'set' };
    return varMap[kind] || 'variable';
  }
  if (el.classList.contains('condition-group')) {
    return String((el as any).dataset?.conditionType || '').toLowerCase() === 'else' ? 'else' : 'if';
  }
  return null;
}

export function isBlock(el: Element | null): el is HTMLElement {
  if (!el || !(el instanceof HTMLElement)) return false;
  return !!getBlockType(el);
}

export function findStepsContainer(el: HTMLElement | null): HTMLElement | null {
  if (!el) return null;
  const goal = el.closest('.goal-section') as HTMLElement | null;
  const func = el.closest('.func-section') as HTMLElement | null;
  const parent = goal || func;
  if (!parent) return null;
  return parent.querySelector('.steps-container') as HTMLElement | null;
}

function prevBlock(el: HTMLElement): HTMLElement | null {
  let p: Element | null = el ? el.previousElementSibling : null;
  while (p && (!(p instanceof HTMLElement) || !isBlock(p))) {
    p = p.previousElementSibling;
  }
  return (p as HTMLElement | null);
}

function nextBlock(el: HTMLElement): HTMLElement | null {
  let n: Element | null = el ? el.nextElementSibling : null;
  while (n && (!(n instanceof HTMLElement) || !isBlock(n))) {
    n = n.nextElementSibling;
  }
  return (n as HTMLElement | null);
}

export function moveBlockUp(el: HTMLElement): boolean {
  const parent: HTMLElement | null = (el && (el.parentElement as HTMLElement | null)) || null;
  if (!parent) return false;
  const prev = prevBlock(el);
  if (!prev) return false;
  try { prev.before(el); return true; } catch { return false; }
}

export function moveBlockDown(el: HTMLElement): boolean {
  const parent: HTMLElement | null = (el && (el.parentElement as HTMLElement | null)) || null;
  if (!parent) return false;
  const nxt = nextBlock(el);
  if (!nxt) return false;
  try { nxt.after(el); return true; } catch { return false; }
}

export function moveGoalUp(goal: HTMLElement): boolean {
  if (!goal || !goal.classList.contains('goal-section')) return false;
  const prev = goal.previousElementSibling as HTMLElement | null;
  if (!prev || !prev.classList || !prev.classList.contains('goal-section')) return false;
  const parent = goal.parentElement as HTMLElement | null;
  if (!parent) return false;
  try { prev.before(goal); return true; } catch { return false; }
}

export function moveGoalDown(goal: HTMLElement): boolean {
  if (!goal || !goal.classList.contains('goal-section')) return false;
  const next = goal.nextElementSibling as HTMLElement | null;
  if (!next || !next.classList || !next.classList.contains('goal-section')) return false;
  const parent = goal.parentElement as HTMLElement | null;
  if (!parent) return false;
  try { next.after(goal); return true; } catch { return false; }
}

export function cloneBlock(el: HTMLElement): HTMLElement | null {
  if (!isBlock(el)) return null;
  try {
    const clone = el.cloneNode(true) as HTMLElement;
    const t = getBlockType(el);
    const uid = `x${Date.now()}${Math.floor(Math.random()*1000)}`;
    if (t === 'task') clone.dataset.taskId = `task-${uid}`;
    if (t === 'variable' || t === 'get' || t === 'set') clone.dataset.variableId = `var-${uid}`;
    return clone;
  } catch {
    return null;
  }
}
