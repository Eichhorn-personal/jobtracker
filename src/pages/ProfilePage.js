import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Container, Form, InputGroup, Button } from "react-bootstrap";
import { useApi } from "../hooks/useApi";
import { useAuth } from "../context/AuthContext";
import "../DataTable.css";

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const { request } = useApi();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState(user?.display_name || "");
  const [resumeLink, setResumeLink] = useState(user?.resume_link || "");
  const [photo, setPhoto] = useState(user?.photo || null);
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [googlePicture] = useState(() => localStorage.getItem("authGooglePicture"));
  const [googlePictureDismissed, setGooglePictureDismissed] = useState(false);
  const [googlePhotoImporting, setGooglePhotoImporting] = useState(false);

  const fileInputRef = useRef(null);

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 96;
      canvas.height = 96;
      const ctx = canvas.getContext("2d");

      // Cover-crop: center the image in 96×96
      const scale = Math.max(96 / img.width, 96 / img.height);
      const scaledW = img.width * scale;
      const scaledH = img.height * scale;
      const offsetX = (96 - scaledW) / 2;
      const offsetY = (96 - scaledH) / 2;
      ctx.drawImage(img, offsetX, offsetY, scaledW, scaledH);

      const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
      setPhoto(dataUrl);
      URL.revokeObjectURL(objectUrl);
    };
    img.src = objectUrl;

    // Reset so the same file can be re-selected
    e.target.value = "";
  };

  const handleRemovePhoto = () => {
    setPhoto(null);
  };

  const handleDismissGooglePhoto = () => {
    localStorage.removeItem("authGooglePicture");
    setGooglePictureDismissed(true);
  };

  const handleImportGooglePhoto = async () => {
    const url = googlePicture;
    if (!url) return;
    setGooglePhotoImporting(true);
    setError("");
    try {
      const res = await request("/api/auth/profile", {
        method: "PUT",
        body: JSON.stringify({ google_picture_url: url }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to import photo.");
        return;
      }
      updateUser(data);
      setPhoto(data.photo);
      localStorage.removeItem("authGooglePicture");
      setGooglePictureDismissed(true);
      setSuccess("Google photo imported.");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setGooglePhotoImporting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (showPasswordSection && newPassword) {
      if (newPassword.length < 8 || newPassword.length > 128) {
        setError("New password must be between 8 and 128 characters.");
        return;
      }
      if (newPassword !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
    }

    const body = {};
    body.display_name = displayName.trim() || null;
    body.photo = photo;
    body.resume_link = resumeLink.trim() || null;

    if (showPasswordSection && newPassword) {
      if (user.has_password) {
        body.current_password = currentPassword;
      }
      body.new_password = newPassword;
    }

    setSaving(true);
    try {
      const res = await request("/api/auth/profile", {
        method: "PUT",
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to save profile.");
        return;
      }
      updateUser(data);
      setSuccess("Profile saved.");
      setShowPasswordSection(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const avatarLetter = user?.username?.charAt(0)?.toUpperCase() || "?";

  return (
    <Container className="pt-3" style={{ maxWidth: 540 }}>

      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <button className="btn-toolbar-action" onClick={() => navigate(-1)} aria-label="Back">
          ← Back
        </button>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 400, color: "#5f6368", flexGrow: 1 }}>
          Profile
        </h1>
      </div>

      <form onSubmit={handleSubmit}>

        {/* Google photo import banner */}
        {googlePicture && !googlePictureDismissed && !user?.photo && (
          <div className="admin-panel mb-3" style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", flexWrap: "wrap" }}>
            <img src={googlePicture} alt="" style={{ width: 40, height: 40, borderRadius: "50%", flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 14, color: "#5f6368" }}>Import your Google profile photo?</span>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="btn-toolbar-action"
                onClick={handleImportGooglePhoto}
                disabled={googlePhotoImporting}
              >
                {googlePhotoImporting ? "Importing…" : "Import"}
              </button>
              <button
                type="button"
                className="btn-toolbar-action"
                onClick={handleDismissGooglePhoto}
                disabled={googlePhotoImporting}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Photo panel */}
        <div className="admin-panel mb-3">
          <div className="admin-panel-header">Photo</div>
          <div style={{ padding: "16px", display: "flex", alignItems: "center", gap: 16 }}>
            {photo
              ? <img src={photo} alt="Profile" style={{ width: 96, height: 96, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
              : <span className="gmail-avatar" style={{ width: 96, height: 96, fontSize: 40, flexShrink: 0 }}>{avatarLetter}</span>
            }
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn-toolbar-action"
                onClick={() => fileInputRef.current?.click()}
              >
                Change photo
              </button>
              {photo && (
                <button
                  type="button"
                  className="btn-toolbar-action"
                  onClick={handleRemovePhoto}
                >
                  Remove
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handlePhotoChange}
            />
          </div>
        </div>

        {/* Account panel */}
        <div className="admin-panel mb-3">
          <div className="admin-panel-header">Account</div>
          <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>
            <Form.Group>
              <Form.Label style={{ fontSize: 13, color: "#5f6368", marginBottom: 4 }}>Display Name</Form.Label>
              <Form.Control
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                maxLength={100}
                style={{ fontSize: 14 }}
              />
            </Form.Group>
            <Form.Group>
              <Form.Label style={{ fontSize: 13, color: "#5f6368", marginBottom: 4 }}>Email</Form.Label>
              <Form.Control
                type="text"
                value={user?.username || ""}
                readOnly
                style={{ fontSize: 14, background: "#f8f9fa", color: "#5f6368" }}
              />
            </Form.Group>
          </div>
        </div>

        {/* Resume panel */}
        <div className="admin-panel mb-3">
          <div className="admin-panel-header">Resume</div>
          <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>
            <Form.Group>
              <Form.Label style={{ fontSize: 13, color: "#5f6368", marginBottom: 4 }}>Resume Link</Form.Label>
              <InputGroup>
                <Form.Control
                  type="url"
                  placeholder="https://"
                  value={resumeLink}
                  onChange={(e) => setResumeLink(e.target.value)}
                  style={{ fontSize: 14 }}
                />
                <Button
                  variant="outline-secondary"
                  disabled={!resumeLink.trim()}
                  onClick={() => window.open(resumeLink.trim(), "_blank", "noopener,noreferrer")}
                  aria-label="View resume"
                >
                  View
                </Button>
              </InputGroup>
            </Form.Group>
          </div>
        </div>

        {/* Password panel */}
        <div className="admin-panel mb-3">
          <div className="admin-panel-header">Password</div>
          <div style={{ padding: "16px" }}>
            {!showPasswordSection ? (
              <button
                type="button"
                className="btn-toolbar-action"
                onClick={() => setShowPasswordSection(true)}
              >
                Change password
              </button>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {user?.has_password && (
                  <Form.Group>
                    <Form.Label style={{ fontSize: 13, color: "#5f6368", marginBottom: 4 }}>Current password</Form.Label>
                    <Form.Control
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      autoComplete="current-password"
                      style={{ fontSize: 14 }}
                    />
                  </Form.Group>
                )}
                <Form.Group>
                  <Form.Label style={{ fontSize: 13, color: "#5f6368", marginBottom: 4 }}>New password</Form.Label>
                  <Form.Control
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                    style={{ fontSize: 14 }}
                  />
                </Form.Group>
                <Form.Group>
                  <Form.Label style={{ fontSize: 13, color: "#5f6368", marginBottom: 4 }}>Confirm new password</Form.Label>
                  <Form.Control
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    style={{ fontSize: 14 }}
                  />
                </Form.Group>
                <div>
                  <button
                    type="button"
                    className="btn-toolbar-action"
                    style={{ fontSize: 12, color: "#5f6368" }}
                    onClick={() => {
                      setShowPasswordSection(false);
                      setCurrentPassword("");
                      setNewPassword("");
                      setConfirmPassword("");
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div role="alert" style={{ background: "#fce8e6", color: "#c5221f", border: "1px solid #f5c2c0", borderRadius: 4, padding: "10px 12px", fontSize: 14, marginBottom: 12 }}>{error}</div>
        )}
        {success && (
          <div style={{ background: "#e6f4ea", border: "1px solid #34a853", borderRadius: 6, padding: "10px 14px", fontSize: 14, color: "#1e7e34", marginBottom: 12 }} role="status">
            {success}
          </div>
        )}

        <button
          type="submit"
          className="btn-toolbar-action"
          disabled={saving}
          style={{ fontWeight: 500 }}
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>

      </form>
    </Container>
  );
}
