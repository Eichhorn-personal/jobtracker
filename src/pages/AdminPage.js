import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Container, Form, InputGroup, Button, Spinner } from "react-bootstrap";
import { useApi } from "../hooks/useApi";
import { useAuth } from "../context/AuthContext";
import { statusClass, STATUS_COLORS } from "../utils/statusColor";
import "../DataTable.css";

export default function AdminPage() {
  const { request } = useApi();
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && user.role !== "admin") navigate("/");
  }, [user, navigate]);

  const [dropdowns, setDropdowns] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [newValues, setNewValues] = useState({});
  const [newFieldName, setNewFieldName] = useState("");
  const [errors, setErrors] = useState({});

  const loadDropdowns = useCallback(() => {
    request("/api/dropdowns")
      .then((res) => res.json())
      .then(setDropdowns)
      .catch(console.error);
  }, [request]);

  useEffect(() => { loadDropdowns(); }, [loadDropdowns]);

  const setError = (key, msg) => setErrors((prev) => ({ ...prev, [key]: msg }));
  const clearError = (key) => setErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });

  const addOption = async (fieldName) => {
    const label = (newValues[fieldName] || "").trim();
    if (!label) return;
    clearError(`add-${fieldName}`);
    const res = await request(`/api/dropdowns/${encodeURIComponent(fieldName)}`, {
      method: "POST",
      body: JSON.stringify({ label }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(`add-${fieldName}`, d.error || "Failed to add option");
      return;
    }
    const created = await res.json();
    setDropdowns((prev) => ({ ...prev, [fieldName]: [...(prev[fieldName] || []), created] }));
    setNewValues((prev) => ({ ...prev, [fieldName]: "" }));
  };

  const saveEdit = async (id, fieldName) => {
    const label = editValue.trim();
    if (!label) return;
    clearError(`edit-${id}`);
    const res = await request(`/api/dropdowns/option/${id}`, {
      method: "PUT",
      body: JSON.stringify({ label }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(`edit-${id}`, d.error || "Failed to save");
      return;
    }
    const updated = await res.json();
    setDropdowns((prev) => ({
      ...prev,
      [fieldName]: prev[fieldName].map((o) => (o.id === id ? updated : o)),
    }));
    setEditingId(null);
  };

  const deleteOption = async (id, fieldName) => {
    const res = await request(`/api/dropdowns/option/${id}`, { method: "DELETE" });
    if (!res.ok) return;
    setDropdowns((prev) => ({
      ...prev,
      [fieldName]: prev[fieldName].filter((o) => o.id !== id),
    }));
  };

  const saveColor = async (optId, color, fieldName) => {
    const res = await request(`/api/dropdowns/option/${optId}`, {
      method: "PUT",
      body: JSON.stringify({ color }),
    });
    if (!res.ok) return;
    const updated = await res.json();
    setDropdowns((prev) => ({
      ...prev,
      [fieldName]: prev[fieldName].map((o) => (o.id === optId ? updated : o)),
    }));
  };

  const moveOption = async (fieldName, index, direction) => {
    const options = [...dropdowns[fieldName]];
    const target = index + direction;
    if (target < 0 || target >= options.length) return;
    [options[index], options[target]] = [options[target], options[index]];
    setDropdowns((prev) => ({ ...prev, [fieldName]: options }));
    await request(`/api/dropdowns/${encodeURIComponent(fieldName)}/reorder`, {
      method: "PUT",
      body: JSON.stringify({ orderedIds: options.map((o) => o.id) }),
    });
  };

  const addField = () => {
    const name = newFieldName.trim();
    if (!name) return;
    if (dropdowns[name] !== undefined) {
      setError("newField", "A field with that name already exists");
      return;
    }
    clearError("newField");
    setDropdowns((prev) => ({ ...prev, [name]: [] }));
    setNewFieldName("");
  };

  if (dropdowns === null) {
    return <Container className="mt-5 text-center"><Spinner animation="border" /></Container>;
  }

  return (
    <Container className="pt-3" style={{ maxWidth: 640 }}>

      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <button className="btn-toolbar-action" onClick={() => navigate("/")} aria-label="Back to home">
          ← Back
        </button>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 400, color: "#5f6368", flexGrow: 1 }}>
          Manage
        </h1>
      </div>

      {/* One panel per dropdown field */}
      {Object.entries(dropdowns).map(([fieldName, options]) => (
        <div key={fieldName} className="admin-panel">
          <div className="admin-panel-header">
            <span>{fieldName}</span>
            <span className="status-chip status-withdrawn" style={{ fontSize: 11 }}>{options.length}</span>
          </div>

          {options.length === 0 && (
            <div className="text-muted small" style={{ padding: "10px 16px" }}>No options yet — add one below.</div>
          )}

          {options.map((opt, idx) => (
            <div key={opt.id} className="admin-option-row">
              {/* Up / down arrows */}
              <div style={{ display: "flex", flexDirection: "column", gap: 1, flexShrink: 0 }}>
                <button className="arrow-btn" disabled={idx === 0} onClick={() => moveOption(fieldName, idx, -1)} aria-label={`Move ${opt.label} up`}>▲</button>
                <button className="arrow-btn" disabled={idx === options.length - 1} onClick={() => moveOption(fieldName, idx, 1)} aria-label={`Move ${opt.label} down`}>▼</button>
              </div>

              {editingId === opt.id ? (
                <div style={{ flex: 1 }}>
                  <InputGroup size="sm">
                    <Form.Control
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit(opt.id, fieldName);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      isInvalid={!!errors[`edit-${opt.id}`]}
                      aria-label={`Edit label for ${opt.label}`}
                      autoFocus
                    />
                    <Button variant="success" size="sm" onClick={() => saveEdit(opt.id, fieldName)}>Save</Button>
                    <Button variant="outline-secondary" size="sm" onClick={() => setEditingId(null)} aria-label="Cancel edit">✕</Button>
                  </InputGroup>
                  {errors[`edit-${opt.id}`] && (
                    <div className="text-danger small mt-1">{errors[`edit-${opt.id}`]}</div>
                  )}
                </div>
              ) : (
                <>
                  <span style={{ flex: 1 }}>{opt.label}</span>
                  {fieldName === "Status" && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                      <span
                        className={`status-chip ${opt.color || statusClass(opt.label)}`}
                        style={{ fontSize: 11, pointerEvents: "none", userSelect: "none" }}
                        aria-hidden="true"
                      >
                        {opt.label}
                      </span>
                      <Form.Select
                        size="sm"
                        value={opt.color || ""}
                        onChange={(e) => saveColor(opt.id, e.target.value, fieldName)}
                        aria-label={`Color for ${opt.label}`}
                        style={{ width: 88, fontSize: 12 }}
                      >
                        {STATUS_COLORS.map((c) => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </Form.Select>
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                    <button
                      className="row-action-btn"
                      style={{ opacity: 0.5 }}
                      onClick={() => { setEditingId(opt.id); setEditValue(opt.label); }}
                      aria-label={`Edit option: ${opt.label}`}
                      title="Edit"
                    >✏</button>
                    <button
                      className="row-action-btn"
                      style={{ opacity: 0.5 }}
                      onClick={() => deleteOption(opt.id, fieldName)}
                      aria-label={`Delete option: ${opt.label}`}
                      title="Delete"
                    >✕</button>
                  </div>
                </>
              )}
            </div>
          ))}

          <div className="admin-panel-footer">
            <InputGroup size="sm">
              <Form.Control
                placeholder="New option…"
                value={newValues[fieldName] || ""}
                onChange={(e) => setNewValues((prev) => ({ ...prev, [fieldName]: e.target.value }))}
                onKeyDown={(e) => { if (e.key === "Enter") addOption(fieldName); }}
                isInvalid={!!errors[`add-${fieldName}`]}
                aria-label={`New option for ${fieldName}`}
              />
              <Button variant="primary" size="sm" onClick={() => addOption(fieldName)}>Add</Button>
            </InputGroup>
            {errors[`add-${fieldName}`] && (
              <div className="text-danger small mt-1" role="alert">{errors[`add-${fieldName}`]}</div>
            )}
          </div>
        </div>
      ))}

      {/* Add new dropdown field */}
      <div className="admin-panel">
        <div className="admin-panel-header">Add New Dropdown Field</div>
        <div className="admin-panel-footer">
          <InputGroup size="sm">
            <Form.Control
              placeholder="Field name (e.g. Priority, Job Type…)"
              value={newFieldName}
              onChange={(e) => { setNewFieldName(e.target.value); clearError("newField"); }}
              onKeyDown={(e) => { if (e.key === "Enter") addField(); }}
              isInvalid={!!errors.newField}
              aria-label="New dropdown field name"
            />
            <Button variant="outline-primary" size="sm" onClick={addField}>Create</Button>
          </InputGroup>
          {errors.newField && (
            <div className="text-danger small mt-1" role="alert">{errors.newField}</div>
          )}
          <div className="text-muted small mt-1">The field will appear in the table once you add its first option.</div>
        </div>
      </div>

    </Container>
  );
}
