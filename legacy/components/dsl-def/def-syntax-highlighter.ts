import { logger } from '../../utils/logger';
import { fetchWithAuth } from '../../utils/fetch.utils';
/**
 * DEF JavaScript Syntax Highlighter
 * Adds syntax highlighting to DEF textarea with edit controls
 */

export class DefSyntaxHighlighter {
  private readonly textarea!: HTMLTextAreaElement;
  private highlightLayer!: HTMLDivElement;
  private readonly container!: HTMLElement;
  private isHighlighting: boolean = false;
  private readonly handleInput = () => { this.updateOverlayGeometry(); this.highlight(); };
  private readonly handleScroll = () => this.syncScroll();
  private readonly handleResize = () => { this.updateOverlayGeometry(); this.syncScroll(); };

  constructor(textareaId: string) {
    const textarea = document.getElementById(textareaId) as HTMLTextAreaElement;
    if (!textarea) {
      logger.warn(`DefSyntaxHighlighter: Textarea ${textareaId} not found`);
      return;
    }
    
    this.textarea = textarea;
    this.container = textarea.parentElement!;
    this.init();
  }

  private init(): void {
    // Create container wrapper
    this.container.style.position = 'relative';
    this.container.style.fontFamily = '"Monaco", "Menlo", "Ubuntu Mono", "Consolas", monospace';
    
    // Create highlight layer
    this.highlightLayer = document.createElement('div');
    this.highlightLayer.className = 'def-highlight-layer';
    // Base style; geometry is computed to match the textarea only
    this.highlightLayer.style.position = 'absolute';
    this.highlightLayer.style.pointerEvents = 'none';
    this.highlightLayer.style.zIndex = '1';
    this.highlightLayer.style.boxSizing = 'border-box';
    this.highlightLayer.style.background = 'transparent';
    this.highlightLayer.style.fontFamily = 'inherit';
    // Default text color (tokens override via spans)
    this.highlightLayer.style.color = 'var(--def-code-color, var(--text))';

    // Style textarea for transparency
    this.textarea.style.position = 'relative';
    this.textarea.style.zIndex = '2';
    this.textarea.style.background = 'transparent';
    // Hide raw textarea text, keep caret visible
    this.textarea.style.color = 'transparent';
    this.textarea.style.caretColor = '#333';

    // Insert highlight layer
    this.container.insertBefore(this.highlightLayer, this.textarea);

    // Add event listeners (store references for clean destroy)
    this.textarea.addEventListener('input', this.handleInput);
    this.textarea.addEventListener('scroll', this.handleScroll);
    window.addEventListener('resize', this.handleResize);

    // Initial highlight
    this.updateOverlayGeometry();
    this.highlight();
    this.addStyles();
  }

  private updateOverlayGeometry(): void {
    const cs = getComputedStyle(this.textarea);
    // Position the overlay exactly over the textarea area (not the entire section)
    const top = this.textarea.offsetTop;
    const left = this.textarea.offsetLeft;
    const width = this.textarea.offsetWidth;
    const height = this.textarea.offsetHeight;

    this.highlightLayer.style.top = `${top}px`;
    this.highlightLayer.style.left = `${left}px`;
    this.highlightLayer.style.width = `${width}px`;
    this.highlightLayer.style.height = `${height}px`;

    // Align to the textarea content box
    const bt = parseFloat(cs.borderTopWidth || '0') || 0;
    const bl = parseFloat(cs.borderLeftWidth || '0') || 0;
    this.highlightLayer.style.top = `${this.textarea.offsetTop + bt}px`;
    this.highlightLayer.style.left = `${this.textarea.offsetLeft + bl}px`;
    this.highlightLayer.style.width = `${this.textarea.clientWidth}px`;
    this.highlightLayer.style.height = `${this.textarea.clientHeight}px`;

    this.highlightLayer.style.padding = cs.padding;
    this.highlightLayer.style.borderWidth = '0px';
    this.highlightLayer.style.fontSize = cs.fontSize;
    this.highlightLayer.style.lineHeight = cs.lineHeight;
    // Match whitespace behavior to keep line wraps identical
    this.highlightLayer.style.whiteSpace = cs.whiteSpace;
    // Allow programmatic scrolling to sync with textarea, hide scrollbars via CSS
    this.highlightLayer.style.overflow = 'auto';
  }

