const express         = require("express");
const router          = express.Router();
const Team            = require("../../models/Team");
const Application     = require("../../models/Application");
const { requireAuth } = require("../middleware/auth");

// POST /api/applications
router.post("/", requireAuth, async (req, res) => {
  try {
    if (!req.user.teamId) return res.status(400).json({ error: "Сначала создайте команду." });
    const existing = await Application.findOne({ userId: req.user._id, status: "pending" });
    if (existing) return res.status(400).json({ error: "У вас уже есть активная заявка." });

    const { hoursInCS2, faceitLevel, experience, contacts } = req.body;
    if (!hoursInCS2 || !faceitLevel || !contacts)
      return res.status(400).json({ error: "Заполните все обязательные поля." });

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

module.exports = router;
