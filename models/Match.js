const mongoose = require("mongoose");

const matchSchema = new mongoose.Schema(
  {
    seasonId:     { type: mongoose.Schema.Types.ObjectId, ref: "Season",     required: true },
    tournamentId: { type: mongoose.Schema.Types.ObjectId, ref: "Tournament", default: null },
    // Серия (BO1/BO3/BO5), в рамках которой сыграна эта карта.
    // null — для матчей, записанных до введения серий (старый формат).
    seriesId:     { type: mongoose.Schema.Types.ObjectId, ref: "Series",     default: null },

    winnerTeamId: { type: mongoose.Schema.Types.ObjectId, ref: "Team", required: true },
    loserTeamId:  { type: mongoose.Schema.Types.ObjectId, ref: "Team", required: true },

    map:       { type: String, default: "", maxlength: 64 }, // напр. "Mirage"
    score:     { type: String, default: "", maxlength: 16 }, // напр. "13:7" — только для отображения
    roundDiff: { type: Number, default: 0 },                 // разница раундов в пользу победителя (для очков)

    playedAt: { type: Date, default: Date.now },

    // ── Личная стата по игрокам (опционально, вводится админом) ────────────
    playerStats: [
      {
        userId:     { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        teamId:     { type: mongoose.Schema.Types.ObjectId, ref: "Team", required: true }, // за какую команду играл в этом матче
        kills:      { type: Number, default: 0, min: 0 },
        deaths:     { type: Number, default: 0, min: 0 },
        assists:    { type: Number, default: 0, min: 0 },
        headshots:  { type: Number, default: 0, min: 0 }, // сколько из kills — в голову (для HS%)
      },
    ],
  },
  { timestamps: true }
);

matchSchema.index({ winnerTeamId: 1, playedAt: -1 });
matchSchema.index({ loserTeamId: 1, playedAt: -1 });
matchSchema.index({ "playerStats.userId": 1, playedAt: -1 });
matchSchema.index({ seriesId: 1 });

module.exports = mongoose.models.Match || mongoose.model("Match", matchSchema);