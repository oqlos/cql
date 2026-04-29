// =============================================================================
// DSL REGISTRY - Hybrydowa architektura mapowania
// =============================================================================
//
// ZALETY:
// 1. Type-safe - mapowania w kodzie z TypeScript
// 2. Testowalne - unit tests dla każdego handlera
// 3. Wersjonowane - Git history
// 4. Rozszerzalne - MAP w bazie nadpisuje/rozszerza
// 5. Hot-reload - zmiany w bazie bez deploymentu
// 6. Przenośne - eksport/import konfiguracji
//
// UŻYCIE:
//   registry.registerTask('pompa 1', 'Włącz', handler);
//   registry.loadMapOverride(scenarioMap);  // z bazy
//   await registry.executeTask('Włącz', 'pompa 1');
//
// =============================================================================

import { showDslDialog, parseDialogOptions } from './dsl-dialog';

// Types extracted to dsl-registry.types.ts
import type {
  TaskHandler, ParamHandler, FuncHandler, ConditionHandler,
  DslCommandType, CommandHandler,
  ExecutionContext, TimerState,
  ActionMapping, ParamMapping, FuncMapping,
  GoalMeasurement, RegistryConfig,
  DslRegistryContext
} from './dsl-registry.types';
import type { IDslExecutor } from './dsl-contract';

// Extracted modules
import { createBuiltInCommands } from './dsl-registry.commands';
import { parseValue, executeFuncCode } from './dsl-registry.parsing';
import {
  toNumber, compare,
  executeMapping as executeMappingFn,
  executeFuncMapping as executeFuncMappingFn,
  executeOnBackend as executeOnBackendFn,
  type MappingDeps,
} from './dsl-registry.execution';

// =============================================================================
// CORE REGISTRY CLASS
// =============================================================================

export class DslRegistry implements IDslExecutor {
  // Core registries (code-based, type-safe)
  private taskHandlers = new Map<string, TaskHandler>();
  private paramHandlers = new Map<string, ParamHandler>();
  private funcHandlers = new Map<string, FuncHandler>();
  private conditionHandlers = new Map<string, ConditionHandler>();
  private commandHandlers = new Map<DslCommandType, CommandHandler>();

  // Action mappings (can be overridden by MAP)
  private actionMappings = new Map<string, ActionMapping>();
  private paramMappings = new Map<string, ParamMapping>();
  private funcMappings = new Map<string, FuncMapping>();

  // Runtime state
  private state = new Map<string, any>();
  private timers = new Map<string, TimerState>();
  private savedValues = new Map<string, any>();
  private errors: Array<{ type: string; message: string; timestamp: number }> = [];

  // Configuration
  private config: RegistryConfig;
  private mapOverride: Record<string, any> = {};

  // Context object for extracted modules (commands, parsing)
  private _dslContext: DslRegistryContext;

  // Mapping execution dependencies
  private _mappingDeps: MappingDeps;

