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

// ИСПРАВЛЕНИЕ: sameSite:"lax" нужен для Steam OpenID redirect.
// При sameSite:"strict" браузер сбрасывает куки при редиректе от Steam.
app.use(
  session({
    secret:            process.env.SESSION_SECRET,
    resave:            false,
    saveUninitialized: false,
    cookie: {
      secure:   isProd,
      httpOnly: true,
      sameSite: "lax",           // ← ключевое исправление
      maxAge:   7 * 24 * 60 * 60 * 1000,
    },
    store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }),
  })
);

app.use(passport.initialize());
app.use(passport.session());

function requireAuth(req, res, next) {
  if (!req.isAuthenticated()) return res.status(401).json({ error: "Unauthorized" });
  next();
}

function requireAdmin(req, res, next) {
  if (!req.isAuthenticated() || req.user.steamId !== ADMIN_STEAM_ID)
    return res.status(403).send("<h1>403 Forbidden</h1>");
  next();
}

// --- Auth routes ---
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

// --- API routes ---
app.get("/api/user", async (req, res) => {
  if (!req.isAuthenticated()) return res.json(null);
  const { steamId, displayName, avatar, points, rank, teamId } = req.user;
  let team = null;
  if (teamId) {
    team = await Team.findById(teamId).select("name tag logo").lean();
  }
  res.json({ steamId, displayName, avatar, points, rank, team });
});

app.get("/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.session.destroy(() => {
      res.clearCookie("connect.sid");
      res.redirect("/");
    });
  });
});

app.post("/api/teams", requireAuth, async (req, res) => {
  try {
    if (req.user.teamId) return res.status(400).json({ error: "Вы уже состоите в команде." });
    const { name, tag, logo } = req.body;
    if (!name || !tag) return res.status(400).json({ error: "Название и тег обязательны." });
    if (tag.length > 8) return res.status(400).json({ error: "Тег не может быть длиннее 8 символов." });
    const existing = await Team.findOne({ $or: [{ name }, { tag: tag.toUpperCase() }] });
    if (existing) return res.status(400).json({ error: "Команда с таким названием или тегом уже существует." });
    const team = await Team.create({ name, tag: tag.toUpperCase(), logo: logo || "", captainId: req.user._id, members: [req.user._id] });
    await User.findByIdAndUpdate(req.user._id, { teamId: team._id });
    req.user.teamId = team._id;
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
      .populate("members", "displayName avatar")
      .populate("captainId", "displayName")
      .lean();
    res.json(team);
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера." });
  }
});

app.post("/api/applications", requireAuth, async (req, res) => {
  try {
    if (!req.user.teamId) return res.status(400).json({ error: "Сначала создайте команду." });
    const existing = await Application.findOne({ userId: req.user._id, status: "pending" });
    if (existing) return res.status(400).json({ error: "У вас уже есть активная заявка на рассмотрении." });
    const { hoursInCS2, faceitLevel, experience, contacts } = req.body;
    if (!hoursInCS2 || !faceitLevel || !contacts) return res.status(400).json({ error: "Заполните все обязательные поля." });
    const application = await Application.create({ userId: req.user._id, teamId: req.user.teamId, hoursInCS2: Number(hoursInCS2), faceitLevel, experience: experience || "", contacts, status: "pending" });
    res.json({ ok: true, application });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка сервера." });
  }
});

