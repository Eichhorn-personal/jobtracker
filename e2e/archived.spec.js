/**
 * E2E tests for the collapsible Archived table.
 *
 * Rows with Status "Ghosted" or "Duplicate" are filtered out of the main
 * table and placed in a collapsible "Archived" section below it.
 */
const { test, expect } = require("@playwright/test");
const { setAuth, mockApi, CONTRIBUTOR, SAMPLE_JOBS } = require("./helpers");

// SAMPLE_JOBS contains only "Applied" rows — no archived statuses.
// Extend it with one Ghosted and one Duplicate row for these tests.
const JOBS_WITH_ARCHIVED = [
  ...SAMPLE_JOBS,
  { id: 3, Role: "Phantom Dev", Company: "SpookCo", Date: "03/01/2025", Status: "Ghosted"   },
  { id: 4, Role: "Copy of Eng", Company: "Initech",  Date: "03/05/2025", Status: "Duplicate" },
];

// ── With archived jobs ─────────────────────────────────────────────────────────

test.describe("Archived table — with archived jobs", () => {
  test.beforeEach(async ({ page }) => {
    await setAuth(page, CONTRIBUTOR);
    await mockApi(page, { jobs: JOBS_WITH_ARCHIVED });
    await page.goto("/#/");
    // Wait for the main table (exact label excludes "Archived job applications")
    await expect(page.getByRole("table", { name: "Job applications" })).toBeVisible();
  });

  test("archived rows are absent from the main table", async ({ page }) => {
    const main = page.getByRole("table", { name: "Job applications" });
    await expect(main.getByText("Phantom Dev", { exact: true })).not.toBeVisible();
    await expect(main.getByText("Copy of Eng",  { exact: true })).not.toBeVisible();
  });

  test("active rows remain in the main table", async ({ page }) => {
    const main = page.getByRole("table", { name: "Job applications" });
    await expect(main.getByText("Engineer", { exact: true })).toBeVisible();
    await expect(main.getByText("Designer", { exact: true })).toBeVisible();
  });

  test("Archived toggle is visible and collapsed by default", async ({ page }) => {
    // Two toggle buttons exist (mobile + desktop); target the visible one
    const toggle = page.locator("button.archived-toggle:visible");
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  test("archived table is not rendered when collapsed", async ({ page }) => {
    await expect(
      page.getByRole("table", { name: "Archived job applications" })
    ).not.toBeAttached();
  });

  test("clicking toggle expands section and shows archived rows", async ({ page }) => {
    await page.locator("button.archived-toggle:visible").click();
    const archived = page.getByRole("table", { name: "Archived job applications" });
    await expect(archived).toBeVisible();
    await expect(archived.getByText("Phantom Dev", { exact: true })).toBeVisible();
    await expect(archived.getByText("Copy of Eng",  { exact: true })).toBeVisible();
    await expect(
      page.locator("button.archived-toggle:visible")
    ).toHaveAttribute("aria-expanded", "true");
  });

  test("clicking toggle again collapses the archived table", async ({ page }) => {
    const toggle = page.locator("button.archived-toggle:visible");
    await toggle.click();
    await expect(page.getByRole("table", { name: "Archived job applications" })).toBeVisible();
    await toggle.click();
    await expect(
      page.getByRole("table", { name: "Archived job applications" })
    ).not.toBeAttached();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
  });
});

// ── Without archived jobs ──────────────────────────────────────────────────────

test.describe("Archived table — no archived jobs", () => {
  test("Archived toggle is not rendered when all jobs are active", async ({ page }) => {
    await setAuth(page, CONTRIBUTOR);
    await mockApi(page); // SAMPLE_JOBS has no Ghosted or Duplicate rows
    await page.goto("/#/");
    await expect(page.getByRole("table", { name: "Job applications" })).toBeVisible();
    await expect(page.locator("button.archived-toggle")).not.toBeAttached();
  });
});
