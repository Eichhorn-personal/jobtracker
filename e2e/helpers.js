/**
 * Shared helpers for Playwright E2E tests.
 *
 * All tests mock the API layer with page.route() so no backend is required.
 */

const TEST_TOKEN = "test.jwt.token";

const CONTRIBUTOR = { id: 2, username: "user@example.com", role: "contributor" };
const ADMIN       = { id: 1, username: "admin@example.com", role: "admin" };

const SAMPLE_JOBS = [
  { id: 1, Role: "Engineer",  Company: "Acme",   Date: "01/15/2025", Status: "Applied"  },
  { id: 2, Role: "Designer",  Company: "Globex", Date: "02/20/2025", Status: "Applied"  },
];

const EMPTY_DROPDOWNS = {};

/**
 * Inject localStorage auth state before the page loads.
 * Must be called before page.goto().
 */
async function setAuth(page, user = CONTRIBUTOR) {
  await page.addInitScript(
    ({ token, userData }) => {
      localStorage.setItem("authToken", token);
      localStorage.setItem("authUser", JSON.stringify(userData));
    },
    { token: TEST_TOKEN, userData: user }
  );
}

/**
 * Set up standard API route mocks:
 *   GET  /api/jobs          → SAMPLE_JOBS (or custom list)
 *   GET  /api/dropdowns     → {}
 *   POST /api/jobs          → echoes body back with id=99
 *   PUT  /api/jobs/:id      → { ok: true }
 *   DELETE /api/jobs/:id    → { ok: true }
 *   POST /api/auth/logout   → { ok: true }
 */
async function mockApi(page, { jobs = SAMPLE_JOBS } = {}) {
  await page.route("**/api/jobs", async (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({ json: jobs });
    }
    if (route.request().method() === "POST") {
      const body = JSON.parse(route.request().postData() || "{}");
      return route.fulfill({ json: { id: 99, ...body } });
    }
    return route.continue();
  });

  await page.route("**/api/jobs/**", async (route) => {
    return route.fulfill({ json: { ok: true } });
  });

  await page.route("**/api/dropdowns", async (route) => {
    return route.fulfill({ json: EMPTY_DROPDOWNS });
  });

  await page.route("**/api/auth/logout", async (route) => {
    return route.fulfill({ json: { ok: true } });
  });
}

/**
 * Mock the login endpoint to return a successful auth response.
 */
async function mockLoginSuccess(page, user = CONTRIBUTOR) {
  await page.route("**/api/auth/login", async (route) => {
    return route.fulfill({
      json: { token: TEST_TOKEN, user },
    });
  });
}

/**
 * Mock the login endpoint to return an error.
 */
async function mockLoginError(page, message = "Invalid credentials") {
  await page.route("**/api/auth/login", async (route) => {
    return route.fulfill({
      status: 401,
      json: { error: message },
    });
  });
}

module.exports = {
  TEST_TOKEN,
  CONTRIBUTOR,
  ADMIN,
  SAMPLE_JOBS,
  setAuth,
  mockApi,
  mockLoginSuccess,
  mockLoginError,
};
