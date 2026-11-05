// Чёрный список пользователя: просмотр и разблокировка по id.
// Подключить в server.js рядом с остальными роутами:
//   app.use("/api/blocked", require("./routes/blocked"));
const express  = require("express");
const router   = express.Router();
const mongoose = require("mongoose");
const User     = require("../models/User");
const { requireAuth } = require("../middleware/auth");

const MAX_BLOCKED = 100; // тот же лимит, что и при блокировке (см. комментарий в models/User.js)

// GET /api/blocked → { blocked: [{ _id, steamId, displayName, avatar }], max }
router.get("/", requireAuth, async (req, res) => {
  try {
    const me  = await User.findById(req.user._id).select("blockedUsers").lean();
    const ids = (me && me.blockedUsers) || [];
    if (!ids.length) return res.json({ blocked: [], max: MAX_BLOCKED });

    const users = await User.find({ _id: { $in: ids } })
      .select("steamId displayName avatar")
      .lean();
    const byId = new Map(users.map(u => [String(u._id), u]));

    // сохраняем порядок добавления; удалённые аккаунты пропускаем
    const blocked = ids
      .map(id => byId.get(String(id)))
      .filter(Boolean)
      .map(u => ({ _id: u._id, steamId: u.steamId, displayName: u.displayName, avatar: u.avatar }));

    res.json({ blocked, max: MAX_BLOCKED });
  } catch (err) {
    console.error("GET /api/blocked:", err);
    res.status(500).json({ error: "Ошибка сервера." });
  }
});

// DELETE /api/blocked/:userId → разблокировать
router.delete("/:userId", requireAuth, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.userId)) {
      return res.status(400).json({ error: "Некорректный id пользователя." });
    }
    await User.updateOne({ _id: req.user._id }, { $pull: { blockedUsers: req.params.userId } });
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/blocked/:userId:", err);
    res.status(500).json({ error: "Ошибка сервера." });
  }
});

module.exports = router;
