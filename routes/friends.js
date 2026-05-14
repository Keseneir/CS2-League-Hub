const express         = require("express");
const router          = express.Router();
const mongoose        = require("mongoose");
const User            = require("../models/User");
const { requireAuth } = require("../middleware/auth");

// GET /api/friends
router.get("/", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate("friends",             "displayName avatar steamId teamId")
      .populate("friendRequests.from", "displayName avatar steamId")
      .lean();
    res.json({ friends: user.friends || [], requests: user.friendRequests || [] });
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// POST /api/friends/request/:userId
router.post("/request/:userId", requireAuth, async (req, res) => {
  const targetId = req.params.userId;
  if (targetId === req.user._id.toString())
    return res.status(400).json({ error: "Нельзя добавить себя в друзья" });
  try {
    const [me, target] = await Promise.all([
      User.findById(req.user._id),
      User.findById(targetId)
    ]);
    if (!target) return res.status(404).json({ error: "Пользователь не найден" });
    if (me.friends.some(f => f.toString() === targetId))
      return res.status(400).json({ error: "Уже в списке друзей" });

    const theirIdx = me.friendRequests.findIndex(r => r.from.toString() === targetId);
    if (theirIdx !== -1) {
      me.friendRequests.splice(theirIdx, 1);
      if (!me.friends.some(f => f.toString() === targetId))                    me.friends.push(targetId);
      if (!target.friends.some(f => f.toString() === req.user._id.toString())) target.friends.push(req.user._id);
      await Promise.all([me.save(), target.save()]);
      return res.json({ ok: true, autoAccepted: true });
    }

    if (target.friendRequests.some(r => r.from.toString() === req.user._id.toString()))
      return res.status(400).json({ error: "Заявка уже отправлена" });

    target.friendRequests.push({ from: req.user._id });
    await target.save();
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// PATCH /api/friends/accept/:userId
router.patch("/accept/:userId", requireAuth, async (req, res) => {
  const fromId = req.params.userId;
  try {
    const me   = await User.findById(req.user._id);
    const them = await User.findById(fromId);
    if (!them) return res.status(404).json({ error: "Пользователь не найден" });
    const idx = me.friendRequests.findIndex(r => r.from.toString() === fromId);
    if (idx === -1) return res.status(404).json({ error: "Заявка не найдена" });
    me.friendRequests.splice(idx, 1);
    if (!me.friends.some(f => f.toString() === fromId))                    me.friends.push(fromId);
    if (!them.friends.some(f => f.toString() === req.user._id.toString())) them.friends.push(req.user._id);
    await Promise.all([me.save(), them.save()]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// PATCH /api/friends/reject/:userId
router.patch("/reject/:userId", requireAuth, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      $pull: { friendRequests: { from: req.params.userId } }
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// DELETE /api/friends/:userId
router.delete("/:userId", requireAuth, async (req, res) => {
  const targetId = req.params.userId;
  try {
    await Promise.all([
      User.findByIdAndUpdate(req.user._id, { $pull: { friends: new mongoose.Types.ObjectId(targetId) } }),
      User.findByIdAndUpdate(targetId,     { $pull: { friends: req.user._id } })
    ]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

module.exports = router;