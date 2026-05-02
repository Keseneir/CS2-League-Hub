require('dotenv').config();

const express       = require("express");
const session       = require("express-session");
const passport      = require("passport");
const SteamStrategy = require("passport-steam").Strategy;
const mongoose      = require("mongoose");
const MongoStore    = require("connect-mongo");
const path          = require("path");

const User        = require("./models/User");
const Team        = require("./models/Team");
const Application = require("./models/Application");
const Season      = require("./models/Season");
const TeamStat    = require("./models/TeamStat");
const Rank        = require("./models/Rank");

const app  = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === "production";

const ADMIN_STEAM_ID = "76561199591711477";

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB error:", err));

passport.use(
  new SteamStrategy(
    {
      returnURL: `${process.env.DOMAIN}/auth/steam/return`,
      realm:     `${process.env.DOMAIN}/`,
      apiKey:    process.env.STEAM_API_KEY,
    },
    async (identifier, profile, done) => {
      try {
        const steamId     = profile.id;
        const displayName = profile.displayName;
        const avatar      = profile.photos?.[2]?.value || profile.photos?.[0]?.value || "";
        let user = await User.findOne({ steamId });
        if (!user) {
          user = await User.create({ steamId, displayName, avatar });
        } else {
          user.displayName = displayName;
          user.avatar      = avatar;
          await user.save();
        }
        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

app.set("trust proxy", 1);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret:            process.env.SESSION_SECRET,
    resave:            false,
    saveUninitialized: false,
    cookie: {
      secure:   isProd,
      httpOnly: true,
      sameSite: "lax",
      maxAge:   7 * 24 * 60 * 60 * 1000,
    },
    store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }),
  })
);

app.use(passport.initialize());
app.use(passport.session());

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────

function requireAuth(req, res, next) {
  if (!req.isAuthenticated()) return res.status(401).json({ error: "Unauthorized" });
  next();
}

function requireAdmin(req, res, next) {
  if (!req.isAuthenticated() || req.user.steamId !== ADMIN_STEAM_ID)
    return res.status(403).json({ error: "Forbidden" });
  next();
}

// ─── AUTH ─────────────────────────────────────────────────────────────────────

app.get("/auth/steam", (req, res, next) => {
  if (req.query.redirect) req.session.authRedirect = req.query.redirect;
  passport.authenticate("steam", { failureRedirect: "/" })(req, res, next);
});

app.get(
  "/auth/steam/return",
  passport.authenticate("steam", { failureRedirect: "/" }),
  (req, res) => {
    const redirect = req.session.authRedirect || "/";
    delete req.session.authRedirect;
    res.redirect(redirect);
  }
);

app.get("/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.session.destroy(() => {
      res.clearCookie("connect.sid");
      res.redirect("/");
    });
  });
});

// ─── API: USER ────────────────────────────────────────────────────────────────

app.get("/api/user", async (req, res) => {
  if (!req.isAuthenticated()) return res.json(null);
  const { steamId, displayName, avatar, rank, teamId } = req.user;
  let team = null;
  if (teamId) {
    team = await Team.findById(teamId).select("name tag logo").lean();
  }
  const isAdmin = steamId === ADMIN_STEAM_ID;
  res.json({ steamId, displayName, avatar, rank, team, isAdmin });
});

// ─── API: PROFILE ─────────────────────────────────────────────────────────────

