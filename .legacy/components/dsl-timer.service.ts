// frontend/src/components/dsl/dsl-timer.service.ts
// Timer/Stoper service for DSL execution

export type TimerMode = 'stopwatch' | 'countdown';
export type TimerUnit = 'ms' | 's';

export interface TimerState {
  name: string;
  mode: TimerMode;
  startTime: number;
  duration: number;      // for countdown (ms)
  elapsed: number;       // accumulated time (ms)
  running: boolean;
  paused: boolean;
  onTick?: (remaining: number, elapsed: number) => void;
  onComplete?: () => void;
  intervalId?: ReturnType<typeof setInterval>;
}

export interface TimerOptions {
  mode?: TimerMode;
  duration?: number;     // ms for countdown
  tickInterval?: number; // ms between ticks (default 100)
  onTick?: (remaining: number, elapsed: number) => void;
  onComplete?: () => void;
  autoStart?: boolean;
}

class DslTimerService {
  private timers: Map<string, TimerState> = new Map();
  private defaultTickInterval = 100; // ms

  /**
   * Create a new timer/stopwatch
   */
  create(name: string, options: TimerOptions = {}): TimerState {
    // Stop existing timer with same name
    if (this.timers.has(name)) {
      this.stop(name);
    }

    const state: TimerState = {
      name,
      mode: options.mode || 'stopwatch',
      startTime: 0,
      duration: options.duration || 0,
      elapsed: 0,
      running: false,
      paused: false,
      onTick: options.onTick,
      onComplete: options.onComplete
    };

    this.timers.set(name, state);

    if (options.autoStart) {
      this.start(name, options.tickInterval);
    }

    return state;
  }

  /**
   * Start timer
   */
  start(name: string, tickInterval?: number): boolean {
    const timer = this.timers.get(name);
    if (!timer) return false;

    if (timer.running) return true; // Already running

    timer.startTime = performance.now();
    timer.running = true;
    timer.paused = false;

    // Setup tick interval if callback provided
    if (timer.onTick || timer.onComplete) {
      const interval = tickInterval || this.defaultTickInterval;
      timer.intervalId = setInterval(() => {
        this.tick(name);
      }, interval);
    }

    return true;
  }

  /**
   * Stop timer
   */
  stop(name: string): number {
    const timer = this.timers.get(name);
    if (!timer) return 0;

    if (timer.running) {
      timer.elapsed += performance.now() - timer.startTime;
      timer.running = false;
    }

    if (timer.intervalId) {
      clearInterval(timer.intervalId);
      timer.intervalId = undefined;
    }

    return timer.elapsed;
  }

  /**
   * Pause timer (can resume)
   */
  pause(name: string): boolean {
    const timer = this.timers.get(name);
    if (!timer || !timer.running) return false;

    timer.elapsed += performance.now() - timer.startTime;
    timer.running = false;
    timer.paused = true;

    return true;
  }

  /**
   * Resume paused timer
   */
  resume(name: string): boolean {
    const timer = this.timers.get(name);
    if (!timer || !timer.paused) return false;

    timer.startTime = performance.now();
    timer.running = true;
    timer.paused = false;

    return true;
  }

  /**
   * Reset timer to zero
   */
  reset(name: string): boolean {
    const timer = this.timers.get(name);
    if (!timer) return false;

    this.stop(name);
    timer.elapsed = 0;
    timer.paused = false;

    return true;
  }

  /**
   * Get elapsed time in milliseconds
   */
  getElapsedMs(name: string): number {
    const timer = this.timers.get(name);
    if (!timer) return 0;

    if (timer.running) {
      return timer.elapsed + (performance.now() - timer.startTime);
    }
    return timer.elapsed;
  }

  /**
   * Get elapsed time in seconds
   */
  getElapsedSec(name: string): number {
    return this.getElapsedMs(name) / 1000;
  }

  /**
   * Get remaining time for countdown (ms)
   */
  getRemainingMs(name: string): number {
    const timer = this.timers.get(name);
    if (!timer || timer.mode !== 'countdown') return 0;

    const elapsed = this.getElapsedMs(name);
    return Math.max(0, timer.duration - elapsed);
  }

  /**
   * Get remaining time for countdown (seconds)
   */
  getRemainingSec(name: string): number {
    return this.getRemainingMs(name) / 1000;
  }

  /**
   * Check if countdown has expired
   */
  isExpired(name: string): boolean {
    const timer = this.timers.get(name);
    if (!timer || timer.mode !== 'countdown') return false;
    return this.getRemainingMs(name) <= 0;
  }

