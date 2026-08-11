const mongoose = require("mongoose");

// Тикет техподдержки. Один гость (guestId) может иметь несколько тикетов —
// guestId больше НЕ уникален здесь (уникальность гостя живёт в SupportGuest).
const SupportThreadSchema = new mongoose.Schema(
  {
    guestId:             { type: String, required: true, index: true },
    subject:             { type: String, trim: true, maxlength: 120, default: "" },
    status:              { type: String, enum: ["open", "resolved"], default: "open" },
    lastMessageAt:       { type: Date, default: Date.now },
    // ID всех сообщений, отправленных в Telegram по этому тикету — чтобы
    // "Ответить" на ЛЮБОЕ из них (даже старое) корректно долетало обратно.
    telegramMessageIds:  { type: [Number], default: [] },
  },
  { timestamps: true }
);

SupportThreadSchema.index({ guestId: 1, updatedAt: -1 });

module.exports = mongoose.model("SupportThread", SupportThreadSchema);