const ACCENT_COLOR = 0xE6B022; // var(--accent) в десятичном виде для Discord embed
const DESC_LIMIT    = 1900;    // с запасом от лимита Discord (4096), не превращаем embed в простыню текста

// Общий канал ("firehose") получает КАЖДУЮ новость, независимо от тега.
// Тематические каналы получают её ДОПОЛНИТЕЛЬНО, если тег совпал.
// Если переменная окружения для канала не задана — просто пропускаем его.
const TAG_WEBHOOK_MAP = {
  "Результаты": process.env.DISCORD_WEBHOOK_RESULTS,
  "Анонс":      process.env.DISCORD_WEBHOOK_ANNOUNCE,
  "Обновление": process.env.DISCORD_WEBHOOK_UPDATES,
};

function resolveWebhookUrls(tag) {
  const urls = new Set();
  if (process.env.DISCORD_WEBHOOK_NEWS) urls.add(process.env.DISCORD_WEBHOOK_NEWS);
  const specific = TAG_WEBHOOK_MAP[tag];
  if (specific) urls.add(specific);
  return [...urls];
}

function truncate(str, max) {
  if (!str) return "";
  return str.length > max ? str.slice(0, max - 1).trimEnd() + "…" : str;
}

/**
 * Отправляет новость во все подходящие Discord-каналы (общий + тематический
 * по тегу, если для него задан webhook). Не бросает исключений наружу — если
 * ни один webhook не настроен или Discord недоступен, публикация на сайте
 * всё равно должна пройти.
 */
async function postNewsToDiscord(news) {
  const webhookUrls = resolveWebhookUrls(news.tag);
  if (!webhookUrls.length) return;

  const siteUrl = news.link || `${process.env.DOMAIN || ""}/news.html`;

  const embed = {
    title:       truncate(news.title, 256),
    description: truncate(news.text, DESC_LIMIT),
    url:         siteUrl || undefined,
    color:       ACCENT_COLOR,
    footer:      { text: news.tag || "Новость" },
    timestamp:   new Date(news.publishedAt || Date.now()).toISOString(),
  };
  if (news.img) embed.image = { url: news.img };

  const results = await Promise.allSettled(
    webhookUrls.map(url =>
      fetch(url, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ embeds: [embed] }),
      }).then(async res => {
        if (!res.ok) console.error("Discord webhook error:", url, res.status, await res.text().catch(() => ""));
      })
    )
  );
  results.forEach(r => { if (r.status === "rejected") console.error("Discord webhook request failed:", r.reason?.message); });
}

module.exports = { postNewsToDiscord };