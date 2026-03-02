const db = require("./database");

function serializeUser(u) {
  return {
    id: u.id,
    username: u.username,
    role: u.role,
    display_name: u.display_name || null,
    photo: u.photo || null,
    resume_link: u.resume_link || null,
    has_password: !!(u.password),
  };
}

function findUserById(id) {
  return db
    .prepare("SELECT id, username, password, role, display_name, photo, resume_link FROM users WHERE id = ?")
    .get(id);
}

module.exports = { serializeUser, findUserById };
