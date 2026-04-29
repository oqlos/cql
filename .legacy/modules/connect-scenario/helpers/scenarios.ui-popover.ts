import { escapeHtml } from '../../../utils/html.utils';

export function showBulkChangePopover(
  target: HTMLElement,
  kind: 'object'|'function',
  prev: string,
  cur: string,
  onDone: (applyAll: boolean) => void,
  onCancel: () => void
): void {
  try { document.getElementById('bulk-change-popover')?.remove(); } catch { /* silent */ }
  const rect = target.getBoundingClientRect();
  const pop = document.createElement('div');
  pop.id = 'bulk-change-popover';
  pop.style.position = 'fixed';
  pop.style.zIndex = '9999';
  pop.style.top = `${Math.max(0, rect.bottom + 6)}px`;
  pop.style.left = `${Math.max(0, rect.left)}px`;
  pop.style.background = 'var(--panel-bg)';
  pop.style.border = '1px solid var(--border)';
  pop.style.borderRadius = '6px';
  pop.style.boxShadow = '0 4px 12px rgba(0,0,0,0.12)';
  pop.style.padding = '10px 12px';
  pop.style.fontSize = '12px';
  pop.style.maxWidth = '320px';
  pop.style.color = 'var(--text)';
  const label = kind === 'object' ? 'obiekt' : 'funkcję';
  pop.innerHTML = `
      <div style="margin-bottom:6px;">
        Zastosować zmianę ${label} "${escapeHtml(prev)}" → "${escapeHtml(cur)}"?
      </div>
      <label style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">
        <input type="checkbox" id="bulk-apply-all" />
        <span>Zastąp we wszystkich GOAL-ach</span>
      </label>
      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button class="btn btn-secondary" id="bulk-cancel">Anuluj</button>
        <button class="btn btn-primary" id="bulk-apply">Zastosuj</button>
      </div>
    `;
  document.body.appendChild(pop);
  const apply = pop.querySelector('#bulk-apply') as HTMLButtonElement | null;
  const cancel = pop.querySelector('#bulk-cancel') as HTMLButtonElement | null;
  const chk = pop.querySelector('#bulk-apply-all') as HTMLInputElement | null;
  const cleanup = () => { try { pop.remove(); } catch { /* silent */ } };
  apply?.addEventListener('click', () => { const all = !!chk?.checked; cleanup(); onDone(all); });
  cancel?.addEventListener('click', () => { cleanup(); onCancel(); });
  const outside = (ev: MouseEvent) => { if (!pop.contains(ev.target as Node)) { cleanup(); document.removeEventListener('mousedown', outside, true); } };
  setTimeout(() => document.addEventListener('mousedown', outside, true), 0);
}
