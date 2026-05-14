const express         = require("express");
const router          = express.Router();
const mongoose        = require("mongoose");
const User            = require("../models/User");
const Team            = require("../models/Team");
const Application     = require("../models/Application");
const { requireAuth } = require("../middleware/auth");

// ─── Вспомогательная: расформировать команду ──────────────────────────────────
async function _disbandTeam(teamId) {
  const team = await Team.findById(teamId);
  if (!team) throw new Error("Команда не найдена");
  const allIds = new Set([
    team.captainId.toString(),
    ...(team.members || []).map(String),
    ...(team.subs    || []).map(String),
  ]);
  await User.updateMany({ _id: { $in: [...allIds] } }, { $set: { teamId: null } });
  await User.updateMany({}, { $pull: { teamInvites: { teamId: team._id } } });
  await Team.findByIdAndDelete(teamId);
}

module.exports.disbandTeam = _disbandTeam;

// POST /api/teams — создать команду
router.post("/teams", requireAuth, async (req, res) => {
  try {
    if (req.user.teamId) return res.status(400).json({ error: "Вы уже состоите в команде." });

    const freshUser = await User.findById(req.user._id).select("faceitLevel hoursInCS2");
    if (freshUser.faceitLevel === null || freshUser.faceitLevel === undefined ||
        freshUser.hoursInCS2  === null || freshUser.hoursInCS2  === undefined) {
      return res.status(400).json({
        error: "Заполните профиль (FACEIT уровень и часы в CS2) во вкладке «Мой профиль» перед созданием команды.",
        code:  "PROFILE_INCOMPLETE",
      });
    }

    const { name, tag, logo, telegram } = req.body;
    if (!name || !tag) return res.status(400).json({ error: "Название и тег обязательны." });
    if (tag.length > 8) return res.status(400).json({ error: "Тег не более 8 символов." });
    const existing = await Team.findOne({ $or: [{ name }, { tag: tag.toUpperCase() }] });
    if (existing) return res.status(400).json({ error: "Команда с таким названием или тегом уже существует." });

    const team = await Team.create({
      name, tag: tag.toUpperCase(), logo: logo || "", telegram: telegram || "",
      captainId: req.user._id, members: [req.user._id], subs: []
    });
    await User.findByIdAndUpdate(req.user._id, { teamId: team._id });
    req.user.teamId = team._id;

    try {
      await Application.create({
        userId: req.user._id, teamId: team._id,
        hoursInCS2: freshUser.hoursInCS2, faceitLevel: String(freshUser.faceitLevel),
        experience: "", contacts: "", role: "captain", status: "pending", autoCreated: true,
      });
    } catch (appErr) {
      console.error("Auto-application (captain) error:", appErr);
    }

    res.json({ ok: true, team });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка сервера." });
  }
});

// GET /api/my-team
router.get("/my-team", requireAuth, async (req, res) => {
  if (!req.user.teamId) return res.json(null);
  try {
    const team = await Team.findById(req.user.teamId)
      .populate("members",   "displayName avatar")
      .populate("subs",      "displayName avatar")
      .populate("captainId", "displayName")
      .lean();
    res.json(team);
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера." });
  }
});

