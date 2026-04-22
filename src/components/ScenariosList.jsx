import { useState, useEffect, useCallback, useRef } from "react";
import { ScenariosApi } from "../api/scenariosApi";

const REFRESH_INTERVAL_MS = 30_000;

export default function ScenariosList({ activeId, onSelect, onCreated, onDeleted }) {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("idle"); // idle | loading | error
  const [filter, setFilter] = useState("");
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const inputRef = useRef(null);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const data = await ScenariosApi.list({ filter, limit: 200 });
      setRows(data);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const timer = setInterval(load, REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [load]);

  const handleCreate = useCallback(async () => {
    const title = newTitle.trim();
    if (!title) return;
    try {
      const id = await ScenariosApi.create({ title });
      setNewTitle("");
      setCreating(false);
      await load();
      if (id && onCreated) onCreated(id, title);
    } catch {
      alert("Błąd tworzenia scenariusza");
    }
  }, [newTitle, load, onCreated]);

  const handleDelete = useCallback(async (e, id) => {
    e.stopPropagation();
    if (!window.confirm("Usunąć scenariusz?")) return;
    setDeletingId(id);
    try {
      await ScenariosApi.remove(id);
      await load();
      if (onDeleted) onDeleted(id);
    } catch {
      alert("Błąd usuwania scenariusza");
    } finally {
      setDeletingId(null);
    }
  }, [load, onDeleted]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === "Enter") handleCreate();
    if (e.key === "Escape") { setCreating(false); setNewTitle(""); }
  }, [handleCreate]);

  useEffect(() => {
    if (creating && inputRef.current) inputRef.current.focus();
  }, [creating]);

  const filtered = filter
    ? rows.filter((r) => (r.title || "").toLowerCase().includes(filter.toLowerCase()))
    : rows;

  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        <span style={styles.title}>Scenariusze</span>
        <span style={styles.count}>{rows.length}</span>
        <button style={styles.iconBtn} onClick={load} title="Odśwież">↻</button>
        <button style={styles.addBtn} onClick={() => setCreating(true)} title="Nowy scenariusz">+</button>
      </div>

      <div style={styles.searchWrap}>
        <input
          style={styles.search}
          placeholder="Szukaj…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      {creating && (
        <div style={styles.createRow}>
          <input
            ref={inputRef}
            style={styles.createInput}
            placeholder="Nazwa scenariusza…"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button style={styles.saveBtn} onClick={handleCreate}>✓</button>
          <button style={styles.cancelBtn} onClick={() => { setCreating(false); setNewTitle(""); }}>✕</button>
        </div>
      )}

      <div style={styles.list}>
        {status === "loading" && rows.length === 0 && (
          <div style={styles.msg}>Ładowanie…</div>
        )}
        {status === "error" && (
          <div style={{ ...styles.msg, color: "var(--accent-red)" }}>
            Błąd połączenia z API
          </div>
        )}
        {status !== "loading" && filtered.length === 0 && (
          <div style={styles.msg}>Brak scenariuszy</div>
        )}
        {filtered.map((row) => (
          <div
            key={row.id}
            style={{
              ...styles.item,
              ...(activeId === row.id ? styles.itemActive : {}),
            }}
            onClick={() => onSelect && onSelect(row)}
          >
            <div style={styles.itemTitle}>{row.title || row.id}</div>
            <div style={styles.itemMeta}>
              <span style={styles.itemId}>#{(row.id || "").slice(-6)}</span>
              {row.updatedAt && (
                <span style={styles.itemDate}>
                  {new Date(row.updatedAt).toLocaleDateString("pl-PL")}
                </span>
              )}
            </div>
            <button
              style={styles.deleteBtn}
              disabled={deletingId === row.id}
              onClick={(e) => handleDelete(e, row.id)}
              title="Usuń"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  panel: {
    display: "flex",
    flexDirection: "column",
    width: "220px",
    minWidth: "180px",
    background: "var(--bg-card)",
    borderRight: "1px solid var(--border-color)",
    flexShrink: 0,
    overflow: "hidden",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    padding: "10px 10px 6px",
    borderBottom: "1px solid var(--border-color)",
  },
  title: {
    flex: 1,
    fontSize: "11px",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    color: "var(--text-muted)",
  },
  count: {
    fontSize: "11px",
    color: "var(--text-muted)",
    background: "var(--bg-deep)",
    borderRadius: "10px",
    padding: "1px 6px",
  },
  iconBtn: {
    background: "none",
    border: "none",
    color: "var(--text-muted)",
    cursor: "pointer",
    padding: "2px 4px",
    fontSize: "14px",
    lineHeight: 1,
  },
  addBtn: {
    background: "var(--accent-blue)",
    border: "none",
    color: "#fff",
    cursor: "pointer",
    padding: "2px 7px",
    borderRadius: "4px",
    fontSize: "16px",
    lineHeight: 1,
    fontWeight: 700,
  },
  searchWrap: {
    padding: "6px 8px",
    borderBottom: "1px solid var(--border-color)",
  },
  search: {
    width: "100%",
    boxSizing: "border-box",
    background: "var(--bg-deep)",
    border: "1px solid var(--border-color)",
    borderRadius: "4px",
    padding: "4px 8px",
    fontSize: "12px",
    color: "var(--text-primary)",
    outline: "none",
  },
  createRow: {
    display: "flex",
    gap: "4px",
    padding: "6px 8px",
    borderBottom: "1px solid var(--border-color)",
    alignItems: "center",
  },
  createInput: {
    flex: 1,
    background: "var(--bg-deep)",
    border: "1px solid var(--accent-blue)",
    borderRadius: "4px",
    padding: "4px 6px",
    fontSize: "12px",
    color: "var(--text-primary)",
    outline: "none",
  },
  saveBtn: {
    background: "var(--accent-green)",
    border: "none",
    color: "#fff",
    borderRadius: "4px",
    padding: "3px 7px",
    cursor: "pointer",
    fontSize: "13px",
  },
  cancelBtn: {
    background: "var(--bg-deep)",
    border: "1px solid var(--border-color)",
    color: "var(--text-muted)",
    borderRadius: "4px",
    padding: "3px 7px",
    cursor: "pointer",
    fontSize: "13px",
  },
  list: {
    flex: 1,
    overflowY: "auto",
  },
  msg: {
    padding: "16px 12px",
    fontSize: "12px",
    color: "var(--text-muted)",
    textAlign: "center",
  },
  item: {
    position: "relative",
    padding: "8px 10px",
    cursor: "pointer",
    borderBottom: "1px solid var(--border-color)",
    transition: "background 0.1s",
  },
  itemActive: {
    background: "rgba(59,130,246,0.15)",
    borderLeft: "3px solid var(--accent-blue)",
    paddingLeft: "7px",
  },
  itemTitle: {
    fontSize: "13px",
    color: "var(--text-primary)",
    fontWeight: 500,
    wordBreak: "break-word",
    paddingRight: "20px",
  },
  itemMeta: {
    display: "flex",
    gap: "8px",
    marginTop: "2px",
  },
  itemId: {
    fontSize: "10px",
    color: "var(--text-muted)",
    fontFamily: "var(--font-mono)",
  },
  itemDate: {
    fontSize: "10px",
    color: "var(--text-muted)",
  },
  deleteBtn: {
    position: "absolute",
    top: "6px",
    right: "6px",
    background: "none",
    border: "none",
    color: "var(--text-muted)",
    cursor: "pointer",
    fontSize: "11px",
    padding: "2px 4px",
    opacity: 0.5,
    lineHeight: 1,
  },
};
