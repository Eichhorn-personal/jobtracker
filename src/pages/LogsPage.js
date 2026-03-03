import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Container, Spinner } from "react-bootstrap";
import { useApi } from "../hooks/useApi";
import "../DataTable.css";

// Maps event type to the same chip-class system used for job statuses
const EVENT_CHIP = {
  USER_CREATED: "event-primary",
  USER_LOGIN:   "event-info",
  USER_LOGOUT:  "event-secondary",
  JOB_CREATED:  "event-success",
  JOB_UPDATED:  "event-warning",
  JOB_DELETED:  "event-danger",
};

const EVENT_TYPES = Object.keys(EVENT_CHIP);

function formatTimestamp(ts) {
  return new Date(ts).toLocaleString();
}

function SortIndicator({ dir }) {
  return (
    <svg
      width="9" height="9" viewBox="0 0 9 9" fill="currentColor"
      className="sort-indicator" aria-hidden="true"
    >
      {dir === "asc"
        ? <polygon points="4.5,1 8.5,8 0.5,8" />
        : <polygon points="4.5,8 8.5,1 0.5,1" />
      }
    </svg>
  );
}

function EntryDetails({ data }) {
  return (
    <span style={{ display: "flex", flexWrap: "wrap", gap: "0 12px" }}>
      {Object.entries(data)
        .filter(([k]) => k !== "id")
        .map(([k, v]) => (
          <span key={k}>{k}={String(v)}</span>
        ))}
    </span>
  );
}

export default function LogsPage() {
  const { request } = useApi();
  const navigate = useNavigate();
  const [entries, setEntries] = useState(null);
  const [filterEvent, setFilterEvent] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortDir, setSortDir] = useState("desc");

  const load = useCallback(() => {
    request("/api/logs")
      .then(res => res.json())
      .then(setEntries)
      .catch(console.error);
  }, [request]);

  useEffect(() => { load(); }, [load]);

  const q = searchTerm.trim().toLowerCase();
  const matchesSearch = (e) => {
    if (!q) return true;
    if (e.event.toLowerCase().includes(q)) return true;
    if (formatTimestamp(e.timestamp).toLowerCase().includes(q)) return true;
    if (Object.values(e.data).some(v => String(v).toLowerCase().includes(q))) return true;
    return false;
  };

  const displayed = entries === null ? null : [...entries]
    .filter(e => (!filterEvent || e.event === filterEvent) && matchesSearch(e))
    .sort((a, b) => {
      const diff = new Date(a.timestamp) - new Date(b.timestamp);
      return sortDir === "asc" ? diff : -diff;
    });

  return (
    <Container className="pt-3" style={{ maxWidth: 900 }}>

      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <button className="btn-toolbar-action" onClick={() => navigate("/admin")} aria-label="Back to admin">
          ← Back
        </button>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 400, color: "#5f6368", flexGrow: 1 }}>
          Activity Log
        </h1>
        <div className="search-box">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="search"
            placeholder="Search logs…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            aria-label="Search log entries"
          />
          {searchTerm && (
            <button className="search-clear" onClick={() => setSearchTerm("")} aria-label="Clear search">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
        </div>
        <select
          className="log-filter-select"
          value={filterEvent}
          onChange={e => setFilterEvent(e.target.value)}
          aria-label="Filter by event type"
        >
          <option value="">All events</option>
          {EVENT_TYPES.map(evt => (
            <option key={evt} value={evt}>{evt}</option>
          ))}
        </select>
        <button className="btn-toolbar-action" onClick={load}>
          Refresh
        </button>
      </div>

      {/* Content */}
      <div aria-live="polite">
        {entries === null ? (
          <div className="text-center mt-5"><Spinner animation="border" /></div>
        ) : entries.length === 0 ? (
          <p className="text-muted">No log entries yet.</p>
        ) : displayed.length === 0 ? (
          <p className="text-muted">No entries match the current filter.</p>
        ) : (
          <div className="sheet-scroll" role="table" aria-label="Activity log entries">

            {/* Header */}
            <div className="sheet-grid sheet-header" role="row">
              <div
                className="sheet-cell" role="columnheader"
                style={{ width: 190, flexShrink: 0 }}
                aria-sort={sortDir === "asc" ? "ascending" : "descending"}
              >
                <button
                  className="sheet-header-btn"
                  onClick={() => setSortDir(d => d === "asc" ? "desc" : "asc")}
                >
                  Time <SortIndicator dir={sortDir} />
                </button>
              </div>
              <div className="sheet-cell" role="columnheader" style={{ width: 140, flexShrink: 0 }}>Event</div>
              <div className="sheet-cell" role="columnheader" style={{ flex: 1, minWidth: 100 }}>Details</div>
            </div>

            {/* Rows */}
            {displayed.map((e, i) => (
              <div key={i} className="sheet-grid" role="row">
                <div className="sheet-cell" role="cell" style={{ width: 190, flexShrink: 0 }}>
                  <span style={{ padding: "4px 10px", fontSize: 13, color: "#5f6368" }}>
                    {formatTimestamp(e.timestamp)}
                  </span>
                </div>
                <div className="sheet-cell" role="cell" style={{ width: 140, flexShrink: 0 }}>
                  <span className={`status-chip ${EVENT_CHIP[e.event] || "event-secondary"}`}>
                    {e.event}
                  </span>
                </div>
                <div className="sheet-cell" role="cell" style={{ flex: 1, minWidth: 100, fontSize: 13 }}>
                  <span style={{ padding: "4px 10px", overflow: "hidden" }}>
                    <EntryDetails data={e.data} />
                  </span>
                </div>
              </div>
            ))}

          </div>
        )}
      </div>
    </Container>
  );
}
