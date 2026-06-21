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

// PATCH /api/team/settings — расширенные настройки команды (team.html)
router.patch("/team/settings", requireAuth, async (req, res) => {
  try {
    if (!req.user.teamId) return res.status(400).json({ error: "Вы не в команде" });
    const team = await Team.findById(req.user.teamId);
    if (!team) return res.status(404).json({ error: "Команда не найдена" });

    const uid        = req.user._id.toString();
    const isCaptain  = team.captainId.toString() === uid;
    const isManager  = team.managerId && team.managerId.toString() === uid;
    if (!isCaptain && !isManager)
      return res.status(403).json({ error: "Только капитан или менеджер" });

    const { name, tag, logo, telegram, description, quote, layoutStyle, privacySettings, managerId } = req.body;

    if (isCaptain) {
      if (name && name.trim()) team.name = name.trim();
      if (tag  && tag.trim()) {
        const t = tag.trim().toUpperCase();
        if (t.length > 8) return res.status(400).json({ error: "Тег не более 8 символов" });
        const ex = await Team.findOne({ tag: t, _id: { $ne: team._id } });
        if (ex) return res.status(400).json({ error: "Команда с таким тегом уже существует" });
        team.tag = t;
      }
      if (logo     !== undefined) team.logo     = (logo     || "").trim();
      if (telegram !== undefined) team.telegram = (telegram || "").trim();

      if (managerId !== undefined) {
        if (!managerId) {
          team.managerId = null;
        } else {
          const allIds = [...(team.members || []), ...(team.subs || [])].map(String);
          if (!allIds.includes(managerId.toString()))
            return res.status(400).json({ error: "Игрок не в команде" });
          if (managerId.toString() === team.captainId.toString())
            return res.status(400).json({ error: "Капитан не может быть менеджером" });
          team.managerId = managerId;
        }
      }
    } else {
      if (telegram !== undefined) team.telegram = (telegram || "").trim();
    }

    if (description !== undefined) {
      if (String(description).length > 500) return res.status(400).json({ error: "Описание не более 500 символов" });
      team.description = String(description).trim();
    }
    if (quote !== undefined) {
      if (String(quote).length > 150) return res.status(400).json({ error: "Девиз не более 150 символов" });
      team.quote = String(quote).trim();
    }
    if (layoutStyle !== undefined) {
      const ls = Number(layoutStyle);
      if ([1,2,3].includes(ls)) team.layoutStyle = ls;
    }
    if (privacySettings && typeof privacySettings === "object") {
      if (!team.privacySettings) team.privacySettings = {};
      if (privacySettings.showStats   !== undefined) team.privacySettings.showStats   = Boolean(privacySettings.showStats);
      if (privacySettings.showHistory !== undefined) team.privacySettings.showHistory = Boolean(privacySettings.showHistory);
    }

    await team.save();
    res.json({ ok: true, team });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// GET /api/teams/by-tag/:tag — публичная страница по тегу (/team.html?tag=TAG)
// ВАЖНО: должен быть ВЫШЕ /teams/:teamId/public
router.get("/teams/by-tag/:tag", async (req, res) => {
  try {
    const team = await Team.findOne({ tag: req.params.tag.toUpperCase() })
      .populate("members",   "displayName avatar steamId _id")
      .populate("subs",      "displayName avatar steamId _id")
      .populate("captainId", "displayName avatar steamId _id")
      .populate({ path: "equippedCosmetics.teamBg", select: "name icon css keyframes cosmeticType" })
      .lean();
    if (!team) return res.status(404).json({ error: "Команда не найдена" });
    res.json({
      _id:               team._id,
      name:              team.name,
      tag:               team.tag,
      logo:              team.logo,
      description:       team.description || "",
      quote:             team.quote || "",
      layoutStyle:       team.layoutStyle || 1,
      privacySettings:   team.privacySettings || {},
      captainId:         team.captainId,
      managerId:         team.managerId || null,
      members:           team.members,
      subs:              team.subs,
      telegram:          team.telegram,
      equippedCosmetics: team.equippedCosmetics || {},
    });
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// GET /api/teams/:teamId/public — публичная страница команды
router.get("/teams/:teamId/public", async (req, res) => {
  try {
    const team = await Team.findById(req.params.teamId)
      .populate("members",   "displayName avatar steamId _id")
      .populate("subs",      "displayName avatar steamId _id")
      .populate("captainId", "displayName avatar steamId _id")
      .populate({ path: "equippedCosmetics.teamBg", select: "name icon css keyframes cosmeticType" })
      .lean();
    if (!team) return res.status(404).json({ error: "Команда не найдена" });
    res.json({
      _id:               team._id,
      name:              team.name,
      tag:               team.tag,
      logo:              team.logo,
      description:       team.description || "",
      quote:             team.quote || "",
      layoutStyle:       team.layoutStyle || 1,
      privacySettings:   team.privacySettings || {},
      captainId:         team.captainId,
      managerId:         team.managerId,
      members:           team.members,
      subs:              team.subs,
      telegram:          team.telegram,
      equippedCosmetics: team.equippedCosmetics || {},
    });
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// ─── Invite-ссылки ───────────────────────────────────────────────────────────

// POST /api/team/invite-link — капитан создаёт invite-ссылку
// body: { role?: "main"|"sub", expiresInHours?: number, maxUses?: number }
router.post("/team/invite-link", requireAuth, async (req, res) => {
  try {
    if (!req.user.teamId) return res.status(400).json({ error: "Вы не в команде" });
    const team = await Team.findById(req.user.teamId);
    if (!team) return res.status(404).json({ error: "Команда не найдена" });
    if (team.captainId.toString() !== req.user._id.toString())
      return res.status(403).json({ error: "Только капитан может создавать ссылки" });

    const role           = req.body.role === "sub" ? "sub" : "main";
    const expiresInHours = Number(req.body.expiresInHours) || null;
    const maxUses        = Number(req.body.maxUses)        || null;

    // Генерируем крипто-безопасный токен без внешних зависимостей
    const { randomBytes } = require("crypto");
    const token = randomBytes(9).toString("base64url"); // 12 символов URL-safe

    const link = {
      token,
      role,
      createdBy: req.user._id,
      expiresAt: expiresInHours ? new Date(Date.now() + expiresInHours * 3600_000) : null,
      maxUses:   maxUses || null,
      usedCount: 0,
      active:    true,
    };

    team.inviteLinks.push(link);
    await team.save();

    const inviteUrl = `${process.env.DOMAIN}/invite.html?token=${token}`;
    res.json({ ok: true, token, inviteUrl, link });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// GET /api/team/invite-link — список активных ссылок команды (только капитан)
router.get("/team/invite-link", requireAuth, async (req, res) => {
  try {
    if (!req.user.teamId) return res.status(400).json({ error: "Вы не в команде" });
    const team = await Team.findById(req.user.teamId).lean();
    if (!team) return res.status(404).json({ error: "Команда не найдена" });
    if (team.captainId.toString() !== req.user._id.toString())
      return res.status(403).json({ error: "Только капитан" });

    const links = (team.inviteLinks || []).map(l => ({
      _id:       l._id,
      token:     l.token,
      role:      l.role,
      active:    l.active,
      expiresAt: l.expiresAt,
      maxUses:   l.maxUses,
      usedCount: l.usedCount,
      createdAt: l.createdAt,
      inviteUrl: `${process.env.DOMAIN}/invite.html?token=${l.token}`,
    }));

    res.json(links);
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// DELETE /api/team/invite-link/:token — деактивировать ссылку (только капитан)
router.delete("/team/invite-link/:token", requireAuth, async (req, res) => {
  try {
    if (!req.user.teamId) return res.status(400).json({ error: "Вы не в команде" });
    const team = await Team.findById(req.user.teamId);
    if (!team) return res.status(404).json({ error: "Команда не найдена" });
    if (team.captainId.toString() !== req.user._id.toString())
      return res.status(403).json({ error: "Только капитан" });

    const link = (team.inviteLinks || []).find(l => l.token === req.params.token);
    if (!link) return res.status(404).json({ error: "Ссылка не найдена" });
    link.active = false;
    await team.save();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// GET /api/team/join/preview/:token — предпросмотр ссылки (публичный, без авторизации)
// Возвращает имя/лого команды и роль — для страницы invite.html до нажатия кнопки
router.get("/team/join/preview/:token", async (req, res) => {
  try {
    const team = await Team.findOne({ "inviteLinks.token": req.params.token })
      .select("name tag logo inviteLinks")
      .lean();
    if (!team) return res.status(404).json({ error: "Ссылка недействительна" });

    const link = team.inviteLinks.find(l => l.token === req.params.token);
    if (!link || !link.active)
      return res.status(410).json({ error: "Ссылка деактивирована" });
    if (link.expiresAt && new Date() > new Date(link.expiresAt))
      return res.status(410).json({ error: "Срок действия ссылки истёк" });
    if (link.maxUses && link.usedCount >= link.maxUses)
      return res.status(410).json({ error: "Лимит использований исчерпан" });

    res.json({
      teamName: team.name,
      teamTag:  team.tag,
      teamLogo: team.logo,
      role:     link.role,
    });
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// POST /api/team/join/:token — принять приглашение по ссылке (требует авторизации)
router.post("/team/join/:token", requireAuth, async (req, res) => {
  try {
    if (req.user.teamId)
      return res.status(400).json({ error: "Вы уже состоите в команде" });

    const me = await User.findById(req.user._id);
    if (me.faceitLevel === null || me.faceitLevel === undefined ||
        me.hoursInCS2  === null || me.hoursInCS2  === undefined) {
      return res.status(400).json({
        error: "Заполните профиль (FACEIT уровень и часы в CS2) перед вступлением в команду.",
        code:  "PROFILE_INCOMPLETE",
      });
    }

    const team = await Team.findOne({ "inviteLinks.token": req.params.token });
    if (!team) return res.status(404).json({ error: "Ссылка недействительна" });

    const link = team.inviteLinks.find(l => l.token === req.params.token);
    if (!link || !link.active)
      return res.status(410).json({ error: "Ссылка деактивирована" });
    if (link.expiresAt && new Date() > new Date(link.expiresAt))
      return res.status(410).json({ error: "Срок действия ссылки истёк" });
    if (link.maxUses && link.usedCount >= link.maxUses)
      return res.status(410).json({ error: "Лимит использований исчерпан" });

    const role = link.role;
    if (role === "main" && (team.members || []).length >= 5)
      return res.status(400).json({ error: "Основной состав уже заполнен (5/5)" });
    if (role === "sub" && (team.subs || []).length >= 5)
      return res.status(400).json({ error: "Состав замен уже заполнен (5/5)" });

    const alreadyIn = (team.members || []).some(m => m.toString() === req.user._id.toString())
                   || (team.subs    || []).some(s => s.toString() === req.user._id.toString());
    if (alreadyIn) return res.status(400).json({ error: "Вы уже в этой команде" });

    // Вступаем
    if (role === "sub") team.subs.push(req.user._id);
    else                team.members.push(req.user._id);
    link.usedCount += 1;

    me.teamId = team._id;
    await Promise.all([team.save(), me.save()]);

    // Автоматически создаём заявку для истории
    try {
      const Application = require("../models/Application");
      const existingApp = await Application.findOne({ userId: req.user._id, teamId: team._id });
      if (!existingApp) {
        await Application.create({
          userId: req.user._id, teamId: team._id,
          hoursInCS2: me.hoursInCS2, faceitLevel: String(me.faceitLevel),
          experience: "", contacts: "", role, status: "pending", autoCreated: true,
        });
      }
    } catch (appErr) {
      console.error("Auto-application (invite link) error:", appErr);
    }

    res.json({ ok: true, teamName: team.name, teamTag: team.tag, role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

module.exports = router;