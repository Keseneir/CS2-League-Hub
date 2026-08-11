const mongoose = require("mongoose");

const SupportMessageSchema = new mongoose.Schema(
  {
    threadId:    { type: mongoose.Schema.Types.ObjectId, ref: "SupportThread", required: true },
    from:        { type: String, enum: ["guest", "admin"], required: true },
    text:        { type: String, required: true, trim: true, maxlength: 2000 },
    authorName:  { type: String, trim: true, default: "" }, // ник ответившего админа в Telegram, либо имя игрока
    authorAvatar:{ type: String, trim: true, default: "" }, // аватар игрока (если авторизован через Steam)
    attachmentUrl:       { type: String, trim: true, default: "" },
    attachmentPublicId:  { type: String, trim: true, default: "" }, // нужен для удаления из Cloudinary
    attachmentExpiresAt: { type: Date, default: null },             // вложение живёт ограниченное время
  },
  { timestamps: true }
);

SupportMessageSchema.index({ threadId: 1, createdAt: 1 });

module.exports = mongoose.model("SupportMessage", SupportMessageSchema);