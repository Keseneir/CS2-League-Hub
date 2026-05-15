const mongoose = require("mongoose");

const teamStatSchema = new mongoose.Schema(
  {
    teamId:      { type: mongoose.Schema.Types.ObjectId, ref: "Team", required: true },
    seasonId:    { type: mongoose.Schema.Types.ObjectId, ref: "Season", required: true },

    pts:         { type: Number, default: 100 },   //птс
    wins:        { type: Number, default: 0 },
    losses:      { type: Number, default: 0 },
    matches:     { type: Number, default: 0 },
    roundDiff:   { type: Number, default: 0 },     //рд

    winStreak:   { type: Number, default: 0 },     //винстрик
    isKingOfHill:{ type: Boolean, default: false }, //цг
  },
  { timestamps: true }
);

//уник индекс по команде и сезону
teamStatSchema.index({ teamId: 1, seasonId: 1 }, { unique: true });

module.exports = mongoose.model("TeamStat", teamStatSchema);
