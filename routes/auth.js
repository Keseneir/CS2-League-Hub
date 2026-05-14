const express  = require("express");
const passport = require("passport");
const router   = express.Router();

// GET /auth/steam
router.get("/steam", (req, res, next) => {
  if (req.query.redirect) req.session.authRedirect = req.query.redirect;
  passport.authenticate("steam", { failureRedirect: "/" })(req, res, next);
});

// GET /auth/steam/return
router.get(
  "/steam/return",
  passport.authenticate("steam", { failureRedirect: "/" }),
  (req, res) => {
    const redirect = req.session.authRedirect || "/";
    delete req.session.authRedirect;
    res.redirect(redirect);
  }
);

// GET /logout
router.get("/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.session.destroy(() => {
      res.clearCookie("connect.sid");
      res.redirect("/");
    });
  });
});

module.exports = router;