import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "../context/AuthContext";
import { ThemeProvider } from "../context/ThemeContext";
import Header from "./Header";

function renderHeader(user = null) {
  if (user) {
    localStorage.setItem("authUser", JSON.stringify(user));
    localStorage.setItem("authToken", "test-token");
  }
  return render(
    <MemoryRouter>
      <ThemeProvider>
        <AuthProvider>
          <Header />
        </AuthProvider>
      </ThemeProvider>
    </MemoryRouter>
  );
}

afterEach(() => localStorage.clear());

// ── semantic / ARIA structure ─────────────────────────────────────────────────

describe("Header — ARIA structure", () => {
  test('header has aria-label="Main navigation"', () => {
    // <header> has implicit ARIA role "banner" (not "navigation")
    renderHeader({ id: 1, username: "u@example.com", role: "user" });
    expect(
      screen.getByRole("banner", { name: /main navigation/i })
    ).toBeInTheDocument();
  });

  test("logo image is decorative (alt='')", () => {
    const { container } = renderHeader({
      id: 1,
      username: "u@example.com",
      role: "user",
    });
    // eslint-disable-next-line testing-library/no-node-access
    const img = container.querySelector("img");
    expect(img).toHaveAttribute("alt", "");
  });

  test("brand renders as a link", () => {
    renderHeader({ id: 1, username: "u@example.com", role: "user" });
    expect(screen.getByRole("link", { name: /jobtracker/i })).toBeInTheDocument();
  });
});

// ── role-conditional menu items ───────────────────────────────────────────────

describe("Header — role-based menu items", () => {
  test("admin user sees Manage button", () => {
    // Manage is a standalone button outside the dropdown for admin users
    renderHeader({ id: 1, username: "admin@example.com", role: "admin" });
    expect(screen.getByRole("button", { name: /^manage$/i })).toBeInTheDocument();
  });

  test("user role does not see Manage button", () => {
    renderHeader({ id: 2, username: "user@example.com", role: "user" });
    expect(screen.queryByRole("button", { name: /^manage$/i })).not.toBeInTheDocument();
  });

  test("avatar toggle carries account-menu aria-label", () => {
    // The letter-avatar span has aria-label="Account menu for <username>"
    renderHeader({ id: 1, username: "u@example.com", role: "user" });
    expect(
      screen.getByLabelText(/account menu for u@example\.com/i)
    ).toBeInTheDocument();
  });

  test("dropdown contains Sign out item after opening", async () => {
    renderHeader({ id: 1, username: "u@example.com", role: "user" });
    userEvent.click(screen.getByLabelText(/account menu for u@example\.com/i));
    await waitFor(() =>
      expect(screen.getByText(/sign out/i)).toBeInTheDocument()
    );
  });

  test("dropdown contains Edit Profile item after opening", async () => {
    renderHeader({ id: 1, username: "u@example.com", role: "user" });
    userEvent.click(screen.getByLabelText(/account menu for u@example\.com/i));
    await waitFor(() =>
      expect(screen.getByText(/edit profile/i)).toBeInTheDocument()
    );
  });

  test("site admin user sees Admin link in dropdown", async () => {
    renderHeader({ id: 1, username: "siteadmin@example.com", role: "admin", is_site_admin: true });
    userEvent.click(screen.getByLabelText(/account menu for siteadmin@example\.com/i));
    await waitFor(() =>
      expect(screen.getByText(/^admin$/i)).toBeInTheDocument()
    );
  });

  test("other user does not see Admin link in dropdown", async () => {
    renderHeader({ id: 2, username: "other@example.com", role: "admin" });
    userEvent.click(screen.getByLabelText(/account menu for other@example\.com/i));
    await waitFor(() =>
      expect(screen.getByText(/edit profile/i)).toBeInTheDocument()
    );
    expect(screen.queryByText(/^admin$/i)).not.toBeInTheDocument();
  });
});

// ── profile quick-links (mobile dropdown) ─────────────────────────────────────

describe("Header — profile quick-links", () => {
  test("user with resume_link sees My Resume links in DOM", () => {
    renderHeader({ id: 1, username: "u@example.com", role: "user", resume_link: "https://example.com/resume" });
    // Both the header link (d-none d-sm-flex) and the dropdown item (d-sm-none) are in DOM
    expect(screen.getAllByRole("link", { name: /my resume/i }).length).toBeGreaterThanOrEqual(1);
  });

  test("user with linkedin_url sees My LinkedIn links in DOM", () => {
    renderHeader({ id: 1, username: "u@example.com", role: "user", linkedin_url: "https://linkedin.com/in/user" });
    expect(screen.getAllByRole("link", { name: /my linkedin/i }).length).toBeGreaterThanOrEqual(1);
  });

  test("user without resume_link does not see My Resume", () => {
    renderHeader({ id: 1, username: "u@example.com", role: "user" });
    expect(screen.queryByRole("link", { name: /my resume/i })).not.toBeInTheDocument();
  });

  test("user without linkedin_url does not see My LinkedIn", () => {
    renderHeader({ id: 1, username: "u@example.com", role: "user" });
    expect(screen.queryByRole("link", { name: /my linkedin/i })).not.toBeInTheDocument();
  });

  test("user with github_url sees My GitHub link in DOM", () => {
    renderHeader({ id: 1, username: "u@example.com", role: "user", github_url: "https://github.com/user" });
    expect(screen.getAllByRole("link", { name: /my github/i }).length).toBeGreaterThanOrEqual(1);
  });

  test("user without github_url does not see My GitHub", () => {
    renderHeader({ id: 1, username: "u@example.com", role: "user" });
    expect(screen.queryByRole("link", { name: /my github/i })).not.toBeInTheDocument();
  });

  test("dropdown contains My GitHub item when user has github_url", async () => {
    renderHeader({ id: 1, username: "u@example.com", role: "user", github_url: "https://github.com/user" });
    userEvent.click(screen.getByLabelText(/account menu for u@example\.com/i));
    await waitFor(() =>
      expect(screen.getAllByRole("link", { name: /my github/i }).length).toBeGreaterThanOrEqual(2)
    );
  });

  test("dropdown contains My Resume item when user has resume_link", async () => {
    renderHeader({ id: 1, username: "u@example.com", role: "user", resume_link: "https://example.com/resume" });
    userEvent.click(screen.getByLabelText(/account menu for u@example\.com/i));
    await waitFor(() =>
      expect(screen.getAllByRole("link", { name: /my resume/i }).length).toBeGreaterThanOrEqual(2)
    );
  });
});
