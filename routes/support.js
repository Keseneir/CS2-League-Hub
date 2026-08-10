const express         = require("express");
const router          = express.Router();
const SupportThread   = require("../models/SupportThread");
const SupportMessage  = require("../models/SupportMessage");
const { sendTelegramMessage } = require("../utils/telegramSupport");

// ─── GET /api/support/thread/:guestId ─── история переписки гостя ─────────
router.get("/thread/:guestId", async (req, res) => {
  try {
    const thread = await SupportThread.findOne({ guestId: req.params.guestId }).lean();
    if (!thread) return res.json({ thread: null, messages: [] });

    const messages = await SupportMessage.find({ threadId: thread._id })
      .sort({ createdAt: 1 })
      .select("from text createdAt")
      .lean();

    res.json({ thread: { guestName: thread.guestName, isResolved: thread.isResolved }, messages });
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

    if (!guestId) return res.status(400).json({ error: "Некорректная сессия чата" });
    if (!text)    return res.status(400).json({ error: "Введите сообщение" });
    if (text.length > 2000) return res.status(400).json({ error: "Слишком длинное сообщение" });

    let thread = await SupportThread.findOne({ guestId });
    if (!thread) {
      thread = await SupportThread.create({ guestId, guestName: guestName || "Гость" });
    } else if (guestName && thread.guestName === "Гость") {
      thread.guestName = guestName;
    }

    const message = await SupportMessage.create({ threadId: thread._id, from: "guest", text });

    // Отвечаем в Telegram цепочкой (reply на предыдущее сообщение этого же
    // треда, если оно есть) — так все сообщения одного гостя визуально
    // группируются в Telegram, даже если гостей пишет одновременно много.
    const lastTgId = thread.telegramMessageIds[thread.telegramMessageIds.length - 1];
    const tgText = `💬 ${thread.guestName} (#${thread._id.toString().slice(-6)})\n\n${text}`;
    const sentId = await sendTelegramMessage(tgText, lastTgId);
    if (sentId) thread.telegramMessageIds.push(sentId);

    thread.lastMessageAt = new Date();
    thread.isResolved = false;
    await thread.save();

    res.json({ ok: true, message: { from: message.from, text: message.text, createdAt: message.createdAt } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// ─── POST /api/support/telegram-webhook ─── входящее от Telegram ──────────
// Telegram сам стучится сюда, когда админ отвечает боту. Нужен ТОЛЬКО
// вебхук — никакого постоянно живого процесса, это отличие от Discord-бота.
router.post("/telegram-webhook", async (req, res) => {
  // Telegram ждёт быстрый 200 независимо от результата обработки
  res.sendStatus(200);

  try {
    if (process.env.TELEGRAM_WEBHOOK_SECRET) {
      const headerSecret = req.get("X-Telegram-Bot-Api-Secret-Token");
      if (headerSecret !== process.env.TELEGRAM_WEBHOOK_SECRET) return;
    }

    const msg = req.body?.message;
    if (!msg || !msg.text) return;
    if (String(msg.chat?.id) !== String(process.env.TELEGRAM_SUPPORT_CHAT_ID)) return; // не наш чат — игнор

    const replyToId = msg.reply_to_message?.message_id;
    if (!replyToId) return; // отвечать нужно строго через "Ответить" на сообщение конкретного треда

    const thread = await SupportThread.findOne({ telegramMessageIds: replyToId });
    if (!thread) return;

    await SupportMessage.create({ threadId: thread._id, from: "admin", text: msg.text });
    thread.telegramMessageIds.push(msg.message_id);
    thread.lastMessageAt = new Date();
    await thread.save();
  } catch (err) {
    console.error("Telegram webhook handling error:", err.message);
  }
});

module.exports = router;