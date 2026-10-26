const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema(
  {
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation", required: true },
    // Всегда берётся из серверной сессии, клиент его не передаёт
    senderId:       { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    // У удалённого сообщения (deletedAt) текст очищается («надгробие») — оригинал нигде не хранится
    text:           { type: String, required: function () { return !this.deletedAt; }, trim: true, maxlength: 1000 },
    // Необязательные поля: у обычных сообщений их нет, места они не занимают
    editedAt:       { type: Date },
    deletedAt:      { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

MessageSchema.index({ conversationId: 1, createdAt: 1, _id: 1 });
MessageSchema.index({ senderId: 1, createdAt: -1 }); // лимит частоты отправки

module.exports = mongoose.models.Message || mongoose.model("Message", MessageSchema);
