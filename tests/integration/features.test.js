// Интеграционные тесты: правка/удаление сообщений, mute, аватары/профиль, чёрный список, жалобы на объявления.
// Нужна ИЗОЛИРОВАННАЯ тестовая БД (см. tests/helpers/testDb.js); без неё набор пропускается.
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { getTestDb, withDbName } = require("../helpers/testDb");
const { startEnv } = require("../helpers/integrationEnv");

const db = getTestDb();
const sleep = ms => new Promise(r => setTimeout(r, ms));
const msgUrl = (cid, mid) => `/api/conversations/${cid}/messages${mid ? "/" + mid : ""}`;

describe("правка/удаление, mute, профили, блокировки, жалобы (интеграция, изолированная БД)", { skip: db.skip }, () => {
  let env, api, M;
  before(async () => { env = await startEnv(withDbName(db.uri, "features")); api = env.api; M = env.M; });
  after(async () => { if (env) await env.stop(); });

  async function send(s, user, text) {
    const r = await api("POST", msgUrl(s.cid), { user, body: { text } });
    assert.equal(r.status, 200, r.raw); return r.body.message;
  }
  const convOf = cid => M.Conversation.findById(cid).lean();
  const oid = x => new env.mongoose.Types.ObjectId(String(x));      // «сырые» запросы драйвера не приводят строку к ObjectId

  // ── 1, 2, 5: правка ───────────────────────────────────────────────────
  it("пользователь правит своё сообщение; правка видна после перезагрузки обоим; превью обновляется только у последнего", async () => {
    const s = await env.scenario();
    const m1 = await send(s, s.responder, "первое");
    await sleep(15);
    const r = await api("PATCH", msgUrl(s.cid, m1._id), { user: s.responder, body: { text: "  исправлено  " } });
    assert.equal(r.status, 200, r.raw);
    assert.equal(r.body.message.text, "исправлено"); assert.equal(r.body.message.edited, true); assert.ok(r.body.message.editedAt);
    const db1 = await M.Message.findById(m1._id).lean();
    assert.equal(db1.text, "исправлено"); assert.ok(db1.editedAt);
    assert.equal((await convOf(s.cid)).lastMessagePreview, "исправлено");        // это последнее сообщение

    for (const user of [s.author, s.responder]) {                                   // «перезагрузка»
      const g = await api("GET", msgUrl(s.cid), { user });
      const m = g.body.messages.find(x => x._id === String(m1._id));
      assert.equal(m.text, "исправлено"); assert.equal(m.edited, true);
      assert.equal(m.canEdit, user === s.responder ? true : undefined);
    }
    await sleep(15);
    await send(s, s.author, "ответ автора");
    await api("PATCH", msgUrl(s.cid, m1._id), { user: s.responder, body: { text: "ещё правка" } });
    assert.equal((await convOf(s.cid)).lastMessagePreview, "ответ автора");        // не последнее — превью не трогаем
    assert.equal((await M.Message.findById(m1._id).lean()).text, "ещё правка");

    const before = (await M.Message.findById(m1._id).lean()).editedAt;
    await sleep(15);
    assert.equal((await api("PATCH", msgUrl(s.cid, m1._id), { user: s.responder, body: { text: "ещё правка" } })).status, 200);
    assert.equal(+(await M.Message.findById(m1._id).lean()).editedAt, +before);     // тот же текст — без записи
  });

  it("правка: некорректный текст отклоняется, чужие/посторонние/аноним не могут править", async () => {
    const s = await env.scenario(), outsider = await env.mkUser();
    const mine = await send(s, s.responder, "моё"); await sleep(15);
    const theirs = await send(s, s.author, "сообщение автора");
    for (const text of ["", "   ", 5, null, undefined, ["x"], "x".repeat(1001), "a\u0000b"])
      assert.equal((await api("PATCH", msgUrl(s.cid, mine._id), { user: s.responder, body: { text } })).status, 400, JSON.stringify(text)?.slice(0, 15));
    assert.equal((await M.Message.findById(mine._id).lean()).text, "моё");

    // автор не может править сообщение откликнувшегося и наоборот (в т.ч. с подделкой senderId в теле)
    for (const [user, id] of [[s.author, mine._id], [s.responder, theirs._id]]) {
      const r = await api("PATCH", msgUrl(s.cid, id), { user, body: { text: "взлом", senderId: String(id), isMine: true } });
      assert.equal(r.status, 404);
    }
    assert.equal((await M.Message.findById(mine._id).lean()).text, "моё");
    assert.equal((await M.Message.findById(theirs._id).lean()).text, "сообщение автора");
    assert.equal((await api("PATCH", msgUrl(s.cid, mine._id), { user: outsider, body: { text: "взлом" } })).status, 404);
    assert.equal((await api("PATCH", msgUrl(s.cid, mine._id), { user: env.admin, body: { text: "взлом" } })).status, 404);
    assert.equal((await api("PATCH", msgUrl(s.cid, mine._id), { body: { text: "взлом" } })).status, 401);
    const other = await env.scenario();                                              // сообщение из другого диалога через свой cid
    const foreign = await send(other, other.responder, "чужой диалог");
    assert.equal((await api("PATCH", msgUrl(s.cid, foreign._id), { user: s.responder, body: { text: "взлом" } })).status, 404);
    for (const bad of ["abc", "507f1f77bcf86cd79943901z", "%7B%7D", String(new env.mongoose.Types.ObjectId())])
      assert.equal((await api("PATCH", msgUrl(s.cid, bad), { user: s.responder, body: { text: "x" } })).status, 404);
  });

  // ── 3, 4, 5: удаление ─────────────────────────────────────────────────
  it("удаление своего сообщения: текст стирается в БД и не отдаётся API; чужие удалять нельзя; результат виден после перезагрузки", async () => {
    const s = await env.scenario(), outsider = await env.mkUser();
    const secret = "СЕКРЕТНЫЙ_ТЕКСТ_123";
    const m = await send(s, s.responder, secret);
    assert.equal((await api("DELETE", msgUrl(s.cid, m._id), { user: s.author })).status, 404);       // автор чужое не удалит
    assert.equal((await api("DELETE", msgUrl(s.cid, m._id), { user: outsider })).status, 404);
    assert.equal((await api("DELETE", msgUrl(s.cid, m._id), { user: env.admin })).status, 404);
    assert.equal((await api("DELETE", msgUrl(s.cid, m._id))).status, 401);
    assert.equal((await M.Message.findById(m._id).lean()).text, secret);

    assert.equal((await api("DELETE", msgUrl(s.cid, m._id), { user: s.responder })).status, 200);
    const raw = await M.Message.collection.findOne({ _id: oid(m._id) });
    assert.equal(raw.text, ""); assert.ok(raw.deletedAt); assert.equal(raw.editedAt, undefined);
    assert.ok(!JSON.stringify(raw).includes(secret));
    for (const user of [s.author, s.responder]) {
      const g = await api("GET", msgUrl(s.cid), { user });
      assert.ok(!g.raw.includes(secret), "оригинал не должен попадать в ответ");
      const mm = g.body.messages.find(x => x._id === String(m._id));
      assert.equal(mm.deleted, true); assert.ok(!("text" in mm)); assert.equal(mm.canEdit, undefined);
      assert.ok(!(await api("GET", "/api/conversations", { user })).raw.includes(secret));          // и в превью списка
    }
    assert.equal((await convOf(s.cid)).lastMessagePreview, "Сообщение удалено");
    assert.equal((await api("DELETE", msgUrl(s.cid, m._id), { user: s.responder })).status, 200);   // идемпотентно
    assert.equal((await api("PATCH", msgUrl(s.cid, m._id), { user: s.responder, body: { text: "воскресить" } })).status, 409);
    assert.equal((await M.Message.findById(m._id).lean()).text, "");
  });

  it("опрос передаёт правки и удаления собеседнику; без новых изменений лёгкий опрос ничего не возвращает", async () => {
    const s = await env.scenario();
    const m = await send(s, s.responder, "оригинал");
    const init = await api("GET", msgUrl(s.cid), { user: s.author });
    assert.equal(init.body.lastChangeAt, null);
    const last = init.body.messages.at(-1).createdAt;
    const afterPlus = new Date(Date.parse(last) + 1).toISOString();

    await sleep(15);
    await api("PATCH", msgUrl(s.cid, m._id), { user: s.responder, body: { text: "правка" } });
    const poll = await api("GET", msgUrl(s.cid) + "?after=" + encodeURIComponent(afterPlus), { user: s.author });
    assert.equal(poll.body.messages.length, 1); assert.equal(poll.body.messages[0].text, "правка"); assert.equal(poll.body.messages[0].edited, true);
    assert.ok(poll.body.lastChangeAt);
    const calm = await api("GET", msgUrl(s.cid) + `?after=${encodeURIComponent(afterPlus)}&changed=${encodeURIComponent(poll.body.lastChangeAt)}`, { user: s.author });
    assert.equal(calm.body.messages.length, 0);                                       // изменений больше нет

    await sleep(15);
    await api("DELETE", msgUrl(s.cid, m._id), { user: s.responder });
    const poll2 = await api("GET", msgUrl(s.cid) + `?after=${encodeURIComponent(afterPlus)}&changed=${encodeURIComponent(poll.body.lastChangeAt)}`, { user: s.author });
    assert.equal(poll2.body.messages.length, 1); assert.equal(poll2.body.messages[0].deleted, true); assert.ok(!poll2.raw.includes("правка"));
    assert.equal((await api("GET", msgUrl(s.cid) + "?after=x", { user: s.author })).status, 400);
    assert.equal((await api("GET", msgUrl(s.cid) + `?after=${encodeURIComponent(afterPlus)}&changed=zzz`, { user: s.author })).status, 400);
  });

  // ── 6, 7: mute ────────────────────────────────────────────────────────
  it("mute: сохраняется, не влияет на собеседника, исключает диалог из счётчика, не помечает прочитанным, снимается", async () => {
    const s = await env.scenario();
    const count = async user => (await api("GET", "/api/listings/unread-count", { user })).body.messages;
    const listItem = async user => (await api("GET", "/api/conversations", { user })).body.conversations.find(c => String(c._id) === String(s.cid));

    assert.equal((await api("POST", `/api/conversations/${s.cid}/mute`, { user: s.author, body: { muted: true } })).status, 200);
    assert.equal((await convOf(s.cid)).authorMuted, true);
    assert.equal((await listItem(s.author)).muted, true); assert.equal((await listItem(s.responder)).muted, false);
    assert.equal((await api("GET", msgUrl(s.cid), { user: s.author })).body.conversation.muted, true);       // после перезагрузки

    const readBefore = (await convOf(s.cid)).authorLastReadAt;
    await sleep(15);
    await send(s, s.responder, "новое сообщение");
    assert.equal((await listItem(s.author)).unread, true);          // сообщение не потеряно и не прочитано
    assert.equal(await count(s.author), 0);                         // но в счётчик шапки не входит
    assert.equal(String((await convOf(s.cid)).authorLastReadAt), String(readBefore));   // mute не помечает прочитанным
    await send(s, s.author, "я всё равно могу писать");               // отправка/получение работают
    assert.equal((await api("GET", msgUrl(s.cid), { user: s.author })).status, 200);

    await sleep(15);
    await send(s, s.responder, "ещё одно");
    const updatedBefore = (await convOf(s.cid)).updatedAt;
    await api("POST", `/api/conversations/${s.cid}/mute`, { user: s.author, body: { muted: true } });          // повтор — без записи
    assert.equal(+(await convOf(s.cid)).updatedAt, +updatedBefore);

    assert.equal((await api("POST", `/api/conversations/${s.cid}/mute`, { user: s.author, body: { muted: false } })).status, 200);
    const raw = await M.Conversation.collection.findOne({ _id: oid(s.cid) });
    assert.equal(raw.authorMuted, undefined);                                         // поле удалено, а не false
    assert.equal(await count(s.author), 1);                                           // снова учитывается

    for (const muted of ["true", 1, null, undefined, {}])
      assert.equal((await api("POST", `/api/conversations/${s.cid}/mute`, { user: s.author, body: { muted } })).status, 400);
    const outsider = await env.mkUser();
    assert.equal((await api("POST", `/api/conversations/${s.cid}/mute`, { user: outsider, body: { muted: true } })).status, 404);
    assert.equal((await api("POST", `/api/conversations/${s.cid}/mute`, { body: { muted: true } })).status, 401);
  });

  // ── 8: аватары и профиль ──────────────────────────────────────────────
  it("в данных диалога у каждого участника — аватар/имя/steamId именно собеседника, без приватных полей", async () => {
    const s = await env.scenario();
    const pub = u => ({ displayName: u.displayName, avatar: u.avatar, steamId: u.steamId });
    for (const [viewer, other] of [[s.author, s.responder], [s.responder, s.author]]) {
      const list = (await api("GET", "/api/conversations", { user: viewer }));
      assert.deepEqual(list.body.conversations[0].other, pub(other));
      const g = await api("GET", msgUrl(s.cid), { user: viewer });
      assert.deepEqual(g.body.conversation.other, pub(other));
      for (const r of [list, g]) {
        assert.ok(!r.raw.includes(viewer.steamId) || viewer.steamId === other.steamId, "собственные данные не должны дублироваться как «собеседник»");
        assert.ok(!/discordUsername|telegramUsername|blockedUsers|"ds\d+"/.test(r.raw), "приватные поля не должны утекать");
      }
    }
    await M.User.deleteOne({ _id: s.responder._id });
    const g = await api("GET", msgUrl(s.cid), { user: s.author });
    assert.deepEqual(g.body.conversation.other, { displayName: "Удалённый пользователь", avatar: "", steamId: "" });   // нет ссылки на профиль
    assert.equal(g.body.conversation.otherDeleted, true);
  });

  // ── 9, 10: блокировки ─────────────────────────────────────────────────
  it("блокировка: запрещает сообщения и новые отклики в обе стороны через API, история сохраняется, разблокировка возвращает права", async () => {
    const s = await env.scenario();
    const mine = await send(s, s.responder, "до блокировки");
    const msgCount = await M.Message.countDocuments({ conversationId: s.cid });

    // блокирует автор; в теле пытаются подсунуть чужой/свой id — он игнорируется (цель определяется диалогом)
    const b = await api("POST", `/api/conversations/${s.cid}/block`, { user: s.author, body: { blocked: true, userId: String(s.author._id), targetId: String(s.author._id) } });
    assert.equal(b.status, 200);
    let author = await M.User.findById(s.author._id).lean();
    assert.deepEqual(author.blockedUsers.map(String), [String(s.responder._id)]);
    await api("POST", `/api/conversations/${s.cid}/block`, { user: s.author, body: { blocked: true } });      // идемпотентно
    assert.equal((await M.User.findById(s.author._id).lean()).blockedUsers.length, 1);

    // заблокированный не может писать/откликаться (в т.ч. повторно и на другие объявления автора)
    assert.equal((await api("POST", msgUrl(s.cid), { user: s.responder, body: { text: "обход" } })).status, 403);
    const again = await api("POST", `/api/listings/${s.listing._id}/responses`, { user: s.responder, body: { message: "повторный отклик" } });
    assert.equal(again.status, 403);
    assert.equal((await M.ListingResponse.findOne({ listingId: s.listing._id })).message, "Привет, хочу в команду");   // не обновлён
    const second = await env.mkListing(s.author);
    assert.equal((await api("POST", `/api/listings/${second._id}/responses`, { user: s.responder, body: { message: "новое" } })).status, 403);
    assert.equal(await M.Conversation.countDocuments({ listingId: second._id }), 0);
    assert.equal(await M.ListingResponse.countDocuments({ listingId: second._id }), 0);
    // блокирующий тоже не пишет, пока блок не снят
    const self = await api("POST", msgUrl(s.cid), { user: s.author, body: { text: "я заблокировал" } });
    assert.equal(self.status, 403);
    assert.equal(await M.Message.countDocuments({ conversationId: s.cid }), msgCount);

    // история читается обоими; направление блокировки не раскрывается заблокированному
    const ga = await api("GET", msgUrl(s.cid), { user: s.author }), gr = await api("GET", msgUrl(s.cid), { user: s.responder });
    assert.equal(ga.body.messages.length, msgCount); assert.equal(gr.body.messages.length, msgCount);
    assert.deepEqual([ga.body.conversation.canSend, ga.body.conversation.blockedByMe], [false, true]);
    assert.deepEqual([gr.body.conversation.canSend, gr.body.conversation.blockedByMe], [false, false]);
    assert.equal((await api("GET", "/api/conversations", { user: s.author })).body.conversations[0].blockedByMe, true);
    // правка при блокировке запрещена, удаление своего сообщения — разрешено
    assert.equal((await api("PATCH", msgUrl(s.cid, mine._id), { user: s.responder, body: { text: "переписал" } })).status, 403);
    assert.equal((await M.Message.findById(mine._id).lean()).text, "до блокировки");
    assert.equal((await api("DELETE", msgUrl(s.cid, mine._id), { user: s.responder })).status, 200);
    assert.equal(await M.Conversation.countDocuments({ _id: s.cid }), 1);             // ничего не удалено

    // разблокировка возвращает права
    assert.equal((await api("POST", `/api/conversations/${s.cid}/block`, { user: s.author, body: { blocked: false } })).status, 200);
    author = await M.User.findById(s.author._id).lean(); assert.equal((author.blockedUsers || []).length, 0);
    assert.equal((await api("POST", msgUrl(s.cid), { user: s.responder, body: { text: "снова на связи" } })).status, 200);
    assert.equal((await api("POST", msgUrl(s.cid), { user: s.author, body: { text: "и я" } })).status, 200);
    assert.equal((await api("POST", `/api/listings/${second._id}/responses`, { user: s.responder, body: { message: "теперь можно" } })).status, 200);
    assert.equal((await api("GET", msgUrl(s.cid), { user: s.responder })).body.conversation.canSend, true);
  });

  it("блокировка со стороны откликнувшегося тоже работает в обе стороны; лимит списка; валидация и доступ", async () => {
    const s = await env.scenario();
    assert.equal((await api("POST", `/api/conversations/${s.cid}/block`, { user: s.responder, body: { blocked: true } })).status, 200);
    assert.equal((await api("POST", msgUrl(s.cid), { user: s.author, body: { text: "автору запрещено" } })).status, 403);
    assert.equal((await api("POST", msgUrl(s.cid), { user: s.responder, body: { text: "и блокирующему" } })).status, 403);
    assert.equal((await api("POST", `/api/listings/${s.listing._id}/responses`, { user: s.responder, body: { message: "блокирующий пишет автору" } })).status, 403);
    await api("POST", `/api/conversations/${s.cid}/block`, { user: s.responder, body: { blocked: false } });

    const fake = n => Array.from({ length: n }, () => new env.mongoose.Types.ObjectId());
    await M.User.updateOne({ _id: s.author._id }, { blockedUsers: fake(100) });
    assert.equal((await api("POST", `/api/conversations/${s.cid}/block`, { user: s.author, body: { blocked: true } })).status, 409);   // лимит 100
    assert.equal((await M.User.findById(s.author._id).lean()).blockedUsers.length, 100);
    await M.User.updateOne({ _id: s.author._id }, { blockedUsers: fake(99) });
    assert.equal((await api("POST", `/api/conversations/${s.cid}/block`, { user: s.author, body: { blocked: true } })).status, 200);
    assert.equal((await M.User.findById(s.author._id).lean()).blockedUsers.length, 100);

    const outsider = await env.mkUser();
    assert.equal((await api("POST", `/api/conversations/${s.cid}/block`, { user: outsider, body: { blocked: true } })).status, 404);
    assert.equal((await api("POST", `/api/conversations/${s.cid}/block`, { body: { blocked: true } })).status, 401);
    for (const blocked of ["true", 1, null, undefined])
      assert.equal((await api("POST", `/api/conversations/${s.cid}/block`, { user: s.responder, body: { blocked } })).status, 400);
    assert.equal(((await M.User.findById(outsider._id).lean()).blockedUsers || []).length, 0);
  });

  it("хранилище: у обычных данных новые поля не создаются (нет роста документов без использования функций)", async () => {
    const s = await env.scenario(); await send(s, s.responder, "обычное");
    const conv = await M.Conversation.collection.findOne({ _id: oid(s.cid) });
    for (const f of ["authorMuted", "responderMuted", "lastChangeAt"]) assert.ok(!(f in conv), f);
    const msg = await M.Message.collection.findOne({ conversationId: oid(s.cid) });
    for (const f of ["editedAt", "deletedAt"]) assert.ok(!(f in msg), f);
    assert.ok(!("blockedUsers" in (await M.User.collection.findOne({ _id: s.author._id }))));
    // индексы чата не добавлялись: по-прежнему только исходные (+ _id)
    const ci = (await M.Conversation.collection.indexes()).map(i => Object.keys(i.key).join("+")).sort();
    assert.deepEqual(ci, ["_id", "authorId+lastMessageAt", "listingId+responderId", "responderId+lastMessageAt"]);
    const mi = (await M.Message.collection.indexes()).map(i => Object.keys(i.key).join("+")).sort();
    assert.deepEqual(mi, ["_id", "conversationId+createdAt+_id", "senderId+createdAt"]);
  });

  // ── 11, 12: жалобы ────────────────────────────────────────────────────
  it("жалоба: принимается от авторизованного, личность и объявление берутся не из тела; дубликаты и неверные запросы отклоняются", async () => {
    const author = await env.mkUser(), reporter = await env.mkUser(), other = await env.mkUser();
    const l = await env.mkListing(author), url = `/api/listings/${l._id}/report`;
    assert.equal((await api("POST", url, { body: { reason: "spam" } })).status, 401);
    for (const body of [{}, { reason: "evil" }, { reason: 5 }, { reason: ["spam"] }, { reason: { $ne: 1 } }, { reason: "spam", details: 5 }, { reason: "spam", details: "x".repeat(501) }, { reason: "spam", details: "a\u0000b" }])
      assert.equal((await api("POST", url, { user: reporter, body })).status, 400, JSON.stringify(body));
    assert.equal((await api("POST", url, { user: author, body: { reason: "spam" } })).status, 400);            // своё объявление
    assert.equal((await api("POST", `/api/listings/${new env.mongoose.Types.ObjectId()}/report`, { user: reporter, body: { reason: "spam" } })).status, 404);
    for (const bad of ["abc", "%7B%7D"]) assert.equal((await api("POST", `/api/listings/${bad}/report`, { user: reporter, body: { reason: "spam" } })).status, 404);
    const hidden = await env.mkListing(author, { hiddenByAdmin: true }), inactive = await env.mkListing(author, { active: false });
    for (const x of [hidden, inactive]) assert.equal((await api("POST", `/api/listings/${x._id}/report`, { user: reporter, body: { reason: "spam" } })).status, 404);
    assert.equal(await M.ListingReport.countDocuments({}), 0 + (await M.ListingReport.countDocuments({})));    // ничего лишнего не создано выше
    const before = await M.ListingReport.countDocuments({ listingId: l._id });
    assert.equal(before, 0);

    const ok = await api("POST", url, { user: reporter, body: { reason: "scam", details: "  ведёт на сторонний сайт  ", reporterId: String(other._id), listingId: String(hidden._id) } });
    assert.equal(ok.status, 200, ok.raw);
    const docs = await M.ListingReport.find({ listingId: l._id }).lean();
    assert.equal(docs.length, 1); assert.equal(String(docs[0].reporterId), String(reporter._id));           // из сессии, не из тела
    assert.equal(docs[0].details, "ведёт на сторонний сайт"); assert.equal(docs[0].reason, "scam");
    assert.equal((await api("POST", url, { user: reporter, body: { reason: "spam" } })).status, 409);       // дубликат
    assert.equal(await M.ListingReport.countDocuments({ listingId: l._id, reporterId: reporter._id }), 1);
    assert.equal((await api("POST", url, { user: other, body: { reason: "spam" } })).status, 200);          // другой пользователь — можно
    const noDetails = await M.ListingReport.collection.findOne({ listingId: l._id, reporterId: other._id });
    assert.ok(!("details" in noDetails));                                                                     // пустое описание не хранится
    const idx = (await M.ListingReport.collection.indexes()).map(i => Object.keys(i.key).join("+") + (i.unique ? "!" : "")).sort();
    assert.deepEqual(idx, ["_id", "listingId+reporterId!", "reporterId+createdAt"]);
  });

  it("жалобы: лимит в час на пользователя", async () => {
    const author = await env.mkUser(), reporter = await env.mkUser();
    const ls = []; for (let i = 0; i < 6; i++) ls.push(await env.mkListing(author));
    const codes = []; for (const l of ls) codes.push((await api("POST", `/api/listings/${l._id}/report`, { user: reporter, body: { reason: "spam" } })).status);
    assert.deepEqual(codes, [200, 200, 200, 200, 200, 429]);
    assert.equal(await M.ListingReport.countDocuments({ reporterId: reporter._id }), 5);
  });

  it("жалобы видит и отклоняет только администратор; в публичных ответах их нет; удаляются вместе с объявлением", async () => {
    const author = await env.mkUser(), reporter = await env.mkUser(), user = await env.mkUser();
    const l = await env.mkListing(author, { title: "ЖАЛОБА_ТЕСТ_" + Date.now() });
    await api("POST", `/api/listings/${l._id}/report`, { user: reporter, body: { reason: "inappropriate", details: "<b>детали</b>" } });

    for (const [method, path] of [["GET", "/api/admin/listings/reports"], ["DELETE", `/api/admin/listings/reports/${new env.mongoose.Types.ObjectId()}`]]) {
      assert.equal((await api(method, path, { user })).status, 403);
      assert.equal((await api(method, path, { user: author })).status, 403);
      assert.equal((await api(method, path, { user: reporter })).status, 403);
      assert.equal((await api(method, path)).status, 403);
    }
    const list = await api("GET", "/api/admin/listings/reports?limit=50", { user: env.admin });
    assert.equal(list.status, 200);
    const item = list.body.items.find(i => i.listing && i.listing._id === String(l._id));
    assert.ok(item); assert.equal(item.reason, "inappropriate"); assert.equal(item.details, "<b>детали</b>");
    assert.equal(item.reporter.displayName, reporter.displayName); assert.equal(item.listing.author.displayName, author.displayName);
    assert.equal(item.listing.title, l.title);

    for (const url of [`/api/listings/${l._id}`, "/api/listings"]) {                                          // публично и для автора жалоб нет
      for (const user of [undefined, author, reporter]) {
        const r = await api("GET", url, { user });
        assert.ok(!/inappropriate|<b>детали|reporter/.test(r.raw), url);
      }
    }
    assert.equal((await api("GET", `/api/listings/${l._id}/responses`, { user: author })).status, 200);
    assert.ok(!(await api("GET", `/api/listings/${l._id}/responses`, { user: author })).raw.includes("детали"));

    // скрытие из жалоб через существующий admin-hide; отклонение удаляет документ
    assert.equal((await api("PATCH", `/api/listings/${l._id}/admin-hide`, { user: env.admin, body: { hidden: true } })).status, 200);
    assert.equal((await api("DELETE", `/api/admin/listings/reports/${item._id}`, { user: env.admin })).status, 200);
    assert.equal(await M.ListingReport.countDocuments({ _id: item._id }), 0);
    assert.equal((await api("DELETE", `/api/admin/listings/reports/${item._id}`, { user: env.admin })).status, 404);
    assert.equal((await api("DELETE", "/api/admin/listings/reports/not-an-id", { user: env.admin })).status, 404);

    // каскад при удалении объявления
    const l2 = await env.mkListing(author);
    await api("POST", `/api/listings/${l2._id}/report`, { user: reporter, body: { reason: "spam" } });
    assert.equal(await M.ListingReport.countDocuments({ listingId: l2._id }), 1);
    assert.equal((await api("DELETE", `/api/listings/${l2._id}`, { user: author })).status, 200);
    assert.equal(await M.ListingReport.countDocuments({ listingId: l2._id }), 0);
    // пагинация жалоб
    const p = await api("GET", "/api/admin/listings/reports?limit=1&page=1", { user: env.admin });
    assert.equal(p.body.items.length <= 1, true); assert.ok(p.body.pages >= 1);
  });
});
