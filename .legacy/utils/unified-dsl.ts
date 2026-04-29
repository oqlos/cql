import { logger } from './logger';
import { getDslIcon, getTypeIcon } from './dsl/icons';
import { fetchWithAuth } from './fetch.utils';

// frontend/src/utils/unified-dsl.ts
/**
 * Unified DSL - Single format for browser logs AND CLI execution
 * 
 * Goals:
 * 1. Browser logs output DSL that can be copy-pasted to CLI
 * 2. CLI can parse browser-generated DSL and execute API parts
 * 3. Browser can replay CLI-generated DSL
 * 
 * Format: ICON ACTION "target" {params} -> result
 * 
 * Command Types:
 * - UNIVERSAL: Works in both CLI and Browser (API, LOG, WAIT, ASSERT_*)
 * - BROWSER: Browser-only (NAVIGATE, CLICK, SELECT, INPUT)
 * - SEMANTIC: High-level actions (SELECT_DEVICE, START_TEST, etc.)
 * 
 * Replay Capability:
 * - Logs can be exported and replayed via dsl.replay(script)
 * - Browser commands are replayed in browser
 * - API commands can be replayed via CLI
 */

export type DslCommandType = 'universal' | 'browser' | 'semantic';

export interface UnifiedDslCommand {
  type: DslCommandType;
  action: string;
  target: string;
  params: Record<string, any>;
  result?: string;
  duration?: number;
  timestamp?: string;
  correlationId?: string;
}

// Command classification
const COMMAND_TYPES: Record<string, DslCommandType> = {
  // Universal - works everywhere
  'API': 'universal',
  'LOG': 'universal',
  'WAIT': 'universal',
  'ASSERT_STATUS': 'universal',
  'ASSERT_JSON': 'universal',
  'STORE': 'universal',
  'PRINT': 'universal',
  'ENV': 'universal',
  'SET_HEADER': 'universal',
  'SET_BASE_URL': 'universal',
  
  // Browser-only
  'NAVIGATE': 'browser',
  'CLICK': 'browser',
  'SELECT': 'browser',
  'INPUT': 'browser',
  'SUBMIT': 'browser',
  
  // Semantic - Test workflow
  'SELECT_DEVICE': 'semantic',
  'SELECT_INTERVAL': 'semantic',
  'START_TEST': 'semantic',
  'STEP_COMPLETE': 'semantic',
  'PROTOCOL_CREATED': 'semantic',
  'PROTOCOL_FINALIZE': 'semantic',
  'OPEN_INTERVAL_DIALOG': 'semantic',
  'TEST_RUN_PARAMS': 'semantic',
  
  // Semantic - App lifecycle
  'APP_START': 'semantic',
  'APP_INIT': 'semantic',
  'APP_READY': 'semantic',
  'APP_ERROR': 'semantic',
  
  // Semantic - Module lifecycle
  'MODULE_LOAD': 'semantic',
  'MODULE_READY': 'semantic',
  'MODULE_ERROR': 'semantic',
  
  // Semantic - Page lifecycle
  'PAGE_SETUP': 'semantic',
  'PAGE_ERROR': 'semantic',
  'PAGE_RENDER': 'semantic',
  
  // Semantic - Report actions
  'REPORT_AUTOOPEN': 'semantic',
  'REPORT_FETCH': 'semantic',
  'REPORT_OPEN': 'semantic',
  'REPORT_ERROR': 'semantic',
  'REPORT_PRINT': 'semantic',
  'REPORT_LIST': 'semantic',
  
  // Semantic - Protocol operations
  'PROTOCOL_FETCH': 'semantic',
  'PROTOCOL_LOAD': 'semantic',
  'PROTOCOL_PARSE': 'semantic',
  'PROTOCOL_NORMALIZE': 'semantic',
  'PROTOCOL_FILTER': 'semantic',
  'PROTOCOL_ERROR': 'semantic',
};

class UnifiedDslLogger {
  private buffer: UnifiedDslCommand[] = [];
  private readonly maxBuffer = 500;
  private correlationId: string;
  constructor() {
    this.correlationId = this.generateCorrelationId();
    this.exposeGlobally();
  }

  private generateCorrelationId(): string {
    return `dsl-${Date.now().toString(36)}`;
  }

  private exposeGlobally(): void {
    if (typeof globalThis !== 'undefined') {
      (globalThis as any).dsl = {
        // Logging
        log: this.log.bind(this),
        api: this.api.bind(this),
        
        // Control
        start: this.startRecording.bind(this),
        stop: this.stopRecording.bind(this),
        
        // Export
        export: this.exportScript.bind(this),
        exportForCli: this.exportForCli.bind(this),
        exportSimple: this.exportSimple.bind(this),
        copy: this.copyToClipboard.bind(this),
        download: this.download.bind(this),
        
        // Replay
        replay: this.replay.bind(this),
        
        // Utils
        clear: this.clear.bind(this),
        show: this.show.bind(this),
        help: this.showHelp.bind(this),
        getBuffer: this.getBuffer.bind(this),
      };
    }
  }

