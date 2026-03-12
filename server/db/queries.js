const db = require("./database");
const { isAdminEmail } = require("../utils/adminEmails");

function serializeUser(u) {
  return {
    id: u.id,
    username: u.username,
    role: u.role,
    display_name: u.display_name || null,
    photo: u.photo || null,
    resume_link: u.resume_link || null,
    linkedin_url: u.linkedin_url || null,
    github_url: u.github_url || null,
    has_password: !!(u.password),
    is_site_admin: isAdminEmail(u.username),
  };
}

function findUserById(id) {
  return db
    .prepare("SELECT id, username, password, role, display_name, photo, resume_link, linkedin_url, github_url FROM users WHERE id = ?")
    .get(id);
}

module.exports = { serializeUser, findUserById };
