const mongoose = require("mongoose");

// История покупок в магазине. Название, иконка и цена сохраняются «снимком»,
// чтобы история не менялась, если предмет потом переименуют или изменят цену.
const purchaseSchema = new mongoose.Schema(
  {
    userId:   { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },   // кто купил
    teamId:   { type: mongoose.Schema.Types.ObjectId, ref: "Team", default: null },    // для командных покупок
    category: { type: String, enum: ["personal", "team"], required: true },
    itemId:   { type: mongoose.Schema.Types.ObjectId, ref: "ShopItem" },
    itemName: { type: String, default: "" },
    itemIcon: { type: String, default: "" },
    price:    { type: Number, required: true, min: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

purchaseSchema.index({ userId: 1, category: 1, createdAt: -1 });
purchaseSchema.index({ teamId: 1, createdAt: -1 });

module.exports =
  mongoose.models.Purchase || mongoose.model("Purchase", purchaseSchema);