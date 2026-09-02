const express          = require("express");
const router           = express.Router();
const mongoose         = require("mongoose");
const Listing          = require("../models/Listing");
const ListingResponse  = require("../models/ListingResponse");
const Team             = require("../models/Team");
const { requireAuth }    = require("../middleware/auth");
const { ADMIN_STEAM_ID } = require("../config/constants");
const { destroyCloudinaryAsset } = require("../utils/cloudinaryCleanup");
const { containsProfanity }      = require("../utils/profanityFilter");

const TEAM_TYPES = ["team_seeking_player", "scrim"];

function isAdminUser(user) {
  return !!user && user.steamId === ADMIN_STEAM_ID;
}

function isTeamLead(team, userId) {
  if (!team) return false;
  const uid = userId.toString();
  const isCaptain = team.captainId && team.captainId.toString() === uid;
  const isManager = team.managerId && team.managerId.toString() === uid;
  return !!(isCaptain || isManager);
}

// Подмешивает responseCount к массиву объявлений одним агрегационным запросом,
// чтобы не дёргать countDocuments() в цикле на каждую карточку.
async function withResponseCounts(listings) {
  if (!listings.length) return listings;
  const ids = listings.map(l => l._id);
  const counts = await ListingResponse.aggregate([
    { $match: { listingId: { $in: ids } } },
    { $group: { _id: "$listingId", count: { $sum: 1 } } },
  ]);
  const map = new Map(counts.map(c => [c._id.toString(), c.count]));
  return listings.map(l => {
    const obj = l.toObject();
    obj.responseCount = map.get(l._id.toString()) || 0;
    return obj;
  });
}

// ── GET /api/listings — публичный список с фильтрами ────────────────────
router.get("/", async (req, res) => {
  try {
    const { type, role, q } = req.query;
    const filter = { active: true, hiddenByAdmin: false };

    if (type && Listing.TYPES.includes(type)) filter.type = type;
    if (role) filter.role = new RegExp(role.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    if (q)    filter.title = new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

    const listings = await Listing.find(filter)
      .sort({ createdAt: -1 })
      .limit(200)
      .populate("authorId", "displayName avatar")
      .populate("teamId", "name tag logo");

    res.json({ listings: await withResponseCounts(listings) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка сервера." });
  }
});

// ── GET /api/listings/mine — свои объявления (в т.ч. снятые/скрытые) ────
router.get("/mine", requireAuth, async (req, res) => {
  try {
    const listings = await Listing.find({ authorId: req.user._id })
      .sort({ createdAt: -1 })
      .populate("teamId", "name tag logo");

    res.json({ listings: await withResponseCounts(listings) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка сервера." });
  }
});

// ── GET /api/listings/unread-count — для бейджа в хедере ────────────────
router.get("/unread-count", requireAuth, async (req, res) => {
  try {
    const myListingIds = await Listing.find({ authorId: req.user._id }).distinct("_id");
    if (!myListingIds.length) return res.json({ count: 0 });
    const count = await ListingResponse.countDocuments({
      listingId: { $in: myListingIds },
      read: false,
    });
    res.json({ count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка сервера." });
  }
});

// ── GET /api/listings/:id — одна карточка ────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id)
      .populate("authorId", "displayName avatar")
      .populate("teamId", "name tag logo");
    if (!listing) return res.status(404).json({ error: "Объявление не найдено." });

    const isOwner = req.user && listing.authorId._id.toString() === req.user._id.toString();
    const isAdmin = isAdminUser(req.user);
    if ((!listing.active || listing.hiddenByAdmin) && !isOwner && !isAdmin) {
      return res.status(404).json({ error: "Объявление не найдено." });
    }

    const [{ responseCount }] = await withResponseCounts([listing]);
    const obj = listing.toObject();
    obj.responseCount = responseCount;
    res.json({ listing: obj });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка сервера." });
  }
});

// ── POST /api/listings — создать ─────────────────────────────────────────
router.post("/", requireAuth, async (req, res) => {
  try {
    const { type, title, description, role, image } = req.body;

    if (!Listing.TYPES.includes(type))
      return res.status(400).json({ error: "Некорректный тип объявления." });
    if (!title || !title.trim() || !description || !description.trim())
      return res.status(400).json({ error: "Заполните заголовок и описание." });
    if (title.length > 100 || description.length > 2000)
      return res.status(400).json({ error: "Слишком длинный текст." });

    if (containsProfanity(title) || containsProfanity(description) || containsProfanity(role || "")) {
      return res.status(400).json({ error: "Текст содержит недопустимые слова, поправьте формулировку." });
    }

    let teamId = null;
    if (TEAM_TYPES.includes(type)) {
      if (!req.user.teamId)
        return res.status(400).json({ error: "Для этого типа объявления нужна команда." });
      const team = await Team.findById(req.user.teamId);
      if (!isTeamLead(team, req.user._id))
        return res.status(403).json({ error: "Публиковать объявления от команды может только капитан или менеджер." });
      teamId = team._id;
    }

    const listing = await Listing.create({
      authorId:    req.user._id,
      teamId,
      type,
      title:       title.trim(),
      description: description.trim(),
      role:        (role || "").trim(),
      image:       image && image.url ? { url: image.url, publicId: image.publicId || "" } : { url: "", publicId: "" },
    });

    res.json({ ok: true, listing });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка сервера." });
  }
});

// ── PATCH /api/listings/:id — редактирование (только автор) ─────────────
router.patch("/:id", requireAuth, async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) return res.status(404).json({ error: "Объявление не найдено." });
    if (listing.authorId.toString() !== req.user._id.toString())
      return res.status(403).json({ error: "Можно редактировать только своё объявление." });

    const { title, description, role, image, active } = req.body;

    if (title !== undefined) {
      if (!title.trim() || title.length > 100) return res.status(400).json({ error: "Некорректный заголовок." });
      if (containsProfanity(title)) return res.status(400).json({ error: "Заголовок содержит недопустимые слова." });
      listing.title = title.trim();
    }
    if (description !== undefined) {
      if (!description.trim() || description.length > 2000) return res.status(400).json({ error: "Некорректное описание." });
      if (containsProfanity(description)) return res.status(400).json({ error: "Описание содержит недопустимые слова." });
      listing.description = description.trim();
    }
    if (role !== undefined) {
      if (containsProfanity(role)) return res.status(400).json({ error: "Недопустимые слова в поле роли." });
      listing.role = role.trim();
    }
    if (image !== undefined) {
      // Если картинку заменили/убрали — подчищаем старую в Cloudinary
      if (listing.image.publicId && listing.image.publicId !== (image?.publicId || "")) {
        destroyCloudinaryAsset(listing.image.publicId);
      }
      listing.image = image && image.url ? { url: image.url, publicId: image.publicId || "" } : { url: "", publicId: "" };
    }
    if (active !== undefined) listing.active = !!active;

    await listing.save();
    res.json({ ok: true, listing });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка сервера." });
  }
});

// ── DELETE /api/listings/:id — автор или админ ───────────────────────────
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) return res.status(404).json({ error: "Объявление не найдено." });

    const isOwner = listing.authorId.toString() === req.user._id.toString();
    const isAdmin = isAdminUser(req.user);
    if (!isOwner && !isAdmin) return res.status(403).json({ error: "Нет доступа." });

    if (listing.image.publicId) destroyCloudinaryAsset(listing.image.publicId);
    await ListingResponse.deleteMany({ listingId: listing._id });
    await listing.deleteOne();

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка сервера." });
  }
});

