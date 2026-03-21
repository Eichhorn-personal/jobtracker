import { useState, useEffect, useCallback, useRef } from "react";
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
  const pairs = Object.entries(data).filter(([k]) => k !== "id");
  if (!pairs.length) return null;
  return (
    <>
      {pairs.map(([k, v]) => (
        <span key={k} className="log-detail-pair">
          <span className="log-detail-key">{k}</span>
          <span className="log-detail-val">{String(v)}</span>
        </span>
      ))}
    </>
  );
}

export default function LogsPage() {
  const { request } = useApi();
  const navigate = useNavigate();
  const [entries, setEntries] = useState(null);
  const [filterEvents, setFilterEvents] = useState(new Set(EVENT_TYPES));
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef(null);
  // Tracks every event type seen so far; new types get auto-selected, but
  // types the user has unchecked won't be re-added on refresh.
  const seenTypesRef = useRef(new Set(EVENT_TYPES));
  const [searchTerm, setSearchTerm] = useState("");
  const [sortDir, setSortDir] = useState("desc");

  useEffect(() => {
    if (!filterOpen) return;
    const onMouseDown = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) {
        setFilterOpen(false);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [filterOpen]);

  const toggleEvent = (evt) => {
    setFilterEvents(prev => {
      const next = new Set(prev);
      if (next.has(evt)) next.delete(evt);
      else next.add(evt);
      return next;
    });
  };

  const allEventTypes = entries
    ? [...new Set(entries.map(e => e.event))].sort()
    : [...seenTypesRef.current].sort();
  const allSelected = allEventTypes.length > 0 && allEventTypes.every(t => filterEvents.has(t));
  const filterLabel = allSelected
    ? "All events"
    : `${allEventTypes.filter(t => filterEvents.has(t)).length} of ${allEventTypes.length}`;

  const load = useCallback(() => {
    request("/api/logs")
      .then(res => res.json())
      .then(data => {
        setEntries(data);
        // Auto-select any event types not seen before (preserves user's unchecked state).
        const newTypes = data.map(e => e.event).filter(t => !seenTypesRef.current.has(t));
        if (newTypes.length > 0) {
          newTypes.forEach(t => seenTypesRef.current.add(t));
          setFilterEvents(prev => {
            const next = new Set(prev);
            newTypes.forEach(t => next.add(t));
            return next;
          });
        }
      })
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
    .filter(e => filterEvents.has(e.event) && matchesSearch(e))
    .sort((a, b) => {
      const diff = new Date(a.timestamp) - new Date(b.timestamp);
      return sortDir === "asc" ? diff : -diff;
    });

  return (
    <Container className="pt-3 px-0 px-md-3" style={{ maxWidth: 900 }}>

      {/* Toolbar */}
      <div className="px-3 px-md-0" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <button className="btn-toolbar-action" onClick={() => navigate("/admin")} aria-label="Back to admin" style={{ padding: "6px 10px" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <h1 className="text-muted" style={{ margin: 0, fontSize: 18, fontWeight: 400, flexGrow: 1 }}>
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
        <div ref={filterRef} style={{ position: "relative" }}>
          <button
            className={`log-filter-btn${!allSelected ? " log-filter-btn--active" : ""}`}
            onClick={() => setFilterOpen(o => !o)}
            aria-haspopup="true"
            aria-expanded={filterOpen}
            aria-label="Filter by event type"
          >
            {filterLabel}
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true" style={{ marginLeft: 4, opacity: 0.6 }}>
              <polygon points="1,3 9,3 5,8" />
            </svg>
          </button>
          {filterOpen && (
            <div className="log-filter-menu">
              {allEventTypes.map(evt => (
                <label key={evt} className="log-filter-item">
                  <input
                    type="checkbox"
                    checked={filterEvents.has(evt)}
                    onChange={() => toggleEvent(evt)}
                  />
                  <span className={`status-chip ${EVENT_CHIP[evt] || "event-secondary"}`} style={{ fontSize: 11 }}>{evt}</span>
                </label>
              ))}
              {!allSelected && (
                <>
                  <div className="log-filter-divider" />
                  <button
                    className="log-filter-clear"
                    onClick={() => setFilterEvents(prev => {
                      const next = new Set(prev);
                      allEventTypes.forEach(t => next.add(t));
                      return next;
                    })}
                  >
                    Select all
                  </button>
                </>
              )}
            </div>
          )}
        </div>
        <button className="btn-toolbar-action" onClick={load} aria-label="Refresh" style={{ padding: "6px 10px" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="23 4 23 10 17 10"/>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
        </button>
      </div>

      {/* Content */}
      <div aria-live="polite">
        {entries === null ? (
          <div className="text-center mt-5"><Spinner animation="border" /></div>
        ) : entries.length === 0 ? (
          <p className="text-muted px-3 px-md-0">No log entries yet.</p>
        ) : displayed.length === 0 ? (
          <p className="text-muted px-3 px-md-0">No entries match the current filter.</p>
        ) : (
          <>
            {/* ── Mobile cards ─────────────────────────────────────── */}
            <div className="log-cards d-md-none" aria-label="Activity log entries">
              {displayed.map((e, i) => (
                <div key={i} className="log-card">
                  <div className="log-card-header">
                    <span className={`status-chip ${EVENT_CHIP[e.event] || "event-secondary"}`} style={{ fontSize: 11 }}>
                      {e.event}
                    </span>
                    <span className="log-card-time">{formatTimestamp(e.timestamp)}</span>
                  </div>
                  <div className="log-card-details">
                    <EntryDetails data={e.data} />
                  </div>
                </div>
              ))}
            </div>

            {/* ── Desktop table ─────────────────────────────────────── */}
            <div className="sheet-scroll sheet-scroll--limited d-none d-md-block" style={{ maxHeight: "70vh" }} role="table" aria-label="Activity log entries">

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
                    <span style={{ padding: "4px 10px", fontSize: 13 }}>
                      {formatTimestamp(e.timestamp)}
                    </span>
                  </div>
                  <div className="sheet-cell" role="cell" style={{ width: 140, flexShrink: 0 }}>
                    <span className={`status-chip ${EVENT_CHIP[e.event] || "event-secondary"}`}>
                      {e.event}
                    </span>
                  </div>
                  <div className="sheet-cell" role="cell" style={{ flex: 1, minWidth: 100 }}>
                    <div style={{ padding: "4px 10px", display: "flex", flexWrap: "wrap", gap: "2px 12px", overflow: "hidden" }}>
                      <EntryDetails data={e.data} />
                    </div>
                  </div>
                </div>
              ))}

            </div>
          </>
        )}
      </div>
    </Container>
  );
}
