// func-editor-bindings.ts
// Extracted from connect-scenario-func-editor.page.ts — DOM event bindings for FUNC editor

import { highlightDsl } from '../../../components/dsl';
import { promptText, showInfoDialog } from './scenario-dialogs';
import { buildFuncEditorTemplate, getFuncEditorDefaultTemplateName } from './cql-editor-content';

export interface FuncEditorCallbacks {
  getCurrentScenarioId(): string;
  setCurrentScenarioId(id: string): void;
  getCurrentScenarioTitle(): string;
  setCurrentScenarioTitle(title: string): void;
  getOriginalFunc(): string;
  setOriginalFunc(v: string): void;
  getIsDirty(): boolean;
  setIsDirty(v: boolean): void;
  getScenariosList(): Array<{ id: string; name: string; updatedAt?: string }>;
  setScenariosList(list: Array<{ id: string; name: string; updatedAt?: string }>): void;
  getScenarioFilter(): string;
  setScenarioFilter(v: string): void;
  loadScenarioList(listBody: HTMLElement): Promise<void>;
  renderScenarioList(listBody: HTMLElement): void;
  loadScenario(id: string, textarea: HTMLTextAreaElement, preview: HTMLElement, status: HTMLElement, titleEl: HTMLElement, listBody: HTMLElement): Promise<void>;
  updatePreview(text: string, preview: HTMLElement): void;
  updateCodePreview(text: string, codePreview: HTMLElement): void;
  validateFunc(text: string): { valid: boolean; funcs: string[]; errors: string[] };
  initializeSyntaxHelp(syntaxHelp: HTMLElement): void;
  saveScenario(id: string, func: string): Promise<void>;
}

export function attachFuncEditorListeners(cb: FuncEditorCallbacks): void {
  const container = document.querySelector('.func-editor-page');
  if (!container) return;

  const textarea = document.getElementById('func-editor-textarea') as HTMLTextAreaElement;
  const saveBtn = document.getElementById('func-save-btn') as HTMLButtonElement;
  const addTemplateBtn = document.getElementById('func-add-template') as HTMLButtonElement;
  const validateBtn = document.getElementById('func-validate') as HTMLButtonElement;
  const preview = document.getElementById('func-preview') as HTMLElement;
  const codePreview = document.getElementById('func-code-preview') as HTMLElement;
  const syntaxHelp = document.getElementById('func-syntax-help') as HTMLElement;
  const status = document.getElementById('func-status') as HTMLElement;
  const titleEl = document.getElementById('func-scenario-title') as HTMLElement;
  const filterInput = document.getElementById('func-scenario-filter') as HTMLInputElement;
  const sortSelect = document.getElementById('scenario-sort') as HTMLSelectElement | null;
  const listBody = document.getElementById('func-scenario-list-body') as HTMLElement;

  cb.initializeSyntaxHelp(syntaxHelp);
  setupListClickHandler(listBody, cb);
  cb.loadScenarioList(listBody);

  filterInput?.addEventListener('input', () => {
    cb.setScenarioFilter(filterInput.value.toLowerCase());
    cb.renderScenarioList(listBody);
  });

  sortSelect?.addEventListener('change', () => {
    cb.renderScenarioList(listBody);
  });

  const highlightPre = document.getElementById('func-editor-highlight') as HTMLPreElement;

  const syncHighlight = () => {
    if (highlightPre && textarea) {
      highlightPre.innerHTML = highlightDsl(textarea.value) + '\n';
    }
  };

  textarea?.addEventListener('scroll', () => {
    if (highlightPre) {
      highlightPre.scrollTop = textarea.scrollTop;
      highlightPre.scrollLeft = textarea.scrollLeft;
    }
  });

  textarea?.addEventListener('input', () => {
    cb.setIsDirty(textarea.value !== cb.getOriginalFunc());
    saveBtn.disabled = !cb.getIsDirty();
    if (status) status.textContent = cb.getIsDirty() ? '● Niezapisane zmiany' : '';
    if (status) status.className = cb.getIsDirty() ? 'text-xs dirty-indicator' : 'text-xs text-muted';
    cb.updatePreview(textarea.value, preview);
    cb.updateCodePreview(textarea.value, codePreview);
    syncHighlight();
  });

  syncHighlight();

  saveBtn?.addEventListener('click', async () => {
    if (!cb.getCurrentScenarioId()) {
      if (status) { status.textContent = '⚠️ Wybierz scenariusz'; status.className = 'text-xs text-warning'; }
      return;
    }
    try {
      await cb.saveScenario(cb.getCurrentScenarioId(), textarea.value);
      cb.setOriginalFunc(textarea.value);
      cb.setIsDirty(false);
      saveBtn.disabled = true;
      if (status) { status.textContent = '✅ Zapisano'; status.className = 'text-xs text-success'; }
      setTimeout(() => { if (status) { status.textContent = ''; } }, 2000);
      await cb.loadScenarioList(listBody);
    } catch {
      if (status) { status.textContent = '❌ Błąd zapisu'; status.className = 'text-xs text-danger'; }
    }
  });

  addTemplateBtn?.addEventListener('click', async () => {
    const defaultName = getFuncEditorDefaultTemplateName();
    const name = await promptText('Nazwa nowej procedury FUNC:', defaultName, { title: 'Dodaj szablon FUNC' }) || defaultName;
    const template = buildFuncEditorTemplate(name);
    textarea.value += template;
    textarea.dispatchEvent(new Event('input'));
  });

  validateBtn?.addEventListener('click', async () => {
    const result = cb.validateFunc(textarea.value);
    if (result.valid) {
      await showInfoDialog(`✅ Walidacja OK\n\nZnaleziono ${result.funcs.length} procedur:\n${result.funcs.map(f => `• ${f}`).join('\n')}`, 'Walidacja FUNC');
    } else {
      await showInfoDialog(`❌ Błędy walidacji:\n\n${result.errors.join('\n')}`, 'Walidacja FUNC');
    }
  });

  const urlParams = new URLSearchParams(window.location.search);
  const scenarioId = urlParams.get('scenario');
  if (scenarioId) {
    setTimeout(async () => {
      await cb.loadScenario(scenarioId, textarea, preview, status, titleEl, listBody);
    }, 100);
  }
}

function setupListClickHandler(listBody: HTMLElement, cb: FuncEditorCallbacks): void {
  listBody.addEventListener('click', async (e) => {
    const row = (e.target as HTMLElement).closest('tr');
    if (!row) return;
    const id = row.getAttribute('data-id');

    if (id && id !== cb.getCurrentScenarioId()) {
      const textarea = document.getElementById('func-editor-textarea') as HTMLTextAreaElement;
      const preview = document.getElementById('func-preview') as HTMLElement;
      const status = document.getElementById('func-status') as HTMLElement;
      const titleEl = document.getElementById('func-scenario-title') as HTMLElement;
      await cb.loadScenario(id, textarea, preview, status, titleEl, listBody);
    }
  });
}
