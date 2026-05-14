const express    = require("express");
const router     = express.Router();
const Team       = require("../models/Team");
const Season     = require("../models/Season");
const TeamStat   = require("../models/TeamStat");

function buildRows(stats) {
  return stats.map(s => ({
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
}

function sortStats(stats) {
  return stats.sort((a, b) => b.pts - a.pts || b.roundDiff - a.roundDiff || b.wins - a.wins);
}

// GET /api/leaderboard
router.get("/", async (req, res) => {
  try {
    let season = await Season.findOne({ isActive: true }).lean();
    if (!season) season = await Season.findOne().sort({ createdAt: -1 }).lean();
    if (!season) return res.json({ season: null, rows: [] });

    const stats = await TeamStat.find({ seasonId: season._id })
      .populate("teamId", "name tag logo telegram members subs")
      .lean();

    res.json({ season, rows: buildRows(sortStats(stats)) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// GET /api/leaderboard/rosters
router.get("/rosters", async (req, res) => {
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

// GET /api/leaderboard/:seasonId
router.get("/:seasonId", async (req, res) => {
  try {
    const season = await Season.findById(req.params.seasonId).lean();
    if (!season) return res.status(404).json({ error: "Сезон не найден" });

    const stats = await TeamStat.find({ seasonId: season._id })
      .populate("teamId", "name tag logo telegram members subs")
      .lean();

    res.json({ season, rows: buildRows(sortStats(stats)) });
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

module.exports = router;