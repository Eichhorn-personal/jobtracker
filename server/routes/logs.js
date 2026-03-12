const express = require("express");
const fs = require("fs");
const path = require("path");
const authenticate = require("../middleware/authenticate");

const router = express.Router();
router.use(authenticate);
router.use(require("../middleware/requireSiteAdmin"));

const logPath = process.env.LOG_PATH || path.join(__dirname, "..", "app.log");

function parseLine(line) {
  const tsMatch = line.match(/^\[([^\]]+)\]/);
  if (!tsMatch) return null;
  const rest = line.slice(tsMatch[0].length).trim();
  const spaceIdx = rest.indexOf(" ");
  const event = spaceIdx === -1 ? rest : rest.slice(0, spaceIdx);
  const fieldStr = spaceIdx === -1 ? "" : rest.slice(spaceIdx + 1);
  const data = {};
  for (const token of fieldStr.match(/\w+=(?:"[^"]*"|\S+)/g) || []) {
    const eq = token.indexOf("=");
    const key = token.slice(0, eq);
    const raw = token.slice(eq + 1);
    try { data[key] = JSON.parse(raw); } catch { data[key] = raw; }
  }
  return { timestamp: tsMatch[1], event, data };
}

// GET /api/logs
router.get("/", (req, res) => {
  try {
    const content = fs.readFileSync(logPath, "utf8");
    const entries = content
      .trim()
      .split("\n")
      .filter(Boolean)
      .map(parseLine)
      .filter(Boolean)
      .reverse();
    return res.json(entries);
  } catch (err) {
    if (err.code === "ENOENT") return res.json([]);
    throw err;
  }
});

module.exports = router;
