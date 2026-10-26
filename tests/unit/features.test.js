const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { muteFieldFor, isMutedFor, hasBlocked, messageView, unreadConversationsFilter, MAX_BLOCKED, DELETED_PREVIEW } = require("../../utils/chatAccess");
const { validateReport, REPORT_REASONS } = require("../../utils/listingValidation");

const A = "507f1f77bcf86cd799439011", B = "507f1f77bcf86cd799439012", C = "507f1f77bcf86cd799439013";
const read = p => fs.readFileSync(path.join(__dirname, "../..", p), "utf8").replace(/\r\n/g, "\n");

test("mute: поле зависит от роли; isMutedFor учитывает только своего участника", () => {
  assert.equal(muteFieldFor("author"), "authorMuted"); assert.equal(muteFieldFor("responder"), "responderMuted");
  const conv = { authorId: A, responderId: B, authorMuted: true };
  assert.equal(isMutedFor(conv, A), true); assert.equal(isMutedFor(conv, B), false); assert.equal(isMutedFor(conv, C), false);
  assert.equal(isMutedFor({ authorId: A, responderId: B }, A), false);                // поле отсутствует = не отключено
  assert.equal(isMutedFor({ authorId: A, responderId: B, authorMuted: "true" }, A), false);   // только строгий true
});

test("фильтр непрочитанного исключает отключённые диалоги по каждой стороне", () => {
  const f = unreadConversationsFilter(A);
  assert.deepEqual(f.$or[0].authorMuted, { $ne: true }); assert.deepEqual(f.$or[1].responderMuted, { $ne: true });
  assert.equal(f.$or[0].responderMuted, undefined);      // чужой mute на мой счётчик не влияет
});

test("hasBlocked: пустые/отсутствующие списки, совпадение по строке и ObjectId-подобным значениям", () => {
  assert.equal(hasBlocked({ blockedUsers: [B] }, B), true);
  assert.equal(hasBlocked({ blockedUsers: [{ toString: () => B }] }, B), true);
  for (const u of [null, undefined, {}, { blockedUsers: [] }, { blockedUsers: undefined }, { blockedUsers: "x" }, { blockedUsers: [C] }])
    assert.equal(hasBlocked(u, B), false);
  assert.equal(hasBlocked({ blockedUsers: [B] }, null), false);
  assert.equal(MAX_BLOCKED, 100);
});

test("messageView: текст удалённого сообщения не отдаётся; флаги правки только у автора сообщения", () => {
  const base = { _id: "m1", senderId: A, text: "секретный текст", createdAt: new Date("2026-01-01T10:00:00Z") };
  const normal = messageView(base, A);
  assert.deepEqual([normal.text, normal.isMine, normal.canEdit, normal.canDelete, normal.edited], ["секретный текст", true, true, true, undefined]);
  const theirs = messageView(base, B);
  assert.equal(theirs.canEdit, undefined); assert.equal(theirs.canDelete, undefined); assert.equal(theirs.isMine, false);

  const edited = messageView({ ...base, editedAt: new Date("2026-01-01T11:00:00Z") }, A);
  assert.equal(edited.edited, true); assert.equal(+new Date(edited.changedAt), +new Date("2026-01-01T11:00:00Z"));

  const deleted = messageView({ ...base, deletedAt: new Date("2026-01-01T12:00:00Z") }, A, "Имя");
  assert.equal(deleted.deleted, true); assert.ok(!("text" in deleted)); assert.ok(!JSON.stringify(deleted).includes("секретный"));
  assert.equal(deleted.canEdit, undefined); assert.equal(deleted.senderName, "Имя");
  assert.equal(DELETED_PREVIEW, "Сообщение удалено");
  assert.ok(!("senderName" in messageView(base, A)));   // в опросе имя не отдаётся (экономия запросов к БД)
});

test("validateReport: причина из списка, details необязательны/ограничены", () => {
  assert.deepEqual(validateReport({ reason: "spam" }), { ok: true, reason: "spam", details: "" });
  assert.deepEqual(validateReport({ reason: "scam", details: "  текст  " }), { ok: true, reason: "scam", details: "текст" });
  assert.deepEqual(validateReport({ reason: "other", details: null }), { ok: true, reason: "other", details: "" });
  for (const b of [null, [], "x", {}, { reason: "evil" }, { reason: 5 }, { reason: ["spam"] }, { reason: { $ne: 1 } }, { reason: "spam", details: 5 },
    { reason: "spam", details: {} }, { reason: "spam", details: "a".repeat(501) }, { reason: "spam", details: "a\u0000b" }])
    assert.equal(validateReport(b).ok, false, JSON.stringify(b));
  assert.equal(validateReport({ reason: "spam", details: "a".repeat(500) }).ok, true);
  assert.equal(validateReport({ reason: "spam", details: "строка\nс переносом" }).ok, true);
});