// POST /api/team/invite/:userId
router.post("/team/invite/:userId", requireAuth, async (req, res) => {
  try {
    if (!req.user.teamId) return res.status(400).json({ error: "У вас нет команды" });
    const team = await Team.findById(req.user.teamId);
    if (!team) return res.status(400).json({ error: "Команда не найдена" });
    if (team.captainId.toString() !== req.user._id.toString())
      return res.status(403).json({ error: "Только капитан может приглашать" });

    const role      = req.body.role === "sub" ? "sub" : "main";
    const mainCount = (team.members || []).length;
    const subCount  = (team.subs    || []).length;
    if (role === "main" && mainCount >= 5) return res.status(400).json({ error: "Основной состав заполнен (5/5)" });
    if (role === "sub"  && subCount  >= 5) return res.status(400).json({ error: "Состав замен заполнен (5/5)" });

    const targetId = req.params.userId;
    const meUser   = await User.findById(req.user._id).select("friends").lean();
    if (!(meUser.friends || []).some(f => f.toString() === targetId))
      return res.status(400).json({ error: "Можно приглашать только друзей" });

    const target = await User.findById(targetId);
    if (!target)       return res.status(404).json({ error: "Пользователь не найден" });
    if (target.teamId) return res.status(400).json({ error: "Игрок уже состоит в команде" });

    const alreadyIn = (team.members || []).some(m => m.toString() === targetId)
                   || (team.subs    || []).some(s => s.toString() === targetId);
    if (alreadyIn) return res.status(400).json({ error: "Игрок уже в команде" });

    if (target.teamInvites.some(i => i.teamId.toString() === team._id.toString()))
      return res.status(400).json({ error: "Приглашение уже отправлено" });

    target.teamInvites.push({ teamId: team._id, from: req.user._id, role });
    await target.save();
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// PATCH /api/team/invite/accept/:teamId
router.patch("/team/invite/accept/:teamId", requireAuth, async (req, res) => {
  const { teamId } = req.params;
  try {
    const me     = await User.findById(req.user._id);
    const invIdx = me.teamInvites.findIndex(i => i.teamId.toString() === teamId);
    if (invIdx === -1) return res.status(404).json({ error: "Приглашение не найдено" });
    if (me.teamId)     return res.status(400).json({ error: "Вы уже состоите в команде" });

    if (me.faceitLevel === null || me.faceitLevel === undefined ||
        me.hoursInCS2  === null || me.hoursInCS2  === undefined) {
      return res.status(400).json({
        error: "Заполните профиль (FACEIT уровень и часы в CS2) во вкладке «Мой профиль» перед вступлением в команду.",
        code:  "PROFILE_INCOMPLETE",
      });
    }

    const invite = me.teamInvites[invIdx];
    const role   = invite.role || "main";
    const team   = await Team.findById(teamId);
    if (!team) return res.status(404).json({ error: "Команда не найдена" });

    if (role === "main" && (team.members || []).length >= 5) return res.status(400).json({ error: "Основной состав заполнен" });
    if (role === "sub"  && (team.subs    || []).length >= 5) return res.status(400).json({ error: "Состав замен заполнен" });

    me.teamInvites.splice(invIdx, 1);
    me.teamId = team._id;
    if (role === "sub") (team.subs    = team.subs    || []).push(req.user._id);
    else                (team.members = team.members || []).push(req.user._id);
    await Promise.all([me.save(), team.save()]);

    try {
      const existingApp = await Application.findOne({ userId: req.user._id, teamId: team._id });
      if (!existingApp) {
        await Application.create({
          userId: req.user._id, teamId: team._id,
          hoursInCS2: me.hoursInCS2, faceitLevel: String(me.faceitLevel),
          experience: "", contacts: "", role, status: "pending", autoCreated: true,
        });
      }
    } catch (appErr) {
      console.error("Auto-application error:", appErr);
    }

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// PATCH /api/team/invite/reject/:teamId
router.patch("/team/invite/reject/:teamId", requireAuth, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      $pull: { teamInvites: { teamId: new mongoose.Types.ObjectId(req.params.teamId) } }
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// PATCH /api/team — настройки команды
router.patch("/team", requireAuth, async (req, res) => {
  try {
    if (!req.user.teamId) return res.status(400).json({ error: "Вы не в команде" });
    const team = await Team.findById(req.user.teamId);
    if (!team) return res.status(404).json({ error: "Команда не найдена" });
    if (team.captainId.toString() !== req.user._id.toString())
      return res.status(403).json({ error: "Только капитан может изменять настройки" });

    const { name, tag, logo, telegram } = req.body;
    if (name && name.trim()) team.name = name.trim();
    if (tag  && tag.trim()) {
      if (tag.trim().length > 8) return res.status(400).json({ error: "Тег не более 8 символов" });
      const ex = await Team.findOne({ tag: tag.trim().toUpperCase(), _id: { $ne: team._id } });
      if (ex) return res.status(400).json({ error: "Команда с таким тегом уже существует" });
      team.tag = tag.trim().toUpperCase();
    }
    if (logo     !== undefined) team.logo     = (logo     || "").trim();
    if (telegram !== undefined) team.telegram = (telegram || "").trim();
    await team.save();
    res.json({ ok: true, team });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// DELETE /api/team — распустить команду
router.delete("/team", requireAuth, async (req, res) => {
  try {
    if (!req.user.teamId) return res.status(400).json({ error: "Вы не в команде" });
    const team = await Team.findById(req.user.teamId);
    if (!team) return res.status(404).json({ error: "Команда не найдена" });
    if (team.captainId.toString() !== req.user._id.toString())
      return res.status(403).json({ error: "Только капитан может распустить команду" });
    await _disbandTeam(team._id);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// POST /api/team/leave
router.post("/team/leave", requireAuth, async (req, res) => {
  try {
    if (!req.user.teamId) return res.status(400).json({ error: "Вы не в команде" });
    const team = await Team.findById(req.user.teamId);
    if (!team) return res.status(404).json({ error: "Команда не найдена" });
    if (team.captainId.toString() === req.user._id.toString())
      return res.status(400).json({ error: "Капитан не может покинуть команду. Передайте капитанство или распустите команду." });

    const uid = req.user._id.toString();
    team.members = (team.members || []).filter(m => m.toString() !== uid);
    team.subs    = (team.subs    || []).filter(s => s.toString() !== uid);
    await User.findByIdAndUpdate(req.user._id, { $set: { teamId: null } });
    await team.save();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// DELETE /api/team/member/:userId — исключить игрока
router.delete("/team/member/:userId", requireAuth, async (req, res) => {
  try {
    if (!req.user.teamId) return res.status(400).json({ error: "Вы не в команде" });
    const team = await Team.findById(req.user.teamId);
    if (!team) return res.status(404).json({ error: "Команда не найдена" });
    if (team.captainId.toString() !== req.user._id.toString())
      return res.status(403).json({ error: "Только капитан может исключать" });

    const targetId = req.params.userId;
    if (targetId === req.user._id.toString()) return res.status(400).json({ error: "Нельзя исключить себя" });

    team.members = (team.members || []).filter(m => m.toString() !== targetId);
    team.subs    = (team.subs    || []).filter(s => s.toString() !== targetId);
    await User.findByIdAndUpdate(targetId, { $set: { teamId: null } });
    await team.save();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// PATCH /api/team/captain/:userId — передать капитанство
router.patch("/team/captain/:userId", requireAuth, async (req, res) => {
  try {
    if (!req.user.teamId) return res.status(400).json({ error: "Вы не в команде" });
    const team = await Team.findById(req.user.teamId);
    if (!team) return res.status(404).json({ error: "Команда не найдена" });
    if (team.captainId.toString() !== req.user._id.toString())
      return res.status(403).json({ error: "Вы не капитан" });

    const targetId = req.params.userId;
    const inTeam   = (team.members || []).some(m => m.toString() === targetId)
                  || (team.subs    || []).some(s => s.toString() === targetId);
    if (!inTeam) return res.status(400).json({ error: "Игрок не в команде" });

    team.captainId = targetId;
    await team.save();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// PATCH /api/team/member/:userId/role — изменить роль
router.patch("/team/member/:userId/role", requireAuth, async (req, res) => {
  try {
    if (!req.user.teamId) return res.status(400).json({ error: "Вы не в команде" });
    const team = await Team.findById(req.user.teamId);
    if (!team) return res.status(404).json({ error: "Команда не найдена" });
    if (team.captainId.toString() !== req.user._id.toString())
      return res.status(403).json({ error: "Только капитан может менять роли" });

    const targetId = req.params.userId;
    const newRole  = req.body.role;
    if (!["main","sub"].includes(newRole)) return res.status(400).json({ error: "Неверная роль" });

    const isMain = (team.members || []).some(m => m.toString() === targetId);
    const isSub  = (team.subs    || []).some(s => s.toString() === targetId);
    if (!isMain && !isSub) return res.status(400).json({ error: "Игрок не в команде" });

    if (newRole === "main" && isSub) {
      if ((team.members || []).length >= 5) return res.status(400).json({ error: "Основной состав заполнен (5/5)" });
      team.subs    = (team.subs    || []).filter(s => s.toString() !== targetId);
      team.members = [...(team.members || []), targetId];
    } else if (newRole === "sub" && isMain) {
      if ((team.subs || []).length >= 5) return res.status(400).json({ error: "Состав замен заполнен (5/5)" });
      team.members = (team.members || []).filter(m => m.toString() !== targetId);
      team.subs    = [...(team.subs    || []), targetId];
    }
    await team.save();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

module.exports = router;