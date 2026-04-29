// dsl-registry.commands.ts
// Extracted built-in command handler registration

import type { DslCommandType, CommandHandler, DslRegistryContext } from './dsl-registry.types';

/**
 * Create built-in DSL command handlers (ALARM, ERROR, SAVE, etc.)
 */
export function createBuiltInCommands(ctx: DslRegistryContext): Map<DslCommandType, CommandHandler> {
  const handlers = new Map<DslCommandType, CommandHandler>();

  // ALARM [message] - show alarm dialog, can continue
  handlers.set('ALARM', async (_cmd, param, _execCtx) => {
    ctx.log('ALARM', param);
    ctx.pushError({ type: 'ALARM', message: param, timestamp: Date.now() });

    // Emit UI event for alarm dialog
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('dsl:alarm', {
        detail: { message: param, type: 'warning' }
      }));
    }

    return { type: 'ALARM', message: param, handled: true };
  });

  // ERROR [message] - show error, stop execution
  handlers.set('ERROR', async (_cmd, param, _execCtx) => {
    ctx.log('ERROR', param);
    ctx.pushError({ type: 'ERROR', message: param, timestamp: Date.now() });

    // Emit UI event for error dialog
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('dsl:error', {
        detail: { message: param, type: 'error' }
      }));
    }

    // Throw to stop execution
    throw new Error(`DSL ERROR: ${param}`);
  });

  // SAVE [param] - save current value to results
  handlers.set('SAVE', async (_cmd, param, execCtx) => {
    const value = execCtx.state.get(param) ?? await ctx.readParam(param);
    ctx.saveValue(param, { value, timestamp: Date.now() });
    ctx.log('SAVE', param, '=', value);

    // Emit save event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('dsl:save', {
        detail: { param, value }
      }));
    }

    return { type: 'SAVE', param, value };
  });

  // WAIT [time] - wait for duration
  handlers.set('WAIT', async (_cmd, param, _execCtx) => {
    const ms = ctx.parseTimeToMs(param);
    ctx.log('WAIT', `${ms}ms`);
    await ctx.delay(ms);
    return { type: 'WAIT', duration: ms };
  });

  // LOG [message] - log to console
  handlers.set('LOG', async (_cmd, param, _execCtx) => {

    return { type: 'LOG', message: param };
  });

  // STOP - stop test execution
  handlers.set('STOP', async (_cmd, param, _execCtx) => {
    ctx.log('STOP', param || 'Test stopped');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('dsl:stop', {
        detail: { reason: param }
      }));
    }
    throw new Error(`DSL STOP: ${param || 'Execution stopped'}`);
  });

  // PAUSE - pause test execution (user must resume)
  handlers.set('PAUSE', async (_cmd, param, _execCtx) => {
    ctx.log('PAUSE', param || 'Paused');
    return new Promise((resolve) => {
      if (typeof window !== 'undefined') {
        const handler = () => {
          window.removeEventListener('dsl:resume', handler);
          resolve({ type: 'PAUSE', resumed: true });
        };
        window.addEventListener('dsl:resume', handler);
        window.dispatchEvent(new CustomEvent('dsl:pause', {
          detail: { message: param }
        }));
      } else {
        resolve({ type: 'PAUSE', resumed: true });
      }
    });
  });

  // RESUME - handled by PAUSE listener
  handlers.set('RESUME', async (_cmd, _param, _execCtx) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('dsl:resume', { detail: {} }));
    }
    return { type: 'RESUME' };
  });

  return handlers;
}
