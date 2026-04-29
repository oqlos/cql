// dsl/frontend/src/main.ts
/**
 * DSL Editor Frontend
 * Uses shared components from @shared/components/dsl*
 */

// Import shared DSL components
// These will be available once we set up proper imports
// import { DslEditor } from '@shared/components/dsl-editor';
// import { DslRuntime } from '@shared/components/dsl-runtime';

interface DslSchema {
  functions: Array<{ id: string; name: string; category?: string }>;
  objects: Array<{ id: string; name: string; type?: string }>;
  params: Array<{ id: string; name: string; type?: string }>;
  units: Array<{ id: string; name: string; symbol?: string; category?: string }>;
  variables: Array<{ id: string; name: string; type?: string; units?: string }>;
}

class DslEditorApp {
  private schema: DslSchema | null = null;
  private _listenersAttached = false;
  
  constructor() {
    this.init();
  }
  
  async init() {
    this._refresh();
  }
  
  /** Reload data + re-render + ensure listeners. Single entry point for all refreshes. */
  private async _refresh() {
    await this.loadSchema();
    this.render();
    this.setupEventListeners();
  }
  
  /** Central action dispatcher — the only place that calls _refresh(). */
  private _onAction(action: string, payload?: any) {
    switch (action) {
      case 'reload':
        this._refresh();
        break;
      case 'create':
        this.showCreateForm(payload);
        break;
      case 'delete':
        this._doDelete(payload.type, payload.id);
        break;
    }
  }
  
  async loadSchema() {
    try {
      const response = await fetch('/api/v1/schema');
      this.schema = await response.json();
      console.log('DSL Schema loaded:', this.schema);
    } catch (error) {
      console.error('Failed to load schema:', error);
    }
  }
  
  render() {
    const app = document.getElementById('app');
    if (!app) return;
    
    app.innerHTML = `
      <div class="dsl-editor-container">
        <header class="dsl-header">
          <h1>🔧 DSL Editor</h1>
          <div class="dsl-status" id="status">
            ${this.schema ? '✅ Connected' : '❌ Disconnected'}
          </div>
        </header>
        
        <div class="dsl-layout">
          <aside class="dsl-sidebar">
            <h2>📦 Objects</h2>
            <ul id="objects-list">
              ${this.renderList(this.schema?.objects || [], 'object')}
            </ul>
            
            <h2>⚡ Functions</h2>
            <ul id="functions-list">
              ${this.renderList(this.schema?.functions || [], 'function')}
            </ul>
            
            <h2>📐 Variables</h2>
            <ul id="variables-list">
              ${this.renderList(this.schema?.variables || [], 'variable')}
            </ul>
          </aside>
          
          <main class="dsl-main">
            <div class="dsl-toolbar">
              <button id="btn-new-object">➕ New Object</button>
              <button id="btn-new-function">➕ New Function</button>
              <button id="btn-new-variable">➕ New Variable</button>
              <button id="btn-refresh">🔄 Refresh</button>
            </div>
            
            <div class="dsl-editor" id="editor">
              <p>Select an item from the sidebar or create a new one.</p>
            </div>
          </main>
        </div>
      </div>
      
      <style>
        .dsl-editor-container {
          display: flex;
          flex-direction: column;
          height: 100vh;
        }
        
        .dsl-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 24px;
          background: #2a2a2a;
          color: white;
        }
        
        .dsl-header h1 {
          font-size: 24px;
        }
        
        .dsl-status {
          padding: 8px 16px;
          border-radius: 4px;
          background: #3a3a3a;
        }
        
        .dsl-layout {
          display: flex;
          flex: 1;
          overflow: hidden;
        }
        
        .dsl-sidebar {
          width: 280px;
          background: #f5f5f5;
          border-right: 1px solid #ddd;
          overflow-y: auto;
          padding: 16px;
        }
        
        .dsl-sidebar h2 {
          font-size: 14px;
          color: #666;
          margin: 16px 0 8px;
          padding-bottom: 4px;
          border-bottom: 1px solid #ddd;
        }
        
        .dsl-sidebar h2:first-child {
          margin-top: 0;
        }
        
        .dsl-sidebar ul {
          list-style: none;
        }
        
        .dsl-sidebar li {
          padding: 8px 12px;
          margin: 2px 0;
          background: white;
          border-radius: 4px;
          cursor: pointer;
          transition: background 0.2s;
        }
        
        .dsl-sidebar li:hover {
          background: #e3f2fd;
        }
        
        .dsl-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        
        .dsl-toolbar {
          display: flex;
          gap: 8px;
          padding: 12px 16px;
          background: #fafafa;
          border-bottom: 1px solid #ddd;
        }
        
        .dsl-toolbar button {
          padding: 8px 16px;
          border: 1px solid #ddd;
          background: white;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        }
        
        .dsl-toolbar button:hover {
          background: #f0f0f0;
        }
        
        .dsl-editor {
          flex: 1;
          padding: 24px;
          overflow-y: auto;
        }
      </style>
    `;
    
    // Event listeners are set up once via delegation in setupEventListeners()
  }
  
