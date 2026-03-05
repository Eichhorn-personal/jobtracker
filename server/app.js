const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { log } = require("./logger");

const authRoutes = require("./routes/auth");
const jobRoutes = require("./routes/jobs");
const dropdownRoutes = require("./routes/dropdowns");
const logRoutes = require("./routes/logs");
const userRoutes = require("./routes/users");
const scrapeRoutes = require("./routes/scrape");

const app = express();

// Trust the first proxy (Fly.io) so req.ip and rate-limiting work correctly
app.set("trust proxy", 1);

app.use(helmet({
  // Google OAuth popup sends credentials back via window.postMessage;
  // same-origin-allow-popups permits that while still blocking other
  // cross-origin window interactions.
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
}));

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:3000").split(",").map(s => s.trim());
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) cb(null, true);
    else {
      log("CORS_REJECTED", { origin: origin || "(none)" });
      cb(new Error("Not allowed by CORS"));
    }
  },
}));
app.use(express.json({ limit: "512kb" }));

// Access log — fires after every response (skip noisy health checks)
app.use((req, res, next) => {
  if (req.path === "/api/health") return next();
  const start = Date.now();
  res.on("finish", () => {
    const fields = {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${Date.now() - start}ms`,
      ip: req.ip || "-",
    };
    if (req.user) fields.user = req.user.username;
    log("ACCESS", fields);
  });
  next();
});

if (process.env.NODE_ENV !== "test") {
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      log("RATE_LIMITED", { path: req.path, ip: req.ip || "-" });
      res.status(429).json({ error: "Too many attempts, please try again later" });
    },
  });
  app.use("/api/auth/login", authLimiter);
  app.use("/api/auth/register", authLimiter);
}

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", authRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/dropdowns", dropdownRoutes);
app.use("/api/logs", logRoutes);
app.use("/api/users", userRoutes);
app.use("/api/scrape", scrapeRoutes);

app.use((err, req, res, _next) => {
  log("UNHANDLED_ERROR", { method: req.method, path: req.path, error: err.message });
  res.status(500).json({ error: "Internal server error" });
});

module.exports = app;
