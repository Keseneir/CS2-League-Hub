const { ADMIN_STEAM_ID } = require("../config/constants");

function requireAuth(req, res, next) {
  if (!req.isAuthenticated()) return res.status(401).json({ error: "Unauthorized" });
  next();
}

function requireAdmin(req, res, next) {
  if (!req.isAuthenticated() || req.user.steamId !== ADMIN_STEAM_ID)
    return res.status(403).json({ error: "Forbidden" });
  next();
}

module.exports = { requireAuth, requireAdmin };