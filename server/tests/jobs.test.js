const request = require("supertest");
const app = require("../app");
const { resetDb } = require("./helpers/db");
const { createUser, authHeader } = require("./helpers/auth");

let user, otherUser;

beforeEach(() => {
  resetDb();
  user = createUser({ username: "user@example.com" });
  otherUser = createUser({ username: "other@example.com" });
});

async function addJob(asUser, overrides = {}) {
  return request(app)
    .post("/api/jobs")
    .set(authHeader(asUser))
    .send({ Date: "01/15/2025", Role: "Engineer", Company: "Acme Corp", ...overrides });
}

// ── GET /api/jobs ────────────────────────────────────────────────────────────

describe("GET /api/jobs", () => {
  test("200 — authenticated user receives array", async () => {
    const res = await request(app).get("/api/jobs").set(authHeader(user));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test("401 — unauthenticated", async () => {
    const res = await request(app).get("/api/jobs");
    expect(res.status).toBe(401);
  });

  test("returns only jobs belonging to the requesting user", async () => {
    await addJob(user, { Company: "UserCo" });
    await addJob(otherUser, { Company: "OtherCo" });
    const res = await request(app).get("/api/jobs").set(authHeader(user));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].Company).toBe("UserCo");
  });
});

// ── POST /api/jobs ───────────────────────────────────────────────────────────

describe("POST /api/jobs", () => {
  test("201 — valid body creates and returns job", async () => {
    const res = await addJob(user);
    expect(res.status).toBe(201);
    expect(res.body.Company).toBe("Acme Corp");
    expect(res.body.id).toBeDefined();
  });

  test("401 — unauthenticated", async () => {
    const res = await request(app).post("/api/jobs").send({ Role: "Engineer" });
    expect(res.status).toBe(401);
  });

  test("400 — company name exceeds 200 characters", async () => {
    const res = await addJob(user, { Company: "A".repeat(201) });
    expect(res.status).toBe(400);
  });

  test("400 — role name exceeds 200 characters", async () => {
    const res = await addJob(user, { Role: "B".repeat(201) });
    expect(res.status).toBe(400);
  });

  test("400 — notes exceed 5000 characters", async () => {
    const res = await addJob(user, { Notes: "x".repeat(5001) });
    expect(res.status).toBe(400);
  });

  test("400 — job board link with javascript: scheme rejected", async () => {
    const res = await addJob(user, { "Job Board Link": "javascript:alert(1)" });
    expect(res.status).toBe(400);
  });

  test("400 — company_link with data: scheme rejected", async () => {
    const res = await addJob(user, { "Company Link": "data:text/html,<h1>hi</h1>" });
    expect(res.status).toBe(400);
  });

  test("201 — valid https job board link is accepted", async () => {
    const res = await addJob(user, { "Job Board Link": "https://jobs.example.com/123" });
    expect(res.status).toBe(201);
    expect(res.body["Job Board Link"]).toBe("https://jobs.example.com/123");
  });

  test("201 — empty job board link is accepted", async () => {
    const res = await addJob(user, { "Job Board Link": "" });
    expect(res.status).toBe(201);
  });

  test("Notes field is saved and returned as 'Notes'", async () => {
    const res = await addJob(user, { Notes: "Follow up Monday" });
    expect(res.status).toBe(201);
    expect(res.body.Notes).toBe("Follow up Monday");
    expect(res.body.Comments).toBeUndefined();
  });

  test("boolean fields are returned as booleans", async () => {
    const res = await addJob(user, { Resume: true, "Cover Letter": false });
    expect(res.status).toBe(201);
    expect(res.body.Resume).toBe(true);
    expect(res.body["Cover Letter"]).toBe(false);
  });
});

// ── PUT /api/jobs/:id ────────────────────────────────────────────────────────

describe("PUT /api/jobs/:id", () => {
  test("200 — user can update their own job", async () => {
    const { body: created } = await addJob(user);
    const res = await request(app)
      .put(`/api/jobs/${created.id}`)
      .set(authHeader(user))
      .send({ Company: "Updated Co" });
    expect(res.status).toBe(200);
    expect(res.body.Company).toBe("Updated Co");
  });

  test("403 — user cannot update another user's job", async () => {
    const { body: created } = await addJob(user);
    const res = await request(app)
      .put(`/api/jobs/${created.id}`)
      .set(authHeader(otherUser))
      .send({ Company: "Hacked" });
    expect(res.status).toBe(403);
  });

  test("404 — nonexistent job", async () => {
    const res = await request(app)
      .put("/api/jobs/99999")
      .set(authHeader(user))
      .send({ Company: "X" });
    expect(res.status).toBe(404);
  });

  test("400 — rejects invalid URL on update", async () => {
    const { body: created } = await addJob(user);
    const res = await request(app)
      .put(`/api/jobs/${created.id}`)
      .set(authHeader(user))
      .send({ "Job Board Link": "javascript:evil()" });
    expect(res.status).toBe(400);
  });

  test("401 — unauthenticated", async () => {
    const { body: created } = await addJob(user);
    const res = await request(app)
      .put(`/api/jobs/${created.id}`)
      .send({ Company: "X" });
    expect(res.status).toBe(401);
  });
});

// ── DELETE /api/jobs/:id ─────────────────────────────────────────────────────

describe("DELETE /api/jobs/:id", () => {
  test("204 — user can delete their own job", async () => {
    const { body: created } = await addJob(user);
    const res = await request(app)
      .delete(`/api/jobs/${created.id}`)
      .set(authHeader(user));
    expect(res.status).toBe(204);
  });

  test("job is actually removed after deletion", async () => {
    const { body: created } = await addJob(user);
    await request(app).delete(`/api/jobs/${created.id}`).set(authHeader(user));
    const listRes = await request(app).get("/api/jobs").set(authHeader(user));
    expect(listRes.body.find(j => j.id === created.id)).toBeUndefined();
  });

  test("403 — user cannot delete another user's job", async () => {
    const { body: created } = await addJob(user);
    const res = await request(app)
      .delete(`/api/jobs/${created.id}`)
      .set(authHeader(otherUser));
    expect(res.status).toBe(403);
  });

  test("404 — nonexistent job", async () => {
    const res = await request(app)
      .delete("/api/jobs/99999")
      .set(authHeader(user));
    expect(res.status).toBe(404);
  });

  test("401 — unauthenticated", async () => {
    const { body: created } = await addJob(user);
    const res = await request(app).delete(`/api/jobs/${created.id}`);
    expect(res.status).toBe(401);
  });
});
