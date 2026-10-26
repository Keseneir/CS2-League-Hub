"use strict";
// Чистые функции валидации (без БД) — используются админ-роутом объявлений и чатом.

const LIMITS = { title: 100, description: 2000, role: 60, query: 100 };
const ADMIN_STATUSES = ["all", "active", "inactive", "hidden"];
// управляющие символы, кроме \n \r \t
const CONTROL_CHARS_RE = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

const isStr = v => typeof v === "string";
const isObjectIdString = v => typeof v === "string" && /^[a-f\d]{24}$/i.test(v);
const escapeRegex = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Правка объявления админом: title/description/role + removeImage. */
function validateAdminListingEdit(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, error: "Некорректный запрос." };
  const update = {};

  if (body.title !== undefined) {
    if (!isStr(body.title) || !body.title.trim()) return { ok: false, error: "Заголовок не может быть пустым." };
    if (body.title.length > LIMITS.title) return { ok: false, error: "Слишком длинный заголовок." };
    update.title = body.title.trim();
  }
  if (body.description !== undefined) {
    if (!isStr(body.description) || !body.description.trim()) return { ok: false, error: "Описание не может быть пустым." };
    if (body.description.length > LIMITS.description) return { ok: false, error: "Слишком длинное описание." };
    update.description = body.description.trim();
  }
  if (body.role !== undefined) {
    if (!isStr(body.role)) return { ok: false, error: "Некорректная роль." };
    if (body.role.length > LIMITS.role) return { ok: false, error: "Слишком длинная роль." };
    update.role = body.role.trim();
  }
  const removeImage = body.removeImage === true;
  if (!Object.keys(update).length && !removeImage) return { ok: false, error: "Нет изменений." };
  return { ok: true, update, removeImage };
}

/** Фильтр + пагинация списка объявлений для админки. */
function parseAdminListingQuery(query, validTypes) {
  const q = query || {};
  const filter = {};
  const status = isStr(q.status) && ADMIN_STATUSES.includes(q.status) ? q.status : "all";
  if (status === "active")   { filter.active = true;  filter.hiddenByAdmin = false; }
  if (status === "inactive") { filter.active = false; }
  if (status === "hidden")   { filter.hiddenByAdmin = true; }

  if (isStr(q.type) && Array.isArray(validTypes) && validTypes.includes(q.type)) filter.type = q.type;

  if (isStr(q.q) && q.q.trim()) {
    filter.title = new RegExp(escapeRegex(q.q.trim().slice(0, LIMITS.query)), "i");
  }

  let page = parseInt(q.page, 10);  if (!Number.isFinite(page)  || page  < 1) page  = 1;  if (page > 1000) page = 1000;
  let limit = parseInt(q.limit, 10); if (!Number.isFinite(limit) || limit < 1) limit = 20; if (limit > 50)  limit = 50;
  return { filter, page, limit, skip: (page - 1) * limit };
}

/** Текст сообщения чата: строка, не пустая после trim, ≤ max, без управляющих символов. */
function validateChatText(text, max) {
  if (!isStr(text)) return { ok: false, error: "Введите сообщение." };
  const t = text.trim();
  if (!t) return { ok: false, error: "Введите сообщение." };
  if (t.length > max) return { ok: false, error: `Сообщение слишком длинное (максимум ${max} символов).` };
  if (CONTROL_CHARS_RE.test(t)) return { ok: false, error: "Сообщение содержит недопустимые символы." };
  return { ok: true, text: t };
}

const REPORT_REASONS = ["spam", "scam", "inappropriate", "wrong_info", "other"];
const REPORT_DETAILS_MAX = 500;

/** Жалоба на объявление: reason из списка, details — необязательная строка ≤ 500 без управляющих символов. */
function validateReport(body, reasons = REPORT_REASONS) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, error: "Некорректный запрос." };
  if (!isStr(body.reason) || !reasons.includes(body.reason)) return { ok: false, error: "Выберите причину жалобы." };
  let details = "";
  if (body.details !== undefined && body.details !== null) {
    if (!isStr(body.details)) return { ok: false, error: "Некорректное описание." };
    details = body.details.trim();
    if (details.length > REPORT_DETAILS_MAX) return { ok: false, error: `Описание не длиннее ${REPORT_DETAILS_MAX} символов.` };
    if (CONTROL_CHARS_RE.test(details)) return { ok: false, error: "Описание содержит недопустимые символы." };
  }
  return { ok: true, reason: body.reason, details };
}

module.exports = { REPORT_REASONS, REPORT_DETAILS_MAX, validateReport, LIMITS, ADMIN_STATUSES, isObjectIdString, escapeRegex, validateAdminListingEdit, parseAdminListingQuery, validateChatText };
