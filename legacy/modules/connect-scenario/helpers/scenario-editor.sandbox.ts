/**
 * scenario-editor.sandbox.ts
 * Web Worker sandbox for JS runtime execution in DSL editor
 */

import { getDslEngine } from '../../../components/dsl';

/** Web Worker sandbox state */
let sandboxWorker: Worker | null = null;
let sandboxIdSeq = 1;

/** Get or create sandbox Web Worker */
export function getSandboxWorker(): Worker {
  if (sandboxWorker) return sandboxWorker;
  
  const code = `self.onmessage = async (e) => {
  const { id, type, payload } = e.data || {};
  try {
    if (type === 'exec') {
      const { code, args } = payload || {};
      const logs = [];
      const consoleProxy = { log: (...a) => logs.push(a.map(String).join(' ')) };
      const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
      const fn = new AsyncFunction('args','console', code);
      const result = await fn(args, consoleProxy);
      self.postMessage({ id, ok: true, logs, result });
      return;
    }
    self.postMessage({ id, ok: false, error: 'Unknown type' });
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err && err.stack ? err.stack : err) });
  }
};`;
  
  const blob = new Blob([code], { type: 'application/javascript' });
  sandboxWorker = new Worker(URL.createObjectURL(blob));
  return sandboxWorker;
}

/** Generate unique sandbox execution ID */
export function getNextSandboxId(): number {
  return sandboxIdSeq++;
}

export interface SandboxDeps {
  fetchDslFunctions: () => Promise<any[]>;
  fetchRuntimeState: () => Promise<Record<string, any>>;
  println: (msg: string) => void;
}

/**
 * Run DSL in JS sandbox (Web Worker)
 * Executes DSL tasks that have runtime='js' handlers
 */
export async function runDslSandbox(text: string, deps: SandboxDeps): Promise<void> {
  const { fetchDslFunctions, fetchRuntimeState, println } = deps;
  
  try {
    const dsl = getDslEngine();
    const res = dsl.parse(text);
    if (!res.ok) {
      println('❌ JS sandbox: DSL invalid');
      return;
    }
    
    const funcRows = await fetchDslFunctions();
    const runtime = await fetchRuntimeState();
    const worker = getSandboxWorker();
    
    const waitFor = (id: number) => new Promise<any>((resolve) => {
      const onMsg = (ev: MessageEvent) => {
        const d = (ev as MessageEvent).data || {};
        if (d.id === id) {
          try { worker.removeEventListener('message', onMsg as any); } catch { /* silent */ }
          resolve(d);
        }
      };
      worker.addEventListener('message', onMsg as any);
    });
    
    for (const g of res.ast.goals) {
      println(`🧪 JS: GOAL ${g.name}`);
      for (const t of g.tasks) {
        const fnName = String(t.function || '');
        const objName = String(t.object || '');
        const row = funcRows.find((r: any) => 
          String(r?.name || '') === fnName && String(r?.runtime || '') === 'js'
        );
        
        if (!row) {
          println(`⋯ brak JS handlera dla: ${fnName}`);
          continue;
        }
        
        const code = String(row?.handler || '').trim();
        if (!code) {
          println(`⋯ handler pusty dla: ${fnName}`);
          continue;
        }
        
        const id = getNextSandboxId();
        worker.postMessage({ 
          id, 
          type: 'exec', 
          payload: { code, args: { fn: fnName, object: objName, runtime } } 
        });
        
        const resp = await waitFor(id);
        if (resp.ok) {
          const logs = Array.isArray(resp.logs) ? resp.logs : [];
          for (const l of logs) println(`  • ${l}`);
          if (resp.result !== undefined) println(`  ↪ wynik: ${String(resp.result)}`);
        } else {
          println(`  ✖ błąd: ${String(resp.error || 'unknown')}`);
        }
      }
    }
  } catch (e: any) {
    println(`❌ JS sandbox: ${String(e)}`);
  }
}
