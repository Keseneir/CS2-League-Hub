const express         = require("express");
const router          = express.Router();
const SupportGuest    = require("../models/SupportGuest");
const SupportThread   = require("../models/SupportThread");
const SupportMessage  = require("../models/SupportMessage");
const { sendTelegramMessage }     = require("../utils/telegramSupport");
const { destroyCloudinaryAsset }  = require("../utils/cloudinaryCleanup");

const RATE_LIMIT_MS       = 3000;       // не чаще одного сообщения раз в 3 секунды
const ATTACHMENT_TTL_MS   = 30 * 60 * 1000; // вложения живут 30 минут

// ─── Ленивая очистка просроченных вложений ─────────────────────────────────
// Без Vercel Cron (на бесплатном тарифе он сильно ограничен) — вместо этого
// проверяем и подчищаем протухшие вложения при каждом обращении к треду.
// Не идеально точно по времени, но для "пары десятков минут" более чем ок.
async function expireOldAttachments() {
  try {
    const expired = await SupportMessage.find({
      attachmentUrl: { $ne: "" },
      attachmentExpiresAt: { $lt: new Date() },
    }).select("_id attachmentPublicId").lean();

    for (const m of expired) {
      if (m.attachmentPublicId) await destroyCloudinaryAsset(m.attachmentPublicId);
      await SupportMessage.updateOne(
        { _id: m._id },
        { $set: { attachmentUrl: "", attachmentPublicId: "", attachmentExpiresAt: null } }
      );
    }
  } catch (err) {
    console.error("expireOldAttachments error:", err.message);
  }
}

// Короткий человекочитаемый номер тикета — последние 6 символов ObjectId,
// используется и в UI, и в тексте Telegram-сообщений.
function ticketNumber(id) {
  return id.toString().slice(-6);
}

