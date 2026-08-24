const express         = require("express");
const router          = express.Router();
const Team            = require("../models/Team");
const Tournament      = require("../models/Tournament");
const Match           = require("../models/Match");
const User            = require("../models/User");
const { requireAuth } = require("../middleware/auth");


router.get("/", async (req, res) => {
  try {
    const tournaments = await Tournament.find({ status: { $in: ["upcoming", "active"] } })
      .select("name description startDate status minMembers maxMembers maxTeams prize registrations")
      .sort({ startDate: 1, createdAt: -1 })
      .lean();
    const result = tournaments.map(t => ({
      _id:         t._id,
      name:        t.name,
      description: t.description,
      startDate:   t.startDate,
      status:      t.status,
      minMembers:  t.minMembers,
      maxMembers:  t.maxMembers,
      maxTeams:    t.maxTeams,
      prize:       t.prize,
      teamsCount:  (t.registrations || []).length,
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});


router.get("/my", requireAuth, async (req, res) => {
  try {
    const tournaments = await Tournament.find({ status: { $in: ["upcoming", "active"] } })
      .sort({ startDate: 1, createdAt: -1 })
      .lean();

    if (!req.user.teamId) return res.json(tournaments.map(t => ({
      _id: t._id, name: t.name, description: t.description,
      startDate: t.startDate, status: t.status, minMembers: t.minMembers,
      maxMembers: t.maxMembers, maxTeams: t.maxTeams, prize: t.prize,
      teamsCount: (t.registrations || []).length, isRegistered: false,
    })));

    const teamIdStr = req.user.teamId.toString();
    const result = tournaments.map(t => {
      const reg = (t.registrations || []).find(r => r.teamId.toString() === teamIdStr);
      return {
        _id: t._id, name: t.name, description: t.description,
        startDate: t.startDate, status: t.status, minMembers: t.minMembers,
        maxMembers: t.maxMembers, maxTeams: t.maxTeams, prize: t.prize,
        teamsCount: (t.registrations || []).length,
        isRegistered: !!reg,
        // Отдаём выбранный ростер и статус, чтобы join.html мог показать
        // текущий выбор и решить, можно ли его ещё менять (status !== active).
        roster: reg ? (reg.roster || []).map(id => id.toString()) : [],
      };
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});


// GET /api/tournaments/archive — завершённые турниры
router.get("/archive", async (req, res) => {
  try {
    const tournaments = await Tournament.find({ status: "finished" })
      .select("name description startDate prize maxTeams registrations")
      .sort({ startDate: -1, createdAt: -1 })
      .lean();
    const result = tournaments.map(t => ({
      _id:         t._id,
      name:        t.name,
      description: t.description,
      startDate:   t.startDate,
      prize:       t.prize,
      teamsCount:  (t.registrations || []).length,
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// GET /api/tournaments/:id — детали турнира (для архива и общего показа), с составом команд
router.get("/:id", async (req, res) => {
  try {
    const t = await Tournament.findById(req.params.id)
      .populate("registrations.teamId", "name tag logo")
      .select("name description startDate status minMembers maxMembers maxTeams prize registrations")
      .lean();
    if (!t) return res.status(404).json({ error: "Турнир не найден" });
    res.json({
      _id:         t._id,
      name:        t.name,
      description: t.description,
      startDate:   t.startDate,
      status:      t.status,
      minMembers:  t.minMembers,
      maxMembers:  t.maxMembers,
      maxTeams:    t.maxTeams,
      prize:       t.prize,
      teams: (t.registrations || []).map(r => r.teamId).filter(Boolean),
    });
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// GET /api/tournaments/:id/matches — кто с кем играл в рамках турнира
router.get("/:id/matches", async (req, res) => {
  try {
    const matches = await Match.find({ tournamentId: req.params.id })
      .sort({ playedAt: 1 })
      .populate("winnerTeamId", "name tag logo")
      .populate("loserTeamId",  "name tag logo")
      .select("winnerTeamId loserTeamId map score roundDiff playedAt")
      .lean();
    res.json(matches);
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// ── Хелпер: проверяет, что каждый userId в roster реально состоит в
// команде (основной либо запасной состав), и что размер укладывается в
// [minMembers, maxMembers] турнира. Бросает { status, error } при ошибке.
function validateRoster(roster, team, tournament) {
  if (!Array.isArray(roster) || roster.length === 0) {
    throw { status: 400, error: "Выберите состав на турнир" };
  }
  const uniqueRoster = [...new Set(roster.map(String))];
  if (uniqueRoster.length !== roster.length) {
    throw { status: 400, error: "В составе не может быть повторяющихся игроков" };
  }
  if (uniqueRoster.length < tournament.minMembers || uniqueRoster.length > tournament.maxMembers) {
    const range = tournament.minMembers === tournament.maxMembers
      ? `${tournament.minMembers}`
      : `${tournament.minMembers}–${tournament.maxMembers}`;
    throw { status: 400, error: `Состав на турнир должен быть из ${range} игроков` };
  }
  const teamPlayerIds = new Set([
    ...(team.members || []).map(String),
    ...(team.subs    || []).map(String),
  ]);
  const invalid = uniqueRoster.filter(id => !teamPlayerIds.has(id));
  if (invalid.length > 0) {
    throw { status: 400, error: "В составе указан игрок, не состоящий в команде" };
  }
  return uniqueRoster;
}

router.post("/:id/register", requireAuth, async (req, res) => {
  try {
    if (!req.user.teamId) return res.status(400).json({ error: "Вы не состоите в команде" });

    const team = await Team.findById(req.user.teamId).lean();
    if (!team) return res.status(404).json({ error: "Команда не найдена" });
    if (team.captainId.toString() !== req.user._id.toString())
      return res.status(403).json({ error: "Только капитан может регистрировать команду" });

    const tournament = await Tournament.findById(req.params.id);
    if (!tournament) return res.status(404).json({ error: "Турнир не найден" });
    // ФИКС: регистрация была возможна даже когда турнир уже "active" —
    // разрешена только пока турнир "upcoming".
    if (tournament.status !== "upcoming")
      return res.status(400).json({ error: "Регистрация на этот турнир закрыта" });

    if ((team.members || []).length < tournament.minMembers)
      return res.status(400).json({
        error: `Недостаточно игроков в команде. Нужно минимум ${tournament.minMembers} в основном составе`,
        code:  "TEAM_INCOMPLETE",
      });

    if ((tournament.registrations || []).length >= tournament.maxTeams)
      return res.status(400).json({ error: "Все слоты заняты" });

    if ((tournament.registrations || []).some(r => r.teamId.toString() === req.user.teamId.toString()))
      return res.status(400).json({ error: "Ваша команда уже зарегистрирована" });

    const { ageConfirmed, rulesAccepted, roster } = req.body;
    if (!ageConfirmed || !rulesAccepted)
      return res.status(400).json({ error: "Необходимо подтвердить возраст и принять правила" });

    let validRoster;
    try {
      validRoster = validateRoster(roster, team, tournament);
    } catch (e) {
      return res.status(e.status || 400).json({ error: e.error || "Ошибка состава" });
    }

    tournament.registrations.push({
      teamId: req.user.teamId, captainId: req.user._id,
      ageConfirmed: true, rulesAccepted: true,
      roster: validRoster,
    });
    await tournament.save();
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// PATCH /api/tournaments/:id/register — капитан меняет состав на турнир.
// Разрешено только пока турнир не "active" (после старта состав фиксирован).
router.patch("/:id/register", requireAuth, async (req, res) => {
  try {
    if (!req.user.teamId) return res.status(400).json({ error: "Вы не в команде" });

    const team = await Team.findById(req.user.teamId).lean();
    if (!team || team.captainId.toString() !== req.user._id.toString())
      return res.status(403).json({ error: "Только капитан может менять состав" });

    const tournament = await Tournament.findById(req.params.id);
    if (!tournament) return res.status(404).json({ error: "Турнир не найден" });
    if (tournament.status === "active")
      return res.status(400).json({ error: "Турнир уже идёт — состав менять нельзя" });
    if (tournament.status === "finished")
      return res.status(400).json({ error: "Турнир завершён" });

    const reg = (tournament.registrations || []).find(
      r => r.teamId.toString() === req.user.teamId.toString()
    );
    if (!reg) return res.status(400).json({ error: "Ваша команда не зарегистрирована" });

    let validRoster;
    try {
      validRoster = validateRoster(req.body.roster, team, tournament);
    } catch (e) {
      return res.status(e.status || 400).json({ error: e.error || "Ошибка состава" });
    }

    reg.roster = validRoster;
    await tournament.save();
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});


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