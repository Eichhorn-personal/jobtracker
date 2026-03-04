import { Container, NavDropdown } from "react-bootstrap";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import iconSrc from "../job-tracker-icon.svg";

export default function Header() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const avatarLetter = user?.username?.charAt(0)?.toUpperCase() || "?";

  const avatarTitle = user?.photo
    ? <img src={user.photo} alt="" className="gmail-avatar" style={{ borderRadius: "50%", objectFit: "cover" }} aria-label={`Account menu for ${user.username}`} />
    : <span className="gmail-avatar" aria-label={`Account menu for ${user.username}`}>{avatarLetter}</span>;

  return (
    <header className="gmail-header" aria-label="Main navigation">
      <Container className="d-flex align-items-center h-100">

        {/* Left: Logo + App name */}
        <Link to="/" className="d-flex align-items-center text-decoration-none" style={{ gap: 10 }}>
          <img src={iconSrc} alt="" width={40} height={40} style={{ borderRadius: "10px" }} />
          <span className="gmail-app-name">JobTracker</span>
        </Link>

        {/* Resume quick-link — hidden on mobile, shown sm+ */}
        {user?.resume_link && (
          <a
            href={user.resume_link}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-toolbar-action d-none d-sm-flex align-items-center"
            style={{ marginLeft: 16, gap: 6, textDecoration: "none" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            My Resume
          </a>
        )}

        {/* LinkedIn quick-link — hidden on mobile, shown sm+ */}
        {user?.linkedin_url && (
          <a
            href={user.linkedin_url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-toolbar-action d-none d-sm-flex align-items-center"
            style={{ marginLeft: 8, gap: 6, textDecoration: "none" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#0A66C2" aria-hidden="true"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>
            My LinkedIn
          </a>
        )}

        {/* Right: admin button + user avatar dropdown or sign-in */}
        <div className="ms-auto d-flex align-items-center" style={{ gap: 8 }}>
          {user?.role === "admin" && (
            <button className="btn-toolbar-action" onClick={() => navigate("/admin")}>
              Manage
            </button>
          )}
          <button
            onClick={toggleTheme}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, padding: "4px 6px", lineHeight: 1 }}
          >
            {isDark ? "☀" : "🌙"}
          </button>
          {user ? (
            <NavDropdown
              title={avatarTitle}
              align="end"
              id="user-menu"
            >
              <NavDropdown.Header className="text-muted small">
                {user.display_name || user.username}
              </NavDropdown.Header>
              <NavDropdown.Item onClick={() => navigate("/profile")}>Edit Profile</NavDropdown.Item>
              {/* Resume / LinkedIn — only shown on mobile (hidden sm+) */}
              {user.resume_link && (
                <NavDropdown.Item
                  as="a"
                  href={user.resume_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="d-sm-none"
                >
                  My Resume
                </NavDropdown.Item>
              )}
              {user.linkedin_url && (
                <NavDropdown.Item
                  as="a"
                  href={user.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="d-sm-none"
                >
                  My LinkedIn
                </NavDropdown.Item>
              )}
              {user.is_site_admin && (
                <>
                  <NavDropdown.Divider />
                  <NavDropdown.Item onClick={() => navigate("/site-admin")}>Admin</NavDropdown.Item>
                </>
              )}
              <NavDropdown.Divider />
              <NavDropdown.Item onClick={handleLogout}>Sign out</NavDropdown.Item>
            </NavDropdown>
          ) : (
            <button className="btn btn-primary btn-sm" onClick={() => navigate("/login")}>
              Sign in
            </button>
          )}
        </div>

      </Container>
    </header>
  );
}
