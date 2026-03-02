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

  test("ceichhorn@gmail.com sees Admin link in dropdown", async () => {
    renderHeader({ id: 1, username: "ceichhorn@gmail.com", role: "admin" });
    userEvent.click(screen.getByLabelText(/account menu for ceichhorn@gmail\.com/i));
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
