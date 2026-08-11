const mongoose = require("mongoose");

const SupportThreadSchema = new mongoose.Schema(
  {
    guestId:            { type: String, required: true, unique: true },
    guestName:          { type: String, trim: true, default: "Гость" },
    guestAvatar:        { type: String, trim: true, default: "" },
    guestSteamId:       { type: String, trim: true, default: "" },
    lastMessageAt:       { type: Date, default: Date.now },
    isResolved:          { type: Boolean, default: false },
    isBlocked:           { type: Boolean, default: false },
    // ID всех сообщений, отправленных в Telegram по этому треду — чтобы
    // "Ответить" на ЛЮБОЕ из них (даже старое) корректно долетало обратно.
    telegramMessageIds:  { type: [Number], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model("SupportThread", SupportThreadSchema);