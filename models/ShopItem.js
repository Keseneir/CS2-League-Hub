const mongoose = require("mongoose");

const shopItemSchema = new mongoose.Schema(
  {
    name:        { type: String, required: true, trim: true, maxlength: 64 },
    description: { type: String, default: "", maxlength: 256 },
    icon:        { type: String, default: "🎁" },          // emoji-иконка
    price:       { type: Number, required: true, min: 0 },
    category: {
      type:     String,
      enum:     ["personal", "team"],
      required: true,
    },
    // cosmetic — визуальный предмет; boost — бустер; ticket — билет на турнир;
    // slot — расширение ростера; placement — приоритет в таблице
    type: {
      type:    String,
      enum:    ["cosmetic", "boost", "ticket", "slot", "placement"],
      default: "cosmetic",
    },
    isActive:     { type: Boolean, default: true },
    isConsumable: { type: Boolean, default: false },  // исчезает после использования
    order:        { type: Number,  default: 0 },       // порядок отображения

    // ── Косметика ─────────────────────────────────────────────────────────
    // avatar_frame  → рамка аватарки на странице профиля
    // profile_bg    → фон страницы профиля
    // team_bg       → фон страницы команды
    cosmeticType: {
      type: String,
      enum: ["avatar_frame", "profile_bg", "team_bg", null],
      default: null,
    },
    css:       { type: String, default: "" },  // CSS для целевого элемента
    keyframes: { type: String, default: "" },  // @keyframes (если анимированный)
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.ShopItem || mongoose.model("ShopItem", shopItemSchema);