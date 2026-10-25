"use strict";
// Валидация картинки объявления. Принимаем ТОЛЬКО https-ссылки на Cloudinary того облака,
// которое настроено на сервере (CLOUDINARY_CLOUD_NAME). URL разбирается через WHATWG URL —
// проверка по строковому префиксу не используется (иначе обходится через
// "https://res.cloudinary.com@evil.com/", "res.cloudinary.com.evil.com" и т.п.).

const CLOUDINARY_HOST      = "res.cloudinary.com";
const MAX_URL_LENGTH       = 500;
const MAX_PUBLIC_ID_LENGTH = 200;
const PUBLIC_ID_RE         = /^[A-Za-z0-9_\-./]+$/;
// пробелы, кавычки, угловые скобки, обратные слэши/кавычки, управляющие символы
const FORBIDDEN_CHARS_RE   = /[\s"'<>\\`\u0000-\u001f\u007f]/;

const IMAGE_ERROR = "Некорректное изображение. Загрузите картинку заново или уберите её.";
const UNAVAILABLE_ERROR = "Загрузка изображений сейчас недоступна.";

function invalid(error) { return { ok: false, error: error || IMAGE_ERROR }; }

/** @returns {{ok:true,url:string}|{ok:false,error:string}} url === "" означает «без картинки» */
function checkImageUrl(raw, cloudName) {
  if (raw === undefined || raw === null || raw === "") return { ok: true, url: "" };
  if (typeof raw !== "string") return invalid();
  const s = raw.trim();
  if (!s) return { ok: true, url: "" };
  if (s.length > MAX_URL_LENGTH) return invalid();
  if (FORBIDDEN_CHARS_RE.test(s)) return invalid();
  if (typeof cloudName !== "string" || !/^[A-Za-z0-9_-]+$/.test(cloudName)) return invalid(UNAVAILABLE_ERROR);

  let u;
  try { u = new URL(s); } catch { return invalid(); }

  if (u.protocol !== "https:")        return invalid();
  if (u.username || u.password)       return invalid();
  if (u.port)                         return invalid();
  if (u.hostname !== CLOUDINARY_HOST) return invalid();
  if (u.hash)                         return invalid();

  const prefix = `/${cloudName}/image/upload/`;
  if (!u.pathname.startsWith(prefix) || u.pathname.length === prefix.length) return invalid();

  let decoded;
  try { decoded = decodeURIComponent(u.pathname); } catch { return invalid(); }
  if (decoded.includes("..") || FORBIDDEN_CHARS_RE.test(decoded)) return invalid();

  const href = u.href;
  if (FORBIDDEN_CHARS_RE.test(href)) return invalid();
  return { ok: true, url: href };
}

/** publicId должен реально соответствовать пути URL (…/<publicId>[.ext]) */
function publicIdMatchesUrl(publicId, url) {
  if (typeof publicId !== "string" || !publicId) return false;
  if (publicId.length > MAX_PUBLIC_ID_LENGTH || !PUBLIC_ID_RE.test(publicId)) return false;
  if (publicId.startsWith("/") || publicId.includes("..") || publicId.includes("//")) return false;
  let path;
  try { path = decodeURIComponent(new URL(url).pathname); } catch { return false; }
  const idx = path.lastIndexOf("/" + publicId);
  if (idx === -1) return false;
  const rest = path.slice(idx + 1 + publicId.length);
  return rest === "" || /^\.[A-Za-z0-9]{2,5}$/.test(rest);
}

/**
 * Приводит поле image из тела запроса к безопасному виду.
 * Пустое/отсутствующее значение = «убрать картинку».
 * @returns {{ok:true,image:{url:string,publicId:string}}|{ok:false,error:string}}
 */
function sanitizeListingImage(image, cloudName) {
  if (image === undefined || image === null || image === "") {
    return { ok: true, image: { url: "", publicId: "" } };
  }
  if (typeof image !== "object" || Array.isArray(image)) return invalid();

  const r = checkImageUrl(image.url, cloudName);
  if (!r.ok) return r;
  if (!r.url) return { ok: true, image: { url: "", publicId: "" } };

  let publicId = image.publicId;
  if (publicId === undefined || publicId === null || publicId === "") {
    publicId = "";
  } else if (!publicIdMatchesUrl(publicId, r.url)) {
    return invalid();
  }
  return { ok: true, image: { url: r.url, publicId } };
}

module.exports = { checkImageUrl, publicIdMatchesUrl, sanitizeListingImage, IMAGE_ERROR, CLOUDINARY_HOST };
