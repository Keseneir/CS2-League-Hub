const mongoose = require("mongoose");

const PromoRedemptionSchema = new mongoose.Schema(
  {
    codeId: { type: mongoose.Schema.Types.ObjectId, ref: "PromoCode", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

// Один пользователь может погасить конкретный код только один раз
PromoRedemptionSchema.index({ codeId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model("PromoRedemption", PromoRedemptionSchema);