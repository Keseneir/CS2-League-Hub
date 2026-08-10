/**
 * Шлёт короткое уведомление в приватный админский канал Discord.
 * Не бросает исключений наружу — если DISCORD_WEBHOOK_ADMIN не задан
 * или Discord недоступен, основное действие (например, погашение промокода)
 * всё равно должно завершиться успешно для игрока.
 */
async function postAdminAlert(title, fields) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_ADMIN;
  if (!webhookUrl) {
    console.log("Discord admin alert: DISCORD_WEBHOOK_ADMIN not configured, skipping.");
    return;
  }
  try {
    const res = await fetch(webhookUrl, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [{
          title,
          color: 0xE6B022,
          fields: fields.map(f => ({ name: f.name, value: String(f.value), inline: f.inline !== false })),
          timestamp: new Date().toISOString(),
        }],
      }),
    });
    if (!res.ok) console.error("Discord admin alert error:", res.status, await res.text().catch(() => ""));
  } catch (err) {
    console.error("Discord admin alert request failed:", err.message);
  }
}

module.exports = { postAdminAlert };