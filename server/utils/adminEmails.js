// ADMIN_EMAIL may be a single email or a comma-separated list.
function getAdminEmails() {
  const val = process.env.ADMIN_EMAIL || "";
  return val.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
}

function isAdminEmail(email) {
  if (!email) return false;
  return getAdminEmails().includes(email.toLowerCase());
}

module.exports = { getAdminEmails, isAdminEmail };
