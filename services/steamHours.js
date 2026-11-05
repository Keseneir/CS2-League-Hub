// Синхронизация часов CS2 со Steam.
// Единая логика для ручной кнопки (POST /api/profile/sync-steam-hours) и ежедневного cron
// (GET /api/cron/sync-steam-hours). Не меняет hoursInCS2 при любой неудаче.
const User = require("../models/User");

const CS2_APP_ID         = 730;
const REQUEST_TIMEOUT_MS = 3000;   // таймаут одного запроса к Steam
const RECHECK_DELAY_MS   = 1000;   // пауза перед повторной проверкой «пустого» ответа

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Один запрос к Steam с таймаутом, не превышающим общий дедлайн (deadline — timestamp в мс).
// Ключ лежит в URL, поэтому URL и текст ошибок fetch нигде не логируем.
async function steamFetch(url, deadline) {
  const left    = deadline ? deadline - Date.now() : REQUEST_TIMEOUT_MS;
  const timeout = Math.min(REQUEST_TIMEOUT_MS, left);
  if (timeout < 300) return { error: "deadline" };
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeout) });
    if (!res.ok) return { status: res.status };
    return { status: res.status, json: await res.json() };
  } catch (err) {
    return { error: (err && err.name) === "TimeoutError" ? "timeout" : "network" };
  }
}

function ownedGamesUrl(key, steamId) {
  return `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${key}&steamid=${steamId}&include_appinfo=false&include_played_free_games=true`;
}

// Транспортные/HTTP-ошибки → «техническая» неудача (не приватность!)
function httpFailure(r) {
  if (r.error)           return { kind: "technical", reason: r.error };
  if (r.status === 429)  return { kind: "rate_limited" };
  if (r.status === 401 || r.status === 403) return { kind: "config", reason: "rejected" };
  if (r.status >= 400)   return { kind: "technical", reason: "http_" + r.status };
  return null;
}

// Разбор ответа GetOwnedGames:
//   hours   — CS2 найден;
//   no_cs2  — список игр открыт, но CS2 в нём нет (или game_count: 0) — это не приватность;
//   empty   — пустой response без games/game_count: так Steam отвечает на закрытые данные,
//             но иногда и при сбоях, поэтому одного такого ответа для вывода недостаточно;
//   bad     — неожиданный формат.
function parseOwned(json) {
  const resp = json && json.response;
  if (!resp || typeof resp !== "object") return { type: "bad" };
  if (Array.isArray(resp.games)) {
    const cs2 = resp.games.find(g => g.appid === CS2_APP_ID);
    if (cs2) return { type: "hours", hours: Math.round((cs2.playtime_forever || 0) / 60) };
    return { type: "no_cs2" };
  }
  if (typeof resp.game_count === "number") return { type: "no_cs2" };
  return { type: "empty" };
}

// Запрашивает часы CS2. Возвращает:
//   { kind: "ok", hours } | { kind: "privacy" } | { kind: "no_cs2" } |
//   { kind: "rate_limited" } | { kind: "config", reason } | { kind: "technical", reason }
// Видимость профиля и видимость «Подробностей об играх» в Steam — разные настройки, поэтому
// «privacy» определяется ТОЛЬКО по ответам GetOwnedGames: пустой response (без games и game_count)
// должен повториться и при повторном запросе после паузы. Одного пустого ответа мало: Steam иногда
// отдаёт его и при сбоях. Любая ошибка (сеть, таймаут, 429, 5xx, 403, формат) — «technical»/«rate_limited»,
// а открытый список без CS2 — «no_cs2»; ни то, ни другое приватностью не считается.
async function fetchCs2Hours(steamId, opts = {}) {
  const key = process.env.STEAM_API_KEY;
  if (!key) return { kind: "config", reason: "no_key" };
  const deadline = opts.deadline || 0;

  const r1 = await steamFetch(ownedGamesUrl(key, steamId), deadline);
  const f1 = httpFailure(r1);
  if (f1) return f1;
  const p1 = parseOwned(r1.json);
  if (p1.type === "hours")  return { kind: "ok", hours: p1.hours };
  if (p1.type === "no_cs2") return { kind: "no_cs2" };
  if (p1.type === "bad")    return { kind: "technical", reason: "bad_response" };

  // Пустой ответ: повторяем один раз, чтобы исключить разовый сбой
  await sleep(RECHECK_DELAY_MS);
  const r2 = await steamFetch(ownedGamesUrl(key, steamId), deadline);
  const f2 = httpFailure(r2);
  if (f2) return f2;
  const p2 = parseOwned(r2.json);
  if (p2.type === "hours")  return { kind: "ok", hours: p2.hours };
  if (p2.type === "no_cs2") return { kind: "no_cs2" };
  if (p2.type === "empty")  return { kind: "privacy" };
  return { kind: "technical", reason: "bad_response" };
}

const wasMatched = r => !!(r && (r.matchedCount > 0 || r.n > 0));

// Запрашивает часы и записывает результат в User.
// При неудаче hoursInCS2 не трогается; статус «privacy» не сбрасывается из-за технических сбоев.
//
// Защита от гонки ручной синхронизации и cron: hoursSyncTriedAt — «версия» попытки.
//   • cron передаёт attemptAt — значение, которым он уже «занял» пользователя;
//   • ручной запуск ставит новую метку здесь.
// Любой результат (успех или неуспех) записывается, только если эта попытка всё ещё последняя
// (hoursSyncTriedAt == attemptAt) и после её старта не появилось более нового успеха
// (hoursSyncedAt < attemptAt). Так более старая попытка не перезаписывает результат более новой —
// ни завершившейся, ни ещё выполняющейся.
// Возвращает результат + attemptAt + applied (false — запись отброшена как устаревшая; для technical
// также false, если сохранён прежний privacy).
async function syncUserHours(user, opts = {}) {
  let attemptAt = opts.attemptAt;
  if (!attemptAt) {
    attemptAt = new Date();
    await User.updateOne({ _id: user._id }, { $set: { hoursSyncTriedAt: attemptAt } });
  }

  let result;
  try {
    result = await fetchCs2Hours(user.steamId, opts);
  } catch (err) {
    result = { kind: "technical", reason: "exception" };
  }

  const noNewerSuccess = { $or: [{ hoursSyncedAt: null }, { hoursSyncedAt: { $lt: attemptAt } }] };
  let res;
  if (result.kind === "ok") {
    res = await User.updateOne(
      { _id: user._id, hoursSyncTriedAt: attemptAt, ...noNewerSuccess },
      { $set: { hoursInCS2: result.hours, hoursSyncedAt: new Date(), hoursSyncError: null } });
  } else if (result.kind === "privacy" || result.kind === "no_cs2") {
    res = await User.updateOne(
      { _id: user._id, hoursSyncTriedAt: attemptAt, ...noNewerSuccess },
      { $set: { hoursSyncError: result.kind } });
  } else {
    res = await User.updateOne(
      { _id: user._id, hoursSyncTriedAt: attemptAt, hoursSyncError: { $ne: "privacy" }, ...noNewerSuccess },
      { $set: { hoursSyncError: "technical" } });
  }
  return { ...result, attemptAt, applied: wasMatched(res) };
}

module.exports = { fetchCs2Hours, syncUserHours };
