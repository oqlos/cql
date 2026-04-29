export const DSL_RUNTIME_INIT_HTML = '<div class="text-muted">⏳ Inicjalizacja DSL Runtime...</div>';
export const DSL_NO_RESULT_HTML = '<div class="text-muted">⚠️ Brak wyniku DSL</div>';
export const DSL_TOOLS_LOAD_ERROR_HTML = '<div class="text-danger">❌ Błąd ładowania DSL Tools</div>';
export const DSL_CONSOLE_CLEARED_HTML = '<div class="text-muted">📄 Konsola wyczyszczona</div>';

export function shouldSkipRuntimeRefresh(
  currentDslContent: string,
  lastDslContent: string,
  currentOutputHtml: string,
): boolean {
  return currentDslContent === lastDslContent && currentOutputHtml !== DSL_RUNTIME_INIT_HTML;
}

export function resolveDslResultHtml(result: string | null | undefined): string {
  return result || DSL_NO_RESULT_HTML;
}

export function setElementHtml(element: HTMLElement | null, html: string): void {
  if (element) {
    element.innerHTML = html;
  }
}

export function renderRuntimeSuccessStatus(statusElement: HTMLElement | null, timestamp: string): void {
  if (!statusElement) return;
  statusElement.innerHTML = `Status: ✅ Aktualny | Ostatnia aktualizacja: ${timestamp}`;
  statusElement.style.background = 'var(--badge-green-bg)';
  statusElement.style.color = 'var(--badge-green-text)';
}

export function renderRuntimeErrorStatus(statusElement: HTMLElement | null, message: string): void {
  if (!statusElement) return;
  statusElement.innerHTML = `Status: ❌ Błąd | ${message}`;
  statusElement.style.background = 'color-mix(in srgb, var(--danger) 15%, transparent)';
  statusElement.style.color = 'var(--danger)';
}

export function resolveExecutionErrorHtml(error: unknown): string {
  return `<div class="text-danger">❌ Błąd: ${error}</div>`;
}