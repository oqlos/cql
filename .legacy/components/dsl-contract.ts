// frontend/src/components/dsl/dsl-contract.ts
// Shared DSL contract — single source of truth for types used across all three executors.
//
// Executors that consume this contract:
//   1. dsl.exec.ts           — stateless AST runner  (ExecContext, ExecResult)
//   2. dsl-registry.ts       — registry executor     (ActionMap, IDslExecutor)
//   3. core/dsl-runtime/…    — command dispatcher    (IDslExecutor)

// ---------------------------------------------------------------------------
// Re-export registry types so callers only need one import
// ---------------------------------------------------------------------------
export type {
  TaskHandler, ParamHandler, FuncHandler, ConditionHandler,
  CommandHandler, DslCommandType,
  ActionMapping, ParamMapping, FuncMapping,
  GoalMeasurement, RegistryConfig,
  ExecutionContext, TimerState,
} from './dsl-registry.types';

// ---------------------------------------------------------------------------
// F4.2 — Canonical ActionMap
// The authoritative shape of the DSL action map that lives in the database
// (scenario.library.objectActionMap / scenario.library.actions etc.).
// ---------------------------------------------------------------------------

/** One entry in the object-action map: describes how to execute a task. */
export interface CanonicalActionEntry {
  kind: 'api' | 'function' | 'sequence' | 'ui' | 'backend' | 'script';
  /** HTTP endpoint for kind:'api' */
  url?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: unknown;
  /** Steps for kind:'sequence' */
  steps?: Array<{ action: string; object: string; value?: string }>;
  /** Python path for kind:'backend' | 'script' */
  py?: string;
  path?: string;
  args?: string[];
}

/**
 * Canonical top-level ActionMap shape stored in scenario library.
 * Mirrors the structure expected by dsl.runtime.ts and dsl-registry.ts.
 */
export interface CanonicalActionMap {
  /** object → action → entry mapping */
  objectActionMap?: Record<string, Record<string, CanonicalActionEntry>>;
  /** bare action → entry (no object context) */
  actions?: Record<string, CanonicalActionEntry>;
  /** param → sensor/api entry */
  paramSensorMap?: Record<string, CanonicalActionEntry>;
  /** func name → sequence entry */
  funcMap?: Record<string, CanonicalActionEntry>;
}

// ---------------------------------------------------------------------------
// F4.3 / F4.4 — Shared IDslExecutor interface
// Minimum interface that both DslRegistry and DslExecutorEngine satisfy,
// enabling callers to accept either without knowing the concrete type.
// ---------------------------------------------------------------------------

export interface IDslExecutor {
  /** Execute a named action/command with optional arguments. */
  execute(command: string, args?: Record<string, unknown>): Promise<unknown>;
}
