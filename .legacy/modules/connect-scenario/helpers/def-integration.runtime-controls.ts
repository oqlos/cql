export type RuntimePanelControlsCleanup = () => void;

export type RuntimeAutoRefreshState = {
  wsUnsubscribers: Array<() => void>;
  intervalId: number | null;
};

type TimerId = number;

type BindDslRuntimePanelControlsOptions = {
  autoRefreshCheckbox: HTMLInputElement | null;
  manualRefreshBtn: HTMLElement | null;
  manualStateBtn: HTMLElement | null;
  consoleRefreshBtn: HTMLElement | null;
  consoleClearBtn: HTMLElement | null;
  onStartAutoRefresh: () => void;
  onStopAutoRefresh: () => void;
  onRunRuntime: () => void;
  onResetLiveState: () => void;
  onRunConsole: () => void;
  onClearConsole: () => void;
  scheduleInitialRun?: (callback: () => void, delayMs: number) => TimerId;
  clearScheduledRun?: (timerId: TimerId) => void;
};

type StartRuntimeAutoRefreshOptions = {
  subscribeToEvent: (eventType: string, handler: () => void) => () => void;
  onRefreshRuntimePanels: () => void;
  setIntervalFn?: (handler: () => void, delayMs: number) => number;
};

type StopRuntimeAutoRefreshOptions = {
  wsUnsubscribers: Array<() => void>;
  intervalId: number | null;
  clearIntervalFn?: (intervalId: number) => void;
};

export function bindDslRuntimePanelControls(
  options: BindDslRuntimePanelControlsOptions,
): RuntimePanelControlsCleanup {
  const cleanup: Array<() => void> = [];

  if (options.autoRefreshCheckbox) {
    const handleAutoRefreshChange = () => {
      if (options.autoRefreshCheckbox?.checked) {
        options.onStartAutoRefresh();
      } else {
        options.onStopAutoRefresh();
      }
    };
    options.autoRefreshCheckbox.addEventListener('change', handleAutoRefreshChange);
    cleanup.push(() => options.autoRefreshCheckbox?.removeEventListener('change', handleAutoRefreshChange));

    if (options.autoRefreshCheckbox.checked) {
      options.onStartAutoRefresh();
    }
  }

  if (options.manualRefreshBtn) {
    const handleManualRefresh = () => options.onRunRuntime();
    options.manualRefreshBtn.addEventListener('click', handleManualRefresh);
    cleanup.push(() => options.manualRefreshBtn?.removeEventListener('click', handleManualRefresh));
  }

  if (options.manualStateBtn) {
    const handleManualStateRefresh = () => options.onResetLiveState();
    options.manualStateBtn.addEventListener('click', handleManualStateRefresh);
    cleanup.push(() => options.manualStateBtn?.removeEventListener('click', handleManualStateRefresh));
  }

  if (options.consoleRefreshBtn) {
    const handleConsoleRefresh = () => options.onRunConsole();
    options.consoleRefreshBtn.addEventListener('click', handleConsoleRefresh);
    cleanup.push(() => options.consoleRefreshBtn?.removeEventListener('click', handleConsoleRefresh));
  }

  if (options.consoleClearBtn) {
    const handleConsoleClear = () => options.onClearConsole();
    options.consoleClearBtn.addEventListener('click', handleConsoleClear);
    cleanup.push(() => options.consoleClearBtn?.removeEventListener('click', handleConsoleClear));
  }

  const scheduleInitialRun = options.scheduleInitialRun ?? ((callback, delayMs) => window.setTimeout(callback, delayMs));
  const clearScheduledRun = options.clearScheduledRun ?? ((timerId) => window.clearTimeout(timerId));
  const initialRunTimer = scheduleInitialRun(() => {
    options.onRunRuntime();
    options.onRunConsole();
  }, 100);
  cleanup.push(() => clearScheduledRun(initialRunTimer));

  return () => {
    cleanup.forEach((teardown) => teardown());
  };
}

export function startRuntimeAutoRefresh(
  options: StartRuntimeAutoRefreshOptions,
): RuntimeAutoRefreshState {
  const refreshRuntimePanels = () => options.onRefreshRuntimePanels();
  const setIntervalFn = options.setIntervalFn ?? ((handler, delayMs) => window.setInterval(handler, delayMs));

  return {
    wsUnsubscribers: [
      options.subscribeToEvent('domain_event', refreshRuntimePanels),
      options.subscribeToEvent('data_updated', refreshRuntimePanels),
    ],
    intervalId: setIntervalFn(refreshRuntimePanels, 15000),
  };
}

export function stopRuntimeAutoRefresh(
  options: StopRuntimeAutoRefreshOptions,
): RuntimeAutoRefreshState {
  options.wsUnsubscribers.forEach((unsubscribe) => unsubscribe());

  if (options.intervalId !== null) {
    (options.clearIntervalFn ?? ((intervalId) => window.clearInterval(intervalId)))(options.intervalId);
  }

  return {
    wsUnsubscribers: [],
    intervalId: null,
  };
}