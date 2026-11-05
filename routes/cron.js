const express          = require("express");
const crypto           = require("crypto");
const User             = require("../models/User");
const { syncUserHours } = require("../services/steamHours");

const router = express.Router();

const MAX_USERS_PER_RUN  = 8;                       // не более 8 пользователей за запуск
const TIME_BUDGET_MS     = 7000;                    // лимит legacy-функции Vercel по умолчанию — 10 с
const SYNC_EVERY_MS      = 4  * 24 * 3600 * 1000;   // обновляем, если последний успех ≥ 4 дней назад
const RETRY_TECHNICAL_MS = 12 * 3600 * 1000;        // после технического сбоя пробуем снова не раньше чем через 12 ч
const RETRY_BLOCKED_MS   = 7  * 24 * 3600 * 1000;   // privacy / no_cs2: повтор раз в 7 дней (не занимать очередь)
const MIN_TIME_FOR_USER  = 1500;                    // не начинаем нового игрока, если осталось меньше

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Защита: Vercel Cron сам добавляет "Authorization: Bearer <CRON_SECRET>".
// Если CRON_SECRET не задан — доступ закрыт полностью (fail closed).
function isAuthorized(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given    = Buffer.from(req.get("authorization") || "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

// Кого можно взять в работу: последний успех ≥ 4 дней назад (или никогда) и прошла пауза после последней попытки.
function eligibleFilter(now) {
  const t = ms => new Date(now.getTime() - ms);
  return {
    banned: { $ne: true },
    $and: [
      { $or: [{ hoursSyncedAt: null }, { hoursSyncedAt: { $lte: t(SYNC_EVERY_MS) } }] },
      { $or: [
        { hoursSyncError: { $nin: ["privacy", "no_cs2"] },
          $or: [{ hoursSyncTriedAt: null }, { hoursSyncTriedAt: { $lte: t(RETRY_TECHNICAL_MS) } }] },
        { hoursSyncError: { $in: ["privacy", "no_cs2"] }, hoursSyncTriedAt: { $lte: t(RETRY_BLOCKED_MS) } },
      ] },
    ],
  };
}

// GET /api/cron/sync-steam-hours — вызывается Vercel Cron раз в сутки
router.get("/sync-steam-hours", async (req, res) => {
  if (!isAuthorized(req)) {
    if (!process.env.CRON_SECRET) console.error("cron: CRON_SECRET не задан — запрос отклонён");
    return res.status(401).json({ error: "Unauthorized" });
  }

  const startedAt = Date.now();
  const deadline  = startedAt + TIME_BUDGET_MS;
  const summary   = { processed: 0, ok: 0, privacy: 0, no_cs2: 0, technical: 0, stopped: null };

  try {
    while (summary.processed < MAX_USERS_PER_RUN) {
      if (deadline - Date.now() < MIN_TIME_FOR_USER) { summary.stopped = "time"; break; }

      // Атомарно «занимаем» пользователя: сразу ставим hoursSyncTriedAt, поэтому параллельный
      // или повторный запуск тот же фильтр уже не пропустит его.
      const now  = new Date();
      const user = await User.findOneAndUpdate(
        eligibleFilter(now),
        { $set: { hoursSyncTriedAt: now } },
        { sort: { hoursSyncedAt: 1, _id: 1 }, projection: { steamId: 1 } }
      ).lean();
      if (!user) break;

      const result = await syncUserHours(user, { deadline, attemptAt: now });
      summary.processed++;
      if      (result.kind === "ok")      summary.ok++;
      else if (result.kind === "privacy") summary.privacy++;
      else if (result.kind === "no_cs2")  summary.no_cs2++;
      else                                summary.technical++;

      // Лимит запросов или отклонённый ключ — остальные пользователи получат ту же ошибку, прекращаем
      if (result.kind === "rate_limited" || result.kind === "config") { summary.stopped = result.kind; break; }
      await sleep(300);
    }
    res.json({ ok: true, ...summary, ms: Date.now() - startedAt });
  } catch (err) {
    console.error("cron sync-steam-hours:", err && err.name);
    res.status(500).json({ error: "Ошибка сервера", ...summary });
  }
});

module.exports = router;
