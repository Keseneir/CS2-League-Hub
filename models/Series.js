const mongoose = require("mongoose");

const seriesSchema = new mongoose.Schema(
  {
    seasonId:     { type: mongoose.Schema.Types.ObjectId, ref: "Season",     required: true },
    tournamentId: { type: mongoose.Schema.Types.ObjectId, ref: "Tournament", default: null },

    format: { type: String, enum: ["bo1", "bo3", "bo5"], default: "bo1" },

    // TeamStat — для начисления очков сезона (привязаны к сезону)
    teamAStatId: { type: mongoose.Schema.Types.ObjectId, ref: "TeamStat", required: true },
    teamBStatId: { type: mongoose.Schema.Types.ObjectId, ref: "TeamStat", required: true },
    // Team — сама команда, для Match/User/монет
    teamAId:     { type: mongoose.Schema.Types.ObjectId, ref: "Team", required: true },
    teamBId:     { type: mongoose.Schema.Types.ObjectId, ref: "Team", required: true },

    mapsWonA: { type: Number, default: 0, min: 0 },
    mapsWonB: { type: Number, default: 0, min: 0 },

    status: { type: String, enum: ["in_progress", "finished"], default: "in_progress" },

    winnerTeamId: { type: mongoose.Schema.Types.ObjectId, ref: "Team", default: null },
    loserTeamId:  { type: mongoose.Schema.Types.ObjectId, ref: "Team", default: null },

    finishedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Series || mongoose.model("Series", seriesSchema);