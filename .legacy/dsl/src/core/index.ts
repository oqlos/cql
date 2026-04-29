// dsl/core/index.ts
/**
 * DSL Core - Main exports
 * 
 * Usage in browser:
 *   import { getDslRuntime } from '@dsl/core';
 *   const dsl = getDslRuntime();
 *   dsl.execute('NAVIGATE "/connect-test"');
 * 
 * Available via window.dsl in browser console.
 */

// Types
export type {
  DslCommand,
  ApiCommand,
  ActionCommand,
  ComponentCommand,
  StateCommand,
  ProcessCommand,
  SessionCommand,
  ReplayCommand,
  UIState,
  ProcessDefinition,
  ProcessStep,
  ProcessInstance,
  ComponentDefinition,
  DslExecutionContext,
  DslExecutionResult,
} from './types';

// Event Bus & Event Sourcing
export {
  DslEventBus,
  EventStore,
  EventTypes,
  WebSocketBridge,
  getEventBus,
  getWebSocketBridge,
  type DslEvent,
  type EventType,
} from './event-bus';

// State Management
export {
  DslStateManager,
  getStateManager,
} from './state-manager';

// Process Engine
export {
  ProcessEngine,
  BUILT_IN_PROCESSES,
  getProcessEngine,
  type ProcessEvent,
} from './process-engine';

// Component Renderer
export {
  ComponentRenderer,
  COMPONENT_REGISTRY,
  LAYOUT_TEMPLATES,
  getComponentRenderer,
  componentToDsl,
  layoutToDsl,
  type ComponentMapping,
} from './component-renderer';

// Runtime (main integration)
export {
  DslRuntime,
  SessionRecorder,
  SessionPlayer,
  getDslRuntime,
  type DslSession,
  type ReplayOptions,
} from './dsl-runtime';

// ============================================================================
// Quick Start API
// ============================================================================

/**
 * Quick start - get the runtime instance
 */
export function dsl() {
  return getDslRuntime();
}

/**
 * Execute a DSL command
 */
export async function exec(command: string) {
  return getDslRuntime().execute(command);
}

/**
 * Execute a DSL script (multiple commands)
 */
export async function run(script: string) {
  return getDslRuntime().executeScript(script);
}

/**
 * Navigate to route
 */
export async function navigate(route: string) {
  return getDslRuntime().execute(`NAVIGATE "${route}"`);
}

/**
 * Start recording session
 */
export function startRecording(userId?: string) {
  return getDslRuntime().getSessionRecorder().startRecording(userId);
}

/**
 * Stop recording session
 */
export function stopRecording() {
  return getDslRuntime().getSessionRecorder().stopRecording();
}

/**
 * Replay a session
 */
export async function replay(sessionId: string, options?: any) {
  const session = getDslRuntime().getSessionRecorder().getSession(sessionId);
  if (session) {
    return getDslRuntime().getSessionPlayer().play(session, options);
  }
}

/**
 * Connect to event server
 */
export async function connect(url?: string) {
  return getDslRuntime().connectToCli(url);
}

// ============================================================================
// Browser Global
// ============================================================================

if (typeof window !== 'undefined') {
  const api = {
    // Runtime
    runtime: getDslRuntime,
    
    // Quick API
    exec,
    run,
    navigate,
    startRecording,
    stopRecording,
    replay,
    connect,
    
    // Services
    eventBus: getEventBus,
    state: getStateManager,
    process: getProcessEngine,
    renderer: getComponentRenderer,
    
    // Help
    help: () => getDslRuntime().help(),
  };
  
  (window as any).dsl = api;
  
  console.log('🔧 DSL Runtime ready - type dsl.help() for usage');
}
