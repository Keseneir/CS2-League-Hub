const mongoose = require("mongoose");

const teamSchema = new mongoose.Schema(
  {
    name:      { type: String, required: true, trim: true, maxlength: 64 },
    tag:       { type: String, required: true, trim: true, maxlength: 8, uppercase: true },
    logo:      { type: String, default: "" },
    telegram:  { type: String, default: "" },

    captainId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    managerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },  // ← RBAC: менеджер

    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    subs:    [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    // ── Контент команды ────────────────────────────────────────────────────────
    description: { type: String, default: "", maxlength: 500 },  // описание команды
    quote:       { type: String, default: "", maxlength: 150 },   // девиз / цитата

    // 1 = аватар по центру, описание снизу
    // 2 = аватар слева, описание справа
    // 3 = аватар справа, описание сверху в виде девиза
    layoutStyle: { type: Number, default: 1, min: 1, max: 3 },

    privacySettings: {
      showStats:   { type: Boolean, default: true },   // показывать стату чужим
      showHistory: { type: Boolean, default: true },   // показывать историю матчей
    },

    // ── Магазин / Экономика ───────────────────────────────────────────────────
    balance: { type: Number, default: 0, min: 0 },   // командный кошелёк (монеты)

    // Инвентарь: массив купленных предметов
    inventory: [
      {
        itemId:    { type: mongoose.Schema.Types.ObjectId, ref: "ShopItem" },
        addedAt:   { type: Date, default: Date.now },
        consumed:  { type: Boolean, default: false },  // билеты становятся true
        consumedAt:{ type: Date, default: null },
      },
    ],

    // ── Roster Lock ───────────────────────────────────────────────────────────
    // При регистрации на турнир фиксируем состав
    rosterLocks: [
      {
        tournamentId: { type: mongoose.Schema.Types.ObjectId, ref: "Tournament" },
        lockedAt:     { type: Date, default: Date.now },
        roster:       [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],  // снимок состава
      },
    ],
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.Team || mongoose.model("Team", teamSchema);