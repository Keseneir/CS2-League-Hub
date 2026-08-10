const mongoose = require("mongoose");

const RewardSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["personalCoins", "teamCoins", "cosmetic", "discordRole"],
      required: true,
    },
    amount:   { type: Number, default: 0 },   // для personalCoins / teamCoins
    itemId:   { type: mongoose.Schema.Types.ObjectId, ref: "ShopItem", default: null }, // для cosmetic
    roleName: { type: String, trim: true, default: "" }, // для discordRole
  },
  { _id: false }
);

const PromoCodeSchema = new mongoose.Schema(
  {
    code:            { type: String, required: true, trim: true, uppercase: true, unique: true, maxlength: 40 },
    rewards:         { type: [RewardSchema], default: [] },
    maxActivations:  { type: Number, default: null },   // null = без лимита
    expiresAt:       { type: Date, default: null },     // null = бессрочно
    isActive:        { type: Boolean, default: true },
    activationsCount:{ type: Number, default: 0 },
    createdBy:       { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PromoCode", PromoCodeSchema);