test("причины жалоб согласованы между валидатором, моделью, формой и админкой", () => {
  const ListingReport = require("../../models/ListingReport");
  assert.deepEqual([...ListingReport.REASONS].sort(), [...REPORT_REASONS].sort());
  const html = read("public/listings.html"), admin = read("public/admin.html");
  for (const r of REPORT_REASONS) {
    assert.ok(html.includes(`<option value="${r}">`), "нет в форме: " + r);
    assert.ok(new RegExp(`\\b${r}:\\s*"`).test(admin), "нет в админке: " + r);
  }
});

test("схема: новые поля необязательны и без default (не занимают место, пока не используются)", () => {
  const Message = require("../../models/Message"), Conversation = require("../../models/Conversation"), User = require("../../models/User"), R = require("../../models/ListingReport");
  for (const [m, f] of [[Message, "editedAt"], [Message, "deletedAt"], [Conversation, "authorMuted"], [Conversation, "responderMuted"], [Conversation, "lastChangeAt"], [R, "details"]])
    assert.equal(m.schema.path(f).options.default, undefined, m.modelName + "." + f);
  assert.equal(User.schema.path("blockedUsers").options.default, undefined);
  // «надгробие»: у удалённого сообщения text не обязателен, у обычного — обязателен
  const m = new Message({ conversationId: A, senderId: B, text: "", deletedAt: new Date() }); assert.equal(m.validateSync(), undefined);
  const n = new Message({ conversationId: A, senderId: B, text: "" }); assert.ok(n.validateSync());
  // индексы жалоб: ровно два, один уникальный
  const idx = R.schema.indexes();
  assert.equal(idx.length, 2); assert.equal(idx.filter(([, o]) => o && o.unique).length, 1);
  assert.deepEqual(Object.keys(Message.schema.indexes().reduce((a, [k]) => ({ ...a, ...k }), {})).sort(), ["conversationId", "createdAt", "senderId", "_id"].sort());
});

test("фронтенд: ссылка на профиль строится по существующему шаблону, чат без innerHTML, аватары только https", () => {
  const src = read("public/js/listings.js");
  const m = src.match(/function profileUrl\(steamId\) \{[^\n]*\}/); assert.ok(m, "profileUrl не найдена");
  const profileUrl = vm.runInNewContext("(" + m[0].replace("function profileUrl", "function") + ")");
  assert.equal(profileUrl("76561190000000001"), "/profile.html?id=76561190000000001");
  assert.equal(profileUrl("a&b=1"), "/profile.html?id=a%26b%3D1");                  // значение кодируется
  assert.ok(read("public/admin.html").includes("/profile.html?id=${u.steamId}"), "эталонная ссылка из админки изменилась");
  const start = src.indexOf("// ── Сообщения: приватный чат по объявлению"), end = src.indexOf("// ── Модалка создания / редактирования");
  const block = src.slice(start, end).replace(/^\s*\/\/.*$/gm, "");
  assert.ok(!/innerHTML/.test(block), "в блоке чата не должно быть innerHTML");
  assert.ok(/\/\^https:\\\/\\\/\/i\.test\(u\.avatar\)/.test(block), "аватар должен проверяться на https");
  assert.ok(/m\.deleted \? DELETED_TEXT : m\.text/.test(block));
  assert.ok(!/ariaLabel/.test(src));
});

test("routes/listings.js: жалоба и проверка чёрного списка стоят в нужных местах", () => {
  const src = read("routes/listings.js");
  const iBlock = src.indexOf("hasBlocked(req.user, listing.authorId)"), iUpsert = src.indexOf("ListingResponse.findOneAndUpdate(");
  assert.ok(iBlock > 0 && iBlock < iUpsert, "проверка блокировки должна быть ДО записи отклика и диалога");
  assert.ok(src.includes("ListingReport.deleteMany({ listingId: listing._id })"), "жалобы должны удаляться вместе с объявлением");
  assert.ok(/router\.post\("\/:id\/report", requireAuth/.test(src));
});

test("не тронуты: удаление пользователей и глобальная проверка banned; админ-роутер объявлений защищён", () => {
  assert.ok(!/blockedUsers|ListingReport|Conversation/.test(read("routes/admin.js")), "admin.js (удаление пользователей) не должен затрагивать новые данные");
  assert.ok(!/banned|blockedUsers/.test(read("middleware/auth.js")));
  assert.ok(read("routes/adminListings.js").includes("router.use(requireAdmin);"));
});