  /**
   * Check if timer is running
   */
  isRunning(name: string): boolean {
    return this.timers.get(name)?.running || false;
  }

  /**
   * Internal tick handler
   */
  private tick(name: string): void {
    const timer = this.timers.get(name);
    if (!timer || !timer.running) return;

    const elapsed = this.getElapsedMs(name);
    const remaining = timer.mode === 'countdown' 
      ? Math.max(0, timer.duration - elapsed)
      : 0;

    // Call tick callback
    if (timer.onTick) {
      timer.onTick(remaining, elapsed);
    }

    // Check countdown completion
    if (timer.mode === 'countdown' && remaining <= 0) {
      this.stop(name);
      if (timer.onComplete) {
        timer.onComplete();
      }
    }
  }

  /**
   * Delete timer
   */
  delete(name: string): boolean {
    this.stop(name);
    return this.timers.delete(name);
  }

  /**
   * Get all timer names
   */
  getTimerNames(): string[] {
    return Array.from(this.timers.keys());
  }

  /**
   * Clear all timers
   */
  clearAll(): void {
    for (const name of this.timers.keys()) {
      this.stop(name);
    }
    this.timers.clear();
  }

  // =========================================================================
  // DSL Integration Methods
  // =========================================================================

  /**
   * Execute DSL TIMER command
   * 
   * TIMER [name] START
   * TIMER [name] STOP
   * TIMER [name] RESET
   * COUNTDOWN [name] = [30 s]
   */
  executeDslCommand(command: string, name: string, value?: string): any {
    const cmd = command.toUpperCase();

    switch (cmd) {
      case 'START':
        if (!this.timers.has(name)) {
          this.create(name, { mode: 'stopwatch' });
        }
        this.start(name);
        return { action: 'started', name };

      case 'STOP':
        const elapsed = this.stop(name);
        return { action: 'stopped', name, elapsed, elapsedSec: elapsed / 1000 };

      case 'PAUSE':
        this.pause(name);
        return { action: 'paused', name };

      case 'RESUME':
        this.resume(name);
        return { action: 'resumed', name };

      case 'RESET':
        this.reset(name);
        return { action: 'reset', name };

      case 'COUNTDOWN':
        // Parse value like "30 s" or "5000 ms"
        const duration = this.parseTimeValue(value || '0');
        this.create(name, { mode: 'countdown', duration, autoStart: true });
        return { action: 'countdown_started', name, duration };

      case 'GET':
      case 'VALUE':
        return {
          name,
          elapsedMs: this.getElapsedMs(name),
          elapsedSec: this.getElapsedSec(name),
          remainingMs: this.getRemainingMs(name),
          remainingSec: this.getRemainingSec(name),
          running: this.isRunning(name),
          expired: this.isExpired(name)
        };

      default:
        return { error: `Unknown timer command: ${cmd}` };
    }
  }

  /**
   * Parse time value string to milliseconds
   * "30 s" -> 30000
   * "500 ms" -> 500
   * "1.5 s" -> 1500
   */
  parseTimeValue(value: string): number {
    const match = value.trim().match(/^([\d.]+)\s*(s|ms|sec|msec)?$/i);
    if (!match) return 0;

    const num = parseFloat(match[1]);
    const unit = (match[2] || 's').toLowerCase();

    if (unit === 'ms' || unit === 'msec') {
      return num;
    }
    return num * 1000; // seconds to ms
  }

  /**
   * Format milliseconds to display string
   */
  formatTime(ms: number, format: 'ms' | 's' | 'mm:ss' | 'mm:ss.ms' = 's'): string {
    switch (format) {
      case 'ms':
        return `${Math.round(ms)} ms`;
      case 's':
        return `${(ms / 1000).toFixed(1)} s`;
      case 'mm:ss':
        const totalSec = Math.floor(ms / 1000);
        const min = Math.floor(totalSec / 60);
        const sec = totalSec % 60;
        return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
      case 'mm:ss.ms':
        const totalSec2 = Math.floor(ms / 1000);
        const min2 = Math.floor(totalSec2 / 60);
        const sec2 = totalSec2 % 60;
        const msRem = Math.floor(ms % 1000);
        return `${min2.toString().padStart(2, '0')}:${sec2.toString().padStart(2, '0')}.${msRem.toString().padStart(3, '0')}`;
      default:
        return `${ms}`;
    }
  }
}

// Singleton instance
export const dslTimerService = new DslTimerService();

// Global access for DSL runtime
if (typeof globalThis !== 'undefined') {
  (globalThis as any).__dslTimerService = dslTimerService;
}

export default dslTimerService;
