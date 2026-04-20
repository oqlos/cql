import { createGoalRunRuntime } from './goal-run.runtime';
import { SCENARIO_UI_HANDLERS } from './scenarios.ui-window-handlers';
import type { ScenariosControllerCtx } from './scenarios.ui-types';

export function bindWindowUiEvents(container: HTMLElement, ctx: ScenariosControllerCtx, runtimeParam?: any): void {
  const g: any = (globalThis as any);
  const runtime = runtimeParam || g.__goalRunRuntime || createGoalRunRuntime();
  g.__goalRunRuntime = runtime;
  try { runtime.bindUi(container); } catch { /* silent */ }

  if ((g as any).__suiWindowBound) return;

  window.addEventListener('scenarios:ui', async (ev: Event) => {
    const d = (ev as CustomEvent).detail || {};
    const action = String(d.action || '');
    const handler = SCENARIO_UI_HANDLERS[action];
    if (handler) await handler(d, ctx, runtime);
  });
  try { (g as any).__suiWindowBound = '1'; } catch { /* silent */ }
}
