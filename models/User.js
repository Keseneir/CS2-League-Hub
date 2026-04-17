const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    steamId:     { type: String, required: true, unique: true },
    displayName: { type: String, default: "" },
    avatar:      { type: String, default: "" },
    points:      { type: Number, default: 0 },
    rank:        { type: String, default: "Unranked" },
    teamId:      { type: mongoose.Schema.Types.ObjectId, ref: "Team", default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
