const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    steamId: {
      type:     String,
      required: true,
      unique:   true,
      index:    true,
    },
    displayName: {
      type:    String,
      default: "",
    },
    avatar: {
      type:    String,
      default: "",
    },
    role: {
      type:    String,
      enum:    ["user", "admin"],
      default: "user",
    },
    // Команда, в которой состоит игрок
    team: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  "Team",
      default: null,
    },
    // Список друзей (steamId)
    friends: [
      {
        type: String,
      },
    ],
    // Входящие заявки в друзья (steamId)
    friendRequests: [
      {
        type: String,
      },
    ],
    // Статистика игрока
    stats: {
      kills:   { type: Number, default: 0 },
      deaths:  { type: Number, default: 0 },
      assists: { type: Number, default: 0 },
      wins:    { type: Number, default: 0 },
      losses:  { type: Number, default: 0 },
      rating:  { type: Number, default: 0 },
    },
    rank: {
      type:    String,
      default: "Unranked",
    },
    banned: {
      type:    Boolean,
      default: false,
    },
  },
  {
    timestamps: true, // createdAt, updatedAt
  }
);

// Не пересоздавать модель при hot-reload (serverless)
module.exports =
  mongoose.models.User || mongoose.model("User", userSchema);