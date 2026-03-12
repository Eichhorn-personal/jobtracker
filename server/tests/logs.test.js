const request = require("supertest");
const app = require("../app");
const { resetDb } = require("./helpers/db");
const { createUser, authHeader } = require("./helpers/auth");

const SITE_ADMIN_EMAIL = "siteadmin@example.com";

let siteAdmin, admin, contributor;

beforeEach(() => {
  process.env.ADMIN_EMAIL = SITE_ADMIN_EMAIL;
  resetDb();
  siteAdmin = createUser({ username: SITE_ADMIN_EMAIL, role: "admin" });
  admin = createUser({ username: "admin@example.com", role: "admin" });
  contributor = createUser({ username: "user@example.com", role: "user" });
});

afterEach(() => {
  delete process.env.ADMIN_EMAIL;
});

// ── GET /api/logs ────────────────────────────────────────────────────────────

describe("GET /api/logs", () => {
  test("200 — site admin receives an array (empty if no log file yet)", async () => {
    const res = await request(app).get("/api/logs").set(authHeader(siteAdmin));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test("403 — admin role without site admin email is forbidden", async () => {
    const res = await request(app).get("/api/logs").set(authHeader(admin));
    expect(res.status).toBe(403);
  });

  test("403 — contributor is forbidden", async () => {
    const res = await request(app).get("/api/logs").set(authHeader(contributor));
    expect(res.status).toBe(403);
  });

  test("401 — unauthenticated", async () => {
    const res = await request(app).get("/api/logs");
    expect(res.status).toBe(401);
  });

  test("entries are returned newest-first", async () => {
    const fs = require("fs");
    const logPath = process.env.LOG_PATH;
    // Write two entries with known timestamps
    fs.writeFileSync(
      logPath,
      [
        '[2025-01-01T00:00:00.000Z] USER_LOGIN email="first@example.com"',
        '[2025-06-01T00:00:00.000Z] USER_LOGIN email="second@example.com"',
      ].join("\n") + "\n"
    );

    const res = await request(app).get("/api/logs").set(authHeader(siteAdmin));
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
    // Newest first: second entry should appear before first
    const emails = res.body.map(e => e.data.email);
    expect(emails.indexOf("second@example.com")).toBeLessThan(
      emails.indexOf("first@example.com")
    );

    // Clean up
    fs.unlinkSync(logPath);
  });
});
