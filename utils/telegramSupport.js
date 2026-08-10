function botApiUrl(method) {
  return `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`;
}

/**
 * Отправляет сообщение в настроенный Telegram-чат поддержки.
 * Возвращает message_id отправленного сообщения (для последующей привязки
 * ответов админа через "Ответить" на это сообщение), либо null при ошибке.
 */
async function sendTelegramMessage(text, replyToMessageId) {
  const token  = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_SUPPORT_CHAT_ID;
  if (!token || !chatId) {
    console.log("Telegram support: TELEGRAM_BOT_TOKEN / TELEGRAM_SUPPORT_CHAT_ID not configured, skipping.");
    return null;
  }
  try {
    const body = { chat_id: chatId, text };
    if (replyToMessageId) body.reply_to_message_id = replyToMessageId;

    const res  = await fetch(botApiUrl("sendMessage"), {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(body),
    });
    const data = await res.json();
    if (!data.ok) {
      console.error("Telegram sendMessage error:", data.description);
      return null;
    }
    return data.result.message_id;
  } catch (err) {
    console.error("Telegram sendMessage request failed:", err.message);
    return null;
  }
}

module.exports = { sendTelegramMessage };