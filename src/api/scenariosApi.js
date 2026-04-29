// REST client for maskservice /api/v3/data/test_scenarios endpoints.
// The actual host is either same-origin (when cql is reverse-proxied) or
// configured via VITE_API_BASE (preferred in dev).

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
  let content = null;
  if (row.content && typeof row.content === "object") content = row.content;
  else if (typeof row.content === "string") {
    try { content = JSON.parse(row.content); } catch { content = null; }
  }
  return {
    id: row.id || row.scenario_id || "",
    title: row.title || row.name || "",
    content,
    dsl: content?.dsl ?? row.dsl,
    def: content?.def ?? row.def,
    map: content?.map ?? row.map,
    func: content?.func ?? row.func,
    library: row.library,
    config: row.config,
    updatedAt: row.updated_at || row.updatedAt || "",
  };
}

export const ScenariosApi = {
  async list({ filter = "", limit = 500, skip = 0 } = {}) {
    const data = await request(
      `/api/v3/data/test_scenarios?skip=${skip}&limit=${limit}${
        filter ? `&filters=${encodeURIComponent(JSON.stringify({ title: filter }))}` : ""
      }`
    );
    const rows = Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data?.rows)
        ? data.rows
        : Array.isArray(data)
          ? data
          : [];
    return rows.map(normalizeRow);
  },

  async get(id) {
    if (!id) return null;
    // First try the "filters" endpoint used by maskservice helpers.
    try {
      const filters = encodeURIComponent(JSON.stringify({ id }));
      const data = await request(`/api/v3/data/test_scenarios?filters=${filters}`);
      const row = Array.isArray(data?.data) ? data.data[0]
        : Array.isArray(data?.rows) ? data.rows[0]
        : Array.isArray(data) ? data[0]
        : data?.row || null;
      if (row) return normalizeRow(row);
    } catch (err) {
      if (err.status && err.status !== 404) throw err;
    }
    // Fallback: by-id route
    try {
      const data = await request(`/api/v3/scenarios/${encodeURIComponent(id)}`);
      return normalizeRow(data?.data || data?.row || data);
    } catch (err) {
      if (err.status === 404) return null;
      throw err;
    }
  },

  async create({ title }) {
    let data;
    try {
      data = await request(`/api/v3/data/test_scenarios`, {
        method: "POST",
        body: JSON.stringify({ title }),
      });
    } catch {
      data = await request(`/api/v3/data/test_scenarios`, {
        method: "POST",
        body: JSON.stringify({ data: { title } }),
      });
    }
    return (data?.row?.id || data?.data?.scenario_id || data?.id || "").toString();
  },

  async update(id, payload) {
    try {
      return await request(`/api/v3/data/test_scenarios/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
    } catch {
      return request(`/api/v3/data/test_scenarios/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ data: payload }),
      });
    }
  },

  async remove(id) {
    return request(`/api/v3/data/test_scenarios/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  async saveDsl(id, dsl) {
    try {
      return await request(`/api/v3/scenarios/${encodeURIComponent(id)}`, {
        method: "PUT",
        body: JSON.stringify({ dsl }),
      });
    } catch {
      return this.update(id, { dsl });
    }
  },

  async saveContent(id, content) {
    const dsl = typeof content === "object" ? content?.dsl : content;
    if (dsl !== undefined) return this.saveDsl(id, dsl);
    return this.update(id, { content });
  },
};

export function getApiBase() {
  return API_BASE || window.location.origin;
}