  /**
   * Log a DSL command
   */
  log(action: string, target: string, params: Record<string, any> = {}, result?: string): void {
    const type = COMMAND_TYPES[action.toUpperCase()] || 'semantic';
    
    const cmd: UnifiedDslCommand = {
      type,
      action: action.toUpperCase(),
      target,
      params,
      result,
      timestamp: new Date().toISOString(),
      correlationId: this.correlationId,
    };

    this.buffer.push(cmd);
    if (this.buffer.length > this.maxBuffer) {
      this.buffer.shift();
    }

    this.printCommand(cmd);
  }

  /**
   * Log API call with automatic extraction of request details
   */
  api(method: string, url: string, body?: any, result?: any): void {
    const params: Record<string, any> = { method: method.toUpperCase() };
    if (body) params.body = body;
    
    this.log('API', url, params, result ? JSON.stringify(result).slice(0, 100) : undefined);
  }

  /**
   * Print command to console in DSL format
   * Format: TYPE_ICON ACTION_ICON ACTION "target" {params} -> result
   */
  private printCommand(cmd: UnifiedDslCommand): void {
    const actionIcon = getDslIcon(cmd.action);
    const typeIcon = getTypeIcon(cmd.type);
    const paramsStr = Object.keys(cmd.params).length > 0 
      ? ` ${JSON.stringify(cmd.params)}` 
      : '';
    const resultStr = cmd.result ? ` -> ${cmd.result}` : '';
    
    // Format: 📋 🚀 ACTION "target" {params} -> result
    logger.dsl(
      `${typeIcon} ${actionIcon} ${cmd.action} "${cmd.target}"${paramsStr}${resultStr}`
    );
  }

  /**
   * Convert command to DSL line
   */
  private commandToLine(cmd: UnifiedDslCommand): string {
    const params = Object.keys(cmd.params).length > 0 
      ? ` ${JSON.stringify(cmd.params)}` 
      : '';
    const result = cmd.result ? ` -> ${cmd.result}` : '';
    return `${cmd.action} "${cmd.target}"${params}${result}`;
  }

  /**
   * Start recording session
   */
  startRecording(description?: string): void {
    this.correlationId = this.generateCorrelationId();
    this.buffer = [];
    
    this.log('SESSION_START', this.correlationId, { description: description || 'Recording session' });
    
    logger.debug('%c🎬 DSL Recording started', 'color: #E91E63; font-weight: bold');
  }

  /**
   * Stop recording
   */
  stopRecording(): void {
    this.log('SESSION_END', this.correlationId, { 
      commands: this.buffer.length,
      duration: Date.now() 
    });
    
    logger.debug('%c🛑 DSL Recording stopped', 'color: #E91E63; font-weight: bold');
  }

  /**
   * Export full script (all commands)
   */
  exportScript(): string {
    const lines: string[] = [
      `# DSL Session Log`,
      `# Correlation ID: ${this.correlationId}`,
      `# Commands: ${this.buffer.length}`,
      `# Generated: ${new Date().toISOString()}`,
      `#`,
      `# Run in CLI: python3 scripts/dsl-cli.py <file> -u http://localhost:8101`,
      `# Replay in browser: dsl.replay(script)`,
      ``,
    ];

    for (const cmd of this.buffer) {
      const prefix = cmd.type === 'browser' ? '# [BROWSER] ' : '';
      lines.push(prefix + this.commandToLine(cmd));
    }

    const script = lines.join('\n');
    logger.debug('%c📜 DSL Script:', 'color: #4CAF50; font-weight: bold');
    logger.debug(script);
    return script;
  }

  /**
   * Export CLI-compatible script (skips browser-only commands)
   */
  exportForCli(): string {
    const lines: string[] = [
      `# DSL Script (CLI Compatible)`,
      `# Generated: ${new Date().toISOString()}`,
      `#`,
      `# Run: ./scripts/dsl-run.sh <file> -u http://localhost:8101`,
      ``,
    ];

    for (const cmd of this.buffer) {
      if (cmd.type === 'universal') {
        lines.push(this.commandToSimple(cmd));
      } else {
        // Comment out browser/semantic commands
        lines.push(`# [${cmd.type.toUpperCase()}] ${this.commandToSimple(cmd)}`);
      }
    }

    const script = lines.join('\n');
    logger.debug('%c📜 CLI Script:', 'color: #4CAF50; font-weight: bold');
    logger.debug(script);
    return script;
  }

