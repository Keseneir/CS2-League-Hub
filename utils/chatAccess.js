"use strict";
// Чистая логика доступа, «непрочитанного», mute, блокировок и представления сообщений (без БД — покрыта unit-тестами).

const MAX_MESSAGE_LENGTH = 1000;
const PREVIEW_LENGTH     = 120;
const MAX_BLOCKED        = 100;                       // потолок чёрного списка (массив в документе User не растёт безгранично)
const DELETED_PREVIEW    = "Сообщение удалено";

const same = (a, b) => !!a && !!b && String(a) === String(b);

/** 'author' | 'responder' | null — роль считается ТОЛЬКО по данным диалога из БД и id из сессии */
function participantRole(conv, userId) {
  if (!conv || !userId) return null;
  if (same(conv.authorId, userId))    return "author";
  if (same(conv.responderId, userId)) return "responder";
  return null;
}

function readFieldFor(role) { return role === "author" ? "authorLastReadAt" : "responderLastReadAt"; }
function muteFieldFor(role) { return role === "author" ? "authorMuted"      : "responderMuted"; }

function isMutedFor(conv, userId) {
  const role = participantRole(conv, userId);
  return !!role && conv[muteFieldFor(role)] === true;
}

/** Диалог «непрочитан» для пользователя, если последнее сообщение от собеседника и новее отметки прочтения */
function isUnreadFor(conv, userId) {
  const role = participantRole(conv, userId);
  if (!role || !conv.lastMessageSenderId || same(conv.lastMessageSenderId, userId)) return false;
  const readAt = conv[readFieldFor(role)];
  if (!readAt) return true;
  return new Date(conv.lastMessageAt).getTime() > new Date(readAt).getTime();
}

function makePreview(text) {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  return t.length > PREVIEW_LENGTH ? t.slice(0, PREVIEW_LENGTH - 1) + "…" : t;
}

/**
 * Mongo-фильтр «непрочитанные диалоги пользователя, учитываемые в бейдже».
 * Диалоги с отключёнными уведомлениями (mute) в счётчик не входят; сами отметки прочтения mute не трогает.
 */
function unreadConversationsFilter(userId) {
  const epoch = new Date(0);
  const side = (idField, readField, muteField) => ({
    [idField]: userId,
    [muteField]: { $ne: true },
    lastMessageSenderId: { $ne: userId },
    $expr: { $gt: ["$lastMessageAt", { $ifNull: ["$" + readField, epoch] }] },
  });
  return { $or: [side("authorId", "authorLastReadAt", "authorMuted"), side("responderId", "responderLastReadAt", "responderMuted")] };
}

/** user.blockedUsers содержит otherId? (user — документ/объект User, массив может отсутствовать) */
function hasBlocked(user, otherId) {
  const list = user && user.blockedUsers;
  return Array.isArray(list) && list.some(id => same(id, otherId));
}

/**
 * Представление сообщения для клиента. Текст удалённого сообщения НЕ отдаётся никогда.
 * changedAt — момент последнего изменения (для опроса изменений).
 */
function messageView(m, meId, senderName) {
  const isMine = same(m.senderId, meId);
  const v = { _id: m._id, createdAt: m.createdAt, isMine, changedAt: m.deletedAt || m.editedAt || m.createdAt };
  if (senderName !== undefined) v.senderName = senderName;
  if (m.deletedAt) { v.deleted = true; return v; }
  v.text = m.text;
  if (m.editedAt) { v.edited = true; v.editedAt = m.editedAt; }
  if (isMine) { v.canEdit = true; v.canDelete = true; }
  return v;
}

module.exports = {
  MAX_MESSAGE_LENGTH, PREVIEW_LENGTH, MAX_BLOCKED, DELETED_PREVIEW,
  participantRole, readFieldFor, muteFieldFor, isMutedFor, isUnreadFor, makePreview,
  unreadConversationsFilter, hasBlocked, messageView,
};