  private addStyles(): void {
    if (document.getElementById('def-syntax-styles')) return;

    const style = document.createElement('style');
    style.id = 'def-syntax-styles';
    style.textContent = `
      .def-highlight-layer {
        background: var(--panel-bg);
        scrollbar-width: none; /* Firefox */
      }
      .def-highlight-layer::-webkit-scrollbar { display: none; } /* WebKit */
      
      .def-syntax-keyword { color: #0066cc; font-weight: bold; }
      .def-syntax-string { color: #008800; }
      .def-syntax-number { color: #cc6600; }
      .def-syntax-comment { color: #888; font-style: italic; }
      .def-syntax-function { color: #6600cc; }
      .def-syntax-property { color: #0088cc; }
      .def-syntax-operator { color: #666; }
      .def-syntax-bracket { color: #000; font-weight: bold; }
      
      /* Dark theme support */
      .dark .def-syntax-keyword { color: #569cd6; }
      .dark .def-syntax-string { color: #ce9178; }
      .dark .def-syntax-number { color: #b5cea8; }
      .dark .def-syntax-comment { color: #6a9955; }
      .dark .def-syntax-function { color: #dcdcaa; }
      .dark .def-syntax-property { color: #9cdcfe; }
      .dark .def-syntax-operator { color: #d4d4d4; }
      .dark .def-syntax-bracket { color: #ffd700; }
    `;
    document.head.appendChild(style);
  }

  private syncScroll(): void {
    this.highlightLayer.scrollTop = this.textarea.scrollTop;
    this.highlightLayer.scrollLeft = this.textarea.scrollLeft;
  }

  private highlight(): void {
    if (this.isHighlighting) return;
    this.isHighlighting = true;

    requestAnimationFrame(() => {
      const code = this.textarea.value;
      const highlighted = this.highlightCode(code);
      this.highlightLayer.innerHTML = highlighted;
      this.syncScroll();
      this.isHighlighting = false;
    });
  }

  private highlightCode(code: string): string {
    // Simple highlighting to avoid nested HTML spans that cause display issues
    let result = code;

    // Escape HTML first
    result = result
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Line-by-line processing to avoid conflicts
    const lines = result.split('\n');
    const highlightedLines = lines.map(line => {
      let highlightedLine = line;

      // Comments (highest priority - whole line)
      if (/^\s*\/\//.test(highlightedLine)) {
        return `<span class="def-syntax-comment">${highlightedLine}</span>`;
      }
      if (/\/\*.*\*\//.test(highlightedLine)) {
        return highlightedLine.replace(/(\/\*.*?\*\/)/g, '<span class="def-syntax-comment">$1</span>');
      }

      // Strings (protect from further processing)
      const stringMatches: string[] = [];
      highlightedLine = highlightedLine.replace(/(["'`])((?:\\.|(?!\1)[^\\])*?)\1/g, (match, _quote, _content) => {
        const index = stringMatches.length;
        stringMatches.push(`<span class="def-syntax-string">${match}</span>`);
        return `__STRING_${index}__`;
      });

      // Keywords (only if not inside strings)
      const keywords = ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'in', 'of', 'typeof', 'undefined', 'null', 'true', 'false', 'module', 'exports'];
      const keywordPattern = new RegExp(`\\b(${keywords.join('|')})\\b`, 'g');
      highlightedLine = highlightedLine.replace(keywordPattern, '<span class="def-syntax-keyword">$1</span>');

      // Numbers
      highlightedLine = highlightedLine.replace(/\b\d+\.?\d*\b/g, '<span class="def-syntax-number">$&</span>');

      // Restore strings
      stringMatches.forEach((str, index) => {
        highlightedLine = highlightedLine.replace(`__STRING_${index}__`, str);
      });

      return highlightedLine;
    });

    return highlightedLines.join('\n');
  }

  // Public methods
  getValue(): string {
    return this.textarea.value;
  }

  setValue(value: string): void {
    this.textarea.value = value;
    this.highlight();
  }

  insertText(text: string): void {
    const start = this.textarea.selectionStart;
    const end = this.textarea.selectionEnd;
    const value = this.textarea.value;
    
    const newValue = value.substring(0, start) + text + value.substring(end);
    this.textarea.value = newValue;
    this.textarea.selectionStart = this.textarea.selectionEnd = start + text.length;
    this.highlight();
    this.textarea.focus();
  }

  destroy(): void {
    try {
      this.textarea.removeEventListener('input', this.handleInput);
      this.textarea.removeEventListener('scroll', this.handleScroll);
      window.removeEventListener('resize', this.handleResize);
    } catch { /* silent */ }
    // Restore textarea styles
    try {
      this.textarea.style.color = '';
      this.textarea.style.caretColor = '';
      this.textarea.style.background = '';
      this.textarea.style.zIndex = '';
    } catch { /* silent */ }
    // Remove overlay
    try {
      this.highlightLayer?.remove();
    } catch { /* silent */ }
  }
}

