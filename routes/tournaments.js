const express         = require("express");
const router          = express.Router();
const Team            = require("../models/Team");
const Tournament      = require("../models/Tournament");
const { requireAuth } = require("../middleware/auth");

// GET /api/tournaments
router.get("/", async (req, res) => {
  try {
    const tournaments = await Tournament.find({ status: { $in: ["upcoming", "active"] } })
      .select("name description startDate status minMembers maxTeams prize registrations")
      .sort({ startDate: 1, createdAt: -1 })
      .lean();
    const result = tournaments.map(t => ({
      _id:         t._id,
      name:        t.name,
      description: t.description,
      startDate:   t.startDate,
      status:      t.status,
      minMembers:  t.minMembers,
      maxTeams:    t.maxTeams,
      prize:       t.prize,
      teamsCount:  (t.registrations || []).length,
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// GET /api/tournaments/my
router.get("/my", requireAuth, async (req, res) => {
  try {
    const tournaments = await Tournament.find({ status: { $in: ["upcoming", "active"] } })
      .sort({ startDate: 1, createdAt: -1 })
      .lean();

    if (!req.user.teamId) return res.json(tournaments.map(t => ({
      _id: t._id, name: t.name, description: t.description,
      startDate: t.startDate, status: t.status, minMembers: t.minMembers,
      maxTeams: t.maxTeams, prize: t.prize,
      teamsCount: (t.registrations || []).length, isRegistered: false,
    })));

    const teamIdStr = req.user.teamId.toString();
    const result = tournaments.map(t => {
      const reg = (t.registrations || []).find(r => r.teamId.toString() === teamIdStr);
      return {
        _id: t._id, name: t.name, description: t.description,
        startDate: t.startDate, status: t.status, minMembers: t.minMembers,
        maxTeams: t.maxTeams, prize: t.prize,
        teamsCount: (t.registrations || []).length,
        isRegistered: !!reg,
      };
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// POST /api/tournaments/:id/register
router.post("/:id/register", requireAuth, async (req, res) => {
  try {
    if (!req.user.teamId) return res.status(400).json({ error: "Вы не состоите в команде" });

    const team = await Team.findById(req.user.teamId).lean();
    if (!team) return res.status(404).json({ error: "Команда не найдена" });
    if (team.captainId.toString() !== req.user._id.toString())
      return res.status(403).json({ error: "Только капитан может регистрировать команду" });

    const tournament = await Tournament.findById(req.params.id);
    if (!tournament) return res.status(404).json({ error: "Турнир не найден" });
    if (!["upcoming", "active"].includes(tournament.status))
      return res.status(400).json({ error: "Регистрация на этот турнир закрыта" });

    if ((team.members || []).length < tournament.minMembers)
      return res.status(400).json({
        error: `Недостаточно игроков. Нужно минимум ${tournament.minMembers}/5 в основном составе`,
        code:  "TEAM_INCOMPLETE",
      });

    if ((tournament.registrations || []).length >= tournament.maxTeams)
      return res.status(400).json({ error: "Все слоты заняты" });

    if ((tournament.registrations || []).some(r => r.teamId.toString() === req.user.teamId.toString()))
      return res.status(400).json({ error: "Ваша команда уже зарегистрирована" });

    const { ageConfirmed, rulesAccepted } = req.body;
    if (!ageConfirmed || !rulesAccepted)
      return res.status(400).json({ error: "Необходимо подтвердить возраст и принять правила" });

    tournament.registrations.push({
      teamId: req.user.teamId, captainId: req.user._id,
      ageConfirmed: true, rulesAccepted: true,
    });
    await tournament.save();
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// DELETE /api/tournaments/:id/register
router.delete("/:id/register", requireAuth, async (req, res) => {
  try {
    if (!req.user.teamId) return res.status(400).json({ error: "Вы не в команде" });
    const team = await Team.findById(req.user.teamId).lean();
    if (!team || team.captainId.toString() !== req.user._id.toString())
      return res.status(403).json({ error: "Только капитан может отменить регистрацию" });

    const tournament = await Tournament.findById(req.params.id);
    if (!tournament) return res.status(404).json({ error: "Турнир не найден" });

    const before = (tournament.registrations || []).length;
    tournament.registrations = (tournament.registrations || []).filter(r => r.teamId.toString() !== req.user.teamId.toString());
    if (tournament.registrations.length === before)
      return res.status(400).json({ error: "Ваша команда не зарегистрирована" });

    await tournament.save();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

module.exports = router;