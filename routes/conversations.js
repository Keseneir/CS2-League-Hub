const express = require("express");
const router  = express.Router();
const Conversation = require("../models/Conversation");
const Message      = require("../models/Message");
const Listing      = require("../models/Listing");
const User         = require("../models/User");
const { requireAuth }        = require("../middleware/auth");
const { containsProfanity }  = require("../utils/profanityFilter");
const { validateChatText, isObjectIdString } = require("../utils/listingValidation");
const { participantRole, readFieldFor, isUnreadFor, makePreview, MAX_MESSAGE_LENGTH } = require("../utils/chatAccess");

const HISTORY_LIMIT  = 100;    // последние N сообщений при открытии чата
const POLL_LIMIT     = 100;
const RATE_WINDOW_MS = 10000;  // не более RATE_MAX сообщений за окно (считается по БД: работает и на serverless)
const RATE_MAX       = 5;
const DELETED_NAME   = "Удалённый пользователь";
const NOT_FOUND      = { error: "Диалог не найден." };

// В логи не пишем объекты ошибок целиком: в сообщениях mongoose бывают значения полей (тексты сообщений).
function logErr(tag, err) { console.error(tag, err && err.name, err && err.code); }

router.use(requireAuth);
router.use((req, res, next) => {
  res.set("Cache-Control", "no-store"); // приватные данные
  // Проверка блокировки только для чата; глобальная политика banned в проекте не вводится.
  if (req.user && req.user.banned) return res.status(403).json({ error: "Доступ к сообщениям ограничен." });
  next();
});

// Доступ определяется ТОЛЬКО по документу диалога из БД и id из сессии.
// Чужой/несуществующий/некорректный id → одинаковый 404 (не раскрываем существование диалога).
async function loadParticipantConversation(req, res) {
  if (!isObjectIdString(req.params.id)) { res.status(404).json(NOT_FOUND); return null; }
  const conv = await Conversation.findById(req.params.id);
  const role = conv ? participantRole(conv, req.user._id) : null;
  if (!conv || !role) { res.status(404).json(NOT_FOUND); return null; }
  return { conv, role };
}

function otherUserId(conv, role) { return role === "author" ? conv.responderId : conv.authorId; }

function publicUser(u) { return u ? { displayName: u.displayName || DELETED_NAME, avatar: u.avatar || "" } : { displayName: DELETED_NAME, avatar: "" }; }

function formatMessage(m, meId, nameById) {
  const isMine = String(m.senderId) === String(meId);
  const u = nameById.get(String(m.senderId));
  return { _id: m._id, text: m.text, createdAt: m.createdAt, isMine, senderName: u ? (u.displayName || DELETED_NAME) : DELETED_NAME };
}

// ── GET /api/conversations — мои диалоги ────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const me = req.user._id;
    const convs = await Conversation.find({ $or: [{ authorId: me }, { responderId: me }] })
      .sort({ lastMessageAt: -1 }).limit(100).lean();

    const listingIds = [...new Set(convs.map(c => String(c.listingId)))];
    const userIds    = [...new Set(convs.flatMap(c => [String(c.authorId), String(c.responderId)]))];
    const [listings, users] = await Promise.all([
      Listing.find({ _id: { $in: listingIds } }).select("title type").lean(),
      User.find({ _id: { $in: userIds } }).select("displayName avatar").lean(),
    ]);
    const lMap = new Map(listings.map(l => [String(l._id), l]));
    const uMap = new Map(users.map(u => [String(u._id), u]));

    res.json({
      conversations: convs.map(c => {
        const role  = participantRole(c, me);
        const other = uMap.get(String(otherUserId(c, role)));
        const l     = lMap.get(String(c.listingId));
        return {
          _id: c._id,
          listing: l ? { _id: l._id, title: l.title, type: l.type } : null,
          other: publicUser(other),
          otherDeleted: !other,
          lastMessage: {
            text: c.lastMessagePreview || "",
            at: c.lastMessageAt,
            isMine: !!c.lastMessageSenderId && String(c.lastMessageSenderId) === String(me),
          },
          unread: isUnreadFor(c, me),
        };
      }),
    });
  } catch (err) {
    logErr("conversations list failed", err);
    res.status(500).json({ error: "Ошибка сервера." });
  }
});