// --- Admin ---
app.get("/admin/applications", requireAdmin, async (req, res) => {
  try {
    const applications = await Application.find()
      .populate("userId", "displayName avatar steamId")
      .populate("teamId", "name tag")
      .sort({ createdAt: -1 })
      .lean();

    const statusLabel = { pending: "⏳ Ожидание", accepted: "✅ Принята", rejected: "❌ Отклонена" };
    const statusColor = { pending: "#e6b022", accepted: "#4caf82", rejected: "#e05c5c" };

    const rows = applications.map((a) => `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:10px;">
            <img src="${a.userId?.avatar || ""}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;" onerror="this.style.display='none'">
            <div>
              <div style="font-weight:700;color:white;">${a.userId?.displayName || "—"}</div>
              <div style="font-size:11px;color:#5c6b7f;">${a.userId?.steamId || ""}</div>
            </div>
          </div>
        </td>
        <td>${a.teamId ? `[${a.teamId.tag}] ${a.teamId.name}` : "—"}</td>
        <td>${a.hoursInCS2}</td>
        <td>${a.faceitLevel}</td>
        <td style="max-width:200px;white-space:pre-wrap;word-break:break-word;">${a.contacts}</td>
        <td style="max-width:200px;white-space:pre-wrap;word-break:break-word;">${a.experience || "—"}</td>
        <td><span style="color:${statusColor[a.status]};font-weight:700;">${statusLabel[a.status]}</span></td>
        <td style="white-space:nowrap;">
          <button onclick="updateStatus('${a._id}','accepted')" style="background:#4caf82;color:#000;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-weight:700;margin-right:6px;">✅ Принять</button>
          <button onclick="updateStatus('${a._id}','rejected')" style="background:#e05c5c;color:#fff;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-weight:700;">❌ Отклонить</button>
        </td>
      </tr>
    `).join("");

    res.send(`<!DOCTYPE html>
<html lang="ru"><head>
  <meta charset="UTF-8"><title>Заявки — Admin</title>
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@700;800&family=Inter:wght@400;600&display=swap" rel="stylesheet">
  <style>* { box-sizing:border-box;margin:0;padding:0; } body { font-family:'Inter',sans-serif;background:#0b0f12;color:#aebbc7;padding:40px 20px; } h1 { font-family:'Montserrat',sans-serif;color:#e6b022;font-size:28px;margin-bottom:30px;text-transform:uppercase; } table { width:100%;border-collapse:collapse;background:#12171d;border:1px solid #1f252c;border-radius:10px;overflow:hidden; } thead tr { background:#0e1318;border-bottom:2px solid #e6b022; } th { padding:14px 16px;text-align:left;font-family:'Montserrat',sans-serif;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#aebbc7; } tbody tr { border-bottom:1px solid #1f252c; } tbody tr:hover { background:rgba(255,255,255,0.02); } td { padding:14px 16px;font-size:13px;vertical-align:middle; } .count { color:#5c6b7f;font-size:14px;margin-bottom:20px; } .toast { position:fixed;bottom:24px;right:24px;background:#12171d;border:1px solid #1f252c;border-radius:8px;padding:14px 20px;font-weight:600;font-size:14px;display:none; }</style>
</head><body>
  <h1>🛡️ Панель администратора</h1>
  <p class="count">Всего заявок: <strong style="color:white;">${applications.length}</strong></p>
  <div style="overflow-x:auto;"><table><thead><tr><th>Игрок</th><th>Команда</th><th>Часов</th><th>FACEIT</th><th>Контакты</th><th>Опыт</th><th>Статус</th><th>Действия</th></tr></thead>
  <tbody>${rows || '<tr><td colspan="8" style="text-align:center;padding:40px;color:#5c6b7f;">Заявок пока нет</td></tr>'}</tbody></table></div>
  <div class="toast" id="toast"></div>
  <script>
    async function updateStatus(id, status) {
      await fetch('/admin/applications/' + id + '/status', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({status}) });
      const t = document.getElementById('toast');
      t.textContent = status === 'accepted' ? '✅ Заявка принята' : '❌ Заявка отклонена';
      t.style.display = 'block'; t.style.color = status === 'accepted' ? '#4caf82' : '#e05c5c';
      setTimeout(() => { t.style.display = 'none'; location.reload(); }, 1500);
    }
  <\/script>
</body></html>`);
  } catch (err) {
    console.error(err);
    res.status(500).send("Ошибка сервера");
  }
});

app.patch("/admin/applications/:id/status", requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    if (!["accepted","rejected","pending"].includes(status)) return res.status(400).json({ error: "Недопустимый статус." });
    const application = await Application.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!application) return res.status(404).json({ error: "Заявка не найдена." });
    res.json({ ok: true, application });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка сервера." });
  }
});

// --- Static & catch-all ---
app.use(express.static(path.join(__dirname, "public")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
module.exports = app;
