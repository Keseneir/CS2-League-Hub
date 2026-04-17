require('dotenv').config();

const express        = require("express");
const session        = require("express-session");
const passport       = require("passport");
const SteamStrategy  = require("passport-steam").Strategy;
const mongoose       = require("mongoose");
const MongoStore     = require("connect-mongo");
const path           = require("path");
const User           = require("./models/User");

const app  = express();
const PORT = process.env.PORT || 3000;

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
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure:   process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge:   7 * 24 * 60 * 60 * 1000,
    },
    store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }),
  })
);

app.use(passport.initialize());
app.use(passport.session());

app.get("/auth/steam", passport.authenticate("steam", { failureRedirect: "/" }));

app.get(
  "/auth/steam/return",
  passport.authenticate("steam", { failureRedirect: "/" }),
  (req, res) => {
    res.redirect("/");
  }
);

app.get("/api/user", (req, res) => {
  if (!req.isAuthenticated()) {
    return res.json(null);
  }
  const { steamId, displayName, avatar, points, rank } = req.user;
  res.json({ steamId, displayName, avatar, points, rank });
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

app.use(express.static(path.join(__dirname, "public")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = app;