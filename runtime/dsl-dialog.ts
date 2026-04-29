/**
 * DSL Dialog - interactive dialog for user selection
 * Used by DIALOG command in DSL
 */

/** Dialog styles - injected once */
const dialogStyles = `
  .dsl-dialog-overlay {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  }
  .dsl-dialog-box {
    background: var(--panel-bg);
    border-radius: 12px;
    padding: 24px;
    min-width: 300px;
    max-width: 500px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.3);
  }
  .dsl-dialog-title {
    font-size: 18px;
    font-weight: 600;
    margin-bottom: 20px;
    text-align: center;
  }
  .dsl-dialog-options {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .dsl-dialog-option {
    padding: 14px 20px;
    font-size: 16px;
    font-weight: 500;
    border: 2px solid #e0e0e0;
    border-radius: 8px;
    background: #f5f5f5;
    cursor: pointer;
    transition: all 0.2s;
  }
  .dsl-dialog-option:hover {
    background: #2196f3;
    color: white;
    border-color: #2196f3;
  }
`;

let stylesInjected = false;

function injectStyles(): void {
  if (stylesInjected || typeof document === 'undefined') return;
  if (document.getElementById('dsl-dialog-styles')) {
    stylesInjected = true;
    return;
  }
  
  const style = document.createElement('style');
  style.id = 'dsl-dialog-styles';
  style.textContent = dialogStyles;
  document.head.appendChild(style);
  stylesInjected = true;
}

export interface DialogConfig {
  /** Dialog title/prompt */
  prompt: string;
  /** Options to display as buttons */
  options: string[];
  /** Optional callback for logging */
  onLog?: (message: string) => void;
}

/**
 * Show interactive dialog with options
 * Returns the selected option or null if cancelled
 */
export function showDslDialog(config: DialogConfig): Promise<string | null> {
  const { prompt, options, onLog } = config;
  
  if (typeof document === 'undefined') {
    onLog?.('DIALOG not available in non-browser environment');
    return Promise.resolve(null);
  }
  
  injectStyles();
  
  return new Promise<string | null>((resolve) => {
    const dialogId = `dialog-${Date.now()}`;
    const overlay = document.createElement('div');
    overlay.id = dialogId;
    overlay.className = 'dsl-dialog-overlay';
    overlay.innerHTML = `
      <div class="dsl-dialog-box">
        <div class="dsl-dialog-title">📋 ${prompt}</div>
        <div class="dsl-dialog-options">
          ${options.map(opt => `
            <button class="dsl-dialog-option" data-value="${opt}">${opt}</button>
          `).join('')}
        </div>
      </div>
    `;
    
    document.body.appendChild(overlay);
    
    // Handle option clicks
    overlay.querySelectorAll('.dsl-dialog-option').forEach(btn => {
      btn.addEventListener('click', () => {
        const value = (btn as HTMLElement).dataset.value || '';
        onLog?.(`Selected: ${value}`);
        overlay.remove();
        resolve(value);
      });
    });
    
    // Handle click outside to cancel
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        onLog?.('Dialog cancelled');
        overlay.remove();
        resolve(null);
      }
    });
    
    // Handle Escape key
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onLog?.('Dialog cancelled (Escape)');
        overlay.remove();
        document.removeEventListener('keydown', handleEscape);
        resolve(null);
      }
    };
    document.addEventListener('keydown', handleEscape);
  });
}

/**
 * Parse options from variable value
 * Supports semicolon-separated string or array
 */
export function parseDialogOptions(value: any): string[] {
  if (typeof value === 'string') {
    return value.split(';').map(o => o.trim()).filter(o => o);
  }
  if (Array.isArray(value)) {
    return value.map(o => String(o).trim()).filter(o => o);
  }
  return ['TAK', 'NIE']; // Default options
}
