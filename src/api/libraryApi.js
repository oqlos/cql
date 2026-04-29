// REST client for maskservice /api/v3/dsl/* endpoints.
// Manages DSL library items: objects, functions, params.

const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");

function url(path) {
  return `${API_BASE}${path}`;
}

async function request(path, init = {}) {
  const res = await fetch(url(path), {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init.headers || {}) },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(`HTTP ${res.status} ${res.statusText} — ${path}`);
    err.status = res.status;
    err.body = text;
    throw err;
  }
  if (res.status === 204) return null;
  return res.json();
}

function normalizeRow(row) {
  if (!row) return null;
  return {
    id: row.id || "",
    name: row.name || "",
    units: row.units || "",
    runtime: row.runtime || "",
    handler: row.handler || "",
    createdAt: row.created_at || row.createdAt || "",
    updatedAt: row.updated_at || row.updatedAt || "",
  };
}

export const LibraryApi = {
  // Objects
  async listObjects({ limit = 1000, skip = 0 } = {}) {
    const data = await request(`/api/v3/dsl/objects?skip=${skip}&limit=${limit}`);
    const rows = Array.isArray(data?.data) ? data.data : Array.isArray(data?.rows) ? data.rows : Array.isArray(data) ? data : [];
    return rows.map(normalizeRow);
  },

  async addObject({ name }) {
    const data = await request(`/api/v3/dsl/objects`, {
      method: "POST",
      body: JSON.stringify({ data: { name } }),
    });
    return (data?.row?.id || data?.data?.id || data?.id || "").toString();
  },

  async deleteObject(id) {
    return request(`/api/v3/dsl/objects/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  // Functions
  async listFunctions({ limit = 1000, skip = 0 } = {}) {
    const data = await request(`/api/v3/dsl/functions?skip=${skip}&limit=${limit}`);
    const rows = Array.isArray(data?.data) ? data.data : Array.isArray(data?.rows) ? data.rows : Array.isArray(data) ? data : [];
    return rows.map(normalizeRow);
  },

  async addFunction({ name, runtime = "firmware", handler }) {
    const data = await request(`/api/v3/dsl/functions`, {
      method: "POST",
      body: JSON.stringify({ data: { name, runtime, handler } }),
    });
    return (data?.row?.id || data?.data?.id || data?.id || "").toString();
  },

  async deleteFunction(id) {
    return request(`/api/v3/dsl/functions/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  // Params
  async listParams({ limit = 1000, skip = 0 } = {}) {
    const data = await request(`/api/v3/dsl/params?skip=${skip}&limit=${limit}`);
    const rows = Array.isArray(data?.data) ? data.data : Array.isArray(data?.rows) ? data.rows : Array.isArray(data) ? data : [];
    return rows.map(normalizeRow);
  },

  async addParam({ name, units = [] }) {
    const data = await request(`/api/v3/dsl/params`, {
      method: "POST",
      body: JSON.stringify({ data: { name, units: JSON.stringify(units) } }),
    });
    return (data?.row?.id || data?.data?.id || data?.id || "").toString();
  },

  async deleteParam(id) {
    return request(`/api/v3/dsl/params/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },
};
