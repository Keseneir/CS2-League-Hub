const mongoose = require("mongoose");

const NewsCommentSchema = new mongoose.Schema(
  {
    newsId: { type: mongoose.Schema.Types.ObjectId, ref: "News", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    text:   { type: String, required: true, trim: true, maxlength: 1000 },
  },
  { timestamps: true }
);

NewsCommentSchema.index({ newsId: 1, createdAt: 1 });

module.exports = mongoose.model("NewsComment", NewsCommentSchema);