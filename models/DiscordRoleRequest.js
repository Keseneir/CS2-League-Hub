const mongoose = require("mongoose");

const DiscordRoleRequestSchema = new mongoose.Schema(
  {
    userId:      { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    steamId:     { type: String, required: true },
    displayName: { type: String, required: true },
    roleName:    { type: String, required: true },
    promoCode:   { type: String, default: "" },
    status:      { type: String, enum: ["pending", "done"], default: "pending" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("DiscordRoleRequest", DiscordRoleRequestSchema);