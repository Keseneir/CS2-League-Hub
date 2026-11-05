const express             = require("express");
const router              = express.Router();
const User                = require("../models/User");
const Team                = require("../models/Team");
const Application         = require("../models/Application");
const Rank                = require("../models/Rank");
const Season              = require("../models/Season");
const TeamStat            = require("../models/TeamStat");
const Match                = require("../models/Match");
const ShopItem             = require("../models/ShopItem");
const { syncUserHours }    = require("../services/steamHours");
const { requireAuth }     = require("../middleware/auth");
const { ADMIN_STEAM_ID }  = require("../config/constants");

// ── Хелпер: winrate/pts команды за активный сезон ─────────────────────────
async function getActiveSeasonStats(teamId) {
  if (!teamId) return null;
  const season = await Season.findOne({ isActive: true }).select("_id name").lean();
  if (!season) return null;
  const stat = await TeamStat.findOne({ teamId, seasonId: season._id })
    .select("pts wins losses matches roundDiff winStreak").lean();
  if (!stat) return null;
  const winPct = stat.matches > 0 ? Math.round((stat.wins / stat.matches) * 100) : 0;
  return {
    seasonName: season.name,
    pts:        stat.pts,
    wins:       stat.wins,
    losses:     stat.losses,
    matches:    stat.matches,
    winPct,
  };
}

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
  const { steamId, displayName, avatar, rank, teamId, discordUsername, telegramUsername } = req.user;
  let team = null;
  if (teamId) {
    team = await Team.findById(teamId).select("name tag logo").lean();
  }
  const isAdmin = steamId === ADMIN_STEAM_ID;
  // Контакты — только своего аккаунта: нужны странице объявлений, чтобы не показывать ложное «укажите контакты»
  res.json({ steamId, displayName, avatar, rank, team, isAdmin,
             discordUsername: discordUsername || "", telegramUsername: telegramUsername || "" });
});

