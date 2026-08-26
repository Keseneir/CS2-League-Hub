const ACCENT_COLOR = 0xE6B022; // var(--accent) в десятичном виде для Discord embed
const DESC_LIMIT    = 4090;    // реальный лимит Discord на embed.description — 4096, оставляем крошечный запас под "…"

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

// Именованные каналы — те же переменные окружения, что и раньше, но теперь
// с человекочитаемым названием и ключом, чтобы конструктор в админке мог
// предложить их списком, не раскрывая сами webhook URL на клиент.
const CHANNELS = {
  news:     { label: "Общий (новости)", env: "DISCORD_WEBHOOK_NEWS" },
  results:  { label: "Результаты",      env: "DISCORD_WEBHOOK_RESULTS" },
  announce: { label: "Анонсы",          env: "DISCORD_WEBHOOK_ANNOUNCE" },
  updates:  { label: "Обновления",      env: "DISCORD_WEBHOOK_UPDATES" },
};

function listConfiguredChannels() {
  return Object.entries(CHANNELS)
    .filter(([, c]) => !!process.env[c.env])
    .map(([key, c]) => ({ key, label: c.label }));
}

/**
 * Отправляет готовый набор embed'ов (до 10 штук — лимит Discord на сообщение)
 * в конкретный именованный канал. В отличие от postNewsToDiscord, бросает
 * исключение наружу — вызывающая сторона (ручная отправка из конструктора)
 * должна показать админу, что именно пошло не так.
 */
async function sendEmbedsToChannel(channelKey, embeds) {
  const chan = CHANNELS[channelKey];
  if (!chan) throw new Error("Неизвестный канал");
  const url = process.env[chan.env];
  if (!url) throw new Error(`Webhook для канала «${chan.label}» не настроен`);

  const res = await fetch(url, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ embeds }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Discord вернул ${res.status}: ${text || "без деталей"}`);
  }
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
  if (!webhookUrls.length) {
    console.log("Discord webhook: no URL configured for tag \"" + (news.tag || "") + "\", skipping.");
    return;
  }
  console.log(`Discord webhook: sending "${news.title}" to ${webhookUrls.length} channel(s)`);

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
        if (!res.ok) console.error("Discord webhook error:", res.status, await res.text().catch(() => ""));
        else console.log("Discord webhook: delivered OK");
      })
    )
  );
  results.forEach(r => { if (r.status === "rejected") console.error("Discord webhook request failed:", r.reason?.message); });
}

module.exports = { postNewsToDiscord, listConfiguredChannels, sendEmbedsToChannel };