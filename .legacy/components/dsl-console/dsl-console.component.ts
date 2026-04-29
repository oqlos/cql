// frontend/src/components/dsl-console/dsl-console.component.ts
/**
 * DSL Console Component - Visual interface for DSL log viewing and replay
 * 
 * Features:
 * - Real-time log display
 * - Filter by level/action
 * - DSL script editor
 * - Execute scripts
 * - Export/Import sessions
 */

import { slog, StructuredLogEntry } from '../../utils/structured-logger';
import { dsl } from '../../utils/dsl-executor';
import { traceContext } from '../../utils/trace-context';
import { setupActionDispatcher, delegateClick } from '../../utils/event.utils';

export class DslConsoleComponent {
  private container: HTMLElement | null = null;
  private logContainer: HTMLElement | null = null;
  private isVisible = false;
  private isMinimized = false;
  private updateInterval: number | null = null;
  private lastLogCount = 0;

  constructor() {
    this.setupKeyboardShortcut();
  }

  private setupKeyboardShortcut(): void {
    document.addEventListener('keydown', (e) => {
      // Ctrl+Shift+D to toggle DSL console
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        this.toggle();
      }
    });
  }

  toggle(): void {
    this.isVisible ? this.hide() : this.show();
  }

  show(): void {
    if (this.container) {
      this.container.style.display = 'flex';
      this.isVisible = true;
      this.startAutoRefresh();
      return;
    }

    this.render();
    this.isVisible = true;
    this.startAutoRefresh();
  }

  hide(): void {
    if (this.container) {
      this.container.style.display = 'none';
    }
    this.isVisible = false;
    this.stopAutoRefresh();
  }

  private render(): void {
    this.container = document.createElement('div');
    this.container.className = 'dsl-console no-log';
    this.container.innerHTML = this.getTemplate();
    
    // Inject styles
    this.injectStyles();
    
    document.body.appendChild(this.container);
    
    // Get references
    this.logContainer = this.container.querySelector('.dsl-log-entries');
    
    // Setup event handlers
    this.setupEventHandlers();
    
    // Initial render
    this.refreshLogs();
  }

  private getTemplate(): string {
    return `
      <div class="dsl-console-header">
        <div class="dsl-console-title">
          <span class="dsl-icon">📋</span>
          <span>DSL Console</span>
          <span class="dsl-session-id">${traceContext.getSessionId().slice(0, 12)}</span>
        </div>
        <div class="dsl-console-actions">
          <button class="dsl-btn" data-action="refresh" title="Refresh">🔄</button>
          <button class="dsl-btn" data-action="clear" title="Clear">🗑️</button>
          <button class="dsl-btn" data-action="copy" title="Copy DSL">📋</button>
          <button class="dsl-btn" data-action="download" title="Download">💾</button>
          <button class="dsl-btn" data-action="minimize" title="Minimize">➖</button>
          <button class="dsl-btn" data-action="close" title="Close">✖️</button>
        </div>
      </div>
      
      <div class="dsl-console-body">
        <div class="dsl-console-tabs">
          <button class="dsl-tab active" data-tab="logs">Logs</button>
          <button class="dsl-tab" data-tab="editor">Editor</button>
        </div>
        
        <div class="dsl-tab-content active" data-content="logs">
          <div class="dsl-log-filters">
            <select class="dsl-filter-level">
              <option value="">All Levels</option>
              <option value="DEBUG">Debug</option>
              <option value="INFO">Info</option>
              <option value="WARN">Warn</option>
              <option value="ERROR">Error</option>
            </select>
            <input type="text" class="dsl-filter-action" placeholder="Filter by action...">
            <span class="dsl-log-count">0 entries</span>
          </div>
          <div class="dsl-log-entries"></div>
        </div>
        
        <div class="dsl-tab-content" data-content="editor">
          <textarea class="dsl-editor-area" placeholder="# Enter DSL commands here...
NAVIGATE &quot;/connect-data&quot;
CLICK &quot;#refresh-btn&quot;
WAIT 500
"></textarea>
          <div class="dsl-editor-actions">
            <button class="dsl-btn dsl-btn-primary" data-action="run">▶ Run</button>
            <button class="dsl-btn" data-action="stop">⏹ Stop</button>
            <label class="dsl-delay-label">
              Delay: <input type="number" class="dsl-delay-input" value="100" min="0" max="5000" step="100">ms
            </label>
          </div>
        </div>
      </div>
    `;
  }

  private injectStyles(): void {
    if (document.getElementById('dsl-console-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'dsl-console-styles';
    style.textContent = `
      .dsl-console {
        position: fixed;
        bottom: 10px;
        right: 10px;
        width: 500px;
        height: 400px;
        background: var(--menu-bg);
        border: 1px solid var(--border);
        border-radius: 8px;
        display: flex;
        flex-direction: column;
        font-family: 'Consolas', 'Monaco', monospace;
        font-size: 12px;
        z-index: 99999;
        box-shadow: 0 4px 20px var(--shadow);
        resize: both;
        overflow: hidden;
      }
      
      .dsl-console.minimized {
        height: 36px;
        resize: none;
      }
      
      .dsl-console.minimized .dsl-console-body {
        display: none;
      }
      
      .dsl-console-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 12px;
        background: var(--menu-active-bg);
        border-bottom: 1px solid var(--border);
        cursor: move;
      }
      
      .dsl-console-title {
        display: flex;
        align-items: center;
        gap: 8px;
        color: var(--success);
        font-weight: bold;
      }
      
      .dsl-session-id {
        font-size: 10px;
        color: var(--text-muted);
        font-weight: normal;
      }
      
      .dsl-console-actions {
        display: flex;
        gap: 4px;
      }
      
      .dsl-btn {
        background: transparent;
        border: none;
        color: var(--text-muted);
        cursor: pointer;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
      }
      
      .dsl-btn:hover {
        background: var(--menu-active-bg);
        color: var(--menu-active-text);
      }
      
      .dsl-btn-primary {
        background: var(--success);
        color: var(--on-success);
      }
      
      .dsl-btn-primary:hover {
        filter: brightness(0.9);
      }
      
      .dsl-console-body {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      
      .dsl-console-tabs {
        display: flex;
        background: var(--menu-bg);
        border-bottom: 1px solid var(--border);
      }
      
      .dsl-tab {
        background: transparent;
        border: none;
        color: var(--text-muted);
        padding: 8px 16px;
        cursor: pointer;
        border-bottom: 2px solid transparent;
      }
      
      .dsl-tab.active {
        color: var(--success);
        border-bottom-color: var(--success);
      }
      
      .dsl-tab-content {
        flex: 1;
        display: none;
        flex-direction: column;
        overflow: hidden;
      }
      
      .dsl-tab-content.active {
        display: flex;
      }
      
      .dsl-log-filters {
        display: flex;
        gap: 8px;
        padding: 8px;
        background: var(--menu-bg);
        align-items: center;
      }
      
      .dsl-log-filters select,
      .dsl-log-filters input {
        background: var(--bg);
        border: 1px solid var(--border);
        color: var(--menu-text);
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 11px;
      }
      
      .dsl-filter-action {
        flex: 1;
      }
      
      .dsl-log-count {
        color: var(--text-muted);
        font-size: 11px;
      }
      
      .dsl-log-entries {
        flex: 1;
        overflow-y: auto;
        padding: 8px;
      }
      
      .dsl-log-entry {
        padding: 4px 8px;
        margin-bottom: 2px;
        border-radius: 4px;
        display: flex;
        gap: 8px;
        font-size: 11px;
        line-height: 1.4;
      }
      
      .dsl-log-entry:hover {
        background: var(--menu-active-bg);
      }
      
      .dsl-log-entry.level-DEBUG { color: var(--text-muted); }
      .dsl-log-entry.level-INFO { color: var(--link); }
      .dsl-log-entry.level-WARN { color: var(--warning); }
      .dsl-log-entry.level-ERROR { color: var(--danger); }
      
      .dsl-log-time {
        color: var(--text-muted);
        flex-shrink: 0;
      }
      
      .dsl-log-action {
        color: var(--success);
        font-weight: bold;
        flex-shrink: 0;
      }
      
      .dsl-log-target {
        color: var(--menu-text);
      }
      
      .dsl-log-params {
        color: var(--text-muted);
      }
      
      .dsl-editor-area {
        flex: 1;
        background: var(--bg);
        border: none;
        color: var(--menu-text);
        padding: 12px;
        font-family: inherit;
        font-size: 12px;
        resize: none;
        outline: none;
      }
      
      .dsl-editor-actions {
        display: flex;
        gap: 8px;
        padding: 8px;
        background: var(--menu-bg);
        align-items: center;
      }
      
      .dsl-delay-label {
        color: var(--text-muted);
        font-size: 11px;
        margin-left: auto;
      }
      
      .dsl-delay-input {
        width: 60px;
        background: var(--bg);
        border: 1px solid var(--border);
        color: var(--menu-text);
        padding: 2px 4px;
        border-radius: 4px;
      }
      
      .dsl-icon {
        font-size: 14px;
      }
    `;
    document.head.appendChild(style);
  }

  private setupEventHandlers(): void {
    if (!this.container) return;

    // Header actions using centralized dispatcher
    setupActionDispatcher(this.container, {
      'refresh': () => this.refreshLogs(),
      'clear': () => { slog.clear(); this.refreshLogs(); },
      'copy': () => slog.copyDsl(),
      'download': () => slog.downloadDsl(),
      'minimize': () => this.toggleMinimize(),
      'close': () => this.hide(),
      'run': () => this.runScript(),
      'stop': () => dsl.abort(),
    });

    // Tab switching using delegateClick
    delegateClick(this.container, '.dsl-tab', (tab) => {
      const tabName = tab.dataset.tab;
      if (tabName) this.switchTab(tabName);
    });

    // Filters
    const levelFilter = this.container.querySelector('.dsl-filter-level') as HTMLSelectElement;
    const actionFilter = this.container.querySelector('.dsl-filter-action') as HTMLInputElement;
    
    levelFilter?.addEventListener('change', () => this.refreshLogs());
    actionFilter?.addEventListener('input', () => this.refreshLogs());

    // Make draggable
    this.makeDraggable();
  }

  private switchTab(tabName: string): void {
    if (!this.container) return;

    this.container.querySelectorAll('.dsl-tab').forEach(t => 
      t.classList.toggle('active', (t as HTMLElement).dataset.tab === tabName));
    this.container.querySelectorAll('.dsl-tab-content').forEach(c => 
      c.classList.toggle('active', (c as HTMLElement).dataset.content === tabName));
  }

  private toggleMinimize(): void {
    this.isMinimized = !this.isMinimized;
    this.container?.classList.toggle('minimized', this.isMinimized);
  }

  private refreshLogs(): void {
    if (!this.logContainer || !this.container) return;

    const levelFilter = (this.container.querySelector('.dsl-filter-level') as HTMLSelectElement)?.value;
    const actionFilter = (this.container.querySelector('.dsl-filter-action') as HTMLInputElement)?.value;

    const filters: any = { limit: 200 };
    if (levelFilter) filters.level = levelFilter;
    if (actionFilter) filters.action = actionFilter;

    const entries = slog.query(filters);
    const countSpan = this.container.querySelector('.dsl-log-count');
    if (countSpan) countSpan.textContent = `${entries.length} entries`;

    this.logContainer.innerHTML = entries.map(e => this.renderLogEntry(e)).join('');
    
    // Auto-scroll to bottom
    this.logContainer.scrollTop = this.logContainer.scrollHeight;
    this.lastLogCount = entries.length;
  }

  private renderLogEntry(entry: StructuredLogEntry): string {
    const time = new Date(entry.timestamp).toLocaleTimeString();
    const params = entry.params ? JSON.stringify(entry.params) : '';
    
    return `
      <div class="dsl-log-entry level-${entry.level}">
        <span class="dsl-log-time">${time}</span>
        <span class="dsl-log-action">${entry.action}</span>
        <span class="dsl-log-target">"${entry.target}"</span>
        ${params ? `<span class="dsl-log-params">${params}</span>` : ''}
      </div>
    `;
  }

  private async runScript(): Promise<void> {
    const editor = this.container?.querySelector('.dsl-editor-area') as HTMLTextAreaElement;
    const delayInput = this.container?.querySelector('.dsl-delay-input') as HTMLInputElement;
    
    if (!editor) return;

    const script = editor.value;
    const delay = parseInt(delayInput?.value || '100', 10);

    await dsl.run(script, { delay });
    this.refreshLogs();
  }

  private startAutoRefresh(): void {
    if (this.updateInterval) return;
    
    this.updateInterval = window.setInterval(() => {
      const currentCount = slog.getLogs().length;
      if (currentCount !== this.lastLogCount) {
        this.refreshLogs();
      }
    }, 1000);
  }

  private stopAutoRefresh(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  private makeDraggable(): void {
    const header = this.container?.querySelector('.dsl-console-header') as HTMLElement;
    if (!header || !this.container) return;

    let isDragging = false;
    let offsetX = 0;
    let offsetY = 0;

    header.addEventListener('mousedown', (e) => {
      if ((e.target as HTMLElement).tagName === 'BUTTON') return;
      isDragging = true;
      offsetX = e.clientX - this.container!.offsetLeft;
      offsetY = e.clientY - this.container!.offsetTop;
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging || !this.container) return;
      this.container.style.left = `${e.clientX - offsetX}px`;
      this.container.style.top = `${e.clientY - offsetY}px`;
      this.container.style.right = 'auto';
      this.container.style.bottom = 'auto';
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
    });
  }
}

// Singleton instance
export const dslConsole = new DslConsoleComponent();

// Expose globally
if (typeof globalThis !== 'undefined') {
  (globalThis as any).dslConsole = dslConsole;
  (globalThis as any).DSL = {
    ...((globalThis as any).DSL || {}),
    console: () => dslConsole.toggle(),
  };
}
