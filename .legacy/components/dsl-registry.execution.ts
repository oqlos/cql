// dsl-registry.execution.ts
// Extracted mapping execution: API calls, substitution, comparison

import { fetchWithAuth } from '../../utils/fetch.utils';
import type { ActionMapping, ParamMapping, FuncMapping, ExecutionContext } from './dsl-registry.types';

// --- Pure utilities ---

export function toNumber(value: any): number | null {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const num = parseFloat(value);
    return isNaN(num) ? null : num;
  }
  if (value && typeof value === 'object' && 'value' in value) {
    return toNumber(value.value);
  }
  return null;
}

const RELATIONAL_OPS: Record<string, (l: number, r: number) => boolean> = {
  '>':  (l, r) => l > r,
  '<':  (l, r) => l < r,
  '>=': (l, r) => l >= r,
  '<=': (l, r) => l <= r,
};

function compareEquality(left: any, operator: string, right: any): boolean | null {
  const leftNum = toNumber(left);
  const rightNum = toNumber(right);
  if (operator === '!=' ) {
    if (leftNum !== null && rightNum !== null) return leftNum !== rightNum;
    return String(left ?? '') !== String(right ?? '');
  }
  // '=' or '=='
  if (leftNum !== null && rightNum !== null) return leftNum === rightNum;
  return String(left ?? '') === String(right ?? '');
}

export function compare(left: any, operator: string, right: any): boolean {
  if (operator === '=' || operator === '==') return compareEquality(left, '=', right) ?? false;
  if (operator === '!=') return compareEquality(left, '!=', right) ?? false;
  const relOp = RELATIONAL_OPS[operator];
  if (relOp) {
    const l = typeof left === 'number' ? left : parseFloat(left) || 0;
    const r = typeof right === 'number' ? right : parseFloat(right) || 0;
    return relOp(l, r);
  }
  return false;
}

export function substitute(template: string, context: Record<string, any>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(context[key] || ''));
}

export function substituteObj(obj: Record<string, any>, context: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = typeof value === 'string' ? substitute(value, context) : value;
  }
  return result;
}

// --- API execution ---

export async function executeApi(mapping: ActionMapping | ParamMapping, context: Record<string, any>): Promise<any> {
  if (!mapping.url) return null;

  const url = substitute(mapping.url, context);
  const method = ('method' in mapping ? mapping.method : 'GET') || 'GET';
  const body = 'body' in mapping && mapping.body
    ? JSON.parse(substitute(JSON.stringify(mapping.body), context))
    : undefined;

  const response = await fetchWithAuth(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: body ? JSON.stringify(body) : undefined,
  });

  return response.json();
}

export function executeUi(mapping: ActionMapping, context: Record<string, any>): Promise<any> {
  return new Promise((resolve) => {
    const event = new CustomEvent('dsl:ui', {
      detail: {
        component: mapping.component,
        props: substituteObj(mapping.props || {}, context),
        resolve,
      },
    });
    window.dispatchEvent(event);
  });
}

export async function executeOnBackend(backendUrl: string, command: string, params: Record<string, any>): Promise<any> {
  const response = await fetchWithAuth(`${backendUrl}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ command, params }),
  });
  return response.json();
}

// --- Mapping execution ---

export interface MappingDeps {
  backendUrl: string;
  executeTask(action: string, object: string, value?: string): Promise<any>;
}

export async function executeMapping(mapping: ActionMapping | ParamMapping, context: Record<string, any>, deps: MappingDeps): Promise<any> {
  const kind = mapping.kind || 'backend';

  switch (kind) {
    case 'api':
      return executeApi(mapping, context);

    case 'function':
      if ('handler' in mapping && mapping.handler) {
        return mapping.handler(context.action || context.param, context.object, context.value);
      }
      break;

    case 'ui':
      return executeUi(mapping as ActionMapping, context);

    case 'backend':
      return executeOnBackend(
        deps.backendUrl,
        context.action ? 'TASK' : 'VAL',
        context
      );
  }

  return null;
}

export async function executeFuncMapping(mapping: FuncMapping, context: ExecutionContext, deps: MappingDeps): Promise<any> {
  if (mapping.kind === 'sequence' && mapping.steps) {
    for (const step of mapping.steps) {
      await deps.executeTask(step.action, step.object, step.value);
    }
    return { success: true };
  }

  if (mapping.handler) {
    return mapping.handler('', context);
  }

  if (mapping.py) {
    return executeOnBackend(deps.backendUrl, 'FUNC', { py: mapping.py });
  }

  return null;
}
