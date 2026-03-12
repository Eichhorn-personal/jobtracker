const request = require("supertest");
const app = require("../app");
const { getDb } = require("./helpers/db");
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

// ── GET /api/users ───────────────────────────────────────────────────────────

describe("GET /api/users", () => {
  test("200 — site admin receives list of all users", async () => {
    const res = await request(app).get("/api/users").set(authHeader(siteAdmin));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
  });

  test("response does not include password hashes", async () => {
    const res = await request(app).get("/api/users").set(authHeader(siteAdmin));
    expect(res.status).toBe(200);
    res.body.forEach(u => expect(u.password).toBeUndefined());
  });

  test("403 — admin role without site admin email is forbidden", async () => {
    const res = await request(app).get("/api/users").set(authHeader(admin));
    expect(res.status).toBe(403);
  });

  test("403 — user is forbidden", async () => {
    const res = await request(app).get("/api/users").set(authHeader(contributor));
    expect(res.status).toBe(403);
  });

  test("401 — unauthenticated", async () => {
    const res = await request(app).get("/api/users");
    expect(res.status).toBe(401);
  });
});

// ── PUT /api/users/:id/role ──────────────────────────────────────────────────

describe("PUT /api/users/:id/role", () => {
  test("200 — site admin promotes user to admin", async () => {
    const res = await request(app)
      .put(`/api/users/${contributor.id}/role`)
      .set(authHeader(siteAdmin))
      .send({ role: "admin" });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe("admin");
  });

  test("200 — site admin demotes admin to user", async () => {
    const res = await request(app)
      .put(`/api/users/${admin.id}/role`)
      .set(authHeader(siteAdmin))
      .send({ role: "user" });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe("user");
  });

  test("400 — invalid role value", async () => {
    const res = await request(app)
      .put(`/api/users/${contributor.id}/role`)
      .set(authHeader(siteAdmin))
      .send({ role: "superuser" });
    expect(res.status).toBe(400);
  });

  test("404 — nonexistent user", async () => {
    const res = await request(app)
      .put("/api/users/99999/role")
      .set(authHeader(siteAdmin))
      .send({ role: "user" });
    expect(res.status).toBe(404);
  });

  test("403 — admin role without site admin email cannot change roles", async () => {
    const res = await request(app)
      .put(`/api/users/${contributor.id}/role`)
      .set(authHeader(admin))
      .send({ role: "admin" });
    expect(res.status).toBe(403);
  });

  test("403 — user cannot change roles", async () => {
    const res = await request(app)
      .put(`/api/users/${siteAdmin.id}/role`)
      .set(authHeader(contributor))
      .send({ role: "user" });
    expect(res.status).toBe(403);
  });

  test("401 — unauthenticated", async () => {
    const res = await request(app)
      .put(`/api/users/${contributor.id}/role`)
      .send({ role: "admin" });
    expect(res.status).toBe(401);
  });
});

// ── DELETE /api/users/:id ────────────────────────────────────────────────────

describe("DELETE /api/users/:id", () => {
  test("204 — site admin deletes another user", async () => {
    const res = await request(app)
      .delete(`/api/users/${contributor.id}`)
      .set(authHeader(siteAdmin));
    expect(res.status).toBe(204);
  });

  test("deleted user no longer appears in user list", async () => {
    await request(app).delete(`/api/users/${contributor.id}`).set(authHeader(siteAdmin));
    const listRes = await request(app).get("/api/users").set(authHeader(siteAdmin));
    expect(listRes.body.find(u => u.id === contributor.id)).toBeUndefined();
  });

  test("deleting a user also deletes their jobs (cascade)", async () => {
    const db = getDb();
    db.prepare("INSERT INTO jobs (user_id, role, company, status) VALUES (?, ?, ?, ?)")
      .run(contributor.id, "Engineer", "Acme", "Applied");

    await request(app).delete(`/api/users/${contributor.id}`).set(authHeader(siteAdmin));

    const jobs = db.prepare("SELECT * FROM jobs WHERE user_id = ?").all(contributor.id);
    expect(jobs).toHaveLength(0);
  });

  test("400 — site admin cannot delete their own account", async () => {
    const res = await request(app)
      .delete(`/api/users/${siteAdmin.id}`)
      .set(authHeader(siteAdmin));
    expect(res.status).toBe(400);
  });

  test("403 — admin role without site admin email cannot delete users", async () => {
    const res = await request(app)
      .delete(`/api/users/${contributor.id}`)
      .set(authHeader(admin));
    expect(res.status).toBe(403);
  });

  test("403 — user cannot delete users", async () => {
    const res = await request(app)
      .delete(`/api/users/${siteAdmin.id}`)
      .set(authHeader(contributor));
    expect(res.status).toBe(403);
  });

  test("404 — nonexistent user", async () => {
    const res = await request(app)
      .delete("/api/users/99999")
      .set(authHeader(siteAdmin));
    expect(res.status).toBe(404);
  });

  test("401 — unauthenticated", async () => {
    const res = await request(app).delete(`/api/users/${contributor.id}`);
    expect(res.status).toBe(401);
  });
});
