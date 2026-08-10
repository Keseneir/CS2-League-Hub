const mongoose = require("mongoose");

const SupportMessageSchema = new mongoose.Schema(
  {
    threadId: { type: mongoose.Schema.Types.ObjectId, ref: "SupportThread", required: true },
    from:     { type: String, enum: ["guest", "admin"], required: true },
    text:     { type: String, required: true, trim: true, maxlength: 2000 },
  },
  { timestamps: true }
);

SupportMessageSchema.index({ threadId: 1, createdAt: 1 });

module.exports = mongoose.model("SupportMessage", SupportMessageSchema);