// ── PATCH /api/listings/:id/admin-hide — модерация постфактум ───────────
router.patch("/:id/admin-hide", requireAuth, async (req, res) => {
  try {
    if (!isAdminUser(req.user)) return res.status(403).json({ error: "Нет доступа." });
    const listing = await Listing.findById(req.params.id);
    if (!listing) return res.status(404).json({ error: "Объявление не найдено." });

    listing.hiddenByAdmin = req.body.hidden !== undefined ? !!req.body.hidden : !listing.hiddenByAdmin;
    await listing.save();
    res.json({ ok: true, hiddenByAdmin: listing.hiddenByAdmin });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка сервера." });
  }
});

// ── POST /api/listings/:id/responses — приватный отклик автору ──────────
router.post("/:id/responses", requireAuth, async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing || !listing.active || listing.hiddenByAdmin)
      return res.status(404).json({ error: "Объявление не найдено." });
    if (listing.authorId.toString() === req.user._id.toString())
      return res.status(400).json({ error: "Нельзя откликнуться на своё же объявление." });

    const { message } = req.body;
    if (!message || !message.trim()) return res.status(400).json({ error: "Напишите сообщение." });
    if (message.length > 500) return res.status(400).json({ error: "Слишком длинное сообщение." });
    if (containsProfanity(message)) return res.status(400).json({ error: "Сообщение содержит недопустимые слова." });

    const contacts = {
      discordUsername:  req.user.discordUsername  || "",
      telegramUsername: req.user.telegramUsername || "",
    };
    if (!contacts.discordUsername && !contacts.telegramUsername) {
      return res.status(400).json({ error: "Укажите Discord или Telegram в профиле, чтобы автор мог с вами связаться." });
    }

    // upsert: повторный отклик того же юзера обновляет сообщение и «поднимает» его
    // заново как непрочитанный, а не плодит дубликаты
    const response = await ListingResponse.findOneAndUpdate(
      { listingId: listing._id, fromUserId: req.user._id },
      { message: message.trim(), contacts, read: false },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json({ ok: true, response });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка сервера." });
  }
});

// ── GET /api/listings/:id/responses — список откликов (только автор) ────
router.get("/:id/responses", requireAuth, async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) return res.status(404).json({ error: "Объявление не найдено." });
    if (listing.authorId.toString() !== req.user._id.toString())
      return res.status(403).json({ error: "Отклики видны только автору объявления." });

    const responses = await ListingResponse.find({ listingId: listing._id })
      .sort({ createdAt: -1 })
      .populate("fromUserId", "displayName avatar");

    await ListingResponse.updateMany(
      { listingId: listing._id, read: false },
      { $set: { read: true } }
    );

    res.json({ responses });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка сервера." });
  }
});

module.exports = router;