// dsl/core/types.ts
/**
 * DSL Core Types - Extended for UI Generation and Process Flows
 */

// ============================================================================
// Layer 0: API Commands (existing)
// ============================================================================

export interface ApiCommand {
  type: 'API';
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  endpoint: string;
  body?: Record<string, any>;
  headers?: Record<string, string>;
}

// ============================================================================
// Layer 1: User Actions (existing)
// ============================================================================

export interface ActionCommand {
  type: 'NAVIGATE' | 'CLICK' | 'INPUT' | 'SELECT' | 'SUBMIT' | 'SCROLL';
  target: string;  // CSS selector or route
  params: Record<string, any>;
}

// ============================================================================
// Layer 2: UI Components (new)
// ============================================================================

export interface ComponentDefinition {
  id: string;
  template: string;  // 'card' | 'form' | 'table' | 'dialog' | 'menu'
  props: Record<string, any>;
  slots?: Record<string, ComponentDefinition[]>;
  events?: Record<string, string>;  // event -> DSL command
  bindings?: Record<string, string>;  // prop -> state path
}

export interface ComponentCommand {
  type: 'COMPONENT' | 'RENDER' | 'UPDATE' | 'DESTROY';
  componentId: string;
  definition?: ComponentDefinition;
  props?: Record<string, any>;
}

// ============================================================================
// Layer 3: UI State (new)
// ============================================================================

export interface UIState {
  module: string;
  page: string;
  route: string;
  selection: Record<string, any>;
  filters: Record<string, any>;
  data: Record<string, any>;
  history: string[];
}

export interface StateCommand {
  type: 'STATE_SAVE' | 'STATE_RESTORE' | 'STATE_PUSH' | 'STATE_POP' | 'STATE_CLEAR';
  stateId?: string;
  state?: Partial<UIState>;
}

// ============================================================================
// Layer 4: Process Flows (new)
// ============================================================================

export interface ProcessStep {
  id: string;
  name: string;
  ui: string;  // Module/page path
  required?: string[];  // Required fields
  actions?: string[];  // Available actions
  next?: string | Record<string, string>;  // Next step or conditional
  onEnter?: string[];  // DSL commands on enter
  onExit?: string[];   // DSL commands on exit
}

export interface ProcessDefinition {
  id: string;
  name: string;
  description?: string;
  steps: ProcessStep[];
  initialStep: string;
  context: Record<string, any>;  // Initial context
}

export interface ProcessInstance {
  processId: string;
  instanceId: string;
  currentStep: string;
  context: Record<string, any>;
  history: Array<{step: string; timestamp: string; result?: any}>;
  status: 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
}

export interface ProcessCommand {
  type: 'PROCESS_LOAD' | 'PROCESS_START' | 'PROCESS_NEXT' | 'PROCESS_BACK' | 
        'PROCESS_GOTO' | 'PROCESS_PAUSE' | 'PROCESS_RESUME' | 'PROCESS_CANCEL';
  processId?: string;
  instanceId?: string;
  params?: Record<string, any>;
}

// ============================================================================
// Session Recording (new)
// ============================================================================

export interface SessionRecording {
  id: string;
  userId: string;
  startTime: string;
  endTime?: string;
  commands: DslCommand[];
  metadata: {
    browser: string;
    device: string;
    result: 'success' | 'failure' | 'cancelled';
  };
}

export interface SessionCommand {
  type: 'SESSION_START' | 'SESSION_END' | 'SESSION_PAUSE' | 'SESSION_RESUME';
  sessionId?: string;
  metadata?: Record<string, any>;
}

export interface ReplayCommand {
  type: 'REPLAY' | 'REPLAY_STEP' | 'REPLAY_PAUSE' | 'REPLAY_RESUME' | 'REPLAY_STOP';
  sessionId?: string;
  options?: {
    speed?: number;
    mode?: 'auto' | 'step' | 'debug';
    variables?: Record<string, any>;
  };
}

// ============================================================================
// Unified DSL Command
// ============================================================================

export type DslCommand = 
  | ApiCommand
  | ActionCommand
  | ComponentCommand
  | StateCommand
  | ProcessCommand
  | SessionCommand
  | ReplayCommand
  | { type: string; [key: string]: any };  // Fallback for semantic commands

export interface DslExecutionContext {
  state: UIState;
  process?: ProcessInstance;
  session?: SessionRecording;
  variables: Record<string, any>;
  response?: any;
}

export interface DslExecutionResult {
  success: boolean;
  command: DslCommand;
  result?: any;
  error?: string;
  duration: number;
  nextState?: Partial<UIState>;
}
