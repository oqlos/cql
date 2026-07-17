import {
  astToDslText,
  applyMappingToExecPlan,
  canonicalizeDslQuotes,
  DslScenarioBuilders,
  executeDsl,
  executeMappedDsl,
  formatDslLiteral,
  highlightDsl,
  normalizeDslTextQuotes,
  parseDsl,
  quoteDslValue,
  readQuotedToken,
  resolveFuncSteps,
  resolveTaskMapping,
  validateDslFormat,
} from '@oqlos/cql-runtime';
import { parseDslSsot, validateDslSsot } from './oql-v5-ssot.ts';

const VERSION = '0.1.0';

export type JsonBody = Record<string, unknown>;

export function readJsonBody(req: import('node:http').IncomingMessage): Promise<JsonBody> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw) as JsonBody);
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

export function jsonResponse(res: import('node:http').ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

export async function handleRequest(
  method: string,
  pathname: string,
  body: JsonBody,
): Promise<{ status: number; body: unknown } | null> {
  if (method === 'GET' && pathname === '/health') {
    return { status: 200, body: { status: 'ok', service: 'cql-runtime-server', version: VERSION } };
  }

  if (method === 'GET' && pathname === '/api/cql/capabilities') {
    return {
      status: 200,
      body: {
        runtime: 'node',
        package: '@oqlos/cql-runtime',
        implemented: [
          '/api/cql/quote',
          '/api/cql/unquote',
          '/api/cql/format-literal',
          '/api/cql/canonicalize',
          '/api/cql/normalize',
          '/api/cql/highlight',
          '/api/cql/parse',
          '/api/cql/serialize',
          '/api/cql/validate',
          '/api/cql/exec',
          '/api/cql/scenario-build',
          '/api/cql/resolve-task',
          '/api/cql/resolve-func',
          '/api/cql/exec-mapped',
        ],
        stubbed_501: [],
      },
    };
  }

  if (method !== 'POST' || !pathname.startsWith('/api/cql/')) {
    return null;
  }

  const text = String(body.text ?? '');

  switch (pathname) {
    case '/api/cql/quote':
      return { status: 200, body: { quoted: quoteDslValue(body.value) } };
    case '/api/cql/unquote':
      return { status: 200, body: readQuotedToken(String(body.token ?? '')) };
    case '/api/cql/format-literal':
      return { status: 200, body: { literal: formatDslLiteral(String(body.value ?? '')) } };
    case '/api/cql/canonicalize':
      return { status: 200, body: { text: canonicalizeDslQuotes(text) } };
    case '/api/cql/normalize':
      return { status: 200, body: { text: normalizeDslTextQuotes(text) } };
    case '/api/cql/highlight': {
      if (body.mode === 'tokens') {
        return {
          status: 501,
          body: {
            detail: {
              message: 'Token-stream highlight output is not implemented in Node runtime server.',
              ts_reference: 'oqlos/cql/runtime/dsl.highlight.ts',
            },
          },
        };
      }
      return { status: 200, body: { html: highlightDsl(text) } };
    }
    case '/api/cql/parse': {
      const ssot = parseDslSsot(text);
      if (ssot) {
        return { status: 200, body: { ok: ssot.ok, errors: ssot.errors, ast: ssot.ast } };
      }
      const result = parseDsl(text);
      return {
        status: 200,
        body: { ok: result.ok, errors: result.errors, ast: result.ast ?? null },
      };
    }
    case '/api/cql/serialize':
      return { status: 200, body: { text: astToDslText(body.ast as never) } };
    case '/api/cql/validate': {
      const ssot = validateDslSsot(text);
      if (ssot) {
        return {
          status: 200,
          body: {
            ok: ssot.ok,
            errors: ssot.errors,
            warnings: ssot.warnings,
            violations: ssot.violations,
            fixedText: ssot.fixedText,
          },
        };
      }
      const result = validateDslFormat(text);
      return {
        status: 200,
        body: {
          ok: result.ok,
          errors: result.errors,
          warnings: result.warnings,
          violations: result.violations,
          fixedText: result.fixedText,
        },
      };
    }
    case '/api/cql/exec': {
      const result = executeDsl(text, body.context as never);
      return {
        status: 200,
        body: { ok: result.ok, errors: result.errors, ast: result.ast ?? null, plan: result.plan },
      };
    }
    case '/api/cql/scenario-build': {
      const source = String(body.source ?? 'generic');
      const data = (body.data ?? {}) as Record<string, unknown>;
      if (source === 'test') {
        return {
          status: 200,
          body: {
            dsl: DslScenarioBuilders.buildDslFromTestScenario(data),
            goals: DslScenarioBuilders.buildGoalsFromTestScenario(data),
          },
        };
      }
      return {
        status: 200,
        body: { dsl: DslScenarioBuilders.buildDslFromGenericScenario(data) },
      };
    }
    case '/api/cql/resolve-task': {
      const hardwareMap = (body.hardware_map ?? body.hardwareMap ?? {}) as Record<string, unknown>;
      const task = (body.task ?? {}) as Record<string, unknown>;
      const resolved = resolveTaskMapping(hardwareMap, task, {
        environment: (body.environment as string | null | undefined) ?? null,
        usageMode: (body.usage_mode as string | null | undefined) ?? (body.usageMode as string | null | undefined) ?? null,
      });
      return { status: resolved.ok ? 200 : 400, body: resolved };
    }
    case '/api/cql/resolve-func': {
      const hardwareMap = (body.hardware_map ?? body.hardwareMap ?? {}) as Record<string, unknown>;
      const funcName = String(body.func_name ?? body.funcName ?? '');
      const result = resolveFuncSteps(hardwareMap, funcName, {
        environment: (body.environment as string | null | undefined) ?? null,
        usageMode: (body.usage_mode as string | null | undefined) ?? (body.usageMode as string | null | undefined) ?? null,
      });
      return { status: result.ok === false ? 400 : 200, body: result };
    }
    case '/api/cql/exec-mapped': {
      const hardwareMap = (body.hardware_map ?? body.hardwareMap ?? {}) as Record<string, unknown>;
      const result = executeMappedDsl(String(body.text ?? ''), hardwareMap, {
        environment: (body.environment as string | null | undefined) ?? null,
        usageMode: (body.usage_mode as string | null | undefined) ?? (body.usageMode as string | null | undefined) ?? null,
        execContext: body.context as Record<string, unknown> | undefined,
      });
      return {
        status: 200,
        body: {
          ok: result.ok,
          errors: result.errors,
          ast: result.ast ?? null,
          plan: result.plan,
          mappedPlan: result.mappedPlan,
        },
      };
    }
    default:
      return null;
  }
}
