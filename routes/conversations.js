const express = require("express");
const router  = express.Router();
const Conversation = require("../models/Conversation");
const Message      = require("../models/Message");
const Listing      = require("../models/Listing");
const User         = require("../models/User");
const { requireAuth }        = require("../middleware/auth");
const { containsProfanity }  = require("../utils/profanityFilter");
const { validateChatText, isObjectIdString } = require("../utils/listingValidation");
const {
  participantRole, readFieldFor, muteFieldFor, isMutedFor, isUnreadFor, makePreview, hasBlocked, messageView,
  MAX_MESSAGE_LENGTH, MAX_BLOCKED, DELETED_PREVIEW,
} = require("../utils/chatAccess");

const HISTORY_LIMIT  = 100;    // последние N сообщений при открытии чата
const POLL_LIMIT     = 100;
const RATE_WINDOW_MS = 10000;  // не более RATE_MAX сообщений за окно (считается по БД: работает и на serverless)
const RATE_MAX       = 5;
const DELETED_NAME   = "Удалённый пользователь";
const NOT_FOUND      = { error: "Диалог не найден." };
const MSG_NOT_FOUND  = { error: "Сообщение не найдено." };

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

// Публично-безопасные данные собеседника: имя, аватар и steamId (steamId — публичный идентификатор, по нему
// строится ссылка на уже существующий публичный профиль). Никаких контактов, чёрных списков и служебных полей.
function publicUser(u) {
  return u
    ? { displayName: u.displayName || DELETED_NAME, avatar: u.avatar || "", steamId: u.steamId || "" }
    : { displayName: DELETED_NAME, avatar: "", steamId: "" };
}

