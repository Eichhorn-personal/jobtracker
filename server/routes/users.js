const express = require("express");
const db = require("../db/database");
const authenticate = require("../middleware/authenticate");
const { log } = require("../logger");

const router = express.Router();
router.use(authenticate);
router.use(require("../middleware/requireSiteAdmin"));

// GET /api/users
router.get("/", (req, res) => {
  const users = db
    .prepare("SELECT id, username, role, created_at FROM users ORDER BY created_at ASC")
    .all();
  return res.json(users);
});

// PUT /api/users/:id/role
router.put("/:id/role", (req, res) => {
  const { role } = req.body;
  if (!["admin", "user"].includes(role)) {
    return res.status(400).json({ error: "Role must be admin or user" });
  }
  const user = db.prepare("SELECT id FROM users WHERE id = ?").get(req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });

  db.prepare("UPDATE users SET role = ? WHERE id = ?").run(role, req.params.id);
  const updated = db
    .prepare("SELECT id, username, role, created_at FROM users WHERE id = ?")
    .get(req.params.id);
  log("USER_ROLE_CHANGED", { adminEmail: req.user.username, targetId: req.params.id, targetEmail: updated.username, newRole: role });
  return res.json(updated);
});

// DELETE /api/users/:id
router.delete("/:id", (req, res) => {
  if (Number(req.params.id) === req.user.id) {
    return res.status(400).json({ error: "Cannot delete your own account" });
  }
  const user = db.prepare("SELECT id, username FROM users WHERE id = ?").get(req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });

  db.prepare("DELETE FROM users WHERE id = ?").run(req.params.id);
  log("USER_DELETED", { adminEmail: req.user.username, targetId: req.params.id, targetEmail: user.username });
  return res.status(204).send();
});

module.exports = router;
