const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    steamId:     { type: String, required: true, unique: true },
    displayName: { type: String, default: "" },
    avatar:      { type: String, default: "" },
    points:      { type: Number, default: 0 },
    rank:        { type: String, default: "Unranked" },
    teamId:      { type: mongoose.Schema.Types.ObjectId, ref: "Team", default: null },

    // Список друзей
    friends: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    // Входящие заявки в друзья
    friendRequests: [{
      from:      { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
      createdAt: { type: Date, default: Date.now }
    }],

    // Приглашения в команду
    teamInvites: [{
      teamId:    { type: mongoose.Schema.Types.ObjectId, ref: "Team", required: true },
      from:      { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
      role:      { type: String, enum: ["main", "sub"], default: "main" },
      createdAt: { type: Date, default: Date.now }
    }],
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
