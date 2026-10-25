const mongoose = require("mongoose");
const Message  = require("./Message");
const { makePreview, unreadConversationsFilter } = require("../utils/chatAccess");

// Один диалог = одно объявление + один откликнувшийся. Автор берётся из объявления на момент
// создания (authorId объявления не меняется). Дубликаты исключает уникальный индекс.
const ConversationSchema = new mongoose.Schema(
  {
    listingId:   { type: mongoose.Schema.Types.ObjectId, ref: "Listing", required: true },
    authorId:    { type: mongoose.Schema.Types.ObjectId, ref: "User",    required: true },
    responderId: { type: mongoose.Schema.Types.ObjectId, ref: "User",    required: true },

    lastMessageAt:       { type: Date, default: Date.now },
    lastMessageSenderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    lastMessagePreview:  { type: String, default: "", maxlength: 120 },

    // Отметки прочтения хранятся отдельно для каждого участника и меняются только им самим
    authorLastReadAt:    { type: Date, default: null },
    responderLastReadAt: { type: Date, default: null },
  },
  { timestamps: true }
);

ConversationSchema.index({ listingId: 1, responderId: 1 }, { unique: true });
ConversationSchema.index({ authorId: 1, lastMessageAt: -1 });
ConversationSchema.index({ responderId: 1, lastMessageAt: -1 });

/**
 * Создаёт диалог (или возвращает существующий) ПОСЛЕ успешного отклика.
 * Первое сообщение (текст отклика) добавляется только при создании диалога —
 * повторные отклики его не дублируют. Для автора это первое сообщение не считается
 * «непрочитанным»: о нём уже сообщает непрочитанный отклик (иначе бейдж считал бы событие дважды).
 */
ConversationSchema.statics.ensureForResponse = async function ({ listingId, authorId, responderId, firstMessage }) {
  const now = new Date();
  let result;
  try {
    result = await this.findOneAndUpdate(
      { listingId, responderId },
      { $setOnInsert: {
          authorId,
          lastMessageAt: now, lastMessageSenderId: responderId, lastMessagePreview: makePreview(firstMessage),
          authorLastReadAt: now, responderLastReadAt: now,
      } },
      { upsert: true, new: true, includeResultMetadata: true }
    );
  } catch (err) {
    if (err && err.code === 11000) { // параллельный первый отклик — диалог уже создан соседним запросом
      const existing = await this.findOne({ listingId, responderId });
      if (existing) return { conversation: existing, created: false };
    }
    throw err;
  }
  const conversation = result.value;
  const created = result.lastErrorObject && result.lastErrorObject.updatedExisting === false;
  if (created) {
    await Message.create({ conversationId: conversation._id, senderId: responderId, text: firstMessage, createdAt: now });
  }
  return { conversation, created: !!created };
};

ConversationSchema.statics.countUnreadFor = function (userId) {
  return this.countDocuments(unreadConversationsFilter(userId));
};

module.exports = mongoose.models.Conversation || mongoose.model("Conversation", ConversationSchema);
