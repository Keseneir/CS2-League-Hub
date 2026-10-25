const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema(
  {
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation", required: true },
    // Всегда берётся из серверной сессии, клиент его не передаёт
    senderId:       { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    text:           { type: String, required: true, trim: true, maxlength: 1000 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

MessageSchema.index({ conversationId: 1, createdAt: 1, _id: 1 });
MessageSchema.index({ senderId: 1, createdAt: -1 }); // лимит частоты отправки

module.exports = mongoose.models.Message || mongoose.model("Message", MessageSchema);
