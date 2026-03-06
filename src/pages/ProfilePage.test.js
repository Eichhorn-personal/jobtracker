import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "../context/AuthContext";
import { useApi } from "../hooks/useApi";
import ProfilePage from "./ProfilePage";

jest.mock("../hooks/useApi", () => ({ useApi: jest.fn() }));

const baseUser = {
  id: 1,
  username: "user@example.com",
  role: "user",
  display_name: "Jane Smith",
  photo: null,
  resume_link: null,
  has_password: true,
};

function makeRequest(response = { ...baseUser }) {
  return jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(response),
  });
}

function renderProfilePage(user = baseUser, mockRequest = makeRequest()) {
  localStorage.setItem("authUser", JSON.stringify(user));
  localStorage.setItem("authToken", "test-token");
  useApi.mockReturnValue({ request: mockRequest });
  return render(
    <MemoryRouter>
      <AuthProvider>
        <ProfilePage />
      </AuthProvider>
    </MemoryRouter>
  );
}

afterEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
});

// ── panel rendering ───────────────────────────────────────────────────────────

describe("ProfilePage — panels", () => {
  test("renders Photo, Account, Resume, and Password panel headers", () => {
    renderProfilePage();
    expect(screen.getByText("Photo")).toBeInTheDocument();
    expect(screen.getByText("Account")).toBeInTheDocument();
    expect(screen.getByText("Resume")).toBeInTheDocument();
    expect(screen.getByText("Password")).toBeInTheDocument();
  });

  test("GitHub Profile field is rendered", () => {
    renderProfilePage();
    expect(screen.getByPlaceholderText(/github\.com\/yourname/i)).toBeInTheDocument();
  });

  test("GitHub Profile input is pre-filled from user.github_url", () => {
    renderProfilePage({ ...baseUser, github_url: "https://github.com/janesmith" });
    expect(screen.getByPlaceholderText(/github\.com\/yourname/i)).toHaveValue("https://github.com/janesmith");
  });

  test("display name input is pre-filled from user.display_name", () => {
    renderProfilePage();
    expect(screen.getByPlaceholderText(/your name/i)).toHaveValue("Jane Smith");
  });

  test("email field is read-only", () => {
    renderProfilePage();
    expect(screen.getByDisplayValue("user@example.com")).toHaveAttribute("readOnly");
  });
});

// ── password section ──────────────────────────────────────────────────────────

describe("ProfilePage — password section", () => {
  test("password inputs are hidden by default", () => {
    renderProfilePage();
    expect(screen.queryByText("New password")).not.toBeInTheDocument();
  });

  test('"Change password" reveals password inputs', () => {
    renderProfilePage();
    userEvent.click(screen.getByRole("button", { name: /change password/i }));
    expect(screen.getByText("New password")).toBeInTheDocument();
  });

  test('"Cancel" hides the password section', () => {
    renderProfilePage();
    userEvent.click(screen.getByRole("button", { name: /change password/i }));
    userEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(screen.queryByText("New password")).not.toBeInTheDocument();
  });

  test('"Current password" shown only when user.has_password is true', () => {
    renderProfilePage({ ...baseUser, has_password: false });
    userEvent.click(screen.getByRole("button", { name: /change password/i }));
    expect(screen.queryByText("Current password")).not.toBeInTheDocument();
    expect(screen.getByText("New password")).toBeInTheDocument();
  });
});

// ── save validation ───────────────────────────────────────────────────────────

describe("ProfilePage — save validation", () => {
  test("mismatched passwords shows inline error", async () => {
    renderProfilePage();
    userEvent.click(screen.getByRole("button", { name: /change password/i }));
    // eslint-disable-next-line testing-library/no-node-access
    const [newPassInput, confirmPassInput] = document.querySelectorAll(
      "input[autocomplete='new-password']"
    );
    userEvent.type(newPassInput, "ValidPass1!");
    userEvent.type(confirmPassInput, "DifferentPass!");
    userEvent.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/passwords do not match/i)
    );
  });

  test("new password too short shows inline error", async () => {
    renderProfilePage();
    userEvent.click(screen.getByRole("button", { name: /change password/i }));
    // eslint-disable-next-line testing-library/no-node-access
    const [newPassInput] = document.querySelectorAll("input[autocomplete='new-password']");
    userEvent.type(newPassInput, "short");
    userEvent.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/8 and 128/i)
    );
  });

  test("successful save shows success message", async () => {
    renderProfilePage();
    userEvent.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(/profile saved/i)
    );
  });
});

// ── Google photo banner ───────────────────────────────────────────────────────

describe("ProfilePage — Google photo banner", () => {
  test("banner shown when authGooglePicture is set and user has no photo", () => {
    localStorage.setItem("authGooglePicture", "https://lh3.googleusercontent.com/photo.jpg");
    renderProfilePage({ ...baseUser, photo: null });
    expect(
      screen.getByText(/import your google profile photo/i)
    ).toBeInTheDocument();
  });

  test("banner not shown when user already has a photo", () => {
    localStorage.setItem("authGooglePicture", "https://lh3.googleusercontent.com/photo.jpg");
    renderProfilePage({ ...baseUser, photo: "data:image/jpeg;base64,abc" });
    expect(
      screen.queryByText(/import your google profile photo/i)
    ).not.toBeInTheDocument();
  });

  test("Dismiss removes authGooglePicture from localStorage", () => {
    localStorage.setItem("authGooglePicture", "https://lh3.googleusercontent.com/photo.jpg");
    renderProfilePage({ ...baseUser, photo: null });
    userEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(localStorage.getItem("authGooglePicture")).toBeNull();
  });
});
