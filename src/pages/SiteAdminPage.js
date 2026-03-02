import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Container, Form, Button, Modal, Spinner } from "react-bootstrap";
import { useApi } from "../hooks/useApi";
import { useAuth } from "../context/AuthContext";
import "../DataTable.css";

export default function SiteAdminPage() {
  const { request } = useApi();
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && user.username !== "ceichhorn@gmail.com") navigate("/");
  }, [user, navigate]);

  const [users, setUsers] = useState(null);
  const [confirmDeleteUser, setConfirmDeleteUser] = useState(null);

  const loadUsers = useCallback(() => {
    request("/api/users")
      .then((res) => res.json())
      .then(setUsers)
      .catch(console.error);
  }, [request]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const handleRoleChange = async (userId, role) => {
    const res = await request(`/api/users/${userId}/role`, {
      method: "PUT",
      body: JSON.stringify({ role }),
    });
    if (res.ok) {
      const updated = await res.json();
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    }
  };

  const handleDeleteUser = async (userId) => {
    const res = await request(`/api/users/${userId}`, { method: "DELETE" });
    if (res.ok || res.status === 204) {
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    }
    setConfirmDeleteUser(null);
  };

  const handleDownload = async () => {
    const res = await request("/api/jobs");
    const data = await res.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "job-tracker-data.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (users === null) {
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
          Admin
        </h1>
        <button className="btn-toolbar-action" onClick={() => navigate("/logs")}>View Logs</button>
        <button className="btn-toolbar-action" onClick={handleDownload}>Download Data</button>
      </div>

      {/* Users panel */}
      <div className="sheet-scroll mb-4" role="table" aria-label="Users">
        <div className="admin-panel-header" role="rowgroup">
          <span>Users</span>
        </div>
        <div className="sheet-grid sheet-header" role="row">
          <div className="sheet-cell" role="columnheader" style={{ flex: 1, justifyContent: "flex-start" }}>Email</div>
          <div className="sheet-cell" role="columnheader" style={{ width: 155, flexShrink: 0 }}>Role</div>
          <div className="sheet-cell" role="columnheader" style={{ width: 44, flexShrink: 0 }} aria-label="Actions" />
        </div>
        {users.map((u) => (
          <div key={u.id} className="sheet-grid sheet-row" role="row">
            <div className="sheet-cell" role="cell" style={{ flex: 1 }}>
              <span style={{ padding: "4px 10px", fontSize: 14 }}>{u.username}</span>
            </div>
            <div className="sheet-cell" role="cell" style={{ width: 155, flexShrink: 0, padding: "4px 8px" }}>
              <Form.Select
                size="sm"
                value={u.role}
                onChange={(e) => handleRoleChange(u.id, e.target.value)}
                aria-label={`Role for ${u.username}`}
                style={{ fontSize: 13 }}
              >
                <option value="user">user</option>
                <option value="admin">admin</option>
              </Form.Select>
            </div>
            <div className="sheet-cell" role="cell" style={{ width: 44, flexShrink: 0, justifyContent: "center" }}>
              <button
                className="row-action-btn"
                onClick={() => setConfirmDeleteUser(u)}
                aria-label={`Delete user ${u.username}`}
                title="Delete user"
              >✕</button>
            </div>
          </div>
        ))}
      </div>

      {/* Confirm delete user */}
      <Modal show={!!confirmDeleteUser} onHide={() => setConfirmDeleteUser(null)} centered aria-labelledby="confirm-delete-user-title">
        <Modal.Header closeButton>
          <Modal.Title id="confirm-delete-user-title">Delete User?</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {confirmDeleteUser && (
            <p className="mb-0">
              Are you sure you want to delete <strong>{confirmDeleteUser.username}</strong>?
              <br />
              <span className="text-muted small">This will also delete all their job records.</span>
            </p>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setConfirmDeleteUser(null)}>Cancel</Button>
          <Button variant="danger" onClick={() => handleDeleteUser(confirmDeleteUser?.id)}>Delete</Button>
        </Modal.Footer>
      </Modal>

    </Container>
  );
}