  /**
   * Export in simple format (no JSON, easy to read/edit)
   */
  exportSimple(): string {
    const lines: string[] = [
      `# DSL Script (Simple Format)`,
      `# Generated: ${new Date().toISOString()}`,
      `# Commands: ${this.buffer.length}`,
      `#`,
      `# Browser: await dslRun(script)`,
      `# Shell:   ./scripts/dsl-run.sh script.dsl`,
      ``,
    ];

    for (const cmd of this.buffer) {
      // Skip internal logs
      if (['LOG', 'DEBUG'].includes(cmd.action)) continue;
      lines.push(this.commandToSimple(cmd));
    }

    const script = lines.join('\n');
    logger.debug('%c📜 Simple Script:', 'color: #4CAF50; font-weight: bold');
    logger.debug(script);
    return script;
  }

  /**
   * Convert command to simple format: COMMAND target key=value
   */
  private commandToSimple(cmd: UnifiedDslCommand): string {
    let result = cmd.action;
    
    // Add target
    if (cmd.target) {
      result += cmd.target.includes(' ') ? ` "${cmd.target}"` : ` ${cmd.target}`;
    }
    
    // Add params as key=value
    for (const [key, value] of Object.entries(cmd.params)) {
      if (value === undefined || value === null) continue;
      const strValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
      if (strValue.includes(' ') || strValue.startsWith('{')) {
        result += strValue.startsWith('{') ? ` ${key}='${strValue}'` : ` ${key}="${strValue}"`;
      } else {
        result += ` ${key}=${strValue}`;
      }
    }
    
    return result;
  }

  /**
   * Copy to clipboard
   */
  async copyToClipboard(cliOnly = false): Promise<void> {
    const script = cliOnly ? this.exportForCli() : this.exportScript();
    try {
      await navigator.clipboard.writeText(script);
      logger.debug('%c📋 Copied to clipboard!', 'color: #4CAF50; font-weight: bold');
    } catch (err) {
      logger.error('Failed to copy:', err);
    }
  }

  /**
   * Download as file
   */
  download(filename?: string, cliOnly = false): void {
    const script = cliOnly ? this.exportForCli() : this.exportScript();
    const name = filename || `dsl-${this.correlationId}.dsl`;
    
    const blob = new Blob([script], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
    
    logger.debug(`%c📥 Downloaded: ${name}`, 'color: #4CAF50; font-weight: bold');
  }

  /**
   * Clear buffer
   */
  clear(): void {
    this.buffer = [];
    this.correlationId = this.generateCorrelationId();
    logger.debug('%c🗑️ DSL buffer cleared', 'color: #888');
  }

  /**
   * Show recent commands
   */
  show(last = 20): void {
    logger.debug(`%c📋 Last ${last} DSL commands:`, 'color: #4CAF50; font-weight: bold');
    this.buffer.slice(-last).forEach(cmd => this.printCommand(cmd));
  }

  /**
   * Show help
   */
  showHelp(): void {
    logger.debug(`
%c📚 Unified DSL Help
%c====================

%cLogging:%c
  dsl.log("ACTION", "target", {params})   - Log any action
  dsl.api("GET", "/api/...", body)        - Log API call

%cRecording:%c
  dsl.start("description")    - Start recording
  dsl.stop()                  - Stop recording

%cExport:%c
  dsl.export()                - Export full script (unified format)
  dsl.exportSimple()          - Export simple format (key=value)
  dsl.exportForCli()          - Export CLI-compatible only
  dsl.copy()                  - Copy to clipboard
  dsl.download("name.dsl")    - Download as file

%cReplay:%c
  dsl.replay(script)          - Replay DSL script in browser
  await dslRun(script)        - Run simple format script

%cSimple Format:%c
  NAVIGATE /connect-manager
  CLICK #start-btn label="Start"
  INPUT #name value="Test"
  WAIT 500
  API GET /api/devices

%cShell Usage:%c
  ./scripts/dsl-run.sh script.dsl
  echo "API GET /api/devices" | ./scripts/dsl-run.sh -
`,
      'color: #4CAF50; font-weight: bold; font-size: 14px',
      'color: #888',
      'color: #2196F3; font-weight: bold', 'color: inherit',
      'color: #2196F3; font-weight: bold', 'color: inherit',
      'color: #2196F3; font-weight: bold', 'color: inherit',
      'color: #2196F3; font-weight: bold', 'color: inherit',
      'color: #2196F3; font-weight: bold', 'color: inherit',
      'color: #2196F3; font-weight: bold', 'color: inherit'
    );
  }

  /**
   * Get buffer for external access
   */
  getBuffer(): UnifiedDslCommand[] {
    return [...this.buffer];
  }

  /**
   * Replay a DSL script (execute browser commands)
   */
  async replay(script: string, options: { delay?: number; stopOnError?: boolean } = {}): Promise<void> {
    const lines = script.split('\n')
      .map(l => l.trim())
      .filter(l => l && !l.startsWith('#') && !l.startsWith('//'));

    const delay = options.delay ?? 100;
    logger.debug(`%c▶️ Replaying ${lines.length} DSL commands...`, 'color: #4CAF50; font-weight: bold');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      try {
        await this.executeCommand(line, i + 1);
        logger.debug(`%c✅ [${i + 1}/${lines.length}] ${line}`, 'color: #4CAF50');
      } catch (err: any) {
        logger.debug(`%c❌ [${i + 1}/${lines.length}] ${line} - ${err?.message}`, 'color: #f44336');
        if (options.stopOnError !== false) {
          logger.debug('%c⛔ Replay stopped on error', 'color: #f44336');
          return;
        }
      }
      if (delay > 0 && i < lines.length - 1) {
        await new Promise(r => setTimeout(r, delay));
      }
    }

    logger.debug('%c✅ Replay complete', 'color: #4CAF50; font-weight: bold');
  }

