// frontend/src/components/dsl/index.ts
// Main DSL components export

// Legacy direct exports (for backward compatibility)
export * from './dsl.types';
export * from './dsl.parser';
export * from './dsl.highlight';
export * from './dsl.exec';
export * from './dsl.validator';
export * from './dsl-tools';
export { dslDataService } from './dsl-data.service';
export * from './dsl.schema';
export * from './dsl.xsd';
export * from './dsl.xml';
export * from './dsl.serialize.text';
export * from './dsl.quotes';
export * from './dsl.examples';
export type { DslData, DslObject, DslFunction, DslParam, DslUnit, DslObjectFunction, DslParamUnit } from './dsl-data.service';

// New singleton pattern (recommended approach)
export { DslEngine } from './dsl.engine';
export type { DslParseResult, DslExecuteResult, DslValidateResult } from './dsl.engine';
export { getDslEngine, initializeDslEngine, resetDslEngine, isDslEngineReady } from './singleton';
export { parseDsl } from './dsl.parser';
export { highlightDsl } from './dsl.highlight';
export { executeDsl, executeAst } from './dsl.exec';
export { validateDslFormat } from './dsl.validator';
export { DslTools } from './dsl-tools';
export { normalizeDsl, dslFromScenarioContent, goalsFromContent } from './dsl-content-helpers';
export { DslScenarioBuilders } from './dsl-scenario-builders';
export * from './dsl.validate.db';
export * from './dsl.migrate.xml';
export { createExecContextFromDef } from './dsl.runtime';

// FUNC parser and expander
export {
  parseFuncDefinitions,
  expandFuncCalls,
  validateFuncCalls,
  getFuncNames,
  setGlobalFuncLibrary,
  getGlobalFuncLibrary,
  loadFuncLibraryFromSource
} from './dsl-func.parser';
export type { FuncDefinition, FuncStep, FuncLibrary } from './dsl-func.parser';

// DSL Registry (hybrid architecture)
export { DslRegistry } from './dsl-registry';
export { createRegistry, getGlobalRegistry, setGlobalRegistry, createHardwareRegistry } from './dsl-registry.presets';
export type {
  TaskHandler,
  ParamHandler,
  FuncHandler,
  CommandHandler,
  DslCommandType,
  ExecutionContext,
  ActionMapping,
  ParamMapping,
  FuncMapping,
  RegistryConfig
} from './dsl-registry.types';

// Timer service
export { dslTimerService } from './dsl-timer.service';
export type { TimerState as DslTimerState, TimerOptions } from './dsl-timer.service';
