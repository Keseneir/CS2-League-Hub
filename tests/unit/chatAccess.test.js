const test = require("node:test");
const assert = require("node:assert/strict");
const { participantRole, isUnreadFor, makePreview, readFieldFor, unreadConversationsFilter, PREVIEW_LENGTH } = require("../../utils/chatAccess");

const A = "507f1f77bcf86cd799439011", B = "507f1f77bcf86cd799439012", C = "507f1f77bcf86cd799439013";
const conv = (o = {}) => ({ authorId: A, responderId: B, lastMessageSenderId: B, lastMessageAt: new Date("2026-01-01T10:00:10Z"), authorLastReadAt: null, responderLastReadAt: null, ...o });

test("participantRole: только два участника; посторонние и пустые значения — null", () => {
  assert.equal(participantRole(conv(), A), "author");
  assert.equal(participantRole(conv(), B), "responder");
  for (const u of [C, null, undefined, "", "garbage"]) assert.equal(participantRole(conv(), u), null);
  assert.equal(participantRole(null, A), null);
  assert.equal(participantRole(conv({ authorId: null }), null), null);   // null не совпадает с null
});

test("readFieldFor возвращает поле только своей роли", () => {
  assert.equal(readFieldFor("author"), "authorLastReadAt");
  assert.equal(readFieldFor("responder"), "responderLastReadAt");
});

test("isUnreadFor: логика непрочитанного", () => {
  assert.equal(isUnreadFor(conv(), A), true);                                                                // от собеседника, не читал
  assert.equal(isUnreadFor(conv(), B), false);                                                               // своё сообщение
  assert.equal(isUnreadFor(conv({ authorLastReadAt: new Date("2026-01-01T10:00:09Z") }), A), true);          // прочитано до последнего
  assert.equal(isUnreadFor(conv({ authorLastReadAt: new Date("2026-01-01T10:00:10Z") }), A), false);         // прочитано ровно до последнего
  assert.equal(isUnreadFor(conv({ authorLastReadAt: new Date("2026-01-01T11:00:00Z") }), A), false);
  assert.equal(isUnreadFor(conv({ authorLastReadAt: new Date("2026-01-01T11:00:00Z"), responderLastReadAt: null }), B), false);
  assert.equal(isUnreadFor(conv({ lastMessageSenderId: A }), B), true);                                      // сообщение автора непрочитано откликнувшимся
  assert.equal(isUnreadFor(conv(), C), false);                                                               // посторонний
  assert.equal(isUnreadFor(conv({ lastMessageSenderId: null }), A), false);
});

test("makePreview: схлопывает пробелы и ограничивает длину", () => {
  assert.equal(makePreview("  a \n\n b  "), "a b");
  const long = makePreview("x".repeat(500));
  assert.equal(long.length, PREVIEW_LENGTH); assert.ok(long.endsWith("…"));
  assert.equal(makePreview(undefined), "");
});

test("unreadConversationsFilter строит условия по обеим ролям и исключает свои сообщения", () => {
  const f = unreadConversationsFilter(A);
  assert.equal(f.$or.length, 2);
  assert.equal(f.$or[0].authorId, A); assert.deepEqual(f.$or[0].lastMessageSenderId, { $ne: A });
  assert.equal(f.$or[1].responderId, A); assert.deepEqual(f.$or[1].lastMessageSenderId, { $ne: A });
  assert.ok(JSON.stringify(f.$or[0].$expr).includes("authorLastReadAt"));
  assert.ok(JSON.stringify(f.$or[1].$expr).includes("responderLastReadAt"));
});
