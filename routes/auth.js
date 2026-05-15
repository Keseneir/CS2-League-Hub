const express  = require("express");
const passport = require("passport");
const router   = express.Router();


router.get("/steam", (req, res, next) => {
  if (req.query.redirect) req.session.authRedirect = req.query.redirect;
  passport.authenticate("steam", { failureRedirect: "/" })(req, res, next);
});


router.get(
  "/steam/return",
  passport.authenticate("steam", { failureRedirect: "/" }),
  (req, res) => {
    const redirect = req.session.authRedirect || "/";
    delete req.session.authRedirect;
    res.redirect(redirect);
  }
);


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