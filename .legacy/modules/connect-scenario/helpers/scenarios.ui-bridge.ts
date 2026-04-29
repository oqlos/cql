import { createGoalRunRuntime } from './goal-run.runtime';
import type { ScenariosControllerCtx } from './scenarios.ui-types';
import { bindWindowUiEvents } from './scenarios.ui-window';
import { bindContainerUiEvents } from './scenarios.ui-container';

export function setupUiBridge(container: HTMLElement, ctx: ScenariosControllerCtx): void {
  const g: any = (globalThis as any);
  const runtime = g.__goalRunRuntime || createGoalRunRuntime();
  g.__goalRunRuntime = runtime;
  try { runtime.bindUi(container); } catch { /* silent */ }

  // Bind per-container (was global-bound, which broke handlers on other routes)
  const already = (container as any).dataset?.suiBound;
  if (already === '1') {
    return;
  }
  try { (container as any).dataset.suiBound = '1'; } catch { /* silent */ }
  bindWindowUiEvents(container, ctx, runtime);

  bindContainerUiEvents(container, ctx);
}
