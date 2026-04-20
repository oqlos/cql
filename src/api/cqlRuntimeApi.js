/**
 * REST client for the cql-backend (Python FastAPI) runtime service.
 *
 * Calls go through nginx which proxies /api/cql/* to the cql-backend
 * container. In dev mode the Vite proxy (see `vite.config.js`) can point
 * directly at `http://localhost:8100`.
 *
 * All methods return plain values (string / object) and raise on HTTP
 * errors so callers can `try/catch` around them. The `NotImplementedError`
 * wrapper distinguishes 501 responses from the stub endpoints so callers
 * can fall back to a local implementation while the port is in progress.
 */

const API_BASE = (import.meta.env.VITE_CQL_BACKEND_BASE || "").replace(/\/$/, "");

export class CqlBackendError extends Error {
  constructor(message, { status, detail } = {}) {
    super(message);
    this.name = "CqlBackendError";
    this.status = status;
    this.detail = detail;
  }
}

export class NotImplementedError extends CqlBackendError {
  constructor(detail) {
    super(detail?.message || "Endpoint not implemented", { status: 501, detail });
    this.name = "NotImplementedError";
  }
}

async function post(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  if (res.status === 501) {
    const detail = await res.json().catch(() => ({}));
    throw new NotImplementedError(detail.detail || detail);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new CqlBackendError(`${res.status} ${res.statusText} — ${path}`, {
      status: res.status,
      detail: text,
    });
  }
  return res.json();
}

async function get(path) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    throw new CqlBackendError(`${res.status} ${res.statusText} — ${path}`, { status: res.status });
  }
  return res.json();
}

export const CqlRuntimeApi = {
  async health() { return get(`/health`); },

  async capabilities() { return get(`/api/cql/capabilities`); },

  // Quote / literal utilities — full parity with TS `dsl.quotes.ts`.
  async quote(value) { return (await post(`/api/cql/quote`, { value })).quoted; },
  async formatLiteral(value) { return (await post(`/api/cql/format-literal`, { value })).literal; },
  async unquote(token) { return post(`/api/cql/unquote`, { token }); },
  async canonicalize(text) { return (await post(`/api/cql/canonicalize`, { text })).text; },
  async normalize(text) { return (await post(`/api/cql/normalize`, { text })).text; },

  // Highlight — partial port; returns HTML safe for the protocol view.
  async highlightHtml(text) { return (await post(`/api/cql/highlight`, { text, mode: "html" })).html; },

  // Stubbed endpoints — will throw NotImplementedError until the port lands.
  async parse(text) { return post(`/api/cql/parse`, { text }); },
  async serialize(text) { return post(`/api/cql/serialize`, { text }); },
  async validate(text) { return post(`/api/cql/validate`, { text }); },
  async exec(text) { return post(`/api/cql/exec`, { text }); },
  async scenarioBuild(text) { return post(`/api/cql/scenario-build`, { text }); },
};
