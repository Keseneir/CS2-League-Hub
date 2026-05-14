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

    // ─── Команда ─────────────────────────────────────────────────────────────
    teamId: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     "Team",
      default: null,
    },

    // ─── Друзья ──────────────────────────────────────────────────────────────
    friends: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref:  "User",
      },
    ],

    // ─── Входящие заявки в друзья ─────────────────────────────────────────────
    friendRequests: [
      {
        from: {
          type: mongoose.Schema.Types.ObjectId,
          ref:  "User",
        },
        createdAt: {
          type:    Date,
          default: Date.now,
        },
      },
    ],

    // ─── Приглашения в команду ────────────────────────────────────────────────
    teamInvites: [
      {
        teamId: {
          type: mongoose.Schema.Types.ObjectId,
          ref:  "Team",
        },
        from: {
          type: mongoose.Schema.Types.ObjectId,
          ref:  "User",
        },
        createdAt: {
          type:    Date,
          default: Date.now,
        },
      },
    ],

    // ─── Статистика ───────────────────────────────────────────────────────────
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

    // ─── Профиль игрока ───────────────────────────────────────────────────────
    faceitLevel: {
      type:    Number,
      default: null,
      min:     0,
      max:     10,
    },
    hoursInCS2: {
      type:    Number,
      default: null,
      min:     0,
    },
    bio: {
      type:      String,
      default:   "",
      maxlength: 300,
    },
    isPrivate: {
      type:    Boolean,
      default: false,
    },
    telegramUsername: {
      type:    String,
      default: "",
    },
    discordUsername: {
      type:    String,
      default: "",
    },

    // ─── Уведомления от админа ────────────────────────────────────────────────
    adminNotices: [
      {
        message: {
          type: String,
        },
        read: {
          type:    Boolean,
          default: false,
        },
        createdAt: {
          type:    Date,
          default: Date.now,
        },
      },
    ],

    banned: {
      type:    Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Не пересоздавать модель при hot-reload (serverless)
module.exports =
  mongoose.models.User || mongoose.model("User", userSchema);