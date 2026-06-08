const express              = require("express");
const router               = express.Router();
const User                 = require("../models/User");
const Team                 = require("../models/Team");
const Application          = require("../models/Application");
const Season               = require("../models/Season");
const TeamStat             = require("../models/TeamStat");
const Rank                 = require("../models/Rank");
const Tournament           = require("../models/Tournament");
const ShopItem             = require("../models/ShopItem");
const { requireAdmin }     = require("../middleware/auth");
const { disbandTeam }      = require("./teams");

// ─── Логика рейтинга ─────────────────────────────────────────────────────────

function calcPoints(winnerStat, loserStat, roundDiffForWinner) {
  let winPts, losePts;

  if (loserStat.pts > winnerStat.pts) { winPts = 30; losePts = -10; }
  else                                { winPts = 25; losePts = -20; }

  const newWinStreak = winnerStat.winStreak + 1;
  if (newWinStreak >= 3)     winPts += 5;
  if (loserStat.isKingOfHill) winPts += 10;

  return { winPts, losePts, newWinStreak };
}

// ─── Матчи ────────────────────────────────────────────────────────────────────

router.post("/match", requireAdmin, async (req, res) => {
  const { seasonId, winnerId, loserId, winnerRoundDiff } = req.body;
  if (!seasonId || !winnerId || !loserId)
    return res.status(400).json({ error: "Необходимо указать сезон, победителя и проигравшего" });
  if (winnerId === loserId)
    return res.status(400).json({ error: "Победитель и проигравший не могут совпадать" });

  try {
    const [winner, loser] = await Promise.all([
      TeamStat.findById(winnerId),
      TeamStat.findById(loserId),
    ]);
    if (!winner || !loser) return res.status(404).json({ error: "TeamStat не найден" });
    if (winner.seasonId.toString() !== seasonId || loser.seasonId.toString() !== seasonId)
      return res.status(400).json({ error: "Команды принадлежат разным сезонам" });

    const rd = parseInt(winnerRoundDiff) || 0;
    const { winPts, losePts, newWinStreak } = calcPoints(winner, loser, rd);

    winner.pts         = Math.max(0, winner.pts + winPts);
    winner.wins       += 1;
    winner.matches    += 1;
    winner.roundDiff  += rd;
    winner.winStreak   = newWinStreak;
    winner.isKingOfHill = newWinStreak >= 3;

    loser.pts          = Math.max(0, loser.pts + losePts);
    loser.losses      += 1;
    loser.matches     += 1;
    loser.roundDiff   -= rd;
    loser.winStreak    = 0;
    loser.isKingOfHill = false;

    await Promise.all([winner.save(), loser.save()]);

    // ── Авто-начисление монет магазина ────────────────────────────────────────
    // Победитель: +15 в командный кошелёк, все участники: +5 лично
    try {
      await Promise.all([
        Team.findByIdAndUpdate(winner.teamId, { $inc: { balance: 15 } }),
        Team.findByIdAndUpdate(loser.teamId,  { $inc: { balance: 5  } }),
      ]);
      // Участникам обеих команд — по 5 личных монет за матч
      const [winTeam, loseTeam] = await Promise.all([
        Team.findById(winner.teamId).select("members subs captainId").lean(),
        Team.findById(loser.teamId).select("members subs captainId").lean(),
      ]);
      const allPlayerIds = [
        ...(winTeam  ? [...(winTeam.members  || []), ...(winTeam.subs  || []), winTeam.captainId]  : []),
        ...(loseTeam ? [...(loseTeam.members || []), ...(loseTeam.subs || []), loseTeam.captainId] : []),
      ].filter(Boolean).map(id => id.toString());
      const uniqueIds = [...new Set(allPlayerIds)];
      if (uniqueIds.length) {
        await User.updateMany(
          { _id: { $in: uniqueIds } },
          { $inc: { personalBalance: 5 } }
        );
      }
    } catch (balanceErr) {
      console.error("Ошибка авто-начисления монет:", balanceErr);
      // Не прерываем ответ — матч уже записан
    }

    res.json({ ok: true, winner, loser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// ─── Пользователи ─────────────────────────────────────────────────────────────

router.get("/users", requireAdmin, async (req, res) => {
  try {
    const users = await User.find()
      .select("steamId displayName avatar rank faceitLevel hoursInCS2 bio telegramUsername discordUsername teamId createdAt")
      .populate("teamId", "name tag")
      .sort({ createdAt: -1 })
      .lean();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

router.post("/users/:userId/notice", requireAdmin, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !String(message).trim()) return res.status(400).json({ error: "Текст сообщения обязателен" });
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ error: "Пользователь не найден" });
    if (!user.adminNotices) user.adminNotices = [];
    user.adminNotices.push({ type: "custom", message: String(message).trim(), read: false, createdAt: new Date() });
    await user.save();
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

router.patch("/users/:userId/rank", requireAdmin, async (req, res) => {
  try {
    const { rank } = req.body;
    if (rank === undefined || rank === null) return res.status(400).json({ error: "Укажите ранг" });
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ error: "Пользователь не найден" });
    if (rank !== "Unranked") {
      const exists = await Rank.findOne({ name: rank });
      if (!exists) return res.status(400).json({ error: "Звание не найдено. Сначала создайте его." });
    }
    user.rank = rank;
    await user.save();
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

router.delete("/users/:userId", requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ error: "Пользователь не найден" });
    if (user.steamId === process.env.ADMIN_STEAM_ID)
      return res.status(400).json({ error: "Нельзя удалить аккаунт администратора" });

    if (user.teamId) {
      const team = await Team.findById(user.teamId);
      if (team) {
        const uid = user._id.toString();
        if (team.captainId.toString() === uid) {
          await disbandTeam(user.teamId);
        } else {
          team.members = (team.members || []).filter(m => m.toString() !== uid);
          team.subs    = (team.subs    || []).filter(s => s.toString() !== uid);
          await team.save();
        }
      }
    }

    await User.updateMany({}, {
      $pull: {
        friends:        user._id,
        friendRequests: { from: user._id },
        teamInvites:    { from: user._id },
      }
    });

    await Application.deleteMany({ userId: user._id });
    await User.findByIdAndDelete(user._id);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// ─── Команды ──────────────────────────────────────────────────────────────────

router.get("/teams", requireAdmin, async (req, res) => {
  try {
    const teams = await Team.find()
      .populate("captainId", "displayName steamId avatar")
      .populate("members",   "displayName")
      .populate("subs",      "displayName")
      .sort({ createdAt: -1 })
      .lean();
    res.json(teams);
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

router.delete("/teams/:teamId", requireAdmin, async (req, res) => {
  try {
    await disbandTeam(req.params.teamId);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Ошибка сервера" });
  }
});

router.post("/teams/:teamId/notice", requireAdmin, async (req, res) => {
  try {
    const team = await Team.findById(req.params.teamId).populate("captainId", "_id");
    if (!team) return res.status(404).json({ error: "Команда не найдена" });
    const { type, message } = req.body;
    const labels = { rename: "Требование сменить название", logo: "Требование обновить логотип", custom: "Сообщение от администрации" };
    const captain = await User.findById(team.captainId._id || team.captainId);
    if (!captain) return res.status(404).json({ error: "Капитан не найден" });
    if (!captain.adminNotices) captain.adminNotices = [];
    captain.adminNotices.push({
      type:     type || "custom",
      message:  message || labels[type] || "Сообщение от администрации",
      teamId:   team._id,
      teamName: team.name,
      read:     false,
      createdAt: new Date(),
    });
    await captain.save();
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// ─── Заявки ───────────────────────────────────────────────────────────────────

router.get("/applications", requireAdmin, async (req, res) => {
  try {
    const applications = await Application.find()
      .populate({ path: "userId", select: "displayName avatar steamId faceitLevel hoursInCS2 bio" })
      .populate("teamId", "name tag")
      .sort({ createdAt: -1 })
      .lean();
    res.json(applications);
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

router.patch("/applications/:id", requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    if (!["accepted","rejected","pending"].includes(status))
      return res.status(400).json({ error: "Недопустимый статус" });
    const app = await Application.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!app) return res.status(404).json({ error: "Заявка не найдена" });
    res.json({ ok: true, application: app });
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

router.delete("/applications/:id", requireAdmin, async (req, res) => {
  try {
    await Application.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// ─── Сезоны ───────────────────────────────────────────────────────────────────

router.get("/seasons", requireAdmin, async (req, res) => {
  try {
    const seasons = await Season.find().sort({ createdAt: -1 }).lean();
    res.json(seasons);
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

router.post("/seasons", requireAdmin, async (req, res) => {
  const { name, year, isActive } = req.body;
  if (!name || !year) return res.status(400).json({ error: "Название и год обязательны" });
  try {
    if (isActive) await Season.updateMany({}, { $set: { isActive: false } });
    const season = await Season.create({ name, year: Number(year), isActive: !!isActive });
    res.json({ ok: true, season });
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

router.patch("/seasons/:id/activate", requireAdmin, async (req, res) => {
  try {
    await Season.updateMany({}, { $set: { isActive: false } });
    const season = await Season.findByIdAndUpdate(req.params.id, { isActive: true }, { new: true });
    res.json({ ok: true, season });
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

router.delete("/seasons/:id", requireAdmin, async (req, res) => {
  try {
    await TeamStat.deleteMany({ seasonId: req.params.id });
    await Season.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// ─── Лидерборд (управление) ───────────────────────────────────────────────────

router.get("/leaderboard/:seasonId", requireAdmin, async (req, res) => {
  try {
    const stats = await TeamStat.find({ seasonId: req.params.seasonId })
      .populate("teamId", "name tag logo")
      .sort({ pts: -1 })
      .lean();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

router.post("/leaderboard", requireAdmin, async (req, res) => {
  const { teamId, seasonId, pts } = req.body;
  if (!teamId || !seasonId) return res.status(400).json({ error: "teamId и seasonId обязательны" });
  try {
    const existing = await TeamStat.findOne({ teamId, seasonId });
    if (existing) return res.status(400).json({ error: "Команда уже добавлена в этот сезон" });
    const stat      = await TeamStat.create({ teamId, seasonId, pts: pts !== undefined ? Number(pts) : 100 });
    const populated = await TeamStat.findById(stat._id).populate("teamId", "name tag logo").lean();
    res.json({ ok: true, stat: populated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

router.patch("/leaderboard/:statId", requireAdmin, async (req, res) => {
  try {
    const allowed = ["pts","wins","losses","matches","roundDiff","winStreak","isKingOfHill"];
    const update  = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    }
    const stat = await TeamStat.findByIdAndUpdate(req.params.statId, { $set: update }, { new: true })
      .populate("teamId", "name tag logo").lean();
    if (!stat) return res.status(404).json({ error: "Не найдено" });
    res.json({ ok: true, stat });
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

router.delete("/leaderboard/:statId", requireAdmin, async (req, res) => {
  try {
    await TeamStat.findByIdAndDelete(req.params.statId);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// ─── Ранги ────────────────────────────────────────────────────────────────────

router.get("/ranks", requireAdmin, async (req, res) => {
  try {
    const ranks = await Rank.find().sort({ order: 1, name: 1 }).lean();
    res.json(ranks);
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

router.post("/ranks", requireAdmin, async (req, res) => {
  try {
    const { name, color, order } = req.body;
    if (!name || !String(name).trim()) return res.status(400).json({ error: "Название обязательно" });
    const rank = await Rank.create({ name: String(name).trim(), color: color || "#e6b022", order: order !== undefined ? Number(order) : 0 });
    res.json({ ok: true, rank });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ error: "Звание с таким названием уже существует" });
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

router.patch("/ranks/:id", requireAdmin, async (req, res) => {
  try {
    const { name, color, order } = req.body;
    const update = {};
    if (name  !== undefined) update.name  = String(name).trim();
    if (color !== undefined) update.color = color;
    if (order !== undefined) update.order = Number(order);
    const oldRank = await Rank.findById(req.params.id);
    if (!oldRank) return res.status(404).json({ error: "Звание не найдено" });
    const rank = await Rank.findByIdAndUpdate(req.params.id, { $set: update }, { new: true });
    if (name && name.trim() !== oldRank.name) {
      await User.updateMany({ rank: oldRank.name }, { $set: { rank: name.trim() } });
    }
    res.json({ ok: true, rank });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ error: "Звание с таким названием уже существует" });
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

router.delete("/ranks/:id", requireAdmin, async (req, res) => {
  try {
    const rank = await Rank.findByIdAndDelete(req.params.id);
    if (!rank) return res.status(404).json({ error: "Звание не найдено" });
    await User.updateMany({ rank: rank.name }, { $set: { rank: "Unranked" } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// ─── Турниры ──────────────────────────────────────────────────────────────────

router.get("/tournaments", requireAdmin, async (req, res) => {
  try {
    const tournaments = await Tournament.find().sort({ createdAt: -1 }).lean();
    const teamIds = [...new Set(tournaments.flatMap(t => (t.registrations || []).map(r => r.teamId.toString())))];
    const teams   = await Team.find({ _id: { $in: teamIds } }).select("name tag logo").lean();
    const teamMap = Object.fromEntries(teams.map(t => [t._id.toString(), t]));
    const result  = tournaments.map(t => ({
      ...t,
      registrations: (t.registrations || []).map(r => ({ ...r, team: teamMap[r.teamId.toString()] || null })),
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

router.post("/tournaments", requireAdmin, async (req, res) => {
  try {
    const { name, description, startDate, status, minMembers, maxTeams, prize } = req.body;
    if (!name || !String(name).trim()) return res.status(400).json({ error: "Название обязательно" });
    const tournament = await Tournament.create({
      name:        String(name).trim(),
      description: description ? String(description).trim() : "",
      startDate:   startDate || null,
      status:      ["upcoming","active","finished"].includes(status) ? status : "upcoming",
      minMembers:  minMembers ? Math.min(5, Math.max(1, Number(minMembers))) : 5,
      maxTeams:    maxTeams   ? Math.max(2, Number(maxTeams)) : 16,
      prize:       prize ? String(prize).trim() : "",
    });
    res.json({ ok: true, tournament });
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

router.patch("/tournaments/:id", requireAdmin, async (req, res) => {
  try {
    const { name, description, startDate, status, minMembers, maxTeams, prize } = req.body;
    const update = {};
    if (name        !== undefined) update.name        = String(name).trim();
    if (description !== undefined) update.description = String(description).trim();
    if (startDate   !== undefined) update.startDate   = startDate || null;
    if (status      !== undefined && ["upcoming","active","finished"].includes(status)) update.status = status;
    if (minMembers  !== undefined) update.minMembers  = Math.min(5, Math.max(1, Number(minMembers)));
    if (maxTeams    !== undefined) update.maxTeams    = Math.max(2, Number(maxTeams));
    if (prize       !== undefined) update.prize       = String(prize).trim();
    const tournament = await Tournament.findByIdAndUpdate(req.params.id, { $set: update }, { new: true });
    if (!tournament) return res.status(404).json({ error: "Турнир не найден" });
    res.json({ ok: true, tournament });
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

router.delete("/tournaments/:id", requireAdmin, async (req, res) => {
  try {
    await Tournament.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

router.delete("/tournaments/:id/registrations/:teamId", requireAdmin, async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id);
    if (!tournament) return res.status(404).json({ error: "Турнир не найден" });
    tournament.registrations = (tournament.registrations || []).filter(r => r.teamId.toString() !== req.params.teamId);
    await tournament.save();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// ─── Магазин: управление предметами ──────────────────────────────────────────

router.get("/shop-items", requireAdmin, async (req, res) => {
  try {
    const items = await ShopItem.find().sort({ order: 1, createdAt: 1 }).lean();
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

router.post("/shop-items", requireAdmin, async (req, res) => {
  try {
    const { name, description, icon, price, category, type, isActive, isConsumable, order } = req.body;
    if (!name || !String(name).trim())
      return res.status(400).json({ error: "Название обязательно" });
    if (!["personal","team"].includes(category))
      return res.status(400).json({ error: "category: personal или team" });
    if (price === undefined || price === null || Number(price) < 0)
      return res.status(400).json({ error: "Укажите корректную цену" });

    const item = await ShopItem.create({
      name:        String(name).trim(),
      description: description ? String(description).trim() : "",
      icon:        icon        ? String(icon).trim()        : "🎁",
      price:       Number(price),
      category,
      type:        type && ["cosmetic","boost","ticket","slot","placement"].includes(type) ? type : "cosmetic",
      isActive:    isActive     !== undefined ? Boolean(isActive)     : true,
      isConsumable:isConsumable !== undefined ? Boolean(isConsumable) : false,
      order:       order        !== undefined ? Number(order)         : 0,
    });
    res.json({ ok: true, item });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

router.patch("/shop-items/:id", requireAdmin, async (req, res) => {
  try {
    const allowed = ["name","description","icon","price","category","type","isActive","isConsumable","order"];
    const update  = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    }
    if (update.name) update.name = String(update.name).trim();
    const item = await ShopItem.findByIdAndUpdate(req.params.id, { $set: update }, { new: true });
    if (!item) return res.status(404).json({ error: "Предмет не найден" });
    res.json({ ok: true, item });
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

router.delete("/shop-items/:id", requireAdmin, async (req, res) => {
  try {
    await ShopItem.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// ─── Монеты: ручное начисление администратором ─────────────────────────────

// POST /api/admin/balance/user/:userId  — начислить/списать личные монеты
router.post("/balance/user/:userId", requireAdmin, async (req, res) => {
  try {
    const amount = Number(req.body.amount);
    if (!Number.isInteger(amount) || amount === 0)
      return res.status(400).json({ error: "amount: целое ненулевое число (отрицательное = списание)" });

    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { $inc: { personalBalance: amount } },
      { new: true }
    );
    if (!user) return res.status(404).json({ error: "Пользователь не найден" });
    if (user.personalBalance < 0) {
      // откат — не уходим в минус
      await User.findByIdAndUpdate(req.params.userId, { $inc: { personalBalance: -amount } });
      return res.status(400).json({ error: "Нельзя опустить баланс ниже нуля" });
    }
    res.json({ ok: true, personalBalance: user.personalBalance });
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// POST /api/admin/balance/team/:teamId  — начислить/списать командные монеты
router.post("/balance/team/:teamId", requireAdmin, async (req, res) => {
  try {
    const amount = Number(req.body.amount);
    if (!Number.isInteger(amount) || amount === 0)
      return res.status(400).json({ error: "amount: целое ненулевое число" });

    const team = await Team.findByIdAndUpdate(
      req.params.teamId,
      { $inc: { balance: amount } },
      { new: true }
    );
    if (!team) return res.status(404).json({ error: "Команда не найдена" });
    if (team.balance < 0) {
      await Team.findByIdAndUpdate(req.params.teamId, { $inc: { balance: -amount } });
      return res.status(400).json({ error: "Нельзя опустить баланс ниже нуля" });
    }
    res.json({ ok: true, balance: team.balance });
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

module.exports = router;