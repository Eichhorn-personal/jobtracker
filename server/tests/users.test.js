const request = require("supertest");
const app = require("../app");
const { getDb, resetDb } = require("./helpers/db");
const { createUser, authHeader } = require("./helpers/auth");

let admin, contributor;

beforeEach(() => {
  resetDb();
  admin = createUser({ username: "admin@example.com", role: "admin" });
  contributor = createUser({ username: "user@example.com", role: "user" });
});

// ── GET /api/users ───────────────────────────────────────────────────────────

describe("GET /api/users", () => {
  test("200 — admin receives list of all users", async () => {
    const res = await request(app).get("/api/users").set(authHeader(admin));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
  });

  test("response does not include password hashes", async () => {
    const res = await request(app).get("/api/users").set(authHeader(admin));
    expect(res.status).toBe(200);
    res.body.forEach(u => expect(u.password).toBeUndefined());
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
  test("200 — admin promotes user to admin", async () => {
    const res = await request(app)
      .put(`/api/users/${contributor.id}/role`)
      .set(authHeader(admin))
      .send({ role: "admin" });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe("admin");
  });

  test("200 — admin demotes admin to user", async () => {
    const other = createUser({ username: "other-admin@example.com", role: "admin" });
    const res = await request(app)
      .put(`/api/users/${other.id}/role`)
      .set(authHeader(admin))
      .send({ role: "user" });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe("user");
  });

  test("400 — invalid role value", async () => {
    const res = await request(app)
      .put(`/api/users/${contributor.id}/role`)
      .set(authHeader(admin))
      .send({ role: "superuser" });
    expect(res.status).toBe(400);
  });

  test("404 — nonexistent user", async () => {
    const res = await request(app)
      .put("/api/users/99999/role")
      .set(authHeader(admin))
      .send({ role: "user" });
    expect(res.status).toBe(404);
  });

  test("403 — user cannot change roles", async () => {
    const res = await request(app)
      .put(`/api/users/${admin.id}/role`)
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
  test("204 — admin deletes another user", async () => {
    const res = await request(app)
      .delete(`/api/users/${contributor.id}`)
      .set(authHeader(admin));
    expect(res.status).toBe(204);
  });

  test("deleted user no longer appears in user list", async () => {
    await request(app).delete(`/api/users/${contributor.id}`).set(authHeader(admin));
    const listRes = await request(app).get("/api/users").set(authHeader(admin));
    expect(listRes.body.find(u => u.id === contributor.id)).toBeUndefined();
  });

  test("deleting a user also deletes their jobs (cascade)", async () => {
    const db = getDb();
    db.prepare("INSERT INTO jobs (user_id, role, company, status) VALUES (?, ?, ?, ?)")
      .run(contributor.id, "Engineer", "Acme", "Applied");

    await request(app).delete(`/api/users/${contributor.id}`).set(authHeader(admin));

    const jobs = db.prepare("SELECT * FROM jobs WHERE user_id = ?").all(contributor.id);
    expect(jobs).toHaveLength(0);
  });

  test("400 — admin cannot delete their own account", async () => {
    const res = await request(app)
      .delete(`/api/users/${admin.id}`)
      .set(authHeader(admin));
    expect(res.status).toBe(400);
  });

  test("403 — user cannot delete users", async () => {
    const res = await request(app)
      .delete(`/api/users/${admin.id}`)
      .set(authHeader(contributor));
    expect(res.status).toBe(403);
  });

  test("404 — nonexistent user", async () => {
    const res = await request(app)
      .delete("/api/users/99999")
      .set(authHeader(admin));
    expect(res.status).toBe(404);
  });

  test("401 — unauthenticated", async () => {
    const res = await request(app).delete(`/api/users/${contributor.id}`);
    expect(res.status).toBe(401);
  });
});
