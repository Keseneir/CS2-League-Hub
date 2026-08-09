const mongoose = require("mongoose");

const NewsSchema = new mongoose.Schema(
  {
    title:       { type: String, required: true, trim: true, maxlength: 200 },
    text:        { type: String, required: true, trim: true, maxlength: 5000 },
    tag:         { type: String, trim: true, default: "Новость", maxlength: 40 },
    img:         { type: String, trim: true, default: "" },
    link:        { type: String, trim: true, default: "" }, // необязательная внешняя ссылка (например, Telegram-пост)
    featured:    { type: Boolean, default: false },
    publishedAt: { type: Date, default: Date.now }, // отображаемая дата — можно задать вручную, отдельно от createdAt
    authorId:    { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reactions: {
      flame:    { type: Number, default: 0 },
      sad:      { type: Number, default: 0 },
      angry:    { type: Number, default: 0 },
      thumbsUp: { type: Number, default: 0 },
    },
  },
  { timestamps: true } // createdAt/updatedAt — служебные, для аудита
);

NewsSchema.index({ publishedAt: -1 });

module.exports = mongoose.model("News", NewsSchema);