const { isAdminEmail } = require("../utils/adminEmails");

module.exports = function requireSiteAdmin(req, res, next) {
  if (!isAdminEmail(req.user.username)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
};
