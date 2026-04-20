// frontend/src/components/dsl-log/logger.ts

import { fetchWithAuth } from '../../utils/fetch.utils';

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  source?: string;
}

export class DslLogger {
  private readonly element: HTMLElement;
  private logs: LogEntry[] = [];
  private readonly maxLogs: number = 1000;
  private stream: EventSource | null = null;
  private pollTimer: any = null;
  private lastPollCount: number = 0;

  constructor(elementOrSelector: HTMLElement | string, options?: { maxLogs?: number }) {
    if (typeof elementOrSelector === 'string') {
      const el = document.querySelector(elementOrSelector) as HTMLElement;
      if (!el) throw new Error(`DSL Logger: Element not found: ${elementOrSelector}`);
      this.element = el;
    } else {
      this.element = elementOrSelector;
    }

    if (options && options.maxLogs) {
      this.maxLogs = options.maxLogs;
    }

    // Initialize with proper structure
    if (!this.element.classList.contains('logs-wrap')) {
      this.element.classList.add('logs-wrap');
    }
    
    if (!this.element.querySelector('pre')) {
      this.element.innerHTML = '<pre class="mono" style="margin:0;padding:8px;background:#111;color:#eee;height:180px;overflow:auto;"></pre>';
    }
  }

  log(message: string, level: LogLevel = 'info', source?: string): void {
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      source
    };

    this.logs.push(entry);
    
    // Trim logs if exceeding max
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    this.appendToElement(this.formatLogEntry(entry));
  }

  info(message: string, source?: string): void {
    this.log(message, 'info', source);
  }

  warn(message: string, source?: string): void {
    this.log(message, 'warn', source);
  }

  error(message: string, source?: string): void {
    this.log(message, 'error', source);
  }

  debug(message: string, source?: string): void {
    this.log(message, 'debug', source);
  }

  // Compatibility shim for older code paths
  setLogLevel(_level: LogLevel): void {
    // no-op; could store a threshold and filter in log() if needed
  }

  clear(): void {
    this.logs = [];
    const pre = this.element.querySelector('pre');
    if (pre) {
      pre.textContent = '';
    }
  }

  connectStream(baseUrl: string, scenarioId?: string, executionId?: string): void {
    this.disconnectStream();
    
    try {
      const url = new URL(`${baseUrl}/api/v1/execution/logs/stream`);
      if (scenarioId) url.searchParams.set('scenario', scenarioId);
      if (executionId) {
        url.searchParams.set('executionId', executionId);
        url.searchParams.set('id', executionId);
      }

      this.info(`🔗 Connected to logs stream for scenario: ${scenarioId || 'all'}`);
      
      const es = new EventSource(url.toString());
      this.stream = es;

      es.onopen = () => {
        this.info(`ℹ️ logs-sse connected: ${url.toString()}`);
      };

      es.onmessage = (ev: MessageEvent) => {
        try {
          // Accept both plain text and JSON {message}
          if (typeof ev.data === 'string') {
            try {
              const js = JSON.parse(ev.data);
              if (js && js.message) {
                this.info(js.message);
                return;
              }
            } catch { /* silent */ }
            this.info(String(ev.data));
          }
        } catch (e: any) {
          this.error(`Log parsing error: ${String(e)}`);
        }
      };

      es.onerror = () => {
        this.disconnectStream();
        this.warn('ℹ️ logs-sse closed; switching to polling');
        this.startPolling(baseUrl, executionId);
      };
    } catch (e: any) {
      this.error(`Stream connection error: ${String(e)}`);
      this.startPolling(baseUrl, executionId);
    }
  }

  private startPolling(baseUrl: string, executionId?: string): void {
    this.stopPolling();
    
    let announced = false;
    const poll = () => {
      try {
        const endpoints = [
          `${baseUrl}/api/v1/execution/logs${executionId ? `?executionId=${encodeURIComponent(executionId)}` : ''}`,
          `${baseUrl}/api/v1/execution/status${executionId ? `?executionId=${encodeURIComponent(executionId)}` : ''}`
        ];
        
        if (!announced) {
          this.info(`ℹ️ logs-poll: ${endpoints.join(' | ')}`);
          announced = true;
        }
        
        for (const ep of endpoints) {
          try {
            fetchWithAuth(ep, { credentials: 'same-origin' }).then(resp => {
              if (!resp.ok) return;
              return resp.json().catch(() => ({}));
            }).then(js => {
              if (!js) return;
              const logs = Array.isArray(js.logs) ? js.logs : [];
              if (logs.length) {
                for (let i = this.lastPollCount; i < logs.length; i++) {
                  this.info(String(logs[i]));
                }
                this.lastPollCount = logs.length;
              }
            }).catch(e => {
              this.debug(`Poll endpoint error: ${String(e)}`);
            });
          } catch (e: any) {
            this.debug(`Poll endpoint error: ${String(e)}`);
          }
        }
      } catch (e: any) {
        this.error(`Polling error: ${String(e)}`);
      }
    };

    poll();
    this.pollTimer = setInterval(poll, 1000);
  }

  disconnectStream(): void {
    if (this.stream) {
      try {
        this.stream.close();
      } catch (e: any) {
        this.debug(`Stream close error: ${String(e)}`);
      }
      this.stream = null;
    }
    this.stopPolling();
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.lastPollCount = 0;
  }

  private formatLogEntry(entry: LogEntry): string {
    const emoji = this.getLevelEmoji(entry.level);
    const source = entry.source ? ` [${entry.source}]` : '';
    return `${emoji} ${entry.message}${source}`;
  }

  private getLevelEmoji(level: LogLevel): string {
    switch (level) {
      case 'error': return '❌';
      case 'warn': return '⚠️';
      case 'debug': return '🐛';
      case 'info':
      default: return 'ℹ️';
    }
  }

  private appendToElement(text: string): void {
    const pre = this.element.querySelector('pre');
    if (pre) {
      const currentText = pre.textContent || '';
      const newText = currentText + (text.indexOf('\n') === text.length - 1 ? text : text + '\n');
      pre.textContent = newText;
      pre.scrollTop = pre.scrollHeight;
    }
  }

  // Static factory method for common use cases
  static createGoalLogger(containerId: string): DslLogger {
    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error(`Goal Logger: Container not found: ${containerId}`);
    }

    // Create the log structure similar to scenario-editor
    container.innerHTML = `
      <div class="mt-sm">
        <div class="d-flex items-center justify-between">
          <div class="text-sm text-muted" style="font-weight:600;">Logi GOAL-a</div>
          <button class="btn btn-secondary btn-xs" data-action="clear-logs">Wyczyść</button>
        </div>
        <div class="panel-body" style="padding:0;">
          <pre class="mono" style="margin:0;padding:8px;background:#111;color:#eee;height:180px;overflow:auto;"></pre>
        </div>
      </div>
    `;

    const logsWrapper = container.querySelector('.panel-body') as HTMLElement;
    const logger = new DslLogger(logsWrapper);

    // Bind clear button
    const clearBtn = container.querySelector('[data-action="clear-logs"]') as HTMLButtonElement;
    if (clearBtn) {
      clearBtn.addEventListener('click', () => logger.clear());
    }

    return logger;
  }
}
