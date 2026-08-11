const express         = require("express");
const router          = express.Router();
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

// ─── GET /api/support/thread/:guestId ─── история переписки гостя ─────────
router.get("/thread/:guestId", async (req, res) => {
  try {
    await expireOldAttachments();

    const thread = await SupportThread.findOne({ guestId: req.params.guestId }).lean();
    if (!thread) return res.json({ thread: null, messages: [] });

    const messages = await SupportMessage.find({ threadId: thread._id })
      .sort({ createdAt: 1 })
      .select("from text authorName authorAvatar attachmentUrl createdAt")
      .lean();

    const hasAdminReply = messages.some(m => m.from === "admin");

    res.json({
      thread: {
        guestName: thread.guestName,
        guestAvatar: thread.guestAvatar,
        isResolved: thread.isResolved,
        isBlocked: thread.isBlocked,
        hasAdminReply,
      },
      messages,
    });
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// ─── POST /api/support/message ─── гость отправляет сообщение ─────────────
router.post("/message", async (req, res) => {
  try {
    const guestId    = String(req.body.guestId || "").trim();
    const text       = String(req.body.text || "").trim();
    const guestName  = String(req.body.guestName || "").trim().slice(0, 60);
    const guestAvatar  = String(req.body.guestAvatar || "").trim();
    const attachmentUrl      = String(req.body.attachmentUrl || "").trim();
    const attachmentPublicId = String(req.body.attachmentPublicId || "").trim();

    if (!guestId) return res.status(400).json({ error: "Некорректная сессия чата" });
    if (!text && !attachmentUrl) return res.status(400).json({ error: "Введите сообщение" });
    if (text.length > 2000) return res.status(400).json({ error: "Слишком длинное сообщение" });

    let thread = await SupportThread.findOne({ guestId });

    if (thread && thread.isBlocked) {
      return res.status(403).json({ error: "Чат временно недоступен" });
    }

    // Рейт-лимит: не чаще одного сообщения раз в RATE_LIMIT_MS
    if (thread && thread.lastMessageAt && Date.now() - thread.lastMessageAt.getTime() < RATE_LIMIT_MS) {
      return res.status(429).json({ error: "Слишком часто. Подождите пару секунд." });
    }

    if (!thread) {
      thread = await SupportThread.create({
        guestId, guestName: guestName || "Гость", guestAvatar: guestAvatar || "",
      });
    } else {
      if (guestName)   thread.guestName   = guestName;
      if (guestAvatar) thread.guestAvatar = guestAvatar;
    }

    const message = await SupportMessage.create({
      threadId: thread._id,
      from: "guest",
      text: text || "📎 Вложение",
      authorName: thread.guestName,
      authorAvatar: thread.guestAvatar,
      attachmentUrl,
      attachmentPublicId,
      attachmentExpiresAt: attachmentUrl ? new Date(Date.now() + ATTACHMENT_TTL_MS) : null,
    });

    // Отвечаем в Telegram цепочкой (reply на предыдущее сообщение этого же
    // треда, если оно есть) — так все сообщения одного гостя визуально
    // группируются в Telegram, даже если гостей пишет одновременно много.
    const lastTgId = thread.telegramMessageIds[thread.telegramMessageIds.length - 1];
    let tgText = `💬 ${thread.guestName} (#${thread._id.toString().slice(-6)})\n\n${text}`;
    if (attachmentUrl) tgText += `\n\n📎 Вложение (ссылка активна ~30 мин): ${attachmentUrl}`;
    const sentId = await sendTelegramMessage(tgText, lastTgId);
    if (sentId) thread.telegramMessageIds.push(sentId);

    thread.lastMessageAt = new Date();
    thread.isResolved = false;
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
    const command = /^\/(block|unblock|resolve)\s*$/i.exec(msg.text.trim())?.[1]?.toLowerCase();
    if (command) {
      let confirmText;
      if (command === "block") {
        thread.isBlocked = true;
        confirmText = `🚫 Гость ${thread.guestName} заблокирован.`;
      } else if (command === "unblock") {
        thread.isBlocked = false;
        confirmText = `✅ Гость ${thread.guestName} разблокирован.`;
      } else {
        thread.isResolved = true;
        confirmText = `✅ Тред ${thread.guestName} помечен решённым.`;
      }
      await thread.save();
      await sendTelegramMessage(confirmText, msg.message_id);
      console.log(`Telegram webhook: command /${command} applied to thread ${thread._id}`);
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
    thread.isResolved = false; // новый ответ админа — тред снова "в диалоге", не решён
    await thread.save();

    console.log(`Telegram webhook: admin reply saved to thread ${thread._id}`);
    res.sendStatus(200);
  } catch (err) {
    console.error("Telegram webhook handling error:", err.message);
    res.sendStatus(200); // Telegram всё равно ждёт 200, иначе начнёт ретраить
  }
});

module.exports = router;