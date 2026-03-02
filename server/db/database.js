const Database = require("better-sqlite3");
const path = require("path");

const dbPath = process.env.DB_PATH || path.join(__dirname, "..", "jobtracker.db");
const db = new Database(dbPath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS dropdown_options (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    field_name TEXT NOT NULL,
    label      TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(field_name, label)
  );

  CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    username   TEXT NOT NULL UNIQUE,
    password   TEXT,
    google_id  TEXT UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS jobs (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date           TEXT,
    role           TEXT,
    company        TEXT,
    job_board_link TEXT,
    company_link   TEXT,
    resume       INTEGER NOT NULL DEFAULT 0,
    cover_letter INTEGER NOT NULL DEFAULT 0,
    status       TEXT NOT NULL DEFAULT 'Applied',
    recruiter    TEXT,
    hiring_mgr   TEXT,
    panel        TEXT,
    hr           TEXT,
    comments     TEXT,
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Seed default Status options if none exist yet
const statusCount = db.prepare("SELECT COUNT(*) AS n FROM dropdown_options WHERE field_name = 'Status'").get().n;
if (statusCount === 0) {
  const insertOpt = db.prepare("INSERT INTO dropdown_options (field_name, label, sort_order) VALUES (?, ?, ?)");
  ["Applied", "Interviewing", "Offer", "Rejected", "Ghosted"].forEach((label, i) => {
    insertOpt.run("Status", label, i);
  });
}

// Migration: add google_id column to existing databases
const userCols = db.pragma("table_info(users)").map((c) => c.name);
if (!userCols.includes("google_id")) {
  db.exec("ALTER TABLE users ADD COLUMN google_id TEXT");
  db.exec(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL"
  );
}

// Migration: add role column to existing databases
if (!userCols.includes("role")) {
  db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'");
}

// Migration: rename 'contributor' role to 'user'
db.prepare("UPDATE users SET role = 'user' WHERE role = 'contributor'").run();

// Migration: add display_name and photo columns
if (!userCols.includes("display_name")) {
  db.exec("ALTER TABLE users ADD COLUMN display_name TEXT");
}
if (!userCols.includes("photo")) {
  db.exec("ALTER TABLE users ADD COLUMN photo TEXT");
}

// Migration: add resume_link column to users
if (!userCols.includes("resume_link")) {
  db.exec("ALTER TABLE users ADD COLUMN resume_link TEXT");
}

// Migration: rename source_link to job_board_link
const jobCols = db.pragma("table_info(jobs)").map((c) => c.name);
if (jobCols.includes("source_link")) {
  db.exec("ALTER TABLE jobs RENAME COLUMN source_link TO job_board_link");
}

// Migration: add color column to dropdown_options
const dropCols = db.pragma("table_info(dropdown_options)").map((c) => c.name);
if (!dropCols.includes("color")) {
  db.exec("ALTER TABLE dropdown_options ADD COLUMN color TEXT");
}

// Always ensure designated admin has admin role (handles fresh DBs where user didn't exist at migration time)
const adminEmail = process.env.ADMIN_EMAIL;
if (adminEmail) {
  db.prepare("UPDATE users SET role = 'admin' WHERE username = ?").run(adminEmail);
}

module.exports = db;
