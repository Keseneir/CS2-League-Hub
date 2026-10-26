const mongoose = require("mongoose");

// Жалоба на объявление. Отдельная коллекция нужна, потому что жалобы должны храниться постоянно и показываться
// только администраторам: встроить их массивом в Listing нельзя — документ читается в публичных ответах
// (риск утечки жалоб и данных жалобщиков) и массив рос бы без предела.
// Хранятся только ссылки + причина + необязательный текст; копий объявления и профиля нет.
// Размер ограничен: одна жалоба на пару (объявление, жалобщик); админ «отклоняет» жалобу = удаляет документ;
// при удалении объявления его жалобы удаляются каскадно.
const REASONS = ["spam", "scam", "inappropriate", "wrong_info", "other"];

const ListingReportSchema = new mongoose.Schema(
  {
    listingId:  { type: mongoose.Schema.Types.ObjectId, ref: "Listing", required: true },
    reporterId: { type: mongoose.Schema.Types.ObjectId, ref: "User",    required: true },
    reason:     { type: String, enum: REASONS, required: true },
    details:    { type: String, trim: true, maxlength: 500 },   // без default: пустое описание не хранится
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// 1) уникальность «одна жалоба на объявление от пользователя» + выборка/каскадное удаление по listingId
ListingReportSchema.index({ listingId: 1, reporterId: 1 }, { unique: true });
// 2) лимит частоты: сколько жалоб пользователь отправил за последний час
ListingReportSchema.index({ reporterId: 1, createdAt: -1 });

const ListingReport = mongoose.models.ListingReport || mongoose.model("ListingReport", ListingReportSchema);
ListingReport.REASONS = REASONS;
module.exports = ListingReport;
