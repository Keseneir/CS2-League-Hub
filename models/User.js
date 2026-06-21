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

    //команда
    teamId: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     "Team",
      default: null,
    },

    //др
    friends: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref:  "User",
      },
    ],

    //ВХОДЯЩИЕ заявки в др
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

    //инвайты в тим
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

    //стата
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

    //профиль игрока
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

    //уведы от адм
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

    // ── Магазин: личный кошелёк и инвентарь ──────────────────────────────────
    // Монеты начисляются автоматически за участие в матчах.
    // Тратятся в Personal Store (shop.html, вкладка «Для себя»).
    personalBalance: {
      type:    Number,
      default: 0,
      min:     0,
    },

    personalInventory: [
      {
        itemId: {
          type: mongoose.Schema.Types.ObjectId,
          ref:  "ShopItem",
        },
        addedAt: {
          type:    Date,
          default: Date.now,
        },
        // Для расходников (буст монет и т.п.)
        consumed: {
          type:    Boolean,
          default: false,
        },
        consumedAt: {
          type:    Date,
          default: null,
        },
      },
    ],

    // ── Надетая косметика ─────────────────────────────────────────────────
    equippedCosmetics: {
      avatarFrame: { type: mongoose.Schema.Types.ObjectId, ref: "ShopItem", default: null },
      profileBg:   { type: mongoose.Schema.Types.ObjectId, ref: "ShopItem", default: null },
    },
  },
  {
    timestamps: true,
  }
);


module.exports =
  mongoose.models.User || mongoose.model("User", userSchema);