// ─── GET /api/support/tickets/:guestId ─── список тикетов гостя ───────────
router.get("/tickets/:guestId", async (req, res) => {
  try {
    const guest = await SupportGuest.findOne({ guestId: req.params.guestId }).lean();
    if (!guest) return res.json({ guest: null, tickets: [] });

    const threads = await SupportThread.find({ guestId: req.params.guestId })
      .sort({ updatedAt: -1 })
      .select("subject status lastMessageAt createdAt")
      .lean();

    const tickets = threads.map(t => ({
      id: t._id,
      number: ticketNumber(t._id),
      subject: t.subject,
      status: t.status,
      lastMessageAt: t.lastMessageAt,
      createdAt: t.createdAt,
    }));

    res.json({ guest: { isBlocked: guest.isBlocked }, tickets });
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// ─── POST /api/support/ticket ─── создать новый тикет ─────────────────────
router.post("/ticket", async (req, res) => {
  try {
    const guestId     = String(req.body.guestId || "").trim();
    const subject     = String(req.body.subject || "").trim().slice(0, 120);
    const guestName   = String(req.body.guestName || "").trim().slice(0, 60);
    const guestAvatar = String(req.body.guestAvatar || "").trim();

    if (!guestId) return res.status(400).json({ error: "Некорректная сессия чата" });
    if (!subject) return res.status(400).json({ error: "Укажите тему обращения" });

    let guest = await SupportGuest.findOne({ guestId });
    if (guest && guest.isBlocked) {
      return res.status(403).json({ error: "Чат временно недоступен" });
    }

    if (!guest) {
      guest = await SupportGuest.create({
        guestId, guestName: guestName || "Гость", guestAvatar: guestAvatar || "",
      });
    } else {
      if (guestName)   guest.guestName   = guestName;
      if (guestAvatar) guest.guestAvatar = guestAvatar;
      await guest.save();
    }

    const thread = await SupportThread.create({ guestId, subject });

    res.json({
      ok: true,
      ticket: { id: thread._id, number: ticketNumber(thread._id), subject: thread.subject, status: thread.status },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// ─── GET /api/support/thread/:ticketId ─── история переписки по тикету ────
router.get("/thread/:ticketId", async (req, res) => {
  try {
    await expireOldAttachments();

    const thread = await SupportThread.findById(req.params.ticketId).lean();
    if (!thread) return res.status(404).json({ error: "Тикет не найден" });

    const messages = await SupportMessage.find({ threadId: thread._id })
      .sort({ createdAt: 1 })
      .select("from text authorName authorAvatar attachmentUrl createdAt")
      .lean();

    res.json({
      thread: {
        id: thread._id,
        number: ticketNumber(thread._id),
        subject: thread.subject,
        status: thread.status,
      },
      messages,
    });
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// ─── POST /api/support/message ─── гость отправляет сообщение в тикет ─────
router.post("/message", async (req, res) => {
  try {
    const ticketId    = String(req.body.ticketId || "").trim();
    const guestId     = String(req.body.guestId || "").trim();
    const text        = String(req.body.text || "").trim();
    const guestName   = String(req.body.guestName || "").trim().slice(0, 60);
    const guestAvatar = String(req.body.guestAvatar || "").trim();
    const attachmentUrl      = String(req.body.attachmentUrl || "").trim();
    const attachmentPublicId = String(req.body.attachmentPublicId || "").trim();

    if (!guestId)  return res.status(400).json({ error: "Некорректная сессия чата" });
    if (!ticketId) return res.status(400).json({ error: "Не указан тикет" });
    if (!text && !attachmentUrl) return res.status(400).json({ error: "Введите сообщение" });
    if (text.length > 2000) return res.status(400).json({ error: "Слишком длинное сообщение" });

    const guest = await SupportGuest.findOne({ guestId });
    if (guest && guest.isBlocked) {
      return res.status(403).json({ error: "Чат временно недоступен" });
    }

    const thread = await SupportThread.findOne({ _id: ticketId, guestId });
    if (!thread) return res.status(404).json({ error: "Тикет не найден" });
    if (thread.status === "resolved") {
      return res.status(409).json({ error: "Тикет закрыт. Создайте новый." });
    }

    // Рейт-лимит: не чаще одного сообщения раз в RATE_LIMIT_MS (на весь гостевой аккаунт)
    if (thread.lastMessageAt && Date.now() - thread.lastMessageAt.getTime() < RATE_LIMIT_MS) {
      return res.status(429).json({ error: "Слишком часто. Подождите пару секунд." });
    }

    if (guest && (guestName || guestAvatar)) {
      if (guestName)   guest.guestName   = guestName;
      if (guestAvatar) guest.guestAvatar = guestAvatar;
      await guest.save();
    }
    const authorName   = guest?.guestName   || guestName   || "Гость";
    const authorAvatar = guest?.guestAvatar || guestAvatar || "";

    const message = await SupportMessage.create({
      threadId: thread._id,
      from: "guest",
      text: text || "📎 Вложение",
      authorName,
      authorAvatar,
      attachmentUrl,
      attachmentPublicId,
      attachmentExpiresAt: attachmentUrl ? new Date(Date.now() + ATTACHMENT_TTL_MS) : null,
    });

    // Отвечаем в Telegram цепочкой (reply на предыдущее сообщение этого же
    // тикета, если оно есть) — так все сообщения одного тикета визуально
    // группируются в Telegram, даже если тикетов и гостей одновременно много.
    const lastTgId = thread.telegramMessageIds[thread.telegramMessageIds.length - 1];
    let tgText = `💬 ${authorName} — тикет #${ticketNumber(thread._id)} «${thread.subject}»\n\n${text}`;
    if (attachmentUrl) tgText += `\n\n📎 Вложение (ссылка активна ~30 мин): ${attachmentUrl}`;
    const sentId = await sendTelegramMessage(tgText, lastTgId);
    if (sentId) thread.telegramMessageIds.push(sentId);

    thread.lastMessageAt = new Date();
    await thread.save();

    res.json({
      ok: true,
      message: {
        from: message.from, text: message.text, authorName: message.authorName,
        authorAvatar: message.authorAvatar, attachmentUrl: message.attachmentUrl, createdAt: message.createdAt,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// ─── POST /api/support/ticket/:ticketId/resolve ─── гость закрывает тикет ─
router.post("/ticket/:ticketId/resolve", async (req, res) => {
  try {
    const guestId = String(req.body.guestId || "").trim();
    if (!guestId) return res.status(400).json({ error: "Некорректная сессия чата" });

    const thread = await SupportThread.findOne({ _id: req.params.ticketId, guestId });
    if (!thread) return res.status(404).json({ error: "Тикет не найден" });

    thread.status = "resolved";
    await thread.save();
    await sendTelegramMessage(`✅ Гость пометил тикет #${ticketNumber(thread._id)} «${thread.subject}» как решённый.`);

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// ─── POST /api/support/telegram-webhook ─── входящее от Telegram ──────────
// Telegram сам стучится сюда, когда админ отвечает боту. Нужен ТОЛЬКО
// вебхук — никакого постоянно живого процесса, это отличие от Discord-бота.
//
// ВАЖНО: на Vercel serverless функция может "заморозиться" сразу после
// отправки ответа — поэтому вся обработка идёт ДО res.sendStatus(200).
router.post("/telegram-webhook", async (req, res) => {
  try {
    if (process.env.TELEGRAM_WEBHOOK_SECRET) {
      const headerSecret = req.get("X-Telegram-Bot-Api-Secret-Token");
      if (headerSecret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
        console.log("Telegram webhook: secret token mismatch, ignoring.");
        return res.sendStatus(200);
      }
    }

    const msg = req.body?.message;
    if (!msg || !msg.text) {
      console.log("Telegram webhook: no message/text in payload, ignoring.");
      return res.sendStatus(200);
    }
    if (String(msg.chat?.id) !== String(process.env.TELEGRAM_SUPPORT_CHAT_ID)) {
      console.log(`Telegram webhook: chat_id mismatch (got ${msg.chat?.id}, expected ${process.env.TELEGRAM_SUPPORT_CHAT_ID}), ignoring.`);
      return res.sendStatus(200);
    }

    const replyToId = msg.reply_to_message?.message_id;
    if (!replyToId) {
      console.log("Telegram webhook: message is not a reply, ignoring (admin must use 'Reply' on the guest's message).");
      return res.sendStatus(200);
    }

    const thread = await SupportThread.findOne({ telegramMessageIds: replyToId });
    if (!thread) {
      console.log(`Telegram webhook: no thread found for telegramMessageId=${replyToId}, ignoring.`);
      return res.sendStatus(200);
    }

    // Служебные команды: админ отвечает "/block", "/unblock" или "/resolve"
    // на сообщение гостя вместо обычного текстового ответа. Это НЕ создаёт
    // SupportMessage — гость не должен видеть служебные команды в чате.
    // /block и /unblock действуют на ГОСТЯ целиком (все его тикеты), не только на этот тикет.
    const command = /^\/(block|unblock|resolve)\s*$/i.exec(msg.text.trim())?.[1]?.toLowerCase();
    if (command) {
      let confirmText;
      if (command === "block" || command === "unblock") {
        const isBlocked = command === "block";
        await SupportGuest.updateOne({ guestId: thread.guestId }, { $set: { isBlocked } }, { upsert: true });
        confirmText = isBlocked
          ? `🚫 Гость заблокирован (все тикеты).`
          : `✅ Гость разблокирован.`;
      } else {
        thread.status = "resolved";
        await thread.save();
        confirmText = `✅ Тикет #${ticketNumber(thread._id)} «${thread.subject}» помечен решённым.`;
      }
      await sendTelegramMessage(confirmText, msg.message_id);
      console.log(`Telegram webhook: command /${command} applied (thread ${thread._id}, guest ${thread.guestId})`);
      return res.sendStatus(200);
    }

    // Имя админа: предпочитаем first_name (то, что видно в Telegram), можно
    // добавить username в скобках, если есть — для различения нескольких админов
    const adminName = msg.from?.username
      ? `${msg.from.first_name || "Админ"} (@${msg.from.username})`
      : (msg.from?.first_name || "Администрация");

    await SupportMessage.create({ threadId: thread._id, from: "admin", text: msg.text, authorName: adminName });
    thread.telegramMessageIds.push(msg.message_id);
    thread.lastMessageAt = new Date();
    if (thread.status === "resolved") thread.status = "open"; // новый ответ админа — тикет снова открыт
    await thread.save();

    console.log(`Telegram webhook: admin reply saved to thread ${thread._id}`);
    res.sendStatus(200);
  } catch (err) {
    console.error("Telegram webhook handling error:", err.message);
    res.sendStatus(200); // Telegram всё равно ждёт 200, иначе начнёт ретраить
  }
});

module.exports = router;