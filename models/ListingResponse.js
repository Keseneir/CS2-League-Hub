const mongoose = require("mongoose");

const ListingResponseSchema = new mongoose.Schema(
  {
    listingId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "Listing",
      required: true,
      index:    true,
    },

    fromUserId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "User",
      required: true,
    },

    message: {
      type:      String,
      required:  true,
      trim:      true,
      maxlength: 500,
    },

    // Контакты берутся из профиля откликнувшегося на момент отправки —
    // хранится снапшотом, чтобы автор видел то, что было актуально в момент отклика,
    // даже если пользователь потом сменит контакты в профиле.
    contacts: {
      discordUsername:  { type: String, default: "" },
      telegramUsername: { type: String, default: "" },
    },

    // Прочитан ли отклик автором объявления — управляет бейджем уведомлений
    read: {
      type:    Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Один пользователь — один активный отклик на объявление (повторный отклик
// обновляет существующий, а не плодит дубликаты и не даёт заспамить автора)
ListingResponseSchema.index({ listingId: 1, fromUserId: 1 }, { unique: true });
ListingResponseSchema.index({ listingId: 1, createdAt: -1 });

module.exports = mongoose.models.ListingResponse || mongoose.model("ListingResponse", ListingResponseSchema);