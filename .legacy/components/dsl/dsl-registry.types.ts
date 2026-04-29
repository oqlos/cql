// frontend/src/components/dsl/dsl-registry.types.ts
// Extracted type definitions for DslRegistry

export type TaskHandler = (action: string, object: string, value?: string) => Promise<any>;
export type ParamHandler = (param: string) => Promise<number | null>;
export type FuncHandler = (name: string, context: ExecutionContext) => Promise<any>;
export type ConditionHandler = (name: string) => Promise<any>;

// Built-in DSL command types (executed as TASK)
export type DslCommandType = 'ALARM' | 'ERROR' | 'SAVE' | 'WAIT' | 'LOG' | 'STOP' | 'PAUSE' | 'RESUME';
export type CommandHandler = (command: DslCommandType, param: string, context: ExecutionContext) => Promise<any>;

export interface ExecutionContext {
  state: Map<string, any>;
  timers: Map<string, TimerState>;
  registry: any; // DslRegistry - avoid circular import
}

export interface TimerState {
  name: string;
  mode: 'stopwatch' | 'countdown';
  startTime: number;
  duration: number;
  elapsed: number;
  running: boolean;
}

export interface ActionMapping {
  kind: 'api' | 'function' | 'sequence' | 'ui' | 'backend';
  handler?: TaskHandler;
  url?: string;
  method?: string;
  body?: any;
  py?: string;  // Python code for backend execution
  steps?: Array<{ action: string; object: string; value?: string }>;
  component?: string;
  props?: Record<string, any>;
}

/** Measurement row for report - built from OUT commands */
export interface GoalMeasurement {
  param_name: string;
  measured_value: string | number;
  unit: string;
  min_value: string | number | null;
  max_value: string | number | null;
  result: string;
}

export interface ParamMapping {
  kind: 'api' | 'function' | 'backend';
  handler?: ParamHandler;
  url?: string;
  sensor?: string;
  unit?: string;
  py?: string;
}

export interface FuncMapping {
  kind: 'sequence' | 'function' | 'backend';
  handler?: FuncHandler;
  steps?: Array<{ action: string; object: string; value?: string }>;
  py?: string;
}

export interface RegistryConfig {
  backendUrl?: string;
  environment?: 'browser' | 'node' | 'test';
  enableLogging?: boolean;
}

/** Context interface for extracted DSL registry modules */
export interface DslRegistryContext {
  state: Map<string, any>;
  log(type: string, ...args: any[]): void;
  delay(ms: number): Promise<void>;
  parseTimeToMs(value: string): number;
  readParam(param: string): Promise<number | null>;
  executeTask(action: string, object: string, value?: string): Promise<any>;
  executeFunc(name: string): Promise<any>;
  executeCommand(command: string, param: string): Promise<any>;
  executeDialog(varName: string, prompt: string): Promise<string | null>;
  pushError(entry: { type: string; message: string; timestamp: number }): void;
  saveValue(name: string, entry: { value: any; timestamp: number }): void;
}