app.get("/api/profile", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate("friends", "displayName avatar steamId teamId")
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
      _id:            user._id,
      steamId:        user.steamId,
      displayName:    user.displayName,
      avatar:         user.avatar,
      rank:           user.rank        || "Unranked",
      // ── Новые поля профиля ──
      faceitLevel:      user.faceitLevel      ?? null,
      hoursInCS2:       user.hoursInCS2       ?? null,
      bio:              user.bio              || "",
      isPrivate:        user.isPrivate        || false,
      telegramUsername: user.telegramUsername || "",
      discordUsername:  user.discordUsername  || "",
      // ────────────────────────
      team,
      isCaptain,
      friends:        user.friends        || [],
      friendRequests: user.friendRequests || [],
      teamInvites:    user.teamInvites    || [],
      applications:   applications,
      adminNotices:   (user.adminNotices  || []).filter(n => !n.read),
      isAdmin:        user.steamId === ADMIN_STEAM_ID,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// ── Сохранение статистики профиля ────────────────────────────────────────────

app.patch("/api/profile/stats", requireAuth, async (req, res) => {
  try {
    const { faceitLevel, hoursInCS2, bio, isPrivate, telegramUsername, discordUsername } = req.body;
    const update = {};

    if (faceitLevel !== undefined) {
      const lvl = Number(faceitLevel);
      // 0 = нет аккаунта FACEIT; 1–10 = уровень
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

    if (isPrivate !== undefined) {
      update.isPrivate = Boolean(isPrivate);
    }

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

// ── Закрыть уведомление от администрации ─────────────────────────────────────

app.post("/api/profile/dismiss-notice", requireAuth, async (req, res) => {
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

// ── Публичный профиль игрока ──────────────────────────────────────────────────

app.get("/api/users/:steamId/public", async (req, res) => {
  try {
    const user = await User.findOne({ steamId: req.params.steamId })
      .select("steamId displayName avatar rank faceitLevel hoursInCS2 bio isPrivate teamId telegramUsername discordUsername")
      .lean();

    if (!user) return res.status(404).json({ error: "Пользователь не найден" });

    if (user.isPrivate) {
      return res.json({
        steamId:     user.steamId,
        displayName: user.displayName,
        avatar:      user.avatar,
        isPrivate:   true,
      });
    }

    let team = null;
    if (user.teamId) {
      team = await Team.findById(user.teamId).select("name tag logo").lean();
    }

    // Цвет ранга (если кастомный)
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

app.get("/api/notifications/count", requireAuth, async (req, res) => {
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

// ─── API: ПОИСК ИГРОКОВ ───────────────────────────────────────────────────────

app.get("/api/users/search", requireAuth, async (req, res) => {
  const q = (req.query.q || "").trim();
  if (q.length < 2) return res.json([]);
  try {
    const meUser = await User.findById(req.user._id)
      .select("friends friendRequests").lean();
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

// ─── API: ДРУЗЬЯ ─────────────────────────────────────────────────────────────

app.get("/api/friends", requireAuth, async (req, res) => {
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

app.post("/api/friends/request/:userId", requireAuth, async (req, res) => {
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
      if (!me.friends.some(f => f.toString() === targetId))                      me.friends.push(targetId);
      if (!target.friends.some(f => f.toString() === req.user._id.toString()))   target.friends.push(req.user._id);
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

app.patch("/api/friends/accept/:userId", requireAuth, async (req, res) => {
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

app.patch("/api/friends/reject/:userId", requireAuth, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      $pull: { friendRequests: { from: req.params.userId } }
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

app.delete("/api/friends/:userId", requireAuth, async (req, res) => {
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

// ─── API: КОМАНДЫ ─────────────────────────────────────────────────────────────

app.post("/api/teams", requireAuth, async (req, res) => {
  try {
    if (req.user.teamId) return res.status(400).json({ error: "Вы уже состоите в команде." });

    // Проверка заполненности профиля
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

    // Авто-заявка для капитана
    try {
      await Application.create({
        userId:      req.user._id,
        teamId:      team._id,
        hoursInCS2:  freshUser.hoursInCS2,
        faceitLevel: String(freshUser.faceitLevel),
        experience:  "",
        contacts:    "",
        role:        "captain",
        status:      "pending",
        autoCreated: true,
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

app.get("/api/my-team", requireAuth, async (req, res) => {
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

app.post("/api/team/invite/:userId", requireAuth, async (req, res) => {
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

app.patch("/api/team/invite/accept/:teamId", requireAuth, async (req, res) => {
  const { teamId } = req.params;
  try {
    const me     = await User.findById(req.user._id);
    const invIdx = me.teamInvites.findIndex(i => i.teamId.toString() === teamId);
    if (invIdx === -1) return res.status(404).json({ error: "Приглашение не найдено" });
    if (me.teamId)     return res.status(400).json({ error: "Вы уже состоите в команде" });

    // Проверка заполненности профиля
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

    // Авто-заявка
    try {
      const existingApp = await Application.findOne({ userId: req.user._id, teamId: team._id });
      if (!existingApp) {
        await Application.create({
          userId:      req.user._id,
          teamId:      team._id,
          hoursInCS2:  me.hoursInCS2,
          faceitLevel: String(me.faceitLevel),
          experience:  "",
          contacts:    "",
          role,
          status:      "pending",
          autoCreated: true,
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

app.patch("/api/team/invite/reject/:teamId", requireAuth, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      $pull: { teamInvites: { teamId: new mongoose.Types.ObjectId(req.params.teamId) } }
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

app.patch("/api/team", requireAuth, async (req, res) => {
  try {
    if (!req.user.teamId) return res.status(400).json({ error: "Вы не в команде" });
    const team = await Team.findById(req.user.teamId);
    if (!team) return res.status(404).json({ error: "Команда не найдена" });
    if (team.captainId.toString() !== req.user._id.toString())
      return res.status(403).json({ error: "Только капитан может изменять настройки" });

    const { name, tag, logo, telegram } = req.body;
    if (name && name.trim()) team.name = name.trim();
    if (tag  && tag.trim())  {
      if (tag.trim().length > 8) return res.status(400).json({ error: "Тег не более 8 символов" });
      const ex = await Team.findOne({ tag: tag.trim().toUpperCase(), _id: { $ne: team._id } });
      if (ex) return res.status(400).json({ error: "Команда с таким тегом уже существует" });
      team.tag = tag.trim().toUpperCase();
    }
    if (logo !== undefined)     team.logo     = (logo     || "").trim();
    if (telegram !== undefined) team.telegram = (telegram || "").trim();
    await team.save();
    res.json({ ok: true, team });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

app.delete("/api/team", requireAuth, async (req, res) => {
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

app.post("/api/team/leave", requireAuth, async (req, res) => {
  try {
    if (!req.user.teamId) return res.status(400).json({ error: "Вы не в команде" });
    const team = await Team.findById(req.user.teamId);
    if (!team) return res.status(404).json({ error: "Команда не найдена" });
    if (team.captainId.toString() === req.user._id.toString())
      return res.status(400).json({ error: "Капитан не может покинуть команду. Передайте капитанство или распустите команду." });

    const uid    = req.user._id.toString();
    team.members = (team.members || []).filter(m => m.toString() !== uid);
    team.subs    = (team.subs    || []).filter(s => s.toString() !== uid);
    await User.findByIdAndUpdate(req.user._id, { $set: { teamId: null } });
    await team.save();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

app.delete("/api/team/member/:userId", requireAuth, async (req, res) => {
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

app.patch("/api/team/captain/:userId", requireAuth, async (req, res) => {
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

app.patch("/api/team/member/:userId/role", requireAuth, async (req, res) => {
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

// ─── API: ЗАЯВКИ ─────────────────────────────────────────────────────────────

app.post("/api/applications", requireAuth, async (req, res) => {
  try {
    if (!req.user.teamId) return res.status(400).json({ error: "Сначала создайте команду." });
    const existing = await Application.findOne({ userId: req.user._id, status: "pending" });
    if (existing) return res.status(400).json({ error: "У вас уже есть активная заявка." });
    const { hoursInCS2, faceitLevel, experience, contacts } = req.body;
    if (!hoursInCS2 || !faceitLevel || !contacts) return res.status(400).json({ error: "Заполните все обязательные поля." });

    const team = await Team.findById(req.user.teamId);
    let role = "main";
    if (team) {
      const uid = req.user._id.toString();
      if (team.captainId.toString() === uid) role = "captain";
      else if ((team.subs || []).some(s => s.toString() === uid)) role = "sub";
    }

    const application = await Application.create({
      userId: req.user._id, teamId: req.user.teamId,
      hoursInCS2: Number(hoursInCS2), faceitLevel,
      experience: experience || "", contacts, role, status: "pending"
    });
    res.json({ ok: true, application });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка сервера." });
  }
});

// ─── API: ЛИДЕРБОРД (публичный) ───────────────────────────────────────────────

app.get("/api/leaderboard", async (req, res) => {
  try {
    let season = await Season.findOne({ isActive: true }).lean();
    if (!season) season = await Season.findOne().sort({ createdAt: -1 }).lean();
    if (!season) return res.json({ season: null, rows: [] });

    const stats = await TeamStat.find({ seasonId: season._id })
      .populate("teamId", "name tag logo telegram members subs")
      .lean();

    stats.sort((a, b) =>
      b.pts - a.pts ||
      b.roundDiff - a.roundDiff ||
      b.wins - a.wins
    );

    const rows = stats.map(s => ({
      _id:          s._id,
      teamId:       s.teamId?._id,
      team:         s.teamId?.name     || "—",
      tag:          s.teamId?.tag      || "—",
      logo:         s.teamId?.logo     || "",
      telegram:     s.teamId?.telegram || "",
      pts:          s.pts,
      wins:         s.wins,
      losses:       s.losses,
      matches:      s.matches,
      wr:           s.matches > 0 ? Math.round((s.wins / s.matches) * 100) : 0,
      roundDiff:    s.roundDiff,
      winStreak:    s.winStreak,
      isKingOfHill: s.isKingOfHill,
      rosterSize:   ((s.teamId?.members || []).length) + ((s.teamId?.subs || []).length),
    }));

    res.json({ season, rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

app.get("/api/leaderboard/rosters", async (req, res) => {
  try {
    const ids = (req.query.ids || "").split(",").filter(Boolean).slice(0, 30);
    if (!ids.length) return res.json({});
    const teams = await Team.find({ _id: { $in: ids } })
      .populate("members", "displayName")
      .populate("subs",    "displayName")
      .lean();
    const map = {};
    teams.forEach(t => {
      map[t._id.toString()] = {
        members: (t.members || []).map(m => ({ displayName: m.displayName })),
        subs:    (t.subs    || []).map(m => ({ displayName: m.displayName })),
      };
    });
    res.json(map);
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

app.get("/api/seasons", async (req, res) => {
  try {
    const seasons = await Season.find().sort({ createdAt: -1 }).lean();
    res.json(seasons);
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

app.get("/api/leaderboard/:seasonId", async (req, res) => {
  try {
    const season = await Season.findById(req.params.seasonId).lean();
    if (!season) return res.status(404).json({ error: "Сезон не найден" });

    const stats = await TeamStat.find({ seasonId: season._id })
      .populate("teamId", "name tag logo telegram members subs")
      .lean();

    stats.sort((a, b) => b.pts - a.pts || b.roundDiff - a.roundDiff || b.wins - a.wins);

    const rows = stats.map(s => ({
      _id: s._id, teamId: s.teamId?._id,
      team: s.teamId?.name || "—", tag: s.teamId?.tag || "—", logo: s.teamId?.logo || "", telegram: s.teamId?.telegram || "",
      pts: s.pts, wins: s.wins, losses: s.losses, matches: s.matches,
      wr: s.matches > 0 ? Math.round((s.wins / s.matches) * 100) : 0,
      roundDiff: s.roundDiff, winStreak: s.winStreak, isKingOfHill: s.isKingOfHill,
    }));

    res.json({ season, rows });
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// ─── ЛОГИКА РЕЙТИНГА ─────────────────────────────────────────────────────────

function calcPoints(winnerStat, loserStat, roundDiffForWinner) {
  let winPts  = 25;
  let losePts = -15;

  if (loserStat.pts > winnerStat.pts) {
    winPts  = 30;
    losePts = -10;
  } else {
    winPts  = 25;
    losePts = -20;
  }

  const newWinStreak = winnerStat.winStreak + 1;
  if (newWinStreak >= 3) winPts += 5;
  if (loserStat.isKingOfHill) winPts += 10;

  return { winPts, losePts, newWinStreak };
}

// ─── API: МАТЧИ ───────────────────────────────────────────────────────────────

app.post("/api/admin/match", requireAdmin, async (req, res) => {
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

    winner.pts        = Math.max(0, winner.pts + winPts);
    winner.wins      += 1;
    winner.matches   += 1;
    winner.roundDiff += rd;
    winner.winStreak  = newWinStreak;
    winner.isKingOfHill = newWinStreak >= 3;

    loser.pts         = Math.max(0, loser.pts + losePts);
    loser.losses     += 1;
    loser.matches    += 1;
    loser.roundDiff  -= rd;
    loser.winStreak   = 0;
    loser.isKingOfHill = false;

    await Promise.all([winner.save(), loser.save()]);
    res.json({ ok: true, winner, loser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// ── Список всех игроков (admin) ──────────────────────────────────────────────

app.get("/api/admin/users", requireAdmin, async (req, res) => {
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

// ── Уведомление любому игроку (admin) ────────────────────────────────────────

app.post("/api/admin/users/:userId/notice", requireAdmin, async (req, res) => {
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

// ─── ADMIN API ────────────────────────────────────────────────────────────────

app.get("/api/admin/teams", requireAdmin, async (req, res) => {
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

app.delete("/api/admin/teams/:teamId", requireAdmin, async (req, res) => {
  try {
    await _disbandTeam(req.params.teamId);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Ошибка сервера" });
  }
});

app.get("/api/admin/seasons", requireAdmin, async (req, res) => {
  try {
    const seasons = await Season.find().sort({ createdAt: -1 }).lean();
    res.json(seasons);
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

app.post("/api/admin/seasons", requireAdmin, async (req, res) => {
  const { name, year, isActive } = req.body;
  if (!name || !year) return res.status(400).json({ error: "Название и год обязательны" });
  try {
    if (isActive) {
      await Season.updateMany({}, { $set: { isActive: false } });
    }
    const season = await Season.create({ name, year: Number(year), isActive: !!isActive });
    res.json({ ok: true, season });
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

app.patch("/api/admin/seasons/:id/activate", requireAdmin, async (req, res) => {
  try {
    await Season.updateMany({}, { $set: { isActive: false } });
    const season = await Season.findByIdAndUpdate(req.params.id, { isActive: true }, { new: true });
    res.json({ ok: true, season });
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

app.delete("/api/admin/seasons/:id", requireAdmin, async (req, res) => {
  try {
    await TeamStat.deleteMany({ seasonId: req.params.id });
    await Season.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

app.post("/api/admin/leaderboard", requireAdmin, async (req, res) => {
  const { teamId, seasonId, pts } = req.body;
  if (!teamId || !seasonId) return res.status(400).json({ error: "teamId и seasonId обязательны" });
  try {
    const existing = await TeamStat.findOne({ teamId, seasonId });
    if (existing) return res.status(400).json({ error: "Команда уже добавлена в этот сезон" });
    const stat = await TeamStat.create({
      teamId, seasonId,
      pts: pts !== undefined ? Number(pts) : 100,
    });
    const populated = await TeamStat.findById(stat._id).populate("teamId", "name tag logo").lean();
    res.json({ ok: true, stat: populated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

app.delete("/api/admin/leaderboard/:statId", requireAdmin, async (req, res) => {
  try {
    await TeamStat.findByIdAndDelete(req.params.statId);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

app.patch("/api/admin/leaderboard/:statId", requireAdmin, async (req, res) => {
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

app.get("/api/admin/leaderboard/:seasonId", requireAdmin, async (req, res) => {
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

app.post("/api/admin/teams/:teamId/notice", requireAdmin, async (req, res) => {
  try {
    const team = await Team.findById(req.params.teamId)
      .populate("captainId", "_id");
    if (!team) return res.status(404).json({ error: "Команда не найдена" });
    const { type, message } = req.body;
    const labels = { rename: "Требование сменить название", logo: "Требование обновить логотип", custom: "Сообщение от администрации" };
    const captain = await User.findById(team.captainId._id || team.captainId);
    if (!captain) return res.status(404).json({ error: "Капитан не найден" });
    if (!captain.adminNotices) captain.adminNotices = [];
    captain.adminNotices.push({
      type:    type || "custom",
      message: message || labels[type] || "Сообщение от администрации",
      teamId:  team._id,
      teamName:team.name,
      read:    false,
      createdAt: new Date(),
    });
    await captain.save();
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// ── Заявки (admin) ────────────────────────────────────────────────────────────

app.get("/api/admin/applications", requireAdmin, async (req, res) => {
  try {
    const applications = await Application.find()
      .populate({
        path:   "userId",
        select: "displayName avatar steamId faceitLevel hoursInCS2 bio",
      })
      .populate("teamId", "name tag")
      .sort({ createdAt: -1 })
      .lean();
    res.json(applications);
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

app.patch("/api/admin/applications/:id", requireAdmin, async (req, res) => {
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

app.delete("/api/admin/applications/:id", requireAdmin, async (req, res) => {
  try {
    await Application.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// Совместимость со старым маршрутом
app.patch("/admin/applications/:id/status", requireAdmin, async (req, res) => {
  const { status } = req.body;
  try {
    if (!["accepted","rejected","pending"].includes(status))
      return res.status(400).json({ error: "Недопустимый статус" });
    const application = await Application.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!application) return res.status(404).json({ error: "Заявка не найдена" });
    res.json({ ok: true, application });
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// ─── ВСПОМОГАТЕЛЬНАЯ: расформировать команду ─────────────────────────────────

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

// ─── API: РАНГИ (публичный список) ───────────────────────────────────────────

app.get("/api/ranks", async (req, res) => {
  try {
    const ranks = await Rank.find().sort({ order: 1, name: 1 }).lean();
    res.json(ranks);
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// ─── ADMIN API: РАНГИ ─────────────────────────────────────────────────────────

// Получить все ранги
app.get("/api/admin/ranks", requireAdmin, async (req, res) => {
  try {
    const ranks = await Rank.find().sort({ order: 1, name: 1 }).lean();
    res.json(ranks);
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// Создать ранг
app.post("/api/admin/ranks", requireAdmin, async (req, res) => {
  try {
    const { name, color, order } = req.body;
    if (!name || !String(name).trim())
      return res.status(400).json({ error: "Название обязательно" });
    const rank = await Rank.create({
      name:  String(name).trim(),
      color: color  || "#e6b022",
      order: order !== undefined ? Number(order) : 0,
    });
    res.json({ ok: true, rank });
  } catch (err) {
    if (err.code === 11000)
      return res.status(400).json({ error: "Звание с таким названием уже существует" });
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// Редактировать ранг
app.patch("/api/admin/ranks/:id", requireAdmin, async (req, res) => {
  try {
    const { name, color, order } = req.body;
    const update = {};
    if (name  !== undefined) update.name  = String(name).trim();
    if (color !== undefined) update.color = color;
    if (order !== undefined) update.order = Number(order);
    const oldRank = await Rank.findById(req.params.id);
    if (!oldRank) return res.status(404).json({ error: "Звание не найдено" });
    const rank = await Rank.findByIdAndUpdate(req.params.id, { $set: update }, { new: true });
    // Если название изменилось — обновить у всех игроков
    if (name && name.trim() !== oldRank.name) {
      await User.updateMany({ rank: oldRank.name }, { $set: { rank: name.trim() } });
    }
    res.json({ ok: true, rank });
  } catch (err) {
    if (err.code === 11000)
      return res.status(400).json({ error: "Звание с таким названием уже существует" });
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// Удалить ранг (у игроков с этим рангом сбрасывается в Unranked)
app.delete("/api/admin/ranks/:id", requireAdmin, async (req, res) => {
  try {
    const rank = await Rank.findByIdAndDelete(req.params.id);
    if (!rank) return res.status(404).json({ error: "Звание не найдено" });
    await User.updateMany({ rank: rank.name }, { $set: { rank: "Unranked" } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// Назначить ранг игроку
app.patch("/api/admin/users/:userId/rank", requireAdmin, async (req, res) => {
  try {
    const { rank } = req.body;
    if (rank === undefined || rank === null)
      return res.status(400).json({ error: "Укажите ранг" });
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ error: "Пользователь не найден" });
    if (rank !== "Unranked") {
      const exists = await Rank.findOne({ name: rank });
      if (!exists)
        return res.status(400).json({ error: "Звание не найдено. Сначала создайте его." });
    }
    user.rank = rank;
    await user.save();
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// ─── ADMIN API: УДАЛЕНИЕ ИГРОКА ───────────────────────────────────────────────

app.delete("/api/admin/users/:userId", requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ error: "Пользователь не найден" });

    // Нельзя удалить самого себя (администратора)
    if (user.steamId === ADMIN_STEAM_ID)
      return res.status(400).json({ error: "Нельзя удалить аккаунт администратора" });

    // Если в команде — выйти или расформировать (если капитан)
    if (user.teamId) {
      const team = await Team.findById(user.teamId);
      if (team) {
        const uid = user._id.toString();
        if (team.captainId.toString() === uid) {
          await _disbandTeam(user.teamId);
        } else {
          team.members = (team.members || []).filter(m => m.toString() !== uid);
          team.subs    = (team.subs    || []).filter(s => s.toString() !== uid);
          await team.save();
        }
      }
    }

    // Убрать из списков друзей и входящих заявок у других пользователей
    await User.updateMany(
      {},
      {
        $pull: {
          friends:        user._id,
          friendRequests: { from: user._id },
          teamInvites:    { from: user._id },
        }
      }
    );

    // Удалить заявки игрока
    await Application.deleteMany({ userId: user._id });

    // Удалить самого игрока
    await User.findByIdAndDelete(user._id);

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// ─── STATIC & CATCH-ALL ───────────────────────────────────────────────────────

app.use(express.static(path.join(__dirname, "public")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
module.exports = app;