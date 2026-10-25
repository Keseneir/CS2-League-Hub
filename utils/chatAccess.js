"use strict";
// Чистая логика доступа и «непрочитанного» для чата (без БД — покрыта unit-тестами).

const MAX_MESSAGE_LENGTH = 1000;
const PREVIEW_LENGTH     = 120;

const same = (a, b) => !!a && !!b && String(a) === String(b);

/** 'author' | 'responder' | null — роль считается ТОЛЬКО по данным диалога из БД и id из сессии */
function participantRole(conv, userId) {
  if (!conv || !userId) return null;
  if (same(conv.authorId, userId))    return "author";
  if (same(conv.responderId, userId)) return "responder";
  return null;
}

function readFieldFor(role) { return role === "author" ? "authorLastReadAt" : "responderLastReadAt"; }

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

/** Mongo-фильтр «непрочитанные диалоги пользователя» (тот же смысл, что isUnreadFor) */
function unreadConversationsFilter(userId) {
  const epoch = new Date(0);
  const side = (idField, readField) => ({
    [idField]: userId,
    lastMessageSenderId: { $ne: userId },
    $expr: { $gt: ["$lastMessageAt", { $ifNull: ["$" + readField, epoch] }] },
  });
  return { $or: [side("authorId", "authorLastReadAt"), side("responderId", "responderLastReadAt")] };
}

module.exports = { MAX_MESSAGE_LENGTH, PREVIEW_LENGTH, participantRole, readFieldFor, isUnreadFor, makePreview, unreadConversationsFilter };
