const mongoose = require("mongoose");

// Гость техподдержки — один на устройство/localStorage (guestId), может
// иметь несколько тикетов (SupportThread). Блокировка живёт здесь, а не на
// тикете: заблокированный гость не может писать ни в один свой тикет и не
// может создавать новые.
const SupportGuestSchema = new mongoose.Schema(
  {
    guestId:      { type: String, required: true, unique: true },
    guestName:    { type: String, trim: true, default: "Гость" },
    guestAvatar:  { type: String, trim: true, default: "" },
    guestSteamId: { type: String, trim: true, default: "" },
    isBlocked:    { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("SupportGuest", SupportGuestSchema);