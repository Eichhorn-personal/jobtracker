const express = require("express");
const https = require("https");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const db = require("../db/database");
const authenticate = require("../middleware/authenticate");
const { log } = require("../logger");
const { serializeUser, findUserById } = require("../db/queries");

// Fetch a remote HTTPS image and return it as a base64 data URL.
// Follows up to 3 redirects. Used for Google profile photo import.
function fetchImageAsBase64(url) {
  return new Promise((resolve, reject) => {
    const attempt = (currentUrl, redirectsLeft) => {
      if (!currentUrl.startsWith("https://")) {
        return reject(new Error("Only HTTPS URLs allowed"));
      }
      https.get(currentUrl, (res) => {
        if ([301, 302, 307, 308].includes(res.statusCode)) {
          res.resume();
          if (redirectsLeft <= 0) return reject(new Error("Too many redirects"));
          const location = res.headers.location;
          if (!location) return reject(new Error("Redirect with no location"));
          const nextUrl = location.startsWith("http") ? location : new URL(location, currentUrl).toString();
          return attempt(nextUrl, redirectsLeft - 1);
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        const mimeType = (res.headers["content-type"] || "image/jpeg").split(";")[0].trim();
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const buf = Buffer.concat(chunks);
          if (buf.length > 300 * 1024) return reject(new Error("Image too large"));
          resolve(`data:${mimeType};base64,${buf.toString("base64")}`);
        });
        res.on("error", reject);
      }).on("error", reject);
    };
    attempt(url, 3);
  });
}

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

function createSampleJob(userId) {
  const today = new Date();
  const date = `${String(today.getMonth() + 1).padStart(2, "0")}/${String(today.getDate()).padStart(2, "0")}/${today.getFullYear()}`;
  db.prepare(`
    INSERT INTO jobs (user_id, date, role, company, job_board_link, company_link,
                      resume, cover_letter, status, comments)
    VALUES (?, ?, ?, ?, ?, '', 0, 0, 'Applied', '')
  `).run(userId, date, "<sample role>", "<sample company>", "<paste job board link here>");
}

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Dummy hash used to equalize timing when user is not found (prevents username enumeration)
const DUMMY_HASH = bcrypt.hashSync("dummy-timing-equalization", 10);

// If ALLOWED_EMAILS is set, only those addresses may register or sign in.
// Read from process.env at call time so it can be overridden in tests.
function isEmailAllowed(email) {
  if (!process.env.ALLOWED_EMAILS) return true;
  const allowed = process.env.ALLOWED_EMAILS.split(",").map(e => e.trim().toLowerCase());
  return allowed.includes(email.toLowerCase());
}

// POST /api/auth/register
router.post("/register", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }
  if (typeof username !== "string" || username.length > 254) {
    return res.status(400).json({ error: "Email must be 254 characters or fewer" });
  }
  if (typeof password !== "string" || password.length < 8 || password.length > 128) {
    return res.status(400).json({ error: "Password must be between 8 and 128 characters" });
  }
  if (!EMAIL_RE.test(username)) {
    return res.status(400).json({ error: "Username must be a valid email address" });
  }
  if (!isEmailAllowed(username)) {
    return res.status(403).json({ error: "Registration is not open for this email address" });
  }

  const hash = await bcrypt.hash(password, 10);
  try {
    const stmt = db.prepare("INSERT INTO users (username, password) VALUES (?, ?)");
    const result = stmt.run(username, hash);
    log("USER_CREATED", { id: result.lastInsertRowid, email: username, source: "password" });
    createSampleJob(result.lastInsertRowid);
    return res.status(201).json({ id: result.lastInsertRowid, username });
  } catch (err) {
    if (err.message.includes("UNIQUE")) {
      return res.status(409).json({ error: "Username already taken" });
    }
    throw err;
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }
  if (typeof username !== "string" || username.length > 254) {
    return res.status(400).json({ error: "Email must be 254 characters or fewer" });
  }
  if (typeof password !== "string" || password.length > 128) {
    return res.status(400).json({ error: "Invalid credentials" });
  }
  if (!EMAIL_RE.test(username)) {
    return res.status(400).json({ error: "Username must be a valid email address" });
  }

  const user = db.prepare("SELECT id, username, password, google_id, role, display_name, photo FROM users WHERE username = ?").get(username);
  if (!user || !user.password) {
    await bcrypt.compare(password, DUMMY_HASH); // equalize timing to prevent username enumeration
    return res.status(401).json({ error: "Invalid credentials" });
  }
  if (user.google_id && !user.password) {
    return res.status(400).json({ error: "This account uses Google Sign-In. Please use the Google button." });
  }
  if (!await bcrypt.compare(password, user.password)) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = jwt.sign(
    { sub: user.id, username: user.username, role: user.role },
    process.env.JWT_SECRET,
    { algorithm: "HS256", expiresIn: "8h" }
  );

  const fullUser = findUserById(user.id);
  log("USER_LOGIN", { email: user.username, source: "password" });
  return res.json({ token, user: serializeUser(fullUser) });
});

// POST /api/auth/google
router.post("/google", async (req, res) => {
  const { credential } = req.body;
  if (!credential) {
    return res.status(400).json({ error: "Missing Google credential" });
  }

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch {
    return res.status(401).json({ error: "Invalid Google token" });
  }

  const googleId = payload.sub;
  const email = payload.email;

  if (!isEmailAllowed(email)) {
    return res.status(403).json({ error: "Registration is not open for this email address" });
  }

  // Atomically find-or-create the user for this Google account.
  // The transaction prevents duplicate-user races when two devices log in simultaneously.
  let wasCreated = false;
  let wasLinked  = false;

  const findOrCreateUser = db.transaction(() => {
    // 1. Already linked to this Google account
    let u = db.prepare("SELECT id, username, role, display_name, photo FROM users WHERE google_id = ?").get(googleId);
    if (u) return u;

    // 2. Existing account with matching email (case-insensitive) — link it
    const byEmail = db
      .prepare("SELECT id, username, role, display_name, photo FROM users WHERE LOWER(username) = LOWER(?)")
      .get(email);
    if (byEmail) {
      db.prepare("UPDATE users SET google_id = ? WHERE id = ?").run(googleId, byEmail.id);
      wasLinked = true;
      return db.prepare("SELECT id, username, role, display_name, photo FROM users WHERE id = ?").get(byEmail.id);
    }

    // 3. Brand-new user — INSERT OR IGNORE handles the rare simultaneous-login race
    const role = process.env.ADMIN_EMAIL && email.toLowerCase() === process.env.ADMIN_EMAIL.toLowerCase()
      ? "admin"
      : "user";
    const result = db
      .prepare("INSERT OR IGNORE INTO users (username, password, google_id, role) VALUES (?, ?, ?, ?)")
      .run(email.toLowerCase(), "", googleId, role);

    if (result.changes > 0) {
      wasCreated = true;
      return db.prepare("SELECT id, username, role, display_name, photo FROM users WHERE id = ?").get(result.lastInsertRowid);
    }

    // INSERT was ignored (another request created the user between steps 1 and 3) — re-find
    return (
      db.prepare("SELECT id, username, role, display_name, photo FROM users WHERE google_id = ?").get(googleId) ||
      db.prepare("SELECT id, username, role, display_name, photo FROM users WHERE LOWER(username) = LOWER(?)").get(email)
    );
  });

  const user = findOrCreateUser();
  if (!user) return res.status(500).json({ error: "Failed to sign in with Google" });

  if (wasCreated) {
    log("USER_CREATED", { id: user.id, email, source: "google" });
    createSampleJob(user.id);
  }
  if (wasLinked)  log("GOOGLE_ACCOUNT_LINKED", { id: user.id, email });

  // For Google users we need the password field to compute has_password
  const fullUser = findUserById(user.id);

  const token = jwt.sign(
    { sub: user.id, username: user.username, role: user.role },
    process.env.JWT_SECRET,
    { algorithm: "HS256", expiresIn: "8h" }
  );

  log("USER_LOGIN", { email: user.username, source: "google" });
  return res.json({ token, user: serializeUser(fullUser), google_picture: payload.picture || null });
});

// POST /api/auth/logout
router.post("/logout", authenticate, (req, res) => {
  log("USER_LOGOUT", { email: req.user.username });
  return res.status(204).send();
});