// GET /api/profile
router.get("/profile", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate({ path: "teamInvites.teamId", select: "name tag logo" })
      .populate({ path: "teamInvites.from",   select: "displayName avatar" })
      .populate({ path: "equippedCosmetics.avatarFrame", select: "name css keyframes cosmeticType" })
      .populate({ path: "equippedCosmetics.profileBg",   select: "name css keyframes cosmeticType" })
      .populate({ path: "personalInventory.itemId", select: "name icon css keyframes cosmeticType" })
      .lean();

    let team      = null;
    let isCaptain = false;
    if (user.teamId) {
      team = await Team.findById(user.teamId)
        .populate("members",   "displayName avatar steamId _id")
        .populate("subs",      "displayName avatar steamId _id")
        .populate("captainId", "_id")
        .populate({ path: "equippedCosmetics.teamBg", select: "name icon css keyframes cosmeticType" })
        .lean();
      if (team) {
        isCaptain = team.captainId._id.toString() === req.user._id.toString();
      }
    }

    const applications = await Application.find({ userId: req.user._id })
      .sort({ createdAt: -1 }).limit(5).lean();

    const seasonStats = team ? await getActiveSeasonStats(team._id) : null;

    // Цвет ранга — для отображения собственного профиля тем же компонентом, что и публичный
    let rankColor = null;
    if (user.rank && user.rank !== "Unranked") {
      const rankDoc = await Rank.findOne({ name: user.rank }).select("color").lean();
      if (rankDoc) rankColor = rankDoc.color;
    }

    res.json({
      _id:              user._id,
      steamId:          user.steamId,
      displayName:      user.displayName,
      avatar:           user.avatar,
      rank:             user.rank             || "Unranked",
      rankColor,
      faceitLevel:      user.faceitLevel      ?? null,
      hoursInCS2:       user.hoursInCS2       ?? null,
      // Только для владельца: Steam закрыт для просмотра, автосинхронизация часов невозможна
      steamSyncPrivacyError: user.hoursSyncError === "privacy",
      bio:              user.bio              || "",
      isPrivate:        user.isPrivate        || false,
      telegramUsername: user.telegramUsername || "",
      discordUsername:  user.discordUsername  || "",
      stats:            user.stats            || {},
      seasonStats,
      team,
      isCaptain,
      teamInvites:      user.teamInvites      || [],
      applications,
      adminNotices:     (user.adminNotices    || []).filter(n => !n.read),
      isAdmin:          user.steamId === ADMIN_STEAM_ID,
      equippedCosmetics: user.equippedCosmetics || {},
      personalInventory: user.personalInventory || [],
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

// GET /api/notifications/count
router.get("/notifications/count", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select("teamInvites adminNotices").lean();
    const ti = (user.teamInvites    || []).length;
    const an = (user.adminNotices   || []).length;
    res.json({ teamInvites: ti, adminNotices: an, total: ti + an });
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// GET /api/users/:steamId/public  ← ВАЖНО: должен быть НИЖЕ /users/search
router.get("/users/:steamId/public", async (req, res) => {
  try {
    const user = await User.findOne({ steamId: req.params.steamId })
      .select("steamId displayName avatar rank faceitLevel hoursInCS2 bio isPrivate teamId telegramUsername discordUsername equippedCosmetics stats")
      .populate({ path: "equippedCosmetics.avatarFrame", select: "name icon css keyframes cosmeticType" })
      .populate({ path: "equippedCosmetics.profileBg",   select: "name icon css keyframes cosmeticType" })
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

    const seasonStats = team ? await getActiveSeasonStats(team._id) : null;

    return res.json({
      steamId:           user.steamId,
      displayName:       user.displayName,
      avatar:            user.avatar,
      rank:              user.rank || "Unranked",
      rankColor,
      faceitLevel:       user.faceitLevel,
      hoursInCS2:        user.hoursInCS2,
      bio:               user.bio || "",
      isPrivate:         false,
      telegramUsername:  user.telegramUsername || "",
      discordUsername:   user.discordUsername  || "",
      stats:             user.stats || {},
      seasonStats,
      team,
      equippedCosmetics: user.equippedCosmetics || {},
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});


// GET /api/users/:steamId/matches — последние матчи игрока (своя команда, с личным K/D если введён)
router.get("/users/:steamId/matches", async (req, res) => {
  try {
    const user = await User.findOne({ steamId: req.params.steamId })
      .select("_id teamId isPrivate").lean();
    if (!user) return res.status(404).json({ error: "Пользователь не найден" });

    // Свой профиль всегда видно себе, чужой приватный — прячем
    const isSelf = req.isAuthenticated() && req.user._id.toString() === user._id.toString();
    if (user.isPrivate && !isSelf) return res.json([]);

    const limit = Math.min(parseInt(req.query.limit) || 10, 30);
    if (!user.teamId) return res.json([]);

    const matches = await Match.find({
      $or: [{ winnerTeamId: user.teamId }, { loserTeamId: user.teamId }],
    })
      .sort({ playedAt: -1 })
      .limit(limit)
      .populate("winnerTeamId", "name tag logo")
      .populate("loserTeamId",  "name tag logo")
      .lean();

    const teamIdStr = user.teamId.toString();
    const result = matches.map(m => {
      const won = m.winnerTeamId?._id?.toString() === teamIdStr;
      const own = won ? m.winnerTeamId : m.loserTeamId;
      const opp = won ? m.loserTeamId  : m.winnerTeamId;
      const personal = (m.playerStats || []).find(p => p.userId.toString() === user._id.toString()) || null;

      return {
        matchId:      m._id,
        playedAt:     m.playedAt,
        map:          m.map   || "",
        score:        m.score || "",
        result:       won ? "win" : "loss",
        ownTeam:      own ? { name: own.name, tag: own.tag, logo: own.logo } : null,
        opponentTeam: opp ? { name: opp.name, tag: opp.tag, logo: opp.logo } : null,
        kills:   personal ? personal.kills   : null,
        deaths:  personal ? personal.deaths  : null,
        assists: personal ? personal.assists : null,
      };
    });

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// POST /api/profile/sync-steam-hours — получить часы из Steam API
// Та же логика, что у ежедневного cron (services/steamHours.js); при неудаче hoursInCS2 не меняется.
router.post("/profile/sync-steam-hours", requireAuth, async (req, res) => {
  try {
    const result = await syncUserHours(req.user, { deadline: Date.now() + 8000 });

    if (result.kind === "ok") {
      if (result.applied) return res.json({ ok: true, hoursInCS2: result.hours });

      // Запись отброшена: параллельно началась или завершилась более новая синхронизация.
      // Значение из базы отдаём, только если там уже есть результат не старше этой попытки;
      // иначе не выдаём устаревшее/пустое значение за результат и просим повторить.
      const cur = await User.findById(req.user._id).select("hoursInCS2 hoursSyncedAt").lean();
      if (cur && cur.hoursSyncedAt && cur.hoursSyncedAt >= result.attemptAt &&
          cur.hoursInCS2 !== null && cur.hoursInCS2 !== undefined) {
        return res.json({ ok: true, hoursInCS2: cur.hoursInCS2 });
      }
      return res.status(409).json({ code: "in_progress", error: "Параллельно уже выполняется другая синхронизация. Повторите через несколько секунд" });
    }

    if (result.kind === "config" && result.reason === "no_key")
      return res.status(500).json({ error: "Steam API key не настроен" });
    if (result.kind === "privacy")
      return res.status(404).json({ code: "privacy", error: "CS2 не найден. Проверьте: Профиль Steam → Изменить профиль → Настройки конфиденциальности → 'Подробности об играх' = Открытый" });
    if (result.kind === "no_cs2")
      return res.status(404).json({ code: "no_cs2", error: "CS2 не найден в списке игр вашего аккаунта Steam" });
    if (result.kind === "rate_limited")
      return res.status(429).json({ error: "Steam временно ограничил запросы. Попробуйте чуть позже" });
    res.status(502).json({ error: "Ошибка Steam API" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// POST /api/profile/equip — надеть предмет из инвентаря
router.post("/profile/equip", requireAuth, async (req, res) => {
    try {
        const { itemId, slot } = req.body;
 
        if (!itemId || typeof itemId !== "string" || !["avatarFrame", "profileBg"].includes(slot)) {
            return res.status(400).json({ error: "Неверные параметры" });
        }

        // Тип предмета должен соответствовать слоту
        const slotType = { avatarFrame: "avatar_frame", profileBg: "profile_bg" }[slot];
        const item = await ShopItem.findById(itemId).select("cosmeticType").lean();
        if (!item || item.cosmeticType !== slotType) {
            return res.status(400).json({ error: "Этот предмет нельзя надеть в выбранный слот" });
        }
 
        // Проверяем, что предмет есть в инвентаре игрока
        const user = await User.findById(req.user._id)
            .select("personalInventory")
            .lean();
 
        const owns = (user.personalInventory || []).some(
            i => i.itemId && i.itemId.toString() === itemId
        );
 
        if (!owns) {
            return res.status(403).json({ error: "Предмет не найден в инвентаре" });
        }
 
        await User.findByIdAndUpdate(req.user._id, {
            $set: { [`equippedCosmetics.${slot}`]: itemId },
        });
 
        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Ошибка сервера" });
    }
});
 
// POST /api/profile/unequip — снять предмет
router.post("/profile/unequip", requireAuth, async (req, res) => {
    try {
        const { slot } = req.body;
 
        if (!["avatarFrame", "profileBg"].includes(slot)) {
            return res.status(400).json({ error: "Неверный слот" });
        }
 
        await User.findByIdAndUpdate(req.user._id, {
            $set: { [`equippedCosmetics.${slot}`]: null },
        });
 
        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Ошибка сервера" });
    }
});

module.exports = router;