  renderList(items: Array<{ id: string; name: string; type?: string }>, type: string): string {
    if (items.length === 0) {
      return '<li style="color: #999; font-style: italic;">No items</li>';
    }
    
    return items.map(item => `
      <li data-id="${item.id}" data-type="${type}">
        ${item.name}
        ${item.type ? `<small style="color: #999;"> (${item.type})</small>` : ''}
      </li>
    `).join('');
  }
  
  setupEventListeners() {
    if (this._listenersAttached) return;
    this._listenersAttached = true;

    const app = document.getElementById('app');
    if (!app) return;

    app.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;

      // Toolbar buttons
      if (target.id === 'btn-refresh') {
        this._refresh();
        return;
      }
      if (target.id === 'btn-new-object') {
        this._onAction('create', 'object');
        return;
      }
      if (target.id === 'btn-new-function') {
        this._onAction('create', 'function');
        return;
      }
      if (target.id === 'btn-new-variable') {
        this._onAction('create', 'variable');
        return;
      }

      // Delete button (data-action delegation replaces inline onclick)
      if (target.dataset.action === 'delete') {
        this._doDelete(target.dataset.dtype!, target.dataset.did!);
        return;
      }

      // Sidebar list items
      const li = target.closest('li[data-id]') as HTMLElement | null;
      if (li?.dataset.id && li?.dataset.type) {
        this.showDetails(li.dataset.type, li.dataset.id);
      }
    });
  }
  
  showCreateForm(type: string) {
    const editor = document.getElementById('editor');
    if (!editor) return;
    
    editor.innerHTML = `
      <h2>Create New ${type.charAt(0).toUpperCase() + type.slice(1)}</h2>
      <form id="create-form" style="max-width: 500px;">
        <div style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 4px;">ID:</label>
          <input type="text" name="id" required style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
        </div>
        <div style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 4px;">Name:</label>
          <input type="text" name="name" required style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
        </div>
        <div style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 4px;">Type:</label>
          <input type="text" name="type" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
        </div>
        <div style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 4px;">Description:</label>
          <textarea name="description" rows="3" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;"></textarea>
        </div>
        <button type="submit" style="padding: 10px 20px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">
          Create ${type}
        </button>
      </form>
    `;
    
    document.getElementById('create-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target as HTMLFormElement);
      const data = Object.fromEntries(formData.entries());
      
      try {
        const endpoint = type === 'function' ? 'functions' : type === 'object' ? 'objects' : 'variables';
        const response = await fetch(`/api/v1/${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        
        if (response.ok) {
          alert(`${type} created successfully!`);
          this._refresh();
        } else {
          const error = await response.json();
          alert(`Error: ${error.detail || 'Unknown error'}`);
        }
      } catch (error) {
        alert(`Error: ${error}`);
      }
    });
  }
  
  showDetails(type: string, id: string) {
    const editor = document.getElementById('editor');
    if (!editor) return;
    
    let item;
    switch (type) {
      case 'object':
        item = this.schema?.objects.find(o => o.id === id);
        break;
      case 'function':
        item = this.schema?.functions.find(f => f.id === id);
        break;
      case 'variable':
        item = this.schema?.variables.find(v => v.id === id);
        break;
    }
    
    if (!item) {
      editor.innerHTML = '<p>Item not found</p>';
      return;
    }
    
    editor.innerHTML = `
      <h2>${item.name}</h2>
      <pre style="background: #f5f5f5; padding: 16px; border-radius: 4px; overflow: auto;">
${JSON.stringify(item, null, 2)}
      </pre>
      <div style="margin-top: 16px;">
        <button data-action="delete" data-dtype="${type}" data-did="${id}" 
                style="padding: 8px 16px; background: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer;">
          🗑️ Delete
        </button>
      </div>
    `;
  }
  
  private async _doDelete(type: string, id: string) {
    try {
      const endpoint = type === 'function' ? 'functions' : type === 'object' ? 'objects' : 'variables';
      const response = await fetch(`/api/v1/${endpoint}/${id}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        alert(`${type} deleted successfully!`);
        this._refresh();
      } else {
        const error = await response.json();
        alert(`Error: ${error.detail || 'Unknown error'}`);
      }
    } catch (error) {
      alert(`Error: ${error}`);
    }
  }
}

// Initialize app
const app = new DslEditorApp();
(window as any).dslApp = app;
