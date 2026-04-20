/** @vitest-environment jsdom */

import { describe, expect, it, vi } from 'vitest';

import {
  bindDslRuntimePanelControls,
  startRuntimeAutoRefresh,
  stopRuntimeAutoRefresh,
} from './def-integration.runtime-controls';

describe('def-integration.runtime-controls', () => {
  it('binds runtime panel controls, triggers the expected actions, and cleans up listeners', () => {
    const autoRefreshCheckbox = document.createElement('input');
    autoRefreshCheckbox.type = 'checkbox';
    autoRefreshCheckbox.checked = true;
    const manualRefreshBtn = document.createElement('button');
    const manualStateBtn = document.createElement('button');
    const consoleRefreshBtn = document.createElement('button');
    const consoleClearBtn = document.createElement('button');
    const onStartAutoRefresh = vi.fn();
    const onStopAutoRefresh = vi.fn();
    const onRunRuntime = vi.fn();
    const onResetLiveState = vi.fn();
    const onRunConsole = vi.fn();
    const onClearConsole = vi.fn();
    const scheduleInitialRun = vi.fn((callback: () => void) => {
      callback();
      return 1;
    });
    const clearScheduledRun = vi.fn();

    const cleanup = bindDslRuntimePanelControls({
      autoRefreshCheckbox,
      manualRefreshBtn,
      manualStateBtn,
      consoleRefreshBtn,
      consoleClearBtn,
      onStartAutoRefresh,
      onStopAutoRefresh,
      onRunRuntime,
      onResetLiveState,
      onRunConsole,
      onClearConsole,
      scheduleInitialRun,
      clearScheduledRun,
    });

    expect(onStartAutoRefresh).toHaveBeenCalledOnce();
    expect(scheduleInitialRun).toHaveBeenCalledWith(expect.any(Function), 100);
    expect(onRunRuntime).toHaveBeenCalledOnce();
    expect(onRunConsole).toHaveBeenCalledOnce();

    autoRefreshCheckbox.checked = false;
    autoRefreshCheckbox.dispatchEvent(new Event('change'));
    manualRefreshBtn.click();
    manualStateBtn.click();
    consoleRefreshBtn.click();
    consoleClearBtn.click();

    expect(onStopAutoRefresh).toHaveBeenCalledOnce();
    expect(onRunRuntime).toHaveBeenCalledTimes(2);
    expect(onResetLiveState).toHaveBeenCalledOnce();
    expect(onRunConsole).toHaveBeenCalledTimes(2);
    expect(onClearConsole).toHaveBeenCalledOnce();

    cleanup();

    expect(clearScheduledRun).toHaveBeenCalledWith(1);

    autoRefreshCheckbox.checked = true;
    autoRefreshCheckbox.dispatchEvent(new Event('change'));
    manualRefreshBtn.click();
    manualStateBtn.click();
    consoleRefreshBtn.click();
    consoleClearBtn.click();

    expect(onStartAutoRefresh).toHaveBeenCalledOnce();
    expect(onStopAutoRefresh).toHaveBeenCalledOnce();
    expect(onRunRuntime).toHaveBeenCalledTimes(2);
    expect(onResetLiveState).toHaveBeenCalledOnce();
    expect(onRunConsole).toHaveBeenCalledTimes(2);
    expect(onClearConsole).toHaveBeenCalledOnce();
  });

  it('subscribes to websocket events and polling when auto-refresh starts', () => {
    const subscriptions: Record<string, () => void> = {};
    const subscribeToEvent = vi.fn((eventType: string, handler: () => void) => {
      subscriptions[eventType] = handler;
      return vi.fn();
    });
    const intervalCallbacks: Array<() => void> = [];
    const setIntervalFn = vi.fn((handler: () => void) => {
      intervalCallbacks.push(handler);
      return 123;
    });
    const onRefreshRuntimePanels = vi.fn();

    const state = startRuntimeAutoRefresh({
      subscribeToEvent,
      onRefreshRuntimePanels,
      setIntervalFn,
    });

    expect(subscribeToEvent).toHaveBeenNthCalledWith(1, 'domain_event', expect.any(Function));
    expect(subscribeToEvent).toHaveBeenNthCalledWith(2, 'data_updated', expect.any(Function));
    expect(setIntervalFn).toHaveBeenCalledWith(expect.any(Function), 15000);
    expect(state.intervalId).toBe(123);
    expect(state.wsUnsubscribers).toHaveLength(2);

    subscriptions.domain_event();
    subscriptions.data_updated();
    intervalCallbacks[0]();

    expect(onRefreshRuntimePanels).toHaveBeenCalledTimes(3);
  });

  it('unsubscribes websocket handlers and clears the polling interval when auto-refresh stops', () => {
    const unsubscribeA = vi.fn();
    const unsubscribeB = vi.fn();
    const clearIntervalFn = vi.fn();

    const state = stopRuntimeAutoRefresh({
      wsUnsubscribers: [unsubscribeA, unsubscribeB],
      intervalId: 456,
      clearIntervalFn,
    });

    expect(unsubscribeA).toHaveBeenCalledOnce();
    expect(unsubscribeB).toHaveBeenCalledOnce();
    expect(clearIntervalFn).toHaveBeenCalledWith(456);
    expect(state).toEqual({ wsUnsubscribers: [], intervalId: null });
  });
});