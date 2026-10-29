"use strict";
// Проверки для чата поддержки: формат идентификатора гостя и тикета, строгая проверка ссылки на вложение
// и подтверждение принадлежности файла Cloudinary по подписи ответа загрузки.
//
// Почему подпись. Загрузка идёт из браузера напрямую в Cloudinary (unsigned preset), сервер файл не видит.
// Раньше publicId приходил от клиента и без проверки шёл на удаление — можно было подставить чужой.
// Ответ Cloudinary на загрузку содержит `signature` = SHA-1(или SHA-256) от
// "public_id=<id>&version=<версия>" + API-секрет. Подделать её без секрета нельзя, а чужую подпись
// (для чужого файла) получить негде — её видел только загрузивший. Поэтому удаляем только те файлы,
// для которых клиент предъявил валидную подпись. Нет подписи — вложение показывается, но файл в Cloudinary
// НЕ удаляется (безопаснее пропустить удаление, чем удалить чужое).

const crypto = require("crypto");

const CLOUDINARY_HOST      = "res.cloudinary.com";
const MAX_URL_LENGTH       = 500;
const MAX_PUBLIC_ID_LENGTH = 200;
const PUBLIC_ID_RE         = /^[A-Za-z0-9_\-./]+$/;
// пробелы, кавычки, угловые скобки, обратные слэши/кавычки, управляющие символы
const FORBIDDEN_CHARS_RE   = /[\s"'<>\\`\u0000-\u001f\u007f]/;
const GUEST_ID_RE          = /^[A-Za-z0-9._-]{16,100}$/;   // UUID (36), 32 hex, прежний запасной формат "g-<ms>-<random>"
const OBJECT_ID_RE         = /^[a-f\d]{24}$/i;
// Метка в поле attachmentPublicId: ставится ТОЛЬКО сервером после проверки подписи (схема БД не менялась).
// Строки без метки (старые записи, непроверенные) на удаление не отправляются.
const VERIFIED_PREFIX      = "sig1:";

const isValidGuestId  = v => typeof v === "string" && GUEST_ID_RE.test(v);
const isObjectIdString = v => typeof v === "string" && OBJECT_ID_RE.test(v);

/** Ссылка на вложение: только https://res.cloudinary.com/<наше облако>/image/upload/..., без спецсимволов. */
function checkAttachmentUrl(raw, cloudName) {
  if (typeof raw !== "string") return { ok: false };
  const s = raw.trim();
  if (!s || s.length > MAX_URL_LENGTH || FORBIDDEN_CHARS_RE.test(s)) return { ok: false };
  if (typeof cloudName !== "string" || !/^[A-Za-z0-9_-]+$/.test(cloudName)) return { ok: false };
  let u;
  try { u = new URL(s); } catch { return { ok: false }; }
  if (u.protocol !== "https:" || u.username || u.password || u.port || u.hash) return { ok: false };
  if (u.hostname !== CLOUDINARY_HOST) return { ok: false };
  const prefix = `/${cloudName}/image/upload/`;
  if (!u.pathname.startsWith(prefix) || u.pathname.length === prefix.length) return { ok: false };
  let decoded;
  try { decoded = decodeURIComponent(u.pathname); } catch { return { ok: false }; }
  if (decoded.includes("..") || FORBIDDEN_CHARS_RE.test(decoded) || FORBIDDEN_CHARS_RE.test(u.href)) return { ok: false };
  return { ok: true, url: u.href };
}

/** publicId обязан соответствовать пути ссылки (…/<publicId>[.ext]). */
function publicIdMatchesUrl(publicId, url) {
  if (typeof publicId !== "string" || !publicId || publicId.length > MAX_PUBLIC_ID_LENGTH || !PUBLIC_ID_RE.test(publicId)) return false;
  if (publicId.startsWith("/") || publicId.includes("..") || publicId.includes("//")) return false;
  let path;
  try { path = decodeURIComponent(new URL(url).pathname); } catch { return false; }
  const idx = path.lastIndexOf("/" + publicId);
  if (idx === -1) return false;
  const rest = path.slice(idx + 1 + publicId.length);
  return rest === "" || /^\.[A-Za-z0-9]{2,5}$/.test(rest);
}

/** Подпись ответа загрузки Cloudinary: hash("public_id=<id>&version=<v>" + secret); SHA-1 или SHA-256. */
function verifyUploadSignature(publicId, version, signature, apiSecret) {
  if (typeof publicId !== "string" || !publicId || typeof apiSecret !== "string" || !apiSecret) return false;
  const v = String(version);
  if (!/^\d{1,13}$/.test(v)) return false;
  if (typeof signature !== "string" || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(signature)) return false;
  const expected = crypto.createHash(signature.length === 40 ? "sha1" : "sha256")
    .update(`public_id=${publicId}&version=${v}${apiSecret}`).digest();
  const given = Buffer.from(signature, "hex");
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

/**
 * Разбор вложения из тела запроса.
 * @returns {{ok:false}|{ok:true,url:string,storedPublicId:string,verified:boolean}}
 *  - нет ссылки → вложения нет (остальные поля игнорируются);
 *  - некорректная ссылка → ok:false (запрос отклоняется);
 *  - publicId сохраняется (с меткой) только при совпадении с ссылкой И валидной подписи, иначе ""
 *    (вложение остаётся, но удаление файла из Cloudinary будет пропущено).
 */
function resolveAttachment(input, env) {
  const i = input || {};
  const raw = typeof i.url === "string" ? i.url.trim() : "";
  if (!raw) return { ok: true, url: "", storedPublicId: "", verified: false };
  const u = checkAttachmentUrl(raw, env && env.cloudName);
  if (!u.ok) return { ok: false };
  const verified = publicIdMatchesUrl(i.publicId, u.url) &&
                   verifyUploadSignature(i.publicId, i.version, i.signature, env && env.apiSecret);
  return { ok: true, url: u.url, storedPublicId: verified ? VERIFIED_PREFIX + i.publicId : "", verified };
}

/** Какой publicId можно удалять из Cloudinary по сохранённой записи ("" — удалять нельзя). */
function deletablePublicId(storedPublicId, url, cloudName) {
  if (typeof storedPublicId !== "string" || !storedPublicId.startsWith(VERIFIED_PREFIX)) return "";
  const pid = storedPublicId.slice(VERIFIED_PREFIX.length);
  const u = checkAttachmentUrl(url, cloudName);
  return u.ok && publicIdMatchesUrl(pid, u.url) ? pid : "";
}

module.exports = {
  isValidGuestId, isObjectIdString, checkAttachmentUrl, publicIdMatchesUrl, verifyUploadSignature,
  resolveAttachment, deletablePublicId, VERIFIED_PREFIX,
};
