import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "../context/AuthContext";
import { useApi } from "../hooks/useApi";
import DataTable from "./DataTable";

jest.mock("../hooks/useApi", () => ({ useApi: jest.fn() }));
// Render a sentinel when the modal is open in edit mode so double-click tests
// can assert that the right row was passed as initialData.
jest.mock("./AddJobModal", () => ({ show, initialData }) =>
  show && initialData ? <div data-testid="edit-modal" data-role={initialData.Role} /> : null
);

const sampleJobs = [
  { id: 1, Role: "Engineer", Company: "Acme", Date: "01/15/2025", Status: "Applied" },
  { id: 2, Role: "Designer", Company: "Globex", Date: "02/20/2025", Status: "Rejected" },
];

function makeRequest(jobs = sampleJobs) {
  return jest.fn().mockImplementation((path, options = {}) => {
    if (path === "/api/jobs" && !options.method)
      return Promise.resolve({ json: () => Promise.resolve([...jobs]) });
    if (path === "/api/dropdowns")
      return Promise.resolve({ json: () => Promise.resolve({}) });
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
}

function renderDataTable(jobs = sampleJobs) {
  const mockRequest = makeRequest(jobs);
  useApi.mockReturnValue({ request: mockRequest });
  render(
    <MemoryRouter>
      <AuthProvider>
        <DataTable />
      </AuthProvider>
    </MemoryRouter>
  );
  return { mockRequest };
}

afterEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
});

// ── ARIA structure ────────────────────────────────────────────────────────────

describe("DataTable — ARIA structure", () => {
  test('renders element with role="table"', async () => {
    renderDataTable();
    // Drain pending state updates from the data-loading effect
    await act(async () => {});
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  test("table has accessible label", async () => {
    renderDataTable();
    await act(async () => {});
    expect(
      screen.getByRole("table", { name: /job applications/i })
    ).toBeInTheDocument();
  });
});

// ── inline action buttons ─────────────────────────────────────────────────────
// Edit and Delete icon buttons appear inline on each row (not in a toolbar).

describe("DataTable — action buttons", () => {
  test("each row has an Edit button", async () => {
    renderDataTable();
    await act(async () => {});
    expect(
      screen.getAllByRole("button", { name: /edit engineer/i }).length
    ).toBeGreaterThan(0);
  });

  test("each row has a Delete button", async () => {
    renderDataTable();
    await act(async () => {});
    expect(
      screen.getAllByRole("button", { name: /delete engineer/i }).length
    ).toBeGreaterThan(0);
  });
});

// ── double-click to edit ──────────────────────────────────────────────────────

describe("DataTable — double-click to edit", () => {
  test("double-clicking a row opens the edit modal with that row's data", async () => {
    renderDataTable();
    await act(async () => {});
    const dataRows = screen
      .getAllByRole("row")
      .filter((r) => r.getAttribute("aria-selected") !== null);
    fireEvent.dblClick(dataRows[0]);
    await waitFor(() =>
      expect(screen.getByTestId("edit-modal")).toBeInTheDocument()
    );
    expect(screen.getByTestId("edit-modal").dataset.role).toBe("Engineer");
  });
});

// ── delete confirmation modal ─────────────────────────────────────────────────

describe("DataTable — delete confirmation", () => {
  // Helper: load table, click the inline Delete button on the first active row
  async function openDeleteModal() {
    renderDataTable();
    await act(async () => {});
    const deleteBtn = screen.getAllByRole("button", { name: /delete engineer/i })[0];
    userEvent.click(deleteBtn);
    await waitFor(() => screen.getByRole("dialog"));
  }

  test("clicking delete toolbar button shows confirmation dialog", async () => {
    await openDeleteModal();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  test("confirm dialog has aria-labelledby pointing to title", async () => {
    await openDeleteModal();
    expect(screen.getByRole("dialog")).toHaveAttribute(
      "aria-labelledby",
      "confirm-delete-title"
    );
  });

  test("confirming delete removes the row from the table", async () => {
    await openDeleteModal();
    // "Delete" (exact) targets the modal danger button
    userEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() =>
      expect(
        screen.queryAllByRole("button", { name: /delete engineer/i })
      ).toHaveLength(0)
    );
  });
});

// ── column sort ───────────────────────────────────────────────────────────────

describe("DataTable — column sort", () => {
  test("Date column header has aria-sort='descending' by default", async () => {
    renderDataTable();
    await act(async () => {});
    const dateHeader = screen.getAllByRole("columnheader")[0];
    expect(dateHeader).toHaveAttribute("aria-sort", "descending");
  });

  test("other column headers have aria-sort='none' by default", async () => {
    renderDataTable();
    await act(async () => {});
    const headers = screen.getAllByRole("columnheader");
    // Role, Company, Status — indices 1-3
    headers.slice(1).forEach(h => expect(h).toHaveAttribute("aria-sort", "none"));
  });

  test("clicking Date header toggles to ascending", async () => {
    renderDataTable();
    await act(async () => {});
    const dateHeader = screen.getAllByRole("columnheader")[0];
    userEvent.click(dateHeader.querySelector("button"));
    expect(dateHeader).toHaveAttribute("aria-sort", "ascending");
  });

  test("clicking Date header twice returns to descending", async () => {
    renderDataTable();
    await act(async () => {});
    const dateHeader = screen.getAllByRole("columnheader")[0];
    userEvent.click(dateHeader.querySelector("button"));
    userEvent.click(dateHeader.querySelector("button"));
    expect(dateHeader).toHaveAttribute("aria-sort", "descending");
  });

  test("clicking a different column sets it to ascending and clears Date sort", async () => {
    renderDataTable();
    await act(async () => {});
    const headers = screen.getAllByRole("columnheader");
    const roleHeader = headers[1]; // Role
    userEvent.click(roleHeader.querySelector("button"));
    expect(roleHeader).toHaveAttribute("aria-sort", "ascending");
    expect(headers[0]).toHaveAttribute("aria-sort", "none"); // Date cleared
  });

  test("rows are ordered by date descending by default (newer date first)", async () => {
    const twoActiveJobs = [
      { id: 1, Role: "Engineer", Company: "Acme",   Date: "01/15/2025", Status: "Applied" },
      { id: 2, Role: "Designer", Company: "Globex", Date: "02/20/2025", Status: "Applied" },
    ];
    renderDataTable(twoActiveJobs);
    await act(async () => {});
    const dataRows = screen
      .getAllByRole("row")
      .filter(r => r.getAttribute("aria-selected") !== null);
    // Mobile cards come first in DOM; Designer has newer date (02/20) → should be first
    expect(dataRows[0]).toHaveTextContent("Designer");
    expect(dataRows[1]).toHaveTextContent("Engineer");
  });
});

// ── mobile cards ──────────────────────────────────────────────────────────────

describe("DataTable — mobile cards", () => {
  test("each card renders a status chip", async () => {
    renderDataTable();
    await act(async () => {});
    // eslint-disable-next-line testing-library/no-node-access
    const cards = document.querySelectorAll(".job-card");
    expect(cards.length).toBeGreaterThan(0);
    cards.forEach(card => {
      // eslint-disable-next-line testing-library/no-node-access
      expect(card.querySelector(".status-chip")).not.toBeNull();
    });
  });

  test("active cards show the job role", async () => {
    // Use two active (non-archived) statuses so both appear in .job-cards
    const twoActiveJobs = [
      { id: 1, Role: "Engineer", Company: "Acme",   Date: "01/15/2025", Status: "Applied" },
      { id: 2, Role: "Designer", Company: "Globex", Date: "02/20/2025", Status: "Applied" },
    ];
    renderDataTable(twoActiveJobs);
    await act(async () => {});
    // eslint-disable-next-line testing-library/no-node-access
    const cards = document.querySelectorAll(".job-card");
    const roles = Array.from(cards).map(c => c.querySelector(".job-card-role")?.textContent);
    expect(roles).toContain("Engineer");
    expect(roles).toContain("Designer");
  });
});
