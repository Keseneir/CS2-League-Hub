const mongoose = require("mongoose");

const teamStatSchema = new mongoose.Schema(
  {
    teamId:      { type: mongoose.Schema.Types.ObjectId, ref: "Team", required: true },
    seasonId:    { type: mongoose.Schema.Types.ObjectId, ref: "Season", required: true },

    pts:         { type: Number, default: 100 },   // стартовые 100 очков
    wins:        { type: Number, default: 0 },
    losses:      { type: Number, default: 0 },
    matches:     { type: Number, default: 0 },
    roundDiff:   { type: Number, default: 0 },     // разница раундов

    winStreak:   { type: Number, default: 0 },     // текущая серия побед
    isKingOfHill:{ type: Boolean, default: false }, // статус "Царь горы"
  },
  { timestamps: true }
);

// Уникальная пара: одна команда — один сезон
teamStatSchema.index({ teamId: 1, seasonId: 1 }, { unique: true });

module.exports = mongoose.model("TeamStat", teamStatSchema);
