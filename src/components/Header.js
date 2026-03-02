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
              {user.username === "ceichhorn@gmail.com" && (
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
