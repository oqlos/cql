function updateConditionLabel(group: HTMLElement): void {
  const label = group.querySelector('.condition-label') as HTMLElement | null;
  if (!label) return;
  const incoming = String(group.dataset.incoming || '').toUpperCase();
  const prefix = (incoming === 'AND' || incoming === 'OR') ? `${incoming} ` : '';
  const type = String(group.dataset.conditionType || 'if').toLowerCase();
  label.textContent = `${prefix}${type === 'else' ? 'ELSE' : 'IF'}`;
}

export const moveConditionUpWithConnectors = (el: HTMLElement): boolean => {
  if (!el || !el.classList.contains('condition-group')) return false;
  let prev = el.previousElementSibling as HTMLElement | null;
  while (prev && !(prev.classList.contains('condition-group'))) {
    prev = prev.previousElementSibling as HTMLElement | null;
  }
  if (!prev) return false;
  try { prev.before(el); } catch { return false; }
  const inA = el.dataset.incoming || '';
  const inB = prev.dataset.incoming || '';
  el.dataset.incoming = inB;
  prev.dataset.incoming = inA;
  updateConditionLabel(el);
  updateConditionLabel(prev);
  return true;
};

export const moveConditionDownWithConnectors = (el: HTMLElement): boolean => {
  if (!el || !el.classList.contains('condition-group')) return false;
  let next = el.nextElementSibling as HTMLElement | null;
  while (next && !(next.classList.contains('condition-group'))) {
    next = next.nextElementSibling as HTMLElement | null;
  }
  if (!next) return false;
  try { next.after(el); } catch { return false; }
  const inA = el.dataset.incoming || '';
  const inB = next.dataset.incoming || '';
  el.dataset.incoming = inB;
  next.dataset.incoming = inA;
  updateConditionLabel(el);
  updateConditionLabel(next);
  return true;
};
