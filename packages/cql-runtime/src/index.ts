/**
 * @oqlos/cql-runtime — public surface for browser bundles and Node services.
 * Flat OQL v5: @semcod/oqlts (canonical). Legacy block DSL: ../../runtime/.
 */
export {
  parseOql,
  validateOql,
  simulateOql,
  compileOqlHuiProgram,
  migrateOqlToV5,
  migrateDslToV5,
  buildOqlV5,
  buildOqlV5FromGenericScenario,
  buildOqlV5FromTestScenario,
  goalBlockHeader,
  funcBlockHeader,
  scenarioDocumentHeader,
} from '@semcod/oqlts';
export type {
  OqlParseResult,
  OqlValidationResult,
  SimulationResult,
  OqlCommand,
  OqlScenario,
  OqlHuiProgram,
} from '@semcod/oqlts';
export { parseDsl } from '../../../runtime/dsl.parser.ts';
export { executeDsl, executeAst } from '../../../runtime/dsl.exec.ts';
export { validateDslFormat, DefaultRules } from '../../../runtime/dsl.validator.ts';
export { highlightDsl } from '../../../runtime/dsl.highlight.ts';
export { astToDslText, normalizeDslText } from '../../../runtime/dsl.serialize.text.ts';
export { DslScenarioBuilders } from '../../../runtime/dsl-scenario-builders.ts';
export {
  quoteDslValue,
  formatDslLiteral,
  readQuotedToken,
  canonicalizeDslQuotes,
  normalizeDslTextQuotes,
  normalizeDslLineQuotes,
  canonicalizeDslLineQuotes,
} from '../../../runtime/dsl.quotes.ts';
export type {
  DslAst,
  DslStep,
  ParseResult,
  ExecResult,
  ExecPlanStep,
  ExecContext,
} from '../../../runtime/dsl.types.ts';
export {
  applyMappingToExecPlan,
  executeMappedDsl,
  extractCommandPayload,
  normalizePeripheralId,
  resolveBuiltinMotorTask,
  resolveFuncSteps,
  resolveTaskMapping,
} from '../../../runtime/dsl.mapping.ts';
export type { HardwareMap, MappingResolveContext } from '../../../runtime/dsl.mapping.ts';