// DEF Editor with +/- buttons functionality
export class DefEditor {
  private highlighter: DefSyntaxHighlighter;
  private textarea: HTMLTextAreaElement;

  constructor(textareaId: string) {
    this.textarea = document.getElementById(textareaId) as HTMLTextAreaElement;
    this.highlighter = new DefSyntaxHighlighter(textareaId);
    this.attachButtonHandlers();
  }

  private attachButtonHandlers(): void {
    // Object/function buttons: handle ONLY when clicks occur inside DEF section
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const defSection = this.textarea.closest('.def-section');
      if (!defSection || !defSection.contains(target)) return;

      if (target.classList.contains('btn-add-object')) {
        this.addObjectToLibrary();
      } else if (target.classList.contains('btn-remove-object')) {
        this.removeObjectFromLibrary(target);
      } else if (target.classList.contains('btn-add-function')) {
        this.addFunctionToLibrary();
      } else if (target.classList.contains('btn-remove-function')) {
        this.removeFunctionFromLibrary(target);
      }
    });

    // DEF action buttons
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const action = target.getAttribute('data-action');
      
      if (action === 'def-validate') {
        this.validateDef();
      } else if (action === 'def-save') {
        this.saveDef();
      } else if (action === 'def-reload') {
        this.reloadRuntime();
      } else if (action === 'def-import') {
        this.importFromDB();
      }
    });
  }

  private addObjectToLibrary(): void {
    const objectName = prompt('Podaj nazwę nowego obiektu:');
    if (!objectName || !objectName.trim()) return;

    const def = this.parseDef();
    if (!def.library) def.library = {};
    if (!def.library.objects) def.library.objects = [];
    
    if (!def.library.objects.includes(objectName.trim())) {
      def.library.objects.push(objectName.trim());
      def.library.objects.sort();
      this.updateDefCode(def);
      this.showNotification(`✅ Dodano obiekt: ${objectName}`, 'success');
    } else {
      this.showNotification(`⚠️ Obiekt ${objectName} już istnieje`, 'warning');
    }
  }

  private removeObjectFromLibrary(button: HTMLElement): void {
    const selectContainer = button.parentElement;
    const objectSelect = selectContainer?.querySelector('.object-select') as HTMLSelectElement;
    const selectedObject = objectSelect?.value;
    
    if (!selectedObject) {
      this.showNotification('⚠️ Nie wybrano obiektu do usunięcia', 'warning');
      return;
    }

    if (confirm(`Czy na pewno usunąć obiekt "${selectedObject}" z biblioteki DEF?`)) {
      const def = this.parseDef();
      if (def.library?.objects) {
        def.library.objects = def.library.objects.filter((obj: string) => obj !== selectedObject);
        this.updateDefCode(def);
        this.showNotification(`✅ Usunięto obiekt: ${selectedObject}`, 'success');
      }
    }
  }

  private addFunctionToLibrary(): void {
    const functionName = prompt('Podaj nazwę nowej funkcji:');
    if (!functionName || !functionName.trim()) return;

    const def = this.parseDef();
    if (!def.library) def.library = {};
    if (!def.library.functions) def.library.functions = [];
    
    if (!def.library.functions.includes(functionName.trim())) {
      def.library.functions.push(functionName.trim());
      def.library.functions.sort();
      this.updateDefCode(def);
      this.showNotification(`✅ Dodano funkcję: ${functionName}`, 'success');
    } else {
      this.showNotification(`⚠️ Funkcja ${functionName} już istnieje`, 'warning');
    }
  }

  private removeFunctionFromLibrary(button: HTMLElement): void {
    const selectContainer = button.parentElement;
    const functionSelect = selectContainer?.querySelector('.function-select') as HTMLSelectElement;
    const selectedFunction = functionSelect?.value;
    
    if (!selectedFunction) {
      this.showNotification('⚠️ Nie wybrano funkcji do usunięcia', 'warning');
      return;
    }

    if (confirm(`Czy na pewno usunąć funkcję "${selectedFunction}" z biblioteki DEF?`)) {
      const def = this.parseDef();
      if (def.library?.functions) {
        def.library.functions = def.library.functions.filter((func: string) => func !== selectedFunction);
        this.updateDefCode(def);
        this.showNotification(`✅ Usunięto funkcję: ${selectedFunction}`, 'success');
      }
    }
  }

  private parseDef(): any {
    const fallback = { library: { objects: [], functions: [], params: [], units: [] } };
    try {
      const code = this.highlighter.getValue();
      // Extract library object literal
      const m = code.match(/const\s+library\s*=\s*({[\s\S]*?});/);
      if (!m) return fallback;
      const libStr = (m[1] || '').trim();
      if (!libStr) return fallback;
      // Try JSON parse first
      try {
        const lib = JSON.parse(libStr);
        // Ensure expected shape
        return { library: this.normalizeLibrary(lib) };
      } catch { /* silent */ }
      // Fallback: evaluate object literal safely (no external identifiers)
      try {
        // Wrap in function to avoid access to outer scope
        const fn = new Function(`"use strict"; return (${libStr});`);
        const lib2 = fn();
        return { library: this.normalizeLibrary(lib2) };
      } catch (err) {
        logger.warn('DEF parse fallback failed:', err);
        return fallback;
      }
    } catch (error) {
      logger.warn('Failed to parse DEF:', error);
      return fallback;
    }
  }

  private updateDefCode(def: any): void {
    const currentCode = this.highlighter.getValue();
    
    // Update library section
    const libraryJson = JSON.stringify(def.library, null, 2);
    const updatedCode = currentCode.replace(
      /const\s+library\s*=\s*{[\s\S]*?};/,
      `const library = ${libraryJson};`
    );
    
    this.highlighter.setValue(updatedCode);
    
    // Trigger refresh of selectlists
    this.refreshSelectlists();
  }

  private normalizeLibrary(src: any): { objects: string[]; functions: string[]; params: string[]; units: string[] } {
    const arr = (v: any): string[] => Array.isArray(v) ? v.map((x) => String(x || '')).filter(Boolean) : [];
    const lib = src && typeof src === 'object' ? src : {};
    return {
      objects: arr((lib as any).objects),
      functions: arr((lib as any).functions),
      params: arr((lib as any).params),
      units: arr((lib as any).units),
    };
  }

  private refreshSelectlists(): void {
    try {
      // Trigger global refresh if available
      if (typeof (globalThis as any).refreshBuilderOptions === 'function') {
        (globalThis as any).refreshBuilderOptions();
      }
      
      // Dispatch custom event
      document.dispatchEvent(new CustomEvent('defLibraryUpdated', {
        detail: { source: 'def-editor' }
      }));
    } catch (error) {
      logger.warn('Failed to refresh selectlists:', error);
    }
  }

  private async validateDef(): Promise<void> {
    const defCode = this.highlighter.getValue();
    if (!defCode.trim()) {
      this.showNotification('⚠️ Kod DEF jest pusty', 'warning');
      return;
    }

    try {
      const response = await fetchWithAuth('/api/v3/dsl/validate-def', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ def_code: defCode })
      });

      const result = await response.json();
      
      if (result.valid) {
        this.showNotification('✅ Kod DEF jest poprawny', 'success');
      } else {
        const errors = result.errors?.slice(0, 3).join(', ') || 'Nieznane błędy';
        this.showNotification(`❌ Błędy w kodzie DEF: ${errors}`, 'error');
      }
    } catch (error) {
      this.showNotification('❌ Błąd podczas walidacji DEF', 'error');
    }
  }

  private saveDef(): void {
    // Trigger save event
    document.dispatchEvent(new CustomEvent('defSaveRequested', {
      detail: { defCode: this.highlighter.getValue() }
    }));
    this.showNotification('💾 Zapisywanie DEF...', 'info');
  }

  private reloadRuntime(): void {
    this.refreshSelectlists();
    this.showNotification('🔄 Runtime przeładowany', 'info');
  }

  private importFromDB(): void {
    // Trigger import event
    document.dispatchEvent(new CustomEvent('defImportRequested'));
    this.showNotification('📥 Importowanie z bazy danych...', 'info');
  }

  private showNotification(message: string, type: 'success' | 'warning' | 'error' | 'info'): void {
    // Try to use existing notification system
    try {
      if (typeof (globalThis as any).notifyBottomLine === 'function') {
        (globalThis as any).notifyBottomLine(message, type, 3000);
        return;
      }
    } catch { /* silent */ }

    // Fallback: simple alert/console
    if (type === 'error') {
      logger.error(message);
    } else if (type === 'warning') {
      logger.warn(message);
    } else {

    }
  }

  // Public API
  getValue(): string {
    return this.highlighter.getValue();
  }

  setValue(value: string): void {
    this.highlighter.setValue(value);
  }

  destroy(): void {
    this.highlighter.destroy();
  }
}

// Note: DefEditor should be manually initialized by def-integration.ts
// to avoid conflicts with multiple initializations