// ── GET /api/conversations/:id/messages[?after=ISO] ─────────────────────
// Без after — последние HISTORY_LIMIT сообщений + данные диалога.
// С after — сообщения новее указанного времени (клиент берёт запас по времени и дедуплицирует по _id).
router.get("/:id/messages", async (req, res) => {
  try {
    const ctx = await loadParticipantConversation(req, res);
    if (!ctx) return;
    const { conv, role } = ctx;

    const after = req.query.after;
    let afterDate = null;
    if (after !== undefined) {
      afterDate = typeof after === "string" ? new Date(after) : null;
      if (!afterDate || isNaN(afterDate.getTime())) return res.status(400).json({ error: "Некорректный параметр after." });
    }

    const users = await User.find({ _id: { $in: [conv.authorId, conv.responderId] } }).select("displayName avatar").lean();
    const uMap  = new Map(users.map(u => [String(u._id), u]));

    let msgs;
    if (afterDate) {
      msgs = await Message.find({ conversationId: conv._id, createdAt: { $gt: afterDate } })
        .sort({ createdAt: 1, _id: 1 }).limit(POLL_LIMIT).lean();
    } else {
      msgs = (await Message.find({ conversationId: conv._id })
        .sort({ createdAt: -1, _id: -1 }).limit(HISTORY_LIMIT).lean()).reverse();
    }

    const out = { messages: msgs.map(m => formatMessage(m, req.user._id, uMap)), serverTime: new Date().toISOString() };
    if (!afterDate) {
      const listing = await Listing.findById(conv.listingId).select("title type").lean();
      const other   = uMap.get(String(otherUserId(conv, role)));
      out.conversation = {
        _id: conv._id,
        listing: listing ? { _id: listing._id, title: listing.title, type: listing.type } : null,
        other: publicUser(other),
        canSend: !!other,
        maxLength: MAX_MESSAGE_LENGTH,
      };
    }
    res.json(out);
  } catch (err) {
    logErr("conversation messages failed", err);
    res.status(500).json({ error: "Ошибка сервера." });
  }
});

// ── POST /api/conversations/:id/messages — отправить сообщение ──────────
// Тело: { text }. Отправитель = req.user (из сессии); любые senderId/conversationId/listingId в теле игнорируются.
router.post("/:id/messages", async (req, res) => {
  try {
    const ctx = await loadParticipantConversation(req, res);
    if (!ctx) return;
    const { conv, role } = ctx;

    const v = validateChatText(req.body && req.body.text, MAX_MESSAGE_LENGTH);
    if (!v.ok) return res.status(400).json({ error: v.error });
    if (containsProfanity(v.text)) return res.status(400).json({ error: "Сообщение содержит недопустимые слова." });

    if (!(await User.exists({ _id: otherUserId(conv, role) }))) {
      return res.status(409).json({ error: "Собеседник удалён — отправка сообщений недоступна." });
    }

    const recent = await Message.countDocuments({ senderId: req.user._id, createdAt: { $gt: new Date(Date.now() - RATE_WINDOW_MS) } });
    if (recent >= RATE_MAX) return res.status(429).json({ error: "Слишком часто. Подождите несколько секунд." });

    const msg = await Message.create({ conversationId: conv._id, senderId: req.user._id, text: v.text });

    // Метаданные диалога обновляем только если это самое новое сообщение (защита от гонки двух запросов)
    await Conversation.updateOne(
      { _id: conv._id, lastMessageAt: { $lte: msg.createdAt } },
      { $set: { lastMessageAt: msg.createdAt, lastMessageSenderId: req.user._id, lastMessagePreview: makePreview(v.text) } }
    );

    res.json({
      ok: true,
      message: { _id: msg._id, text: msg.text, createdAt: msg.createdAt, isMine: true, senderName: req.user.displayName || "" },
    });
  } catch (err) {
    logErr("conversation send failed", err);
    res.status(500).json({ error: "Ошибка сервера." });
  }
});

// ── POST /api/conversations/:id/read — отметить прочитанным ДО указанного времени ──
// Тело: { upTo: ISO } — время последнего сообщения, которое клиент реально показал.
// Меняется только отметка вызывающего участника; будущее время обрезается по lastMessageAt.
router.post("/:id/read", async (req, res) => {
  try {
    const ctx = await loadParticipantConversation(req, res);
    if (!ctx) return;
    const { conv, role } = ctx;

    const upTo = req.body && req.body.upTo;
    const d = typeof upTo === "string" ? new Date(upTo) : null;
    if (!d || isNaN(d.getTime())) return res.status(400).json({ error: "Некорректный параметр upTo." });

    const last = new Date(conv.lastMessageAt);
    const clamped = d.getTime() > last.getTime() ? last : d;
    await Conversation.updateOne({ _id: conv._id }, { $max: { [readFieldFor(role)]: clamped } });
    res.json({ ok: true });
  } catch (err) {
    logErr("conversation read failed", err);
    res.status(500).json({ error: "Ошибка сервера." });
  }
});

module.exports = router;