  /**
   * Execute a single DSL command
   */
  private async executeCommand(line: string, lineNum?: number): Promise<void> {
    // Parse: ACTION "target" { params } -> result
    const match = /^(?:\S+\s+)?(\w+)\s+"([^"]+)"(?:\s+(\{[^}]*\}))?/.exec(line);
    if (!match) {
      throw new Error(`Cannot parse line ${lineNum ?? '?'}: "${line}" — expected: ACTION "target" {params}`);
    }

    const [, action, target, paramsStr] = match;
    const params = paramsStr ? JSON.parse(paramsStr) : {};

    const handler = this.getCommandHandler(action.toUpperCase());
    if (handler) {
      await handler(target, params);
    } else {
      logger.debug(`%c⚠️ Skipping unknown action: ${action}`, 'color: #FF9800');
    }
  }

  private getCommandHandler(action: string): ((target: string, params: any) => Promise<void>) | null {
    const handlers: Record<string, (target: string, params: any) => Promise<void>> = {
      'NAVIGATE': async (target) => this.handleNavigate(target),
      'CLICK': async (target) => this.handleClick(target),
      'INPUT': async (target, params) => this.handleInput(target, params),
      'SELECT': async (target, params) => this.handleSelect(target, params),
      'WAIT': async (target) => this.handleWait(target),
      'DISPATCH': async (target, params) => this.handleDispatch(target, params),
      'API': async (target, params) => this.handleApi(target, params),
      'MODULE_LOAD': async () => { /* informational */ },
      'PAGE_RENDER': async () => { /* informational */ },
      'APP_INIT': async () => { /* informational */ },
    };
    return handlers[action] || null;
  }

  private async handleNavigate(target: string): Promise<void> {
    globalThis.history.pushState({}, '', target);
    globalThis.dispatchEvent(new CustomEvent('routeChanged', { detail: { route: target } }));
  }

  private async handleClick(target: string): Promise<void> {
    const el = document.querySelector(target);
    if (!el) throw new Error(`Element not found: ${target}`);
    (el as HTMLElement).click();
  }

  private async handleInput(target: string, params: any): Promise<void> {
    const input = document.querySelector(target) as HTMLInputElement;
    if (!input) throw new Error(`Input not found: ${target}`);
    input.value = params.value || '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  private async handleSelect(target: string, params: any): Promise<void> {
    const select = document.querySelector(target) as HTMLSelectElement;
    if (!select) throw new Error(`Select not found: ${target}`);
    select.value = params.value || '';
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }

  private async handleWait(target: string): Promise<void> {
    await new Promise(r => setTimeout(r, Number.parseInt(target, 10) || 1000));
  }

  private async handleDispatch(target: string, params: any): Promise<void> {
    globalThis.dispatchEvent(new CustomEvent(target, { detail: params }));
  }

  private async handleApi(target: string, params: any): Promise<void> {
    const method = params.method || 'GET';
    const body = params.body ? JSON.stringify(params.body) : undefined;
    const resp = await fetchWithAuth(target, {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body
    });
    if (!resp.ok) throw new Error(`API ${method} ${target} failed: ${resp.status}`);
  }
}

export const unifiedDsl = new UnifiedDslLogger();

// Auto-initialize
if (typeof window !== 'undefined') {
  logger.dsl('🔧 Unified DSL ready - type dsl.help() for usage');
}