// GET /api/auth/me
router.get("/me", authenticate, (req, res) => {
  const user = findUserById(req.user.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  return res.json(serializeUser(user));
});

// PUT /api/auth/profile
router.put("/profile", authenticate, async (req, res) => {
  const { display_name, photo, resume_link, linkedin_url, github_url, current_password, new_password, google_picture_url } = req.body;

  // Validate direct photo upload
  if (photo !== undefined && photo !== null) {
    if (typeof photo !== "string") {
      return res.status(400).json({ error: "Invalid photo format" });
    }
    if (photo.length > 300 * 1024) {
      return res.status(400).json({ error: "Photo must be 300 KB or smaller" });
    }
  }

  // Validate google_picture_url (host check; actual fetch happens below)
  if (google_picture_url !== undefined) {
    if (typeof google_picture_url !== "string") {
      return res.status(400).json({ error: "Invalid google_picture_url" });
    }
    let parsedUrl;
    try { parsedUrl = new URL(google_picture_url); } catch {
      return res.status(400).json({ error: "Invalid google_picture_url" });
    }
    if (!parsedUrl.hostname.endsWith("googleusercontent.com")) {
      return res.status(400).json({ error: "Invalid google_picture_url" });
    }
  }

  // Validate resume_link if provided
  if (resume_link !== undefined && resume_link !== null && resume_link !== "") {
    if (typeof resume_link !== "string" || resume_link.length > 2000) {
      return res.status(400).json({ error: "Resume link must be 2000 characters or fewer" });
    }
    if (!/^https?:\/\//i.test(resume_link)) {
      return res.status(400).json({ error: "Resume link must start with http:// or https://" });
    }
  }

  // Validate linkedin_url if provided
  if (linkedin_url !== undefined && linkedin_url !== null && linkedin_url !== "") {
    if (typeof linkedin_url !== "string" || linkedin_url.length > 2000) {
      return res.status(400).json({ error: "LinkedIn URL must be 2000 characters or fewer" });
    }
    if (!/^https?:\/\//i.test(linkedin_url)) {
      return res.status(400).json({ error: "LinkedIn URL must start with http:// or https://" });
    }
  }

  // Validate github_url if provided
  if (github_url !== undefined && github_url !== null && github_url !== "") {
    if (typeof github_url !== "string" || github_url.length > 2000) {
      return res.status(400).json({ error: "GitHub URL must be 2000 characters or fewer" });
    }
    if (!/^https?:\/\//i.test(github_url)) {
      return res.status(400).json({ error: "GitHub URL must start with http:// or https://" });
    }
  }

  // Validate new_password if provided
  if (new_password !== undefined) {
    if (typeof new_password !== "string" || new_password.length < 8 || new_password.length > 128) {
      return res.status(400).json({ error: "New password must be between 8 and 128 characters" });
    }
  }

  // Load current user record
  const user = findUserById(req.user.id);
  if (!user) return res.status(404).json({ error: "User not found" });

  let newHash = undefined;
  if (new_password !== undefined) {
    const hasExistingPassword = !!(user.password);
    if (hasExistingPassword) {
      if (!current_password) {
        return res.status(400).json({ error: "Current password is required" });
      }
      const valid = await bcrypt.compare(current_password, user.password);
      if (!valid) {
        return res.status(401).json({ error: "Current password is incorrect" });
      }
    }
    newHash = await bcrypt.hash(new_password, 10);
  }

  // Build update — google_picture_url is fetched here so the result goes
  // directly into params; no intermediate variable reassignment needed.
  const updates = [];
  const params = [];

  if (display_name !== undefined) {
    updates.push("display_name = ?");
    params.push(display_name || null);
  }
  if (resume_link !== undefined) {
    updates.push("resume_link = ?");
    params.push(resume_link || null);
  }
  if (linkedin_url !== undefined) {
    updates.push("linkedin_url = ?");
    params.push(linkedin_url || null);
  }
  if (github_url !== undefined) {
    updates.push("github_url = ?");
    params.push(github_url || null);
  }
  if (photo !== undefined) {
    updates.push("photo = ?");
    params.push(photo || null);
  }
  if (google_picture_url !== undefined) {
    let fetchedPhoto;
    try {
      fetchedPhoto = await fetchImageAsBase64(google_picture_url);
    } catch {
      return res.status(502).json({ error: "Could not fetch photo from Google" });
    }
    updates.push("photo = ?");
    params.push(fetchedPhoto);
  }
  if (newHash !== undefined) {
    updates.push("password = ?");
    params.push(newHash);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: "No fields to update" });
  }

  params.push(user.id);
  db.prepare(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`).run(...params);

  const updated = findUserById(user.id);
  log("USER_PROFILE_UPDATED", { id: user.id, email: user.username });
  return res.json(serializeUser(updated));
});

module.exports = router;
