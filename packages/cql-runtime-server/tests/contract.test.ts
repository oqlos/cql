import assert from 'node:assert/strict';
import { once } from 'node:events';
import http from 'node:http';
import { after, before, describe, it } from 'node:test';

import { handleRequest } from '../src/routes.ts';

function request(
  baseUrl: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; json: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const url = new URL(path, baseUrl);
    const req = http.request(
      url,
      {
        method,
        headers: payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {},
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          resolve({ status: res.statusCode ?? 0, json: raw ? JSON.parse(raw) : {} });
        });
      },
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

describe('cql-runtime-server routes (in-process)', () => {
  it('health reports node runtime', async () => {
    const res = await handleRequest('GET', '/health', {});
    assert.equal(res?.status, 200);
    assert.equal(res?.body.service, 'cql-runtime-server');
  });

  it('parse + exec minimal DSL', async () => {
    const dsl = [
      'SCENARIO: smoke',
      '',
      'GOAL: G1',
      "  SET 'x' '1'",
      "  IF 'x' = '1'",
    ].join('\n');

    const parsed = await handleRequest('POST', '/api/cql/parse', { text: dsl });
    assert.equal(parsed?.status, 200);
    assert.equal((parsed?.body as { ok: boolean }).ok, true);

    const executed = await handleRequest('POST', '/api/cql/exec', { text: dsl });
    assert.equal(executed?.status, 200);
    assert.equal((executed?.body as { ok: boolean }).ok, true);
    const plan = (executed?.body as { plan: unknown[] }).plan;
    assert.ok(Array.isArray(plan) && plan.length > 0);
  });
});

describe('cql-runtime-server HTTP', () => {
  let server: http.Server;
  let baseUrl = '';

  before(async () => {
    server = http.createServer(async (req, res) => {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1');
      const body =
        req.method === 'POST'
          ? await new Promise<Record<string, unknown>>((resolve, reject) => {
              const chunks: Buffer[] = [];
              req.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
              req.on('end', () => resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}));
              req.on('error', reject);
            })
          : {};
      const handled = await handleRequest(req.method ?? 'GET', url.pathname, body);
      const payload = JSON.stringify(handled?.body ?? { error: 'not found' });
      res.writeHead(handled?.status ?? 404, { 'Content-Type': 'application/json' });
      res.end(payload);
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const addr = server.address();
    if (!addr || typeof addr === 'string') throw new Error('no address');
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  after(async () => {
    server.close();
    await once(server, 'close');
  });

  it('quote endpoint matches Python contract shape', async () => {
    const res = await request(baseUrl, 'POST', '/api/cql/quote', { value: 'hello' });
    assert.equal(res.status, 200);
    assert.equal(res.json.quoted, "'hello'");
  });
});
