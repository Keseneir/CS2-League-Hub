// Управление объявлениями в админке: список всех (включая снятые/скрытые) и правка текста.
// Скрытие и удаление остаются на существующих маршрутах:
//   PATCH  /api/listings/:id/admin-hide   (скрыть / вернуть)
//   DELETE /api/listings/:id              (админ может удалять любые)
// Отклики и личные сообщения здесь НЕ отдаются.
const express = require("express");
const router  = express.Router();
const Listing = require("../models/Listing");
const { requireAdmin } = require("../middleware/auth");
const { isObjectIdString, parseAdminListingQuery, validateAdminListingEdit } = require("../utils/listingValidation");

router.use(requireAdmin);

function toItem(l) {
  return {
    _id: l._id, type: l.type, title: l.title, description: l.description, role: l.role || "",
    image: { url: (l.image && l.image.url) || "" },
    active: !!l.active, hiddenByAdmin: !!l.hiddenByAdmin,
    createdAt: l.createdAt, updatedAt: l.updatedAt,
    author: l.authorId ? { displayName: l.authorId.displayName || "", avatar: l.authorId.avatar || "", steamId: l.authorId.steamId || "" } : null,
    team:   l.teamId   ? { name: l.teamId.name || "", tag: l.teamId.tag || "" } : null,
  };
}

// GET /api/admin/listings?status=all|active|inactive|hidden&type=&q=&page=&limit=
router.get("/", async (req, res) => {
  try {
    const { filter, page, limit, skip } = parseAdminListingQuery(req.query, Listing.TYPES);
    const [items, total] = await Promise.all([
      Listing.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit)
        .populate("authorId", "displayName avatar steamId").populate("teamId", "name tag").lean(),
      Listing.countDocuments(filter),
    ]);
    res.json({ items: items.map(toItem), total, page, pages: Math.max(1, Math.ceil(total / limit)) });
  } catch (err) {
    console.error("admin listings list failed", err && err.name);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// PATCH /api/admin/listings/:id — { title?, description?, role?, removeImage? }
// Фильтр запрещённых слов к правкам админа не применяется.
// Cloudinary-файл при removeImage НЕ удаляется (владение publicId не подтверждено).
router.patch("/:id", async (req, res) => {
  try {
    if (!isObjectIdString(req.params.id)) return res.status(404).json({ error: "Объявление не найдено" });
    const v = validateAdminListingEdit(req.body);
    if (!v.ok) return res.status(400).json({ error: v.error });

    const listing = await Listing.findById(req.params.id);
    if (!listing) return res.status(404).json({ error: "Объявление не найдено" });

    Object.assign(listing, v.update);
    if (v.removeImage) listing.image = { url: "", publicId: "" };
    await listing.save();

    const fresh = await Listing.findById(listing._id)
      .populate("authorId", "displayName avatar steamId").populate("teamId", "name tag").lean();
    res.json({ ok: true, item: toItem(fresh) });
  } catch (err) {
    console.error("admin listing edit failed", err && err.name);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

module.exports = router;
