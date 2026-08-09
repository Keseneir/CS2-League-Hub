const mongoose = require("mongoose");

const REACTION_TYPES = ["flame", "sad", "angry", "thumbsUp"];

const NewsReactionSchema = new mongoose.Schema(
  {
    newsId: { type: mongoose.Schema.Types.ObjectId, ref: "News", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    emoji:  { type: String, enum: REACTION_TYPES, required: true },
  },
  { timestamps: true }
);

// Один пользователь — одна реакция на новость (переключение = обновление этого документа)
NewsReactionSchema.index({ newsId: 1, userId: 1 }, { unique: true });

const NewsReaction = mongoose.model("NewsReaction", NewsReactionSchema);
NewsReaction.REACTION_TYPES = REACTION_TYPES;

module.exports = NewsReaction;