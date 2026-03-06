const express = require("express");
const db = require("../db/database");
const authenticate = require("../middleware/authenticate");
const { log } = require("../logger");

const router = express.Router();
router.use(authenticate);

// Map DB snake_case columns → frontend space-delimited field names
const DB_TO_FRONTEND = {
  id: "id",
  date: "Date",
  role: "Role",
  company: "Company",
  job_board_link: "Job Board Link",
  company_link: "Direct Company Job Link",
  resume: "Resume",
  cover_letter: "Cover Letter",
  status: "Status",
  comments: "Notes",
  ats: "ATS",
};

const FRONTEND_TO_DB = Object.fromEntries(
  Object.entries(DB_TO_FRONTEND).map(([db, fe]) => [fe, db])
);

const URL_RE = /^https?:\/\//i;

function validateJobFields(body) {
  const str = (v) => (v === undefined || v === null ? "" : String(v));
  const checks = [
    [str(body["Role"]).length > 200,        "Role must be 200 characters or fewer"],
    [str(body["Company"]).length > 200,     "Company must be 200 characters or fewer"],
    [str(body["Notes"]).length > 5000,   "Notes must be 5000 characters or fewer"],
    [str(body["Job Board Link"]).length > 2000,  "Job Board Link must be 2000 characters or fewer"],
    [str(body["Direct Company Job Link"]).length > 2000, "Direct Company Job Link must be 2000 characters or fewer"],
    [body["Job Board Link"] && !URL_RE.test(body["Job Board Link"]),   "Job Board Link must start with http:// or https://"],
    [body["Direct Company Job Link"] && !URL_RE.test(body["Direct Company Job Link"]), "Direct Company Job Link must start with http:// or https://"],
  ];
  for (const [failed, message] of checks) {
    if (failed) return message;
  }
  return null;
}

function rowToFrontend(row) {
  const obj = {};
  for (const [dbCol, feField] of Object.entries(DB_TO_FRONTEND)) {
    if (dbCol === "resume" || dbCol === "cover_letter") {
      obj[feField] = row[dbCol] === 1;
    } else if (dbCol in row) {
      obj[feField] = row[dbCol] ?? "";
    }
  }
  obj.created_at = row.created_at ?? null;
  obj.updated_at = row.updated_at ?? null;
  return obj;
}

// GET /api/jobs
router.get("/", (req, res) => {
  const rows = db
    .prepare("SELECT * FROM jobs WHERE user_id = ? ORDER BY id ASC")
    .all(req.user.id);
  return res.json(rows.map(rowToFrontend));
});

// POST /api/jobs
router.post("/", (req, res) => {
  const body = req.body;
  const validationError = validateJobFields(body);
  if (validationError) return res.status(400).json({ error: validationError });

  const stmt = db.prepare(`
    INSERT INTO jobs
      (user_id, date, role, company, job_board_link, company_link,
       resume, cover_letter, status, comments, ats)
    VALUES
      (@user_id, @date, @role, @company, @job_board_link, @company_link,
       @resume, @cover_letter, @status, @comments, @ats)
  `);

  const result = stmt.run({
    user_id: req.user.id,
    date: body["Date"] ?? "",
    role: body["Role"] ?? "",
    company: body["Company"] ?? "",
    job_board_link: body["Job Board Link"] ?? "",
    company_link: body["Direct Company Job Link"] ?? "",
    resume: body["Resume"] ? 1 : 0,
    cover_letter: body["Cover Letter"] ? 1 : 0,
    status: body["Status"] ?? "Applied",
    comments: body["Notes"] ?? "",
    ats: body["ATS"] || null,
  });

  const created = db.prepare("SELECT * FROM jobs WHERE id = ?").get(result.lastInsertRowid);
  log("JOB_CREATED", { id: created.id, email: req.user.username, role: created.role, company: created.company });
  return res.status(201).json(rowToFrontend(created));
});

// PUT /api/jobs/:id
router.put("/:id", (req, res) => {
  const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(req.params.id);
  if (!job) return res.status(404).json({ error: "Job not found" });
  if (job.user_id !== req.user.id) return res.status(403).json({ error: "Forbidden" });

  const body = req.body;
  const validationError = validateJobFields(body);
  if (validationError) return res.status(400).json({ error: validationError });

  db.prepare(`
    UPDATE jobs SET
      date = @date,
      role = @role,
      company = @company,
      job_board_link = @job_board_link,
      company_link = @company_link,
      resume = @resume,
      cover_letter = @cover_letter,
      status = @status,
      comments = @comments,
      ats = @ats,
      updated_at = datetime('now')
    WHERE id = @id
  `).run({
    id: req.params.id,
    date: body["Date"] ?? job.date,
    role: body["Role"] ?? job.role,
    company: body["Company"] ?? job.company,
    job_board_link: body["Job Board Link"] ?? job.job_board_link,
    company_link: body["Direct Company Job Link"] ?? job.company_link,
    resume: body["Resume"] !== undefined ? (body["Resume"] ? 1 : 0) : job.resume,
    cover_letter: body["Cover Letter"] !== undefined ? (body["Cover Letter"] ? 1 : 0) : job.cover_letter,
    status: body["Status"] ?? job.status,
    comments: body["Notes"] ?? job.comments,
    ats: body["ATS"] !== undefined ? (body["ATS"] || null) : (job.ats || null),
  });

  const updated = db.prepare("SELECT * FROM jobs WHERE id = ?").get(req.params.id);
  log("JOB_UPDATED", { id: updated.id, email: req.user.username, role: updated.role, company: updated.company });
  return res.json(rowToFrontend(updated));
});

// DELETE /api/jobs/:id
router.delete("/:id", (req, res) => {
  const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(req.params.id);
  if (!job) return res.status(404).json({ error: "Job not found" });
  if (job.user_id !== req.user.id) return res.status(403).json({ error: "Forbidden" });

  db.prepare("DELETE FROM jobs WHERE id = ?").run(req.params.id);
  log("JOB_DELETED", { id: job.id, email: req.user.username, role: job.role, company: job.company });
  return res.status(204).send();
});

module.exports = router;
