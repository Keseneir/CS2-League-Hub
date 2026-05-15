require("dotenv").config();

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
const Tournament  = require("./models/Tournament");

const app    = express();
const PORT   = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === "production";


if (!global.__mongoConn) {
  global.__mongoConn = mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS:          45000,
    maxPoolSize:              10,
  }).then(() => {
    console.log("MongoDB connected");
    return mongoose.connection;
  }).catch(err => {
    console.error("MongoDB connect error:", err);
    global.__mongoConn = null;
    throw err;
  });
}


passport.use(new SteamStrategy(
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
));

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


app.use(async (req, res, next) => {
  try {
    if (global.__mongoConn) await global.__mongoConn;
    next();
  } catch (err) {
    console.error("DB unavailable:", err.message);
    res.status(500).json({ error: "Database unavailable" });
  }
});

app.use(session({
  secret:            process.env.SESSION_SECRET,
  resave:            false,
  saveUninitialized: false,
  cookie: {
    secure:   isProd,
    httpOnly: true,
    sameSite: "lax",
    maxAge:   7 * 24 * 60 * 60 * 1000,
  },
  store: MongoStore.create({
    mongoUrl:   process.env.MONGODB_URI,
    touchAfter: 24 * 3600,
    autoRemove: "native",
  }),
}));

app.use(passport.initialize());
app.use(passport.session());

//роуты
app.use("/auth",             require("./routes/auth"));
app.get("/logout",           (req, res) => res.redirect("/auth/logout"));
app.use("/api",              require("./routes/users"));
app.use("/api/friends",      require("./routes/friends"));
app.use("/api",              require("./routes/teams"));
app.use("/api/applications", require("./routes/applications"));
app.use("/api/leaderboard",  require("./routes/leaderboard"));
app.use("/api/admin",        require("./routes/admin"));
app.use("/api/tournaments",  require("./routes/tournaments"));

app.get("/api/seasons", async (req, res) => {
  try {
    const seasons = await Season.find().sort({ createdAt: -1 }).lean();
    res.json(seasons);
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

app.get("/api/ranks", async (req, res) => {
  try {
    const ranks = await Rank.find().sort({ order: 1, name: 1 }).lean();
    res.json(ranks);
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

app.patch("/admin/applications/:id/status", require("./middleware/auth").requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    if (!["accepted","rejected","pending"].includes(status))
      return res.status(400).json({ error: "Недопустимый статус" });
    const application = await Application.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!application) return res.status(404).json({ error: "Заявка не найдена" });
    res.json({ ok: true, application });
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

//статика
app.use(express.static(path.join(__dirname, "public")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

//запуск
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
module.exports = app;