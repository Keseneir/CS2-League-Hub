const express             = require("express");
const router              = express.Router();
const User                = require("../../models/User");
const Team                = require("../../models/Team");
const Application         = require("../../models/Application");
const Rank                = require("../../models/Rank");
const { requireAuth }     = require("../middleware/auth");
const { ADMIN_STEAM_ID }  = require("../config/constants");

// GET /api/config — публичные клиентские ключи
router.get("/config", (req, res) => {
  res.json({
    cloudinaryCloud:  process.env.CLOUDINARY_CLOUD_NAME   || "",
    cloudinaryPreset: process.env.CLOUDINARY_UPLOAD_PRESET || "",
  });
});

// GET /api/user
router.get("/user", async (req, res) => {
  if (!req.isAuthenticated()) return res.json(null);
  const { steamId, displayName, avatar, rank, teamId } = req.user;
  let team = null;
  if (teamId) {
    team = await Team.findById(teamId).select("name tag logo").lean();
  }
  const isAdmin = steamId === ADMIN_STEAM_ID;
  res.json({ steamId, displayName, avatar, rank, team, isAdmin });
});

// GET /api/profile
router.get("/profile", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate("friends",             "displayName avatar steamId teamId")
      .populate("friendRequests.from", "displayName avatar steamId")
      .populate({ path: "teamInvites.teamId", select: "name tag logo" })
      .populate({ path: "teamInvites.from",   select: "displayName avatar" })
      .lean();

    let team      = null;
    let isCaptain = false;
    if (user.teamId) {
      team = await Team.findById(user.teamId)
        .populate("members",   "displayName avatar steamId _id")
        .populate("subs",      "displayName avatar steamId _id")
        .populate("captainId", "_id")
        .lean();
      if (team) {
        isCaptain = team.captainId._id.toString() === req.user._id.toString();
      }
    }

    const applications = await Application.find({ userId: req.user._id })
      .sort({ createdAt: -1 }).limit(5).lean();

    res.json({
      _id:              user._id,
      steamId:          user.steamId,
      displayName:      user.displayName,
      avatar:           user.avatar,
      rank:             user.rank             || "Unranked",
      faceitLevel:      user.faceitLevel      ?? null,
      hoursInCS2:       user.hoursInCS2       ?? null,
      bio:              user.bio              || "",
      isPrivate:        user.isPrivate        || false,
      telegramUsername: user.telegramUsername || "",
      discordUsername:  user.discordUsername  || "",
      team,
      isCaptain,
      friends:          user.friends          || [],
      friendRequests:   user.friendRequests   || [],
      teamInvites:      user.teamInvites      || [],
      applications,
      adminNotices:     (user.adminNotices    || []).filter(n => !n.read),
      isAdmin:          user.steamId === ADMIN_STEAM_ID,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// PATCH /api/profile/stats
router.patch("/profile/stats", requireAuth, async (req, res) => {
  try {
    const { faceitLevel, hoursInCS2, bio, isPrivate, telegramUsername, discordUsername } = req.body;
    const update = {};

    if (faceitLevel !== undefined) {
      const lvl = Number(faceitLevel);
      if (isNaN(lvl) || lvl < 0 || lvl > 10)
        return res.status(400).json({ error: "FACEIT уровень должен быть от 0 до 10 (0 = нет аккаунта)" });
      update.faceitLevel = lvl;
    }

    if (hoursInCS2 !== undefined) {
      const hrs = Number(hoursInCS2);
      if (isNaN(hrs) || hrs < 0)
        return res.status(400).json({ error: "Укажите корректное количество часов" });
      update.hoursInCS2 = hrs;
    }

    if (bio !== undefined) {
      if (String(bio).length > 300)
        return res.status(400).json({ error: "Bio не более 300 символов" });
      update.bio = String(bio).trim();
    }

    if (isPrivate !== undefined) update.isPrivate = Boolean(isPrivate);

    if (telegramUsername !== undefined) {
      const tg = String(telegramUsername).trim().replace(/^@/, "");
      if (tg.length > 64) return res.status(400).json({ error: "Telegram: не более 64 символов" });
      update.telegramUsername = tg;
    }

    if (discordUsername !== undefined) {
      const dc = String(discordUsername).trim();
      if (dc.length > 64) return res.status(400).json({ error: "Discord: не более 64 символов" });
      update.discordUsername = dc;
    }

    const currentUser = await User.findById(req.user._id).lean();
    const finalTg = update.telegramUsername !== undefined ? update.telegramUsername : (currentUser.telegramUsername || "");
    const finalDc = update.discordUsername  !== undefined ? update.discordUsername  : (currentUser.discordUsername  || "");
    if (!finalTg && !finalDc) {
      return res.status(400).json({ error: "Укажите хотя бы один контакт: Telegram или Discord" });
    }

    await User.findByIdAndUpdate(req.user._id, { $set: update });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// POST /api/profile/dismiss-notice
router.post("/profile/dismiss-notice", requireAuth, async (req, res) => {
  try {
    const { idx } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: "Не найдено" });
    const notices = user.adminNotices || [];
    if (idx >= 0 && idx < notices.length) {
      notices.splice(idx, 1);
      user.adminNotices = notices;
      await user.save();
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// GET /api/users/:steamId/public
router.get("/users/:steamId/public", async (req, res) => {
  try {
    const user = await User.findOne({ steamId: req.params.steamId })
      .select("steamId displayName avatar rank faceitLevel hoursInCS2 bio isPrivate teamId telegramUsername discordUsername")
      .lean();

    if (!user) return res.status(404).json({ error: "Пользователь не найден" });

    if (user.isPrivate) {
      return res.json({ steamId: user.steamId, displayName: user.displayName, avatar: user.avatar, isPrivate: true });
    }

    let team = null;
    if (user.teamId) {
      team = await Team.findById(user.teamId).select("name tag logo").lean();
    }

    let rankColor = null;
    if (user.rank && user.rank !== "Unranked") {
      const rankDoc = await Rank.findOne({ name: user.rank }).select("color").lean();
      if (rankDoc) rankColor = rankDoc.color;
    }

    return res.json({
      steamId:          user.steamId,
      displayName:      user.displayName,
      avatar:           user.avatar,
      rank:             user.rank || "Unranked",
      rankColor,
      faceitLevel:      user.faceitLevel,
      hoursInCS2:       user.hoursInCS2,
      bio:              user.bio || "",
      isPrivate:        false,
      telegramUsername: user.telegramUsername || "",
      discordUsername:  user.discordUsername  || "",
      team,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// GET /api/notifications/count
router.get("/notifications/count", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select("friendRequests teamInvites adminNotices").lean();
    const fr = (user.friendRequests || []).length;
    const ti = (user.teamInvites    || []).length;
    const an = (user.adminNotices   || []).length;
    res.json({ friendRequests: fr, teamInvites: ti, adminNotices: an, total: fr + ti + an });
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// GET /api/users/search
router.get("/users/search", requireAuth, async (req, res) => {
  const q = (req.query.q || "").trim();
  if (q.length < 2) return res.json([]);
  try {
    const meUser = await User.findById(req.user._id).select("friends friendRequests").lean();
    const myFriendIds     = (meUser.friends        || []).map(f => f.toString());
    const theyRequestedMe = (meUser.friendRequests || []).map(r => r.from.toString());

    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const users   = await User.find({
      displayName: { $regex: escaped, $options: "i" },
      _id:         { $ne: req.user._id }
    }).select("displayName avatar steamId _id friendRequests").limit(10).lean();

    const results = users.map(u => {
      const uid         = u._id.toString();
      const isFriend    = myFriendIds.includes(uid);
      const requestedMe = theyRequestedMe.includes(uid);
      const iRequested  = (u.friendRequests || []).some(r => r.from.toString() === req.user._id.toString());
      return { _id: u._id, displayName: u.displayName, avatar: u.avatar, steamId: u.steamId, isFriend, requestedMe, iRequestedThem: iRequested };
    });
    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

module.exports = router;
