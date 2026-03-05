import { useState, useEffect } from "react";
import { Button, Container, Modal } from "react-bootstrap";
import { useApi } from "../hooks/useApi";
import AddJobModal from "./AddJobModal";
import { statusClass } from "../utils/statusColor";
import { ARCHIVED_STATUSES } from "../constants/jobs";
import "../DataTable.css";

const COLUMNS = ["Date", "Role", "Company", "Status"];

function SortIndicator({ col, sortConfig }) {
  if (sortConfig.col !== col) return null;
  return (
    <svg
      width="9" height="9" viewBox="0 0 9 9" fill="currentColor"
      className="sort-indicator" aria-hidden="true"
    >
      {sortConfig.dir === "asc"
        ? <polygon points="4.5,1 8.5,8 0.5,8" />
        : <polygon points="4.5,8 8.5,1 0.5,1" />
      }
    </svg>
  );
}

const parseDateVal = (str) => {
  if (!str) return 0;
  const parts = str.split("/");
  if (parts.length !== 3) return 0;
  const [m, d, y] = parts;
  return parseInt(`${y}${m.padStart(2, "0")}${d.padStart(2, "0")}`, 10);
};

const isArchived = (row) => ARCHIVED_STATUSES.includes((row.Status || "").toLowerCase());

function Chevron({ open }) {
  return (
    <svg
      width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className={`archived-chevron${open ? " archived-chevron--open" : ""}`}
      aria-hidden="true"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

// Fixed px width for constrained columns; flex for fluid ones
const COL_STYLE = {
  Date:    { width: 115,  flexShrink: 0 },
  Role:    { flex: 1,     minWidth: 80 },
  Company: { flex: 1,     minWidth: 80 },
  Status:  { width: 130,  flexShrink: 0 },
};

export default function DataTable() {
  const [rows, setRows] = useState([]);
  const [dropdownOptions, setDropdownOptions] = useState({});
  const [statusColorMap, setStatusColorMap] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [sortConfig, setSortConfig] = useState({ col: "Date", dir: "desc" });
  const [showAddModal, setShowAddModal] = useState(false);
  const [viewingRow, setViewingRow] = useState(null);
  const [confirmRow, setConfirmRow] = useState(null);
  const [selectedRow, setSelectedRow] = useState(null);
  const { request } = useApi();

  // Load rows + dropdown options from API on mount — independently so one failure can't blank the other
  useEffect(() => {
    request("/api/jobs")
      .then(res => res.json())
      .then(data => setRows(data))
      .catch(err => console.error("Failed to load jobs:", err));

    request("/api/dropdowns")
      .then(res => res.json())
      .then(optionsData => {
        const labels = {};
        const colorMap = {};
        for (const [field, opts] of Object.entries(optionsData)) {
          labels[field] = opts.map(o => o.label);
          if (field === "Status") {
            for (const o of opts) {
              if (o.color) colorMap[o.label] = o.color;
            }
          }
        }
        setDropdownOptions(labels);
        setStatusColorMap(colorMap);
      })
      .catch(err => console.error("Failed to load dropdown options:", err));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAddJob = async (formData) => {
    try {
      const res = await request("/api/jobs", {
        method: "POST",
        body: JSON.stringify(formData),
      });
      const created = await res.json();
      setRows(prev => [...prev, created]);
    } catch (err) {
      console.error("Failed to add job:", err);
    }
  };

  const handleSaveJob = async (formData) => {
    const id = viewingRow.id;
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...formData } : r));
    try {
      await request(`/api/jobs/${id}`, {
        method: "PUT",
        body: JSON.stringify(formData),
      });
    } catch (err) {
      console.error("Failed to save job:", err);
    }
  };

  const deleteRow = async (id) => {
    setRows(prev => prev.filter(r => r.id !== id));
    try {
      await request(`/api/jobs/${id}`, { method: "DELETE" });
    } catch (err) {
      console.error("Failed to delete row:", err);
    }
  };

  const toggleSelect = (row) =>
    setSelectedRow(prev => prev?.id === row.id ? null : row);

  const handleHeaderClick = (col) => {
    setSortConfig(prev =>
      prev.col === col
        ? { col, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { col, dir: col === "Date" ? "desc" : "asc" }
    );
  };

  const sortRows = (rowSet) => {
    const { col, dir } = sortConfig;
    return [...rowSet].sort((a, b) => {
      const cmp = col === "Date"
        ? parseDateVal(a.Date) - parseDateVal(b.Date)
        : (a[col] || "").localeCompare(b[col] || "");
      return dir === "asc" ? cmp : -cmp;
    });
  };

  const q = searchTerm.trim().toLowerCase();
  const matchesSearch = (r) =>
    !q || [(r.Role || ""), (r.Company || "")].some(v => v.toLowerCase().includes(q));

  const activeRows   = sortRows(rows.filter(r => !isArchived(r) && matchesSearch(r)));
  const archivedRows = sortRows(rows.filter(r =>  isArchived(r) && matchesSearch(r)));

  const renderRows = (rowSet) => rowSet.map(row => (
    <div
      key={row.id}
      className={`sheet-grid sheet-row${selectedRow?.id === row.id ? " sheet-grid--selected" : ""}`}
      role="row"
      aria-selected={selectedRow?.id === row.id}
      onClick={() => toggleSelect(row)}
      onDoubleClick={() => setViewingRow(row)}
    >
      <div role="cell" style={{ width: 68, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 2, padding: "0 4px" }}>
        <button
          className="row-action-btn"
          onClick={(e) => { e.stopPropagation(); setViewingRow(row); }}
          title="Edit"
          aria-label={`Edit ${row.Role || "record"}`}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
          </svg>
        </button>
        <button
          className="row-action-btn row-action-btn--delete"
          onClick={(e) => { e.stopPropagation(); setConfirmRow(row); }}
          title="Delete"
          aria-label={`Delete ${row.Role || "record"}`}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
      </div>
      {COLUMNS.map(col => (
        <div key={col} className="sheet-cell" role="cell" style={COL_STYLE[col]}>
          {col === "Status" ? (
            <span className={`status-chip ${statusColorMap[row[col]] || statusClass(row[col])}`}>{row[col] ?? ""}</span>
          ) : (
            <span style={{ padding: "4px 10px", overflow: "hidden", textOverflow: "ellipsis" }}>
              {row[col] ?? ""}
            </span>
          )}
        </div>
      ))}
    </div>
  ));

  const renderCards = (rowSet) => rowSet.map(row => (
    <div
      key={row.id}
      className={`job-card${selectedRow?.id === row.id ? " job-card--selected" : ""}`}
      onClick={() => toggleSelect(row)}
      onDoubleClick={() => setViewingRow(row)}
      role="row"
      aria-selected={selectedRow?.id === row.id}
    >
      <div className="job-card-actions">
        <button
          className="job-card-btn"
          onClick={(e) => { e.stopPropagation(); setViewingRow(row); }}
          aria-label={`Edit ${row.Role || "record"}`}
          title="Edit"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
          </svg>
        </button>
        <button
          className="job-card-btn job-card-btn--delete"
          onClick={(e) => { e.stopPropagation(); setConfirmRow(row); }}
          aria-label={`Delete ${row.Role || "record"}`}
          title="Delete"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
      </div>
      <div className="job-card-main">
        <div className="job-card-role">{row.Role || "—"}</div>
        <div className="job-card-company">{row.Company || ""}</div>
        <div className="job-card-meta">
          {row.Status && (
            <span className={`status-chip ${statusColorMap[row.Status] || statusClass(row.Status)}`} style={{ fontSize: 11 }}>
              {row.Status}
            </span>
          )}
          {row.Date && <span>{row.Date}</span>}
        </div>
      </div>
    </div>
  ));

  const archivedToggleClass = `archived-toggle ${showArchived ? "archived-toggle--expanded" : "archived-toggle--collapsed"}`;

  return (
    <Container fluid className="p-0">
      <div className="px-3 px-md-0" style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <button className="btn-compose" onClick={() => setShowAddModal(true)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          Add Job
        </button>

        <div className="search-box">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="search"
            placeholder="Search by role or company…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            aria-label="Search jobs"
          />
          {searchTerm && (
            <button className="search-clear" onClick={() => setSearchTerm("")} aria-label="Clear search">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
        </div>

      </div>

      <AddJobModal
        key={viewingRow ? viewingRow.id : "new"}
        show={showAddModal || !!viewingRow}
        onHide={() => { setShowAddModal(false); setViewingRow(null); }}
        onAdd={handleAddJob}
        onSave={handleSaveJob}
        initialData={viewingRow}
        dropdownOptions={dropdownOptions}
      />

      <Modal show={!!confirmRow} onHide={() => setConfirmRow(null)} centered aria-labelledby="confirm-delete-title">
        <Modal.Header closeButton>
          <Modal.Title id="confirm-delete-title">Delete Record?</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {confirmRow && (
            <p className="mb-0">
              Are you sure you want to delete this record?
              <br />
              <span className="text-muted small">
                {[confirmRow.Date, confirmRow.Role, confirmRow.Company].filter(Boolean).join(" · ")}
              </span>
            </p>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setConfirmRow(null)}>Cancel</Button>
          <Button variant="danger" onClick={() => { deleteRow(confirmRow.id); setConfirmRow(null); setSelectedRow(null); }}>Delete</Button>
        </Modal.Footer>
      </Modal>

      {/* ── Main table ─────────────────────────────────────────────── */}
      <div className="job-cards d-md-none" aria-label="Job applications">
        {renderCards(activeRows)}
      </div>

      <div className="sheet-scroll sheet-scroll--limited d-none d-md-block" role="table" aria-label="Job applications">
        <div role="rowgroup">
          <div className="sheet-grid sheet-header" role="row">
            <div aria-hidden="true" style={{ width: 68, flexShrink: 0 }} />
            {COLUMNS.map(col => (
              <div
                key={col} className="sheet-cell" role="columnheader" style={COL_STYLE[col]}
                aria-sort={sortConfig.col === col ? (sortConfig.dir === "asc" ? "ascending" : "descending") : "none"}
              >
                <button className="sheet-header-btn" onClick={() => handleHeaderClick(col)}>
                  {col}
                  <SortIndicator col={col} sortConfig={sortConfig} />
                </button>
              </div>
            ))}
          </div>
        </div>
        <div role="rowgroup">{renderRows(activeRows)}</div>
      </div>

      {/* ── Archived table (Ghosted / Duplicate) ───────────────────── */}
      {archivedRows.length > 0 && (
        <div className="px-3 px-md-0" style={{ marginTop: 16 }}>

          {/* Mobile archived */}
          <div className="d-md-none">
            <button
              className={archivedToggleClass}
              onClick={() => setShowArchived(v => !v)}
              aria-expanded={showArchived}
            >
              <span>Archived</span>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="status-chip status-withdrawn" style={{ fontSize: 11 }}>{archivedRows.length}</span>
                <Chevron open={showArchived} />
              </span>
            </button>
            {showArchived && (
              <div className="job-cards" style={{ borderTop: "none", borderRadius: "0 0 8px 8px" }}>
                {renderCards(archivedRows)}
              </div>
            )}
          </div>

          {/* Desktop archived */}
          <div className="d-none d-md-block">
            <button
              className={archivedToggleClass}
              onClick={() => setShowArchived(v => !v)}
              aria-expanded={showArchived}
            >
              <span>Archived</span>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="status-chip status-withdrawn" style={{ fontSize: 11 }}>{archivedRows.length}</span>
                <Chevron open={showArchived} />
              </span>
            </button>
            {showArchived && (
              <div className="sheet-scroll sheet-scroll--limited" style={{ borderRadius: "0 0 8px 8px" }} role="table" aria-label="Archived job applications">
                <div role="rowgroup">
                  <div className="sheet-grid sheet-header" role="row">
                    <div aria-hidden="true" style={{ width: 68, flexShrink: 0 }} />
                    {COLUMNS.map(col => (
                      <div
                        key={col} className="sheet-cell" role="columnheader" style={COL_STYLE[col]}
                        aria-sort={sortConfig.col === col ? (sortConfig.dir === "asc" ? "ascending" : "descending") : "none"}
                      >
                        <button className="sheet-header-btn" onClick={() => handleHeaderClick(col)}>
                          {col}
                          <SortIndicator col={col} sortConfig={sortConfig} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
                <div role="rowgroup">{renderRows(archivedRows)}</div>
              </div>
            )}
          </div>

        </div>
      )}
    </Container>
  );
}
