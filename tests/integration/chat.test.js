// Интеграционные тесты чата, откликов, админки объявлений. Нужна ИЗОЛИРОВАННАЯ тестовая БД:
//   TEST_MONGODB_URI=mongodb://127.0.0.1:27017/cs2hub_test node --test
// Без переменной (или с «небезопасным» URI) тесты пропускаются — см. tests/helpers/testDb.js.
// Роутеры монтируются в минимальное express-приложение с подменой авторизации (заголовок x-test-user);
// server.js не импортируется (он сам подключает Mongo и вызывает listen).
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const mongoose = require("mongoose");
const { getTestDb } = require("../helpers/testDb");

const db = getTestDb();
process.env.CLOUDINARY_CLOUD_NAME = "testcloud";

describe("чат по объявлениям (интеграция, изолированная БД)", { skip: db.skip }, () => {
  let server, port, User, Listing, ListingResponse, Conversation, Message, ADMIN_STEAM_ID, admin;
  let seq = 0;

  async function api(method, path, { user, body } = {}) {
    const headers = { "content-type": "application/json" };
    if (user) headers["x-test-user"] = String(user._id || user);
    const res = await fetch(`http://127.0.0.1:${port}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    let json = null; try { json = await res.json(); } catch {}
    return { status: res.status, body: json };
  }
  const mkUser = (o = {}) => { seq++; return User.create({ steamId: "76561190" + String(seq).padStart(9, "0"), displayName: "Игрок" + seq, discordUsername: "ds" + seq, ...o }); };
  const mkListing = (author, o = {}) => Listing.create({ authorId: author._id, type: "player_seeking_team", title: "Ищу команду", description: "Опыт 3000 часов", ...o });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  async function scenario() {
    const author = await mkUser(), responder = await mkUser(), listing = await mkListing(author);
    const r = await api("POST", `/api/listings/${listing._id}/responses`, { user: responder, body: { message: "Привет, хочу в команду" } });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    return { author, responder, listing, cid: r.body.conversationId, r };
  }
  const msgUrl = cid => `/api/conversations/${cid}/messages`;

  before(async () => {
    await mongoose.connect(db.uri);
    await mongoose.connection.dropDatabase();          // только тестовая БД (см. guard)
    ({ ADMIN_STEAM_ID } = require("../../config/constants"));
    User = require("../../models/User"); Listing = require("../../models/Listing"); ListingResponse = require("../../models/ListingResponse");
    Conversation = require("../../models/Conversation"); Message = require("../../models/Message");
    await Promise.all([User, Listing, ListingResponse, Conversation, Message].map(m => m.init())); // построить индексы (в т.ч. unique)
    admin = await mkUser({ steamId: ADMIN_STEAM_ID, displayName: "Админ" });

    const app = express();
    app.use(express.json());
    app.use(async (req, res, next) => {
      const id = req.headers["x-test-user"];
      req.user = id ? await User.findById(id) : undefined;
      req.isAuthenticated = () => !!req.user;
      next();
    });
    app.use("/api/listings", require("../../routes/listings"));
    app.use("/api/conversations", require("../../routes/conversations"));
    app.use("/api/admin/listings", require("../../routes/adminListings"));
    await new Promise(r => { server = app.listen(0, "127.0.0.1", r); });
    port = server.address().port;
  });
  after(async () => {
    if (server) await new Promise(r => server.close(r));
    if (mongoose.connection.readyState) { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); }
  });

  // ── 1, 8: старт диалога через успешный отклик; дубликаты ──────────────
  it("успешный отклик создаёт ровно один диалог с первым сообщением; отклик и диалог не дублируются", async () => {
    const s = await scenario();
    assert.ok(s.cid);
    assert.equal(await Conversation.countDocuments({ listingId: s.listing._id }), 1);
    assert.equal(await ListingResponse.countDocuments({ listingId: s.listing._id }), 1);
    const msgs = await Message.find({ conversationId: s.cid }).lean();
    assert.equal(msgs.length, 1); assert.equal(msgs[0].text, "Привет, хочу в команду"); assert.equal(String(msgs[0].senderId), String(s.responder._id));

    const again = await api("POST", `/api/listings/${s.listing._id}/responses`, { user: s.responder, body: { message: "Обновлённый текст отклика" } });
    assert.equal(again.status, 200);
    assert.equal(String(again.body.conversationId), String(s.cid));                         // тот же диалог
    assert.equal(await Conversation.countDocuments({ listingId: s.listing._id }), 1);
    assert.equal(await ListingResponse.countDocuments({ listingId: s.listing._id }), 1);    // существующее поведение: отклик обновился
    assert.equal((await ListingResponse.findOne({ listingId: s.listing._id })).message, "Обновлённый текст отклика");
    assert.equal(await Message.countDocuments({ conversationId: s.cid }), 1);               // первое сообщение не дублируется
  });

  it("параллельное создание диалога даёт один диалог и одно первое сообщение (уникальный индекс + E11000-retry)", async () => {
    const author = await mkUser(), responder = await mkUser(), listing = await mkListing(author);
    const results = await Promise.all(Array.from({ length: 8 }, () =>
      Conversation.ensureForResponse({ listingId: listing._id, authorId: author._id, responderId: responder._id, firstMessage: "первое" })));
    assert.equal(new Set(results.map(r => String(r.conversation._id))).size, 1);
    assert.equal(await Conversation.countDocuments({ listingId: listing._id }), 1);
    assert.equal(await Message.countDocuments({ conversationId: results[0].conversation._id }), 1);
    assert.equal(results.filter(r => r.created).length, 1);
    const idx = await Conversation.collection.indexes();
    assert.ok(idx.some(i => i.unique && i.key.listingId === 1 && i.key.responderId === 1), "уникальный индекс не создан");
  });

  // ── неудачные отклики не создают диалогов ─────────────────────────────
  it("отклики, не прошедшие существующую валидацию, не создают диалог", async () => {
    const author = await mkUser(), listing = await mkListing(author);
    const u = await mkUser(), noContacts = await mkUser({ discordUsername: "", telegramUsername: "" });
    const inactive = await mkListing(author, { active: false }), hidden = await mkListing(author, { hiddenByAdmin: true });
    const cases = [
      [u, listing, { message: "   " }, 400], [u, listing, {}, 400], [u, listing, { message: "x".repeat(501) }, 400],
      [author, listing, { message: "сам себе" }, 400],             // автор не может писать себе
      [noContacts, listing, { message: "привет" }, 400],            // нет контактов (существующее правило)
      [u, inactive, { message: "привет" }, 404], [u, hidden, { message: "привет" }, 404],
    ];
    for (const [user, l, body, status] of cases) {
      const r = await api("POST", `/api/listings/${l._id}/responses`, { user, body });
      assert.equal(r.status, status, JSON.stringify(body));
    }
    assert.equal((await api("POST", `/api/listings/${listing._id}/responses`, { body: { message: "привет" } })).status, 401);
    assert.equal(await Conversation.countDocuments({}), await Conversation.countDocuments({ listingId: { $nin: [listing._id, inactive._id, hidden._id] } }));
    assert.equal(await Conversation.countDocuments({ listingId: { $in: [listing._id, inactive._id, hidden._id] } }), 0);
    assert.equal(await ListingResponse.countDocuments({ listingId: { $in: [listing._id, inactive._id, hidden._id] } }), 0);
  });

  // ── 3, 11: чтение/отправка, персистентность ───────────────────────────
  it("оба участника читают и пишут; история сохраняется между запросами; отправитель берётся из сессии", async () => {
    const s = await scenario();
    const a = await api("GET", msgUrl(s.cid), { user: s.author });
    assert.equal(a.status, 200); assert.equal(a.body.messages.length, 1);
    assert.equal(a.body.messages[0].isMine, false); assert.equal(a.body.conversation.other.displayName, s.responder.displayName);
    assert.equal(a.body.conversation.listing.title, "Ищу команду");
    assert.equal((await api("GET", msgUrl(s.cid), { user: s.responder })).body.messages[0].isMine, true);

    const sendA = await api("POST", msgUrl(s.cid), { user: s.author, body: { text: "  Привет! Расскажи про роль  " } });
    assert.equal(sendA.status, 200); assert.equal(sendA.body.message.text, "Привет! Расскажи про роль"); assert.equal(sendA.body.message.isMine, true);
    await sleep(15);
    assert.equal((await api("POST", msgUrl(s.cid), { user: s.responder, body: { text: "Играю на AWP" } })).status, 200);

    for (const [user, mine] of [[s.author, [false, true, false]], [s.responder, [true, false, true]]]) {
      const h = await api("GET", msgUrl(s.cid), { user });          // «перезагрузка»: новый запрос — история на месте
      assert.deepEqual(h.body.messages.map(m => m.isMine), mine);
      assert.deepEqual(h.body.messages.map(m => m.text), ["Привет, хочу в команду", "Привет! Расскажи про роль", "Играю на AWP"]);
    }
    assert.equal(await Message.countDocuments({ conversationId: s.cid }), 3);

    const after = await api("GET", msgUrl(s.cid) + "?after=" + encodeURIComponent(new Date(Date.now() - 60000).toISOString()), { user: s.author });
    assert.equal(after.status, 200); assert.equal(after.body.conversation, undefined);
    assert.equal((await api("GET", msgUrl(s.cid) + "?after=garbage", { user: s.author })).status, 400);
    assert.equal((await api("GET", msgUrl(s.cid) + "?after[]=1", { user: s.author })).status, 400);
  });

  it("подделка senderId/conversationId/listingId в теле игнорируется", async () => {
    const s = await scenario(), other = await scenario();
    const r = await api("POST", msgUrl(s.cid), { user: s.responder, body: { text: "подделка", senderId: String(s.author._id), conversationId: String(other.cid), listingId: String(other.listing._id), authorId: String(s.author._id), isMine: false } });
    assert.equal(r.status, 200);
    const m = await Message.findOne({ text: "подделка" }).lean();
    assert.equal(String(m.senderId), String(s.responder._id)); assert.equal(String(m.conversationId), String(s.cid));
    assert.equal(await Message.countDocuments({ conversationId: other.cid }), 1);   // чужой диалог не затронут
  });

  // ── 4, 5: доступ (IDOR) ───────────────────────────────────────────────
  it("посторонний пользователь, админ и аноним не получают доступа к диалогу; ответы не раскрывают существование", async () => {
    const s = await scenario(), outsider = await mkUser();
    const fakeId = String(new mongoose.Types.ObjectId());
    for (const user of [outsider, admin]) {
      const g = await api("GET", msgUrl(s.cid), { user }), p = await api("POST", msgUrl(s.cid), { user, body: { text: "вторжение" } });
      const rd = await api("POST", `/api/conversations/${s.cid}/read`, { user, body: { upTo: new Date().toISOString() } });
      assert.deepEqual([g.status, p.status, rd.status], [404, 404, 404]);
      const missing = await api("GET", msgUrl(fakeId), { user });
      assert.deepEqual(g.body, missing.body);                                       // идентично «несуществующему»
      assert.equal((await api("GET", "/api/conversations", { user })).body.conversations.length, 0);
    }
    assert.equal(await Message.countDocuments({ text: "вторжение" }), 0);
    for (const bad of ["abc", "123", "507f1f77bcf86cd79943901z", "%7B%22%24ne%22%3A1%7D"])
      assert.equal((await api("GET", msgUrl(bad), { user: s.author })).status, 404);
    for (const [method, path, body] of [["GET", "/api/conversations"], ["GET", msgUrl(s.cid)], ["POST", msgUrl(s.cid), { text: "x" }], ["POST", `/api/conversations/${s.cid}/read`, { upTo: new Date().toISOString() }]])
      assert.equal((await api(method, path, { body })).status, 401, method + " " + path);   // аноним
  });

  // ── 7: валидация сообщений на сервере ─────────────────────────────────
  it("пустые, пробельные, нестроковые и слишком длинные сообщения отклоняются; 1000 символов допустимо", async () => {
    const s = await scenario();
    for (const text of ["", "   ", "\n\t", undefined, null, 123, { a: 1 }, ["x"], "x".repeat(1001), "a\u0000b"])
      assert.equal((await api("POST", msgUrl(s.cid), { user: s.author, body: { text } })).status, 400, JSON.stringify(text)?.slice(0, 20));
    assert.equal((await api("POST", msgUrl(s.cid), { user: s.author })).status, 400);
    assert.equal(await Message.countDocuments({ conversationId: s.cid }), 1);       // только seed
    assert.equal((await api("POST", msgUrl(s.cid), { user: s.author, body: { text: "я".repeat(1000) } })).status, 200);
    assert.equal((await api("POST", msgUrl(s.cid), { user: s.author, body: { text: "<img src=x onerror=alert(1)>" } })).status, 200);
    const h = await api("GET", msgUrl(s.cid), { user: s.responder });
    assert.equal(h.body.messages.at(-1).text, "<img src=x onerror=alert(1)>");      // хранится как есть, выводится через textContent на клиенте
  });

  // ── 10: непрочитанное ─────────────────────────────────────────────────
  it("непрочитанное: индикатор, счётчик, отметка только за себя, upTo без гонки, обрезка будущего времени", async () => {
    const s = await scenario(), cid = s.cid;
    const listFor = async user => (await api("GET", "/api/conversations", { user })).body.conversations.find(c => String(c._id) === String(cid));
    assert.equal((await listFor(s.author)).unread, false);                           // первое сообщение уже учтено откликом
    let cnt = (await api("GET", "/api/listings/unread-count", { user: s.author })).body;
    assert.deepEqual([cnt.count, cnt.messages], [1, 0]);                             // 1 непрочитанный отклик, сообщений нет

    await sleep(15);
    assert.equal((await api("POST", msgUrl(cid), { user: s.responder, body: { text: "второе" } })).status, 200);
    assert.equal((await listFor(s.author)).unread, true);
    assert.equal((await listFor(s.responder)).unread, false);                        // своё сообщение
    cnt = (await api("GET", "/api/listings/unread-count", { user: s.author })).body;
    assert.deepEqual([cnt.count, cnt.messages], [1, 1]);
    assert.equal((await api("GET", "/api/listings/unread-count", { user: s.responder })).body.messages, 0);

    // откликнувшийся не может «прочитать» за автора
    const before = await Conversation.findById(cid).lean();
    assert.equal((await api("POST", `/api/conversations/${cid}/read`, { user: s.responder, body: { upTo: new Date(Date.now() + 3600e3).toISOString() } })).status, 200);
    const mid = await Conversation.findById(cid).lean();
    assert.equal(String(mid.authorLastReadAt), String(before.authorLastReadAt));
    assert.equal((await listFor(s.author)).unread, true);
    assert.ok(new Date(mid.responderLastReadAt) <= new Date(mid.lastMessageAt), "будущее время должно обрезаться по lastMessageAt");

    // валидация upTo
    for (const upTo of [undefined, null, 5, "garbage", {}])
      assert.equal((await api("POST", `/api/conversations/${cid}/read`, { user: s.author, body: { upTo } })).status, 400);

    // upTo = время первого сообщения → новее последнего → всё ещё непрочитано (защита от гонки)
    const msgs = (await api("GET", msgUrl(cid), { user: s.author })).body.messages;
    assert.equal((await api("POST", `/api/conversations/${cid}/read`, { user: s.author, body: { upTo: msgs[0].createdAt } })).status, 200);
    assert.equal((await listFor(s.author)).unread, true);
    assert.equal((await api("POST", `/api/conversations/${cid}/read`, { user: s.author, body: { upTo: msgs[1].createdAt } })).status, 200);
    assert.equal((await listFor(s.author)).unread, false);
    assert.equal((await api("GET", "/api/listings/unread-count", { user: s.author })).body.messages, 0);
    // «назад» отметку сдвинуть нельзя
    const readAt = (await Conversation.findById(cid).lean()).authorLastReadAt;
    await api("POST", `/api/conversations/${cid}/read`, { user: s.author, body: { upTo: new Date(0).toISOString() } });
    assert.equal(String((await Conversation.findById(cid).lean()).authorLastReadAt), String(readAt));

    // ответ автора → непрочитано у откликнувшегося
    await sleep(15);
    await api("POST", msgUrl(cid), { user: s.author, body: { text: "ответ автора" } });
    assert.equal((await listFor(s.responder)).unread, true);
    assert.equal((await listFor(s.author)).unread, false);
  });

  it("существующий бейдж откликов не изменился: GET /:id/responses помечает отклики прочитанными, диалог не затрагивается", async () => {
    const s = await scenario();
    assert.equal((await api("GET", "/api/listings/unread-count", { user: s.author })).body.count, 1);
    const r = await api("GET", `/api/listings/${s.listing._id}/responses`, { user: s.author });
    assert.equal(r.status, 200); assert.equal(r.body.responses.length, 1);
    assert.equal(String(r.body.responses[0].conversationId), String(s.cid));
    assert.equal(r.body.responses[0].contacts.discordUsername, s.responder.discordUsername);
    assert.equal((await api("GET", "/api/listings/unread-count", { user: s.author })).body.count, 0);
    assert.equal((await api("GET", `/api/listings/${s.listing._id}/responses`, { user: s.responder })).status, 403);
  });

  // ── лимиты, бан, удалённый собеседник ─────────────────────────────────
  it("лимит частоты отправки (по БД): сверх лимита — 429, чужой лимит не затрагивается", async () => {
    const s = await scenario(); let ok = 0, limited = 0;
    for (let i = 0; i < 8; i++) { const r = await api("POST", msgUrl(s.cid), { user: s.responder, body: { text: "m" + i } }); if (r.status === 200) ok++; else if (r.status === 429) limited++; else assert.fail("status " + r.status); }
    assert.equal(ok, 4);        // 5 за окно, одно из них — первое сообщение (текст отклика)
    assert.equal(limited, 4);
    assert.equal((await api("POST", msgUrl(s.cid), { user: s.author, body: { text: "автор пишет свободно" } })).status, 200);
  });

  it("заблокированный пользователь (banned) получает 403 только в чате", async () => {
    const s = await scenario();
    await User.updateOne({ _id: s.responder._id }, { banned: true });
    for (const [m, p, b] of [["GET", "/api/conversations"], ["GET", msgUrl(s.cid)], ["POST", msgUrl(s.cid), { text: "x" }]])
      assert.equal((await api(m, p, { user: s.responder, body: b })).status, 403);
    assert.equal((await api("GET", msgUrl(s.cid), { user: s.author })).status, 200);
  });

  it("удалённый собеседник: история читается, отправка — 409, имя заменяется", async () => {
    const s = await scenario();
    await User.deleteOne({ _id: s.responder._id });
    const g = await api("GET", msgUrl(s.cid), { user: s.author });
    assert.equal(g.status, 200); assert.equal(g.body.conversation.canSend, false); assert.equal(g.body.conversation.other.displayName, "Удалённый пользователь");
    assert.equal(g.body.messages[0].senderName, "Удалённый пользователь");
    assert.equal((await api("POST", msgUrl(s.cid), { user: s.author, body: { text: "есть кто?" } })).status, 409);
    const list = (await api("GET", "/api/conversations", { user: s.author })).body.conversations[0];
    assert.equal(list.otherDeleted, true);
  });

  // ── статус объявления, каскад ─────────────────────────────────────────
  it("снятое/скрытое объявление не мешает действующему чату, но новых диалогов не создаёт; удаление объявления каскадно удаляет его чаты", async () => {
    const s = await scenario(), keep = await scenario();
    await Listing.updateOne({ _id: s.listing._id }, { hiddenByAdmin: true, active: false });
    assert.equal((await api("GET", msgUrl(s.cid), { user: s.author })).status, 200);
    assert.equal((await api("POST", msgUrl(s.cid), { user: s.author, body: { text: "чат работает" } })).status, 200);
    const newcomer = await mkUser();
    assert.equal((await api("POST", `/api/listings/${s.listing._id}/responses`, { user: newcomer, body: { message: "поздно" } })).status, 404);
    assert.equal(await Conversation.countDocuments({ listingId: s.listing._id }), 1);

    const del = await api("DELETE", `/api/listings/${s.listing._id}`, { user: s.author });
    assert.equal(del.status, 200);
    assert.equal(await Conversation.countDocuments({ listingId: s.listing._id }), 0);
    assert.equal(await Message.countDocuments({ conversationId: s.cid }), 0);
    assert.equal(await ListingResponse.countDocuments({ listingId: s.listing._id }), 0);
    assert.equal(await Conversation.countDocuments({ _id: keep.cid }), 1);          // чужое не тронуто
    assert.equal(await Message.countDocuments({ conversationId: keep.cid }), 1);
    assert.equal((await api("DELETE", `/api/listings/${keep.listing._id}`, { user: keep.responder })).status, 403);   // существующее правило
    assert.equal((await api("DELETE", `/api/listings/${keep.listing._id}`, { user: admin })).status, 200);            // админ может
    assert.equal(await Conversation.countDocuments({ _id: keep.cid }), 0);
  });

  it("GET /api/listings/:id отдаёт myConversationId только откликнувшемуся; публичные ответы не содержат личных данных", async () => {
    const s = await scenario(), stranger = await mkUser();
    assert.equal(String((await api("GET", `/api/listings/${s.listing._id}`, { user: s.responder })).body.listing.myConversationId), String(s.cid));
    assert.equal((await api("GET", `/api/listings/${s.listing._id}`, { user: stranger })).body.listing.myConversationId, null);
    assert.equal((await api("GET", `/api/listings/${s.listing._id}`, { user: s.author })).body.listing.myConversationId, undefined);
    const pub = await api("GET", `/api/listings/${s.listing._id}`);                    // аноним
    const txt = JSON.stringify(pub.body);
    assert.ok(!/Привет, хочу в команду|conversation|steamId/i.test(txt));
    const list = JSON.stringify((await api("GET", "/api/listings")).body);
    assert.ok(!/Привет, хочу в команду|conversationId|myConversationId/.test(list));
  });

  // ── картинки: валидация на сервере ────────────────────────────────────
  it("создание/правка объявления: принимается только Cloudinary HTTPS нашего облака, publicId должен соответствовать URL", async () => {
    const u = await mkUser();
    const good = "https://res.cloudinary.com/testcloud/image/upload/v1712345678/abcd1234.jpg";
    const base = { type: "player_seeking_team", title: "Ищу", description: "Описание" };
    const created = await api("POST", "/api/listings", { user: u, body: { ...base, image: { url: good, publicId: "abcd1234" } } });
    assert.equal(created.status, 200); assert.equal(created.body.listing.image.url, good);
    const bads = [
      { url: "http://res.cloudinary.com/testcloud/image/upload/v1/a.jpg" }, { url: "https://evil.com/a.jpg" },
      { url: "https://res.cloudinary.com@evil.com/testcloud/image/upload/a.jpg" }, { url: good + '" onerror="alert(1)' },
      { url: "javascript:alert(1)" }, { url: "https://res.cloudinary.com/othercloud/image/upload/v1/a.jpg" },
      { url: good, publicId: "чужой/ассет" }, "строка", ["x"], { url: 5 },
    ];
    for (const image of bads) {
      assert.equal((await api("POST", "/api/listings", { user: u, body: { ...base, image } })).status, 400, JSON.stringify(image));
      assert.equal((await api("PATCH", `/api/listings/${created.body.listing._id}`, { user: u, body: { image } })).status, 400, JSON.stringify(image));
    }
    assert.equal((await Listing.findById(created.body.listing._id)).image.url, good);   // не изменилось
    const cleared = await api("PATCH", `/api/listings/${created.body.listing._id}`, { user: u, body: { image: { url: "", publicId: "" } } });
    assert.equal(cleared.status, 200); assert.equal(cleared.body.listing.image.url, "");
  });

  // ── 11: существующая функциональность объявлений ──────────────────────
  it("регрессия: создание, публичная лента, правка автором, скрытие админом, права на правку", async () => {
    const author = await mkUser(), other = await mkUser();
    const c = await api("POST", "/api/listings", { user: author, body: { type: "player_seeking_team", title: "Регрессия", description: "Текст", role: "IGL" } });
    assert.equal(c.status, 200); const id = c.body.listing._id;
    assert.equal((await api("POST", "/api/listings", { body: { type: "scrim", title: "t", description: "d" } })).status, 401);
    assert.equal((await api("POST", "/api/listings", { user: author, body: { type: "bogus", title: "t", description: "d" } })).status, 400);
    const pub = await api("GET", "/api/listings?q=Регрессия"); assert.ok(pub.body.listings.some(l => l._id === id));
    assert.equal((await api("PATCH", `/api/listings/${id}`, { user: author, body: { title: "Новый заголовок" } })).status, 200);
    assert.equal((await api("PATCH", `/api/listings/${id}`, { user: other, body: { title: "взлом" } })).status, 403);
    assert.equal((await api("PATCH", `/api/listings/${id}`, { user: admin, body: { title: "взлом" } })).status, 403);   // как и раньше: правка только у автора
    assert.equal((await Listing.findById(id)).title, "Новый заголовок");
    assert.equal((await api("PATCH", `/api/listings/${id}/admin-hide`, { user: other, body: {} })).status, 403);
    assert.equal((await api("PATCH", `/api/listings/${id}/admin-hide`, { user: admin, body: { hidden: true } })).status, 200);
    assert.ok(!(await api("GET", "/api/listings?q=Новый")).body.listings.some(l => l._id === id));
    assert.equal((await api("GET", `/api/listings/${id}`, { user: other })).status, 404);
    assert.equal((await api("GET", `/api/listings/${id}`, { user: author })).status, 200);
  });

  // ── админка объявлений ────────────────────────────────────────────────
  it("админ-эндпоинты объявлений: доступ только админу, фильтры, пагинация, правка, без утечки откликов и чатов", async () => {
    const author = await mkUser(), user = await mkUser();
    const tag = "АДМ" + Date.now();
    const L = [];
    for (let i = 0; i < 3; i++) L.push(await mkListing(author, { title: `${tag} объявление ${i}`, image: i === 0 ? { url: "https://res.cloudinary.com/testcloud/image/upload/v1/a.jpg", publicId: "a" } : undefined }));
    await Listing.updateOne({ _id: L[1]._id }, { hiddenByAdmin: true });
    await Listing.updateOne({ _id: L[2]._id }, { active: false });
    await api("POST", `/api/listings/${L[0]._id}/responses`, { user, body: { message: "секретный отклик" } });

    assert.equal((await api("GET", "/api/admin/listings", { user })).status, 403);
    assert.equal((await api("GET", "/api/admin/listings")).status, 403);
    assert.equal((await api("PATCH", `/api/admin/listings/${L[0]._id}`, { user, body: { title: "x" } })).status, 403);

    const all = await api("GET", `/api/admin/listings?q=${encodeURIComponent(tag)}`, { user: admin });
    assert.equal(all.status, 200); assert.equal(all.body.total, 3);
    for (const [status, n] of [["active", 1], ["hidden", 1], ["inactive", 1]]) assert.equal((await api("GET", `/api/admin/listings?status=${status}&q=${encodeURIComponent(tag)}`, { user: admin })).body.total, n, status);
    const p = await api("GET", `/api/admin/listings?limit=2&page=2&q=${encodeURIComponent(tag)}`, { user: admin });
    assert.equal(p.body.items.length, 1); assert.equal(p.body.pages, 2);
    assert.equal((await api("GET", `/api/admin/listings?q=${encodeURIComponent(".*")}`, { user: admin })).body.total, 0);   // regex экранирован
    const txt = JSON.stringify(all.body);
    assert.ok(!/секретный отклик|responses|conversation|contacts/i.test(txt));
    assert.equal(all.body.items[0].author.displayName, author.displayName);

    const e = await api("PATCH", `/api/admin/listings/${L[0]._id}`, { user: admin, body: { title: "  Отредактировано  ", description: "Новое описание", role: "AWP", removeImage: true, authorId: String(user._id), hiddenByAdmin: true, active: false } });
    assert.equal(e.status, 200); assert.equal(e.body.item.title, "Отредактировано"); assert.equal(e.body.item.image.url, "");
    const fresh = await Listing.findById(L[0]._id).lean();
    assert.equal(String(fresh.authorId), String(author._id)); assert.equal(fresh.hiddenByAdmin, false); assert.equal(fresh.active, true);   // лишние поля игнорируются
    for (const body of [{}, { title: "" }, { title: "x".repeat(101) }, { title: 5 }, { removeImage: "yes" }])
      assert.equal((await api("PATCH", `/api/admin/listings/${L[0]._id}`, { user: admin, body })).status, 400, JSON.stringify(body));
    assert.equal((await api("PATCH", `/api/admin/listings/${new mongoose.Types.ObjectId()}`, { user: admin, body: { title: "x" } })).status, 404);
    assert.equal((await api("PATCH", "/api/admin/listings/not-an-id", { user: admin, body: { title: "x" } })).status, 404);
    // админ по-прежнему не может читать чужие диалоги
    const cid = (await Conversation.findOne({ listingId: L[0]._id }))._id;
    assert.equal((await api("GET", msgUrl(cid), { user: admin })).status, 404);
  });
});
