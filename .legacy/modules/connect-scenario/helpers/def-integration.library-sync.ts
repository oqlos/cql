import {
  buildUiSyncedDefLibrary,
  type DefUiLibrarySnapshot,
} from './def-integration.library';

type GlobalLike = Record<string, unknown>;

type ScheduleDefLibrarySyncOptions = {
  currentTimerId: number | null;
  onSync: () => void;
  delayMs?: number;
  now?: () => number;
  globalObject?: GlobalLike;
  setTimeoutFn?: (callback: () => void, delayMs: number) => number;
  clearTimeoutFn?: (timerId: number) => void;
};

type SyncDefLibraryFromUiOptions = {
  getEditorCode: () => string;
  hasLibraryBlock: (code: string) => boolean;
  ensureLibraryBlock?: () => void;
  getCurrentLibrary: () => Record<string, unknown>;
  buildUiLibrarySnapshot: () => DefUiLibrarySnapshot;
  replaceDefLibraryBlock: (code: string, library: Record<string, unknown>) => string;
  setEditorCode: (nextCode: string) => void;
  updateDefLibraryFromCode: (nextCode: string) => void;
  now?: () => number;
  globalObject?: GlobalLike;
};

function getDefLibrarySyncSuppressionUntil(globalObject: GlobalLike): number {
  try {
    return Number(globalObject.__suppressDefLibrarySyncUntil || 0);
  } catch {
    return 0;
  }
}

function getDefLibrarySourceOverride(globalObject: GlobalLike): string {
  try {
    return String(globalObject.__dslLibrarySourceOverride || '').toUpperCase();
  } catch {
    return '';
  }
}

export function isDefLibrarySyncSuppressed(
  globalObject: GlobalLike = globalThis as unknown as GlobalLike,
  now: number = Date.now(),
): boolean {
  const suppressedUntil = getDefLibrarySyncSuppressionUntil(globalObject);
  return !!suppressedUntil && now < suppressedUntil;
}

export function clearExpiredDefLibrarySyncSuppression(
  globalObject: GlobalLike = globalThis as unknown as GlobalLike,
  now: number = Date.now(),
): void {
  try {
    const suppressedUntil = getDefLibrarySyncSuppressionUntil(globalObject);
    if (suppressedUntil && now >= suppressedUntil) {
      delete globalObject.__suppressDefLibrarySyncUntil;
    }
  } catch {
    /* silent */
  }
}

export function scheduleDefLibrarySync(options: ScheduleDefLibrarySyncOptions): number | null {
  const globalObject = options.globalObject ?? (globalThis as unknown as GlobalLike);
  const now = (options.now ?? Date.now)();
  if (isDefLibrarySyncSuppressed(globalObject, now)) {
    return options.currentTimerId;
  }

  try {
    if (options.currentTimerId !== null) {
      (options.clearTimeoutFn ?? ((timerId) => window.clearTimeout(timerId)))(options.currentTimerId);
    }
  } catch {
    /* silent */
  }

  return (options.setTimeoutFn ?? ((callback, delayMs) => window.setTimeout(callback, delayMs)))(() => {
    try {
      options.onSync();
    } catch {
      /* silent */
    }
  }, options.delayMs ?? 150);
}

export function syncDefLibraryFromUi(options: SyncDefLibraryFromUiOptions): boolean {
  const globalObject = options.globalObject ?? (globalThis as unknown as GlobalLike);
  const now = (options.now ?? Date.now)();

  if (isDefLibrarySyncSuppressed(globalObject, now)) {
    return false;
  }
  clearExpiredDefLibrarySyncSuppression(globalObject, now);

  if (getDefLibrarySourceOverride(globalObject) === 'DB') {
    return false;
  }

  let code = String(options.getEditorCode() || '');
  if (!code || !options.hasLibraryBlock(code)) {
    options.ensureLibraryBlock?.();
    code = String(options.getEditorCode() || '');
    if (!options.hasLibraryBlock(code)) {
      return false;
    }
  }

  const nextLibrary = buildUiSyncedDefLibrary(
    options.getCurrentLibrary(),
    options.buildUiLibrarySnapshot(),
  );
  const nextCode = options.replaceDefLibraryBlock(code, nextLibrary);

  if (nextCode === code) {
    return false;
  }

  options.setEditorCode(nextCode);
  options.updateDefLibraryFromCode(nextCode);
  return true;
}