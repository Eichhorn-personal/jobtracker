import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "../context/AuthContext";
import AddJobModal from "./AddJobModal";

// useApi calls useAuth internally; mock it so no AuthProvider is needed
jest.mock("../hooks/useApi", () => ({
  useApi: () => ({ request: jest.fn() }),
}));

const defaultProps = {
  show: true,
  onHide: jest.fn(),
  onAdd: jest.fn(),
  onSave: jest.fn(),
  initialData: null,
  dropdownOptions: { Status: ["Applied", "Rejected", "Offer"] },
};

// initialData used for edit-mode tests (date field is readOnly in add mode)
const editInitialData = {
  id: 5,
  Date: "01/15/2025",
  Role: "Engineer",
  Company: "Acme",
  Status: "Applied",
};

function renderModal(overrides = {}) {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <AddJobModal {...defaultProps} {...overrides} />
      </AuthProvider>
    </MemoryRouter>
  );
}

afterEach(() => jest.clearAllMocks());

// ── ARIA ──────────────────────────────────────────────────────────────────────

describe("AddJobModal — ARIA", () => {
  test('modal dialog has aria-labelledby="add-job-modal-title"', () => {
    renderModal();
    expect(screen.getByRole("dialog")).toHaveAttribute(
      "aria-labelledby",
      "add-job-modal-title"
    );
  });

  test('modal title element has id="add-job-modal-title"', () => {
    renderModal();
    // eslint-disable-next-line testing-library/no-node-access
    expect(document.getElementById("add-job-modal-title")).toBeInTheDocument();
  });
});

// ── date validation ───────────────────────────────────────────────────────────
// The date field is readOnly in add mode; use edit mode so typing is possible.

describe("AddJobModal — date validation", () => {
  test("invalid date shows error feedback with id='date-error'", () => {
    renderModal({ initialData: editInitialData });
    const dateInput = screen.getByPlaceholderText("mm/dd/yyyy");
    userEvent.clear(dateInput);
    userEvent.type(dateInput, "not-a-date");
    fireEvent.blur(dateInput);
    // eslint-disable-next-line testing-library/no-node-access
    expect(document.getElementById("date-error")).toBeInTheDocument();
    expect(screen.getByText(/enter a date like/i)).toBeInTheDocument();
  });

  test("date input gains aria-describedby when invalid", () => {
    renderModal({ initialData: editInitialData });
    const dateInput = screen.getByPlaceholderText("mm/dd/yyyy");
    userEvent.clear(dateInput);
    userEvent.type(dateInput, "not-a-date");
    fireEvent.blur(dateInput);
    expect(dateInput).toHaveAttribute("aria-describedby", "date-error");
  });

  test("submit button is disabled when date is invalid", () => {
    renderModal({ initialData: editInitialData });
    const dateInput = screen.getByPlaceholderText("mm/dd/yyyy");
    userEvent.clear(dateInput);
    userEvent.type(dateInput, "not-a-date");
    fireEvent.blur(dateInput);
    expect(screen.getByRole("button", { name: /save changes/i })).toBeDisabled();
  });

  test("onSave is not called when date is invalid", () => {
    const onSave = jest.fn();
    renderModal({ initialData: editInitialData, onSave });
    const dateInput = screen.getByPlaceholderText("mm/dd/yyyy");
    userEvent.clear(dateInput);
    userEvent.type(dateInput, "not-a-date");
    fireEvent.blur(dateInput);
    // Click the (disabled) submit button — should not trigger
    userEvent.click(screen.getByRole("button", { name: /save changes/i }));
    expect(onSave).not.toHaveBeenCalled();
  });
});

// ── form submission ───────────────────────────────────────────────────────────

describe("AddJobModal — form submission", () => {
  test("submitting add form with valid date calls onAdd", async () => {
    const onAdd = jest.fn().mockResolvedValue(undefined);
    renderModal({ onAdd });
    // Modal renders in a portal; use document to reach its inputs.
    // Date is disabled in add mode; selector excludes both readonly and disabled.
    // Remaining order: Job Board Link(0), Company(1), Role(2), Direct Company Job Link(3)
    // eslint-disable-next-line testing-library/no-node-access
    const editableText = document.querySelectorAll("input[type='text']:not([readonly]):not([disabled])");
    fireEvent.change(editableText[1], { target: { value: "Acme" } });     // Company
    fireEvent.change(editableText[2], { target: { value: "Engineer" } }); // Role
    userEvent.click(screen.getByRole("button", { name: /add job/i }));
    await waitFor(() => expect(onAdd).toHaveBeenCalledTimes(1));
  });

  test("in edit mode modal title says 'Edit Job'", () => {
    renderModal({ initialData: editInitialData });
    // eslint-disable-next-line testing-library/no-node-access
    expect(document.getElementById("add-job-modal-title")).toHaveTextContent(
      "Edit Job"
    );
  });

  test("in edit mode submit button says 'Save Changes'", () => {
    renderModal({ initialData: editInitialData });
    expect(
      screen.getByRole("button", { name: /save changes/i })
    ).toBeInTheDocument();
  });
});