function parseOptionalDate(v) {
  if (v === undefined) return { ok: true, date: null };
  const d = typeof v === "string" ? new Date(v) : null;
  return d && !isNaN(d.getTime()) ? { ok: true, date: d } : { ok: false };
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
      User.find({ _id: { $in: userIds } }).select("displayName avatar steamId").lean(),
    ]);
    const lMap = new Map(listings.map(l => [String(l._id), l]));
    const uMap = new Map(users.map(u => [String(u._id), u]));

    res.json({
      conversations: convs.map(c => {
        const role    = participantRole(c, me);
        const otherId = otherUserId(c, role);
        const other   = uMap.get(String(otherId));
        const l       = lMap.get(String(c.listingId));
        return {
          _id: c._id,
          listing: l ? { _id: l._id, title: l.title, type: l.type } : null,
          other: publicUser(other),
          otherDeleted: !other,
          muted: isMutedFor(c, me),
          blockedByMe: hasBlocked(req.user, otherId),
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

// ── GET /api/conversations/:id/messages[?after=ISO[&changed=ISO]] ───────
// Без after — последние HISTORY_LIMIT сообщений + данные диалога (1 запрос пользователей, 1 — объявления).
// С after (опрос) — сообщения новее after; если с момента changed были правки/удаления (conv.lastChangeAt),
// дополнительно возвращаются изменённые сообщения. Запрос пользователей в опросе не выполняется.
router.get("/:id/messages", async (req, res) => {
  try {
    const ctx = await loadParticipantConversation(req, res);
    if (!ctx) return;
    const { conv, role } = ctx;
    const me = req.user._id;

    const a = parseOptionalDate(req.query.after), c = parseOptionalDate(req.query.changed);
    if (!a.ok) return res.status(400).json({ error: "Некорректный параметр after." });
    if (!c.ok) return res.status(400).json({ error: "Некорректный параметр changed." });

    if (a.date) {
      const clauses = [{ createdAt: { $gt: a.date } }];
      const changedAfter = c.date || new Date(0);
      if (conv.lastChangeAt && conv.lastChangeAt.getTime() > changedAfter.getTime()) {
        clauses.push({ editedAt: { $gt: changedAfter } }, { deletedAt: { $gt: changedAfter } });
      }
      const filter = clauses.length === 1 ? { conversationId: conv._id, ...clauses[0] } : { conversationId: conv._id, $or: clauses };
      const msgs = await Message.find(filter).sort({ createdAt: 1, _id: 1 }).limit(POLL_LIMIT).lean();
      return res.json({
        messages: msgs.map(m => messageView(m, me)),
        serverTime: new Date().toISOString(),
        lastChangeAt: conv.lastChangeAt || null,
      });
    }

    const users = await User.find({ _id: { $in: [conv.authorId, conv.responderId] } })
      .select("displayName avatar steamId blockedUsers").lean();
    const uMap = new Map(users.map(u => [String(u._id), u]));
    const msgs = (await Message.find({ conversationId: conv._id })
      .sort({ createdAt: -1, _id: -1 }).limit(HISTORY_LIMIT).lean()).reverse();
    const listing = await Listing.findById(conv.listingId).select("title type").lean();

    const otherId = otherUserId(conv, role);
    const other   = uMap.get(String(otherId));
    const blockedByMe = hasBlocked(req.user, otherId);
    const blockedMe   = !!other && hasBlocked(other, me);   // направление блокировки наружу не раскрывается

    res.json({
      messages: msgs.map(m => {
        const u = uMap.get(String(m.senderId));
        return messageView(m, me, u ? (u.displayName || DELETED_NAME) : DELETED_NAME);
      }),
      serverTime: new Date().toISOString(),
      lastChangeAt: conv.lastChangeAt || null,
      conversation: {
        _id: conv._id,
        listing: listing ? { _id: listing._id, title: listing.title, type: listing.type } : null,
        other: publicUser(other),
        otherDeleted: !other,
        canSend: !!other && !blockedByMe && !blockedMe,
        blockedByMe,
        muted: isMutedFor(conv, me),
        maxLength: MAX_MESSAGE_LENGTH,
      },
    });
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
    const otherId = otherUserId(conv, role);

    const v = validateChatText(req.body && req.body.text, MAX_MESSAGE_LENGTH);
    if (!v.ok) return res.status(400).json({ error: v.error });
    if (containsProfanity(v.text)) return res.status(400).json({ error: "Сообщение содержит недопустимые слова." });

    // Один запрос: существует ли собеседник и не заблокировал ли он нас (свой чёрный список уже в req.user)
    const other = await User.findById(otherId).select("blockedUsers").lean();
    if (!other) return res.status(409).json({ error: "Собеседник удалён — отправка сообщений недоступна." });
    if (hasBlocked(req.user, otherId)) return res.status(403).json({ error: "Вы заблокировали этого пользователя. Разблокируйте его, чтобы писать." });
    if (hasBlocked(other, req.user._id)) return res.status(403).json({ error: "Отправка сообщений в этот диалог недоступна." });

    const recent = await Message.countDocuments({ senderId: req.user._id, createdAt: { $gt: new Date(Date.now() - RATE_WINDOW_MS) } });
    if (recent >= RATE_MAX) return res.status(429).json({ error: "Слишком часто. Подождите несколько секунд." });

    const msg = await Message.create({ conversationId: conv._id, senderId: req.user._id, text: v.text });

    // Метаданные диалога обновляем только если это самое новое сообщение (защита от гонки двух запросов)
    await Conversation.updateOne(
      { _id: conv._id, lastMessageAt: { $lte: msg.createdAt } },
      { $set: { lastMessageAt: msg.createdAt, lastMessageSenderId: req.user._id, lastMessagePreview: makePreview(v.text) } }
    );

    res.json({ ok: true, message: messageView(msg, req.user._id, req.user.displayName || "") });
  } catch (err) {
    logErr("conversation send failed", err);
    res.status(500).json({ error: "Ошибка сервера." });
  }
});

// Общий поиск сообщения для правки/удаления. Чужое, несуществующее и из другого диалога сообщение — одинаковый 404.
async function loadOwnMessage(req, res, conv) {
  if (!isObjectIdString(req.params.mid)) { res.status(404).json(MSG_NOT_FOUND); return null; }
  const msg = await Message.findOne({ _id: req.params.mid, conversationId: conv._id })
    .select("senderId text createdAt editedAt deletedAt").lean();
  if (!msg || String(msg.senderId) !== String(req.user._id)) { res.status(404).json(MSG_NOT_FOUND); return null; }
  return msg;
}

// Обновление данных диалога после правки/удаления: время изменения + превью (только если это последнее сообщение)
async function afterMessageChange(conv, msg, me, now, previewText) {
  await Conversation.updateOne({ _id: conv._id }, { $max: { lastChangeAt: now } });
  await Conversation.updateOne(
    { _id: conv._id, lastMessageSenderId: me, lastMessageAt: msg.createdAt },
    { $set: { lastMessagePreview: previewText } }
  );
}

// ── PATCH /api/conversations/:id/messages/:mid — изменить своё сообщение ──
router.patch("/:id/messages/:mid", async (req, res) => {
  try {
    const ctx = await loadParticipantConversation(req, res);
    if (!ctx) return;
    const { conv, role } = ctx;
    const me = req.user._id;

    const v = validateChatText(req.body && req.body.text, MAX_MESSAGE_LENGTH);
    if (!v.ok) return res.status(400).json({ error: v.error });
    if (containsProfanity(v.text)) return res.status(400).json({ error: "Сообщение содержит недопустимые слова." });

    const msg = await loadOwnMessage(req, res, conv);
    if (!msg) return;
    if (msg.deletedAt) return res.status(409).json({ error: "Сообщение удалено." });

    // При блокировке (в любую сторону) правка запрещена: иначе заблокированный мог бы менять текст, который видит собеседник
    const otherId = otherUserId(conv, role);
    const other = await User.findById(otherId).select("blockedUsers").lean();
    if (hasBlocked(req.user, otherId) || (other && hasBlocked(other, me))) {
      return res.status(403).json({ error: "Редактирование недоступно: переписка ограничена." });
    }

    if (msg.text === v.text) return res.json({ ok: true, message: messageView(msg, me) });   // без изменений — без записи в БД

    const now = new Date();
    const upd = await Message.updateOne(
      { _id: msg._id, conversationId: conv._id, senderId: me, deletedAt: { $exists: false } },
      { $set: { text: v.text, editedAt: now } }
    );
    if (!upd.matchedCount) return res.status(409).json({ error: "Сообщение удалено." });
    await afterMessageChange(conv, msg, me, now, makePreview(v.text));

    res.json({ ok: true, message: messageView({ ...msg, text: v.text, editedAt: now }, me) });
  } catch (err) {
    logErr("message edit failed", err);
    res.status(500).json({ error: "Ошибка сервера." });
  }
});

// ── DELETE /api/conversations/:id/messages/:mid — удалить своё сообщение ──
// «Надгробие»: текст очищается, ставится deletedAt. Удаление допустимо всегда (в том числе при блокировке).
router.delete("/:id/messages/:mid", async (req, res) => {
  try {
    const ctx = await loadParticipantConversation(req, res);
    if (!ctx) return;
    const { conv } = ctx;
    const me = req.user._id;

    const msg = await loadOwnMessage(req, res, conv);
    if (!msg) return;
    if (msg.deletedAt) return res.json({ ok: true });                       // идемпотентно

    const now = new Date();
    const upd = await Message.updateOne(
      { _id: msg._id, conversationId: conv._id, senderId: me, deletedAt: { $exists: false } },
      { $set: { text: "", deletedAt: now }, $unset: { editedAt: "" } }
    );
    if (upd.matchedCount) await afterMessageChange(conv, msg, me, now, DELETED_PREVIEW);
    res.json({ ok: true });
  } catch (err) {
    logErr("message delete failed", err);
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

// ── POST /api/conversations/:id/mute — отключить/включить уведомления диалога ──
// Тело: { muted: boolean }. Состояние хранится в самом диалоге (одно необязательное булево поле на участника).
// Сообщения не удаляются, отправка/получение работают, отметки прочтения mute не меняет;
// диалог просто не входит в счётчик непрочитанных в шапке. Запись в БД — только при реальном изменении.
router.post("/:id/mute", async (req, res) => {
  try {
    const ctx = await loadParticipantConversation(req, res);
    if (!ctx) return;
    const { conv, role } = ctx;
    const muted = req.body && req.body.muted;
    if (typeof muted !== "boolean") return res.status(400).json({ error: "Некорректный параметр muted." });

    if (isMutedFor(conv, req.user._id) !== muted) {
      const field = muteFieldFor(role);
      await Conversation.updateOne({ _id: conv._id }, muted ? { $set: { [field]: true } } : { $unset: { [field]: "" } });
    }
    res.json({ ok: true, muted });
  } catch (err) {
    logErr("conversation mute failed", err);
    res.status(500).json({ error: "Ошибка сервера." });
  }
});

// ── POST /api/conversations/:id/block — заблокировать/разблокировать собеседника ──
// Тело: { blocked: boolean }. Кого блокируем, определяется ТОЛЬКО по диалогу (второй участник) — произвольные
// id из клиента не принимаются, заблокировать себя невозможно. Чёрный список — ограниченный массив в документе User.
router.post("/:id/block", async (req, res) => {
  try {
    const ctx = await loadParticipantConversation(req, res);
    if (!ctx) return;
    const { conv, role } = ctx;
    const blocked = req.body && req.body.blocked;
    if (typeof blocked !== "boolean") return res.status(400).json({ error: "Некорректный параметр blocked." });

    const targetId = otherUserId(conv, role);
    if (String(targetId) === String(req.user._id)) return res.status(400).json({ error: "Нельзя заблокировать себя." });

    const already = hasBlocked(req.user, targetId);
    if (blocked && !already) {
      const r = await User.updateOne(
        { _id: req.user._id, [`blockedUsers.${MAX_BLOCKED - 1}`]: { $exists: false } },   // лимит размера списка
        { $addToSet: { blockedUsers: targetId } }
      );
      if (!r.matchedCount) return res.status(409).json({ error: `Достигнут лимит чёрного списка (${MAX_BLOCKED}).` });
    } else if (!blocked && already) {
      await User.updateOne({ _id: req.user._id }, { $pull: { blockedUsers: targetId } });
    }
    res.json({ ok: true, blocked });
  } catch (err) {
    logErr("conversation block failed", err);
    res.status(500).json({ error: "Ошибка сервера." });
  }
});

module.exports = router;