  constructor(config: RegistryConfig = {}) {
    this.config = {
      backendUrl: '/api/v3/dsl',
      environment: 'browser',
      enableLogging: true,
      ...config,
    };

    // Build context for extracted modules
    this._dslContext = {
      state: this.state,
      log: (type, ...args) => this.log(type, ...args),
      delay: (ms) => this.delay(ms),
      parseTimeToMs: (v) => this.parseTimeToMs(v),
      readParam: (p) => this.readParam(p),
      executeTask: (a, o, v) => this.executeTask(a, o, v),
      executeFunc: (n) => this.executeFunc(n),
      executeCommand: (c, p) => this.executeCommand(c, p),
      executeDialog: (v, p) => this.executeDialog(v, p),
      pushError: (e) => this.errors.push(e),
      saveValue: (n, e) => this.savedValues.set(n, e),
    };

    this._mappingDeps = {
      backendUrl: this.config.backendUrl!,
      executeTask: (a, o, v) => this.executeTask(a, o, v),
    };

    // Register built-in command handlers
    this.commandHandlers = createBuiltInCommands(this._dslContext);
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Build measurements array for report from __outputs
   * Combines VAL, MAX, MIN into single measurement row
   */
  buildMeasurements(): GoalMeasurement[] {
    const outputs: Array<{ type: string; name: string; isLiteral?: boolean }> = this.state.get('__outputs') || [];
    const result = this.state.get('__result') || 'N/A';
    
    // Group by VAL - each VAL starts a new measurement row
    const measurements: GoalMeasurement[] = [];
    let currentMeasurement: GoalMeasurement | null = null;
    
    for (const out of outputs) {
      if (out.type === 'VAL') {
        // Save previous and start new
        if (currentMeasurement) measurements.push(currentMeasurement);
        
        const val = this.state.get(`${out.name}_result`) ?? this.state.get(out.name);
        currentMeasurement = {
          param_name: out.name,
          measured_value: val ?? '—',
          unit: '',
          min_value: null,
          max_value: null,
          result: result
        };
      } else if (out.type === 'MAX' && currentMeasurement) {
        currentMeasurement.max_value = this.state.get(`${out.name}_max`) ?? this.state.get(out.name);
      } else if (out.type === 'MIN' && currentMeasurement) {
        currentMeasurement.min_value = this.state.get(`${out.name}_min`) ?? this.state.get(out.name);
      } else if (out.type === 'RESULT') {
        // Update result for current measurement
        if (currentMeasurement) {
          currentMeasurement.result = out.isLiteral ? out.name : (this.state.get(out.name) ?? out.name);
        }
      }
    }
    
    // Don't forget last measurement
    if (currentMeasurement) measurements.push(currentMeasurement);
    
    return measurements;
  }

  /**
   * Clear outputs for next GOAL
   */
  clearOutputs(): void {
    this.state.delete('__outputs');
    this.state.delete('__result');
  }

  /**
   * Get current result status
   */
  getResult(): string {
    return this.state.get('__result') || 'N/A';
  }
  
  private parseTimeToMs(value: string): number {
    const match = value.match(/^([\d.]+)\s*(s|ms|sec|min)?$/i);
    if (!match) return 0;
    const num = parseFloat(match[1]);
    const unit = (match[2] || 's').toLowerCase();
    if (unit === 'ms') return num;
    if (unit === 'min') return num * 60000;
    return num * 1000;
  }

  // ===========================================================================
  // REGISTRATION METHODS (compile-time, type-safe)
  // ===========================================================================

  /**
   * Register task handler
   * @example registry.registerTask('pompa 1', 'Włącz', async () => { ... })
   */
  registerTask(object: string, action: string, handler: TaskHandler): this {
    const key = this.taskKey(object, action);
    this.taskHandlers.set(key, handler);
    return this;
  }

  /**
   * Register task mapping (declarative)
   * @example registry.registerTaskMapping('pompa 1', 'Włącz', { kind: 'api', url: '/pump/on' })
   */
  registerTaskMapping(object: string, action: string, mapping: ActionMapping): this {
    const key = this.taskKey(object, action);
    this.actionMappings.set(key, mapping);
    return this;
  }

  /**
   * Register param handler
   * @example registry.registerParam('ciśnienie', async () => sensor.read('AI01'))
   */
  registerParam(param: string, handler: ParamHandler): this {
    this.paramHandlers.set(param, handler);
    return this;
  }

  /**
   * Register param mapping
   */
  registerParamMapping(param: string, mapping: ParamMapping): this {
    this.paramMappings.set(param, mapping);
    return this;
  }

  /**
   * Register FUNC handler
   * @example registry.registerFunc('Odpowietrzenie', async (name, ctx) => { ... })
   */
  registerFunc(name: string, handler: FuncHandler): this {
    this.funcHandlers.set(name, handler);
    return this;
  }

  /**
   * Register FUNC mapping (sequence)
   */
  registerFuncMapping(name: string, mapping: FuncMapping): this {
    this.funcMappings.set(name, mapping);
    return this;
  }

  /**
   * Register condition evaluator
   */
  registerCondition(name: string, handler: ConditionHandler): this {
    this.conditionHandlers.set(name, handler);
    return this;
  }

  /**
   * Register custom command handler (override built-in or add new)
   * @example registry.registerCommand('ALARM', async (cmd, param, ctx) => { ... })
   */
  registerCommand(command: DslCommandType, handler: CommandHandler): this {
    this.commandHandlers.set(command, handler);
    return this;
  }

  // ===========================================================================
  // COMMAND EXECUTION (ALARM, ERROR, SAVE, etc.)
  // ===========================================================================

  /**
   * Execute DSL command: ALARM, ERROR, SAVE, WAIT, LOG, STOP, PAUSE
   * These are executed like TASK but with built-in handlers
   * 
   * @example await registry.executeCommand('ALARM', 'Sprawdź pompę')
   * @example await registry.executeCommand('SAVE', 'ciśnienie')
   */
  async executeCommand(command: string, param: string): Promise<any> {
    const cmd = command.toUpperCase() as DslCommandType;
    this.log('CMD', `${cmd} [${param}]`);

    const handler = this.commandHandlers.get(cmd);
    if (handler) {
      return handler(cmd, param, this.getContext());
    }

    // Fallback to backend
    return this.executeOnBackend(cmd, { param });
  }

  /**
   * Get saved values from SAVE commands
   */
  getSavedValues(): Map<string, any> {
    return new Map(this.savedValues);
  }

  /**
   * Get saved value by name
   */
  getSavedValue(name: string): any {
    return this.savedValues.get(name)?.value;
  }

  /**
   * Get all errors/alarms
   */
  getErrors(): Array<{ type: string; message: string; timestamp: number }> {
    return [...this.errors];
  }

  /**
   * Clear errors
   */
  clearErrors(): void {
    this.errors = [];
  }

  // ===========================================================================
  // MAP OVERRIDE (runtime, from database)
  // ===========================================================================

  /**
   * Load MAP override from database/scenario
   * This allows runtime customization without code changes
   */
  loadMapOverride(map: Record<string, any>): this {
    this.mapOverride = map || {};
    this.log('MAP override loaded', Object.keys(map || {}));
    return this;
  }

  /**
   * Clear MAP override
   */
  clearMapOverride(): this {
    this.mapOverride = {};
    return this;
  }

  /**
   * Export current configuration (for portability)
   */
  exportConfig(): Record<string, any> {
    return {
      version: '1.0',
      timestamp: new Date().toISOString(),
      tasks: Object.fromEntries(this.actionMappings),
      params: Object.fromEntries(this.paramMappings),
      funcs: Object.fromEntries(this.funcMappings),
      mapOverride: this.mapOverride,
    };
  }

  /**
   * Import configuration
   */
  importConfig(config: Record<string, any>): this {
    if (config.tasks) {
      for (const [key, mapping] of Object.entries(config.tasks)) {
        this.actionMappings.set(key, mapping as ActionMapping);
      }
    }
    if (config.params) {
      for (const [key, mapping] of Object.entries(config.params)) {
        this.paramMappings.set(key, mapping as ParamMapping);
      }
    }
    if (config.funcs) {
      for (const [key, mapping] of Object.entries(config.funcs)) {
        this.funcMappings.set(key, mapping as FuncMapping);
      }
    }
    if (config.mapOverride) {
      this.mapOverride = config.mapOverride;
    }
    return this;
  }

  // ===========================================================================
  // EXECUTION METHODS
  // ===========================================================================

  /**
   * Execute TASK [action] [object]
   * Priority: 1. MAP override → 2. Handler → 3. Mapping → 4. Backend
   */
  async executeTask(action: string, object: string, value?: string): Promise<any> {
    const key = this.taskKey(object, action);
    this.log('TASK', `[${action}] [${object}]`, value);

    // 1. Check MAP override
    const override = this.getMapOverride('objectActionMap', object, action);
    if (override) {
      return executeMappingFn(override as ActionMapping, { action, object, value }, this._mappingDeps);
    }

    // 2. Check registered handler
    const handler = this.taskHandlers.get(key);
    if (handler) {
      return handler(action, object, value);
    }

    // 3. Check registered mapping
    const mapping = this.actionMappings.get(key);
    if (mapping) {
      return executeMappingFn(mapping, { action, object, value }, this._mappingDeps);
    }

    // 4. Fallback to backend
    return this.executeOnBackend('TASK', { action, object, value });
  }

  /**
   * Read VAL [param]
   */
  async readParam(param: string): Promise<number | null> {
    this.log('VAL', `[${param}]`);

    // 1. Check MAP override
    const override = this.getMapOverride('paramSensorMap', param);
    if (override) {
      const result = await executeMappingFn(override as ParamMapping, { param }, this._mappingDeps);
      return toNumber(result);
    }

    // 2. Check registered handler
    const handler = this.paramHandlers.get(param);
    if (handler) {
      return handler(param);
    }

    // 3. Check registered mapping
    const mapping = this.paramMappings.get(param);
    if (mapping) {
      const result = await executeMappingFn(mapping, { param }, this._mappingDeps);
      return toNumber(result);
    }

    // 4. Fallback to backend
    const result = await this.executeOnBackend('VAL', { param });
    return toNumber(result?.result);
  }

  /**
   * Execute FUNC: [name]
   */
  async executeFunc(name: string): Promise<any> {
    this.log('FUNC', name);
    const context = this.getContext();

    // 1. Check MAP override
    const override = this.getMapOverride('funcImplementations', name);
    if (override) {
      return executeFuncMappingFn(override as FuncMapping, context, this._mappingDeps);
    }

    // 2. Check registered handler
    const handler = this.funcHandlers.get(name);
    if (handler) {
      return handler(name, context);
    }

    // 3. Check registered mapping
    const mapping = this.funcMappings.get(name);
    if (mapping) {
      return executeFuncMappingFn(mapping, context, this._mappingDeps);
    }

    // 4. Check DEF library funcs (code-based FUNC definitions)
    const defLibrary = (globalThis as any).__scenarioDefLibrary;
    if (defLibrary?.funcs) {
      const funcDef = defLibrary.funcs.find((f: any) => f.name === name);
      if (funcDef?.code) {
        this.log('FUNC', `Executing DEF-based FUNC: ${name}`);
        return executeFuncCode(funcDef.code, this._dslContext);
      }
    }

    // 5. Fallback to backend
    return this.executeOnBackend('FUNC', { name });
  }



  /**
   * Execute DIALOG command - show options and let user select
   * Options are read from variable (semicolon-separated), result is saved back
   */
  async executeDialog(varName: string, prompt: string): Promise<string | null> {
    this.log('DIALOG', `${varName}: ${prompt}`);
    
    const options = parseDialogOptions(this.state.get(varName));
    
    const result = await showDslDialog({
      prompt,
      options,
      onLog: (msg) => this.log('DIALOG', msg)
    });
    
    if (result !== null) {
      this.state.set(varName, result);
    }
    
    return result;
  }

  /**
   * Evaluate condition: IF [left] [op] [right]
   */
  async evaluateCondition(left: string, operator: string, right: string): Promise<boolean> {
    // Get left value
    let leftVal: any;
    
    // Check condition handler
    const handler = this.conditionHandlers.get(left);
    if (handler) {
      leftVal = await handler(left);
    } else if (this.state.has(left)) {
      leftVal = this.state.get(left);
    } else if (this.timers.has(left)) {
      leftVal = this.getTimerElapsedSec(left);
    } else {
      leftVal = await this.readParam(left);
    }

    // Parse right value
    const rightVal = parseValue(right);

    // Compare
    return compare(leftVal, operator, rightVal);
  }

  // ===========================================================================
  // TIMER METHODS
  // ===========================================================================

  timerStart(name: string, mode: 'stopwatch' | 'countdown' = 'stopwatch', durationMs: number = 0): void {
    this.timers.set(name, {
      name,
      mode,
      startTime: performance.now(),
      duration: durationMs,
      elapsed: 0,
      running: true,
    });
  }

  timerStop(name: string): number {
    const timer = this.timers.get(name);
    if (timer && timer.running) {
      timer.elapsed += performance.now() - timer.startTime;
      timer.running = false;
    }
    return timer?.elapsed || 0;
  }

  getTimerElapsedMs(name: string): number {
    const timer = this.timers.get(name);
    if (!timer) return 0;
    if (timer.running) {
      return timer.elapsed + (performance.now() - timer.startTime);
    }
    return timer.elapsed;
  }

  getTimerElapsedSec(name: string): number {
    return this.getTimerElapsedMs(name) / 1000;
  }

  getTimerRemainingMs(name: string): number {
    const timer = this.timers.get(name);
    if (!timer || timer.mode !== 'countdown') return 0;
    return Math.max(0, timer.duration - this.getTimerElapsedMs(name));
  }

  isTimerExpired(name: string): boolean {
    return this.getTimerRemainingMs(name) <= 0;
  }

  // ===========================================================================
  // STATE METHODS
  // ===========================================================================

  setState(name: string, value: any): void {
    this.state.set(name, value);
  }

  getState(name: string): any {
    return this.state.get(name);
  }

  clearState(): void {
    this.state.clear();
    this.timers.clear();
  }

  getContext(): ExecutionContext {
    return {
      state: this.state,
      timers: this.timers,
      registry: this,
    };
  }

  // ===========================================================================
  // PRIVATE HELPERS
  // ===========================================================================

  private taskKey(object: string, action: string): string {
    return `${object}::${action}`;
  }

  private getMapOverride(...path: string[]): ActionMapping | ParamMapping | FuncMapping | null {
    let obj: any = this.mapOverride;
    for (const key of path) {
      obj = obj?.[key];
      if (!obj) return null;
    }
    return obj;
  }

  private async executeOnBackend(command: string, params: Record<string, any>): Promise<any> {
    return executeOnBackendFn(this.config.backendUrl!, command, params);
  }

  private log(_type: string, ..._args: any[]): void {
    if (this.config.enableLogging) {

    }
  }

  /** IDslExecutor contract – routes to executeTask() */
  async execute(command: string, args?: Record<string, unknown>): Promise<unknown> {
    const action = command;
    const object = (args?.object as string) ?? '';
    const value = args?.value !== undefined ? String(args.value) : undefined;
    return this.executeTask(action, object, value);
  }
}

export default DslRegistry;
