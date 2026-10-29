// Интеграционные тесты доступа к тикетам поддержки и удаления вложений из Cloudinary.
// Нужна ИЗОЛИРОВАННАЯ тестовая БД (tests/helpers/testDb.js). Модели поддержки — заглушки (см. supportEnv.js).
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { getTestDb, withDbName } = require("../helpers/testDb");
const { startSupportEnv } = require("../helpers/supportEnv");

const db = getTestDb();
const CLOUD = "testcloud", SECRET = "test-secret";
const URL_A = "https://res.cloudinary.com/testcloud/image/upload/v1712345678/abc123XYZ.jpg";
const URL_V = "https://res.cloudinary.com/testcloud/image/upload/v1700000000/listings/victim.png";
const sign = (pid, ver, secret = SECRET) => crypto.createHash("sha1").update(`public_id=${pid}&version=${ver}${secret}`).digest("hex");
const NOT_FOUND = { error: "Тикет не найден" };

describe("поддержка: доступ к тикетам и вложения (интеграция, изолированная БД)", { skip: db.skip }, () => {
  let env, api, M, tg, cl;
  before(async () => {
    process.env.CLOUDINARY_CLOUD_NAME = CLOUD; process.env.CLOUDINARY_API_SECRET = SECRET;
    env = await startSupportEnv(withDbName(db.uri, "support")); ({ api, M, tg, cl } = env);
  });
  after(async () => { if (env) await env.stop(); });

  const newGuest = () => crypto.randomUUID();
  const hdr = g => ({ "X-Support-Guest-Id": g });
  async function ticket(guestId, subject = "Вопрос по турниру") {
    const r = await api("POST", "/api/support/ticket", { body: { guestId, subject, guestName: "Игрок" } });
    assert.equal(r.status, 200, r.raw); return r.body.ticket;
  }
  const rewind = id => M.SupportThread.updateOne({ _id: id }, { lastMessageAt: new Date(0) });   // обход ограничения 3 с между сообщениями
  async function msg(guestId, ticketId, text, extra = {}) {
    await rewind(ticketId);
    return api("POST", "/api/support/message", { body: { guestId, ticketId, text, ...extra } });
  }
  const expireAll = () => M.SupportMessage.updateMany({ attachmentUrl: { $ne: "" } }, { attachmentExpiresAt: new Date(Date.now() - 1000) });
  const row = id => M.SupportMessage.findById(id).lean();
  const signed = (pid, url, ver = 1712345678) => ({ attachmentUrl: url, attachmentPublicId: pid, attachmentVersion: ver, attachmentSignature: sign(pid, ver) });

  // ── доступ к тикетам ───────────────────────────────────────────────────
  it("владелец читает свой тикет; Telegram-мост, список и закрытие тикета работают как раньше", async () => {
    const g = newGuest(), t = await ticket(g);
    const before = tg.calls.length;
    const m = await msg(g, t.id, "Здравствуйте, вопрос про сетку");
    assert.equal(m.status, 200, m.raw);
    assert.equal(tg.calls.length, before + 1);
    assert.ok(tg.calls.at(-1).text.includes(`#${t.number}`) && tg.calls.at(-1).text.includes("Вопрос по турниру") && tg.calls.at(-1).text.includes("Здравствуйте, вопрос про сетку"));
    assert.equal((await M.SupportThread.findById(t.id).lean()).telegramMessageIds.length, 1);

    const r = await api("GET", `/api/support/thread/${t.id}`, { headers: hdr(g) });
    assert.equal(r.status, 200, r.raw);
    assert.equal(r.body.messages.length, 1); assert.equal(r.body.thread.number, t.number);
    assert.ok(!/attachmentPublicId|publicId/i.test(r.raw), "publicId не должен уходить клиенту");

    const list = await api("GET", `/api/support/tickets/${g}`);
    assert.equal(list.body.tickets.length, 1); assert.equal(list.body.tickets[0].id, t.id);

    const res = await api("POST", `/api/support/ticket/${t.id}/resolve`, { body: { guestId: g } });
    assert.equal(res.status, 200); assert.ok(tg.calls.at(-1).text.includes("решённый"));
    assert.equal((await msg(g, t.id, "ещё одно")).status, 409);
  });

  it("чтение чужого/несуществующего тикета: любой неавторизованный запрос — одинаковый 404", async () => {
    const a = newGuest(), b = newGuest(), t = await ticket(a);
    await msg(a, t.id, "личные данные: мой ник Discord x#1");
    const cases = {
      "без guestId": {}, "чужой гость (B)": hdr(b), "слишком короткий guestId": hdr("short"),
      "guestId в виде идентификатора тикета": hdr(t.id), "guestId в query, а не в заголовке": {}, "пустой заголовок": hdr(""),
    };
    const results = [];
    for (const [name, headers] of Object.entries(cases)) {
      const url = name.includes("query") ? `/api/support/thread/${t.id}?guestId=${a}` : `/api/support/thread/${t.id}`;
      const r = await api("GET", url, { headers }); results.push([name, r]);
    }
    for (const bad of [t.number, "abc", "507f1f77bcf86cd79943901z", String(new env.mongoose.Types.ObjectId()), "%7B%7D"])
      results.push(["id: " + bad, await api("GET", `/api/support/thread/${bad}`, { headers: hdr(a) })]);
    for (const [name, r] of results) { assert.equal(r.status, 404, name); assert.deepEqual(r.body, NOT_FOUND, name); assert.ok(!r.raw.includes("личные данные"), name); }
    // для сравнения: владелец получает данные
    assert.equal((await api("GET", `/api/support/thread/${t.id}`, { headers: hdr(a) })).status, 200);
  });

  it("запись в чужой тикет и закрытие чужого тикета запрещены; некорректные идентификаторы дают 404/400, а не 500", async () => {
    const a = newGuest(), b = newGuest(), t = await ticket(a); await ticket(b);
    await msg(a, t.id, "первое");
    const count = () => M.SupportMessage.countDocuments({ threadId: t.id });
    const n0 = await count();
    const wrong = await msg(b, t.id, "вторжение"); assert.equal(wrong.status, 404); assert.deepEqual(wrong.body, NOT_FOUND);
    const rs = await api("POST", `/api/support/ticket/${t.id}/resolve`, { body: { guestId: b } }); assert.equal(rs.status, 404); assert.deepEqual(rs.body, NOT_FOUND);
    assert.equal(await count(), n0); assert.equal((await M.SupportThread.findById(t.id).lean()).status, "open");
    for (const badId of ["abc", t.number, "{}"]) {
      assert.deepEqual((await api("POST", "/api/support/message", { body: { guestId: a, ticketId: badId, text: "x" } })).body, NOT_FOUND);
      assert.deepEqual((await api("POST", `/api/support/ticket/${badId}/resolve`, { body: { guestId: a } })).body, NOT_FOUND);
    }
    for (const g of ["", "short", 5, null]) {
      assert.equal((await api("POST", "/api/support/message", { body: { guestId: g, ticketId: t.id, text: "x" } })).status, 400);
      assert.equal((await api("POST", `/api/support/ticket/${t.id}/resolve`, { body: { guestId: g } })).status, 400);
    }
  });

  it("список тикетов: гость видит только свои; некорректный guestId даёт пустой ответ; короткий guestId не принимается при создании", async () => {
    const a = newGuest(), b = newGuest(); await ticket(a, "A1"); await ticket(a, "A2"); await ticket(b, "B1");
    const la = await api("GET", `/api/support/tickets/${a}`), lb = await api("GET", `/api/support/tickets/${b}`);
    assert.deepEqual(la.body.tickets.map(x => x.subject).sort(), ["A1", "A2"]); assert.deepEqual(lb.body.tickets.map(x => x.subject), ["B1"]);
    assert.deepEqual((await api("GET", "/api/support/tickets/short")).body, { guest: null, tickets: [] });
    assert.deepEqual((await api("GET", `/api/support/tickets/${newGuest()}`)).body, { guest: null, tickets: [] });
    const weak = await api("POST", "/api/support/ticket", { body: { guestId: "abc", subject: "x" } });
    assert.equal(weak.status, 400); assert.equal(await M.SupportGuest.countDocuments({ guestId: "abc" }), 0);
  });

  // ── вложения ───────────────────────────────────────────────────────────
  it("легитимное вложение с подписью Cloudinary: сохраняется с меткой, по истечении срока файл удаляется", async () => {
    const g = newGuest(), t = await ticket(g), d0 = cl.destroyed.length;
    const r = await msg(g, t.id, "скриншот", signed("abc123XYZ", URL_A));
    assert.equal(r.status, 200, r.raw); assert.equal(r.body.message.attachmentUrl, URL_A);
    const saved = await M.SupportMessage.findOne({ threadId: t.id, attachmentUrl: URL_A }).lean();
    assert.equal(saved.attachmentPublicId, "sig1:abc123XYZ"); assert.ok(saved.attachmentExpiresAt > new Date());
    assert.ok(tg.calls.at(-1).text.includes(URL_A));                                   // ссылка в Telegram — как раньше
    await expireAll();
    const read = await api("GET", `/api/support/thread/${t.id}`, { headers: hdr(g) });
    assert.equal(read.status, 200);
    assert.deepEqual(cl.destroyed.slice(d0), ["abc123XYZ"]);                           // удалён ровно этот файл, без служебной метки
    const after = await row(saved._id); assert.equal(after.attachmentUrl, ""); assert.equal(after.attachmentPublicId, "");
    assert.equal((await api("GET", `/api/support/thread/${t.id}`, { headers: hdr(g) })).body.messages.find(m => String(m._id) === String(saved._id)).attachmentUrl, "");
  });

  it("подделка publicId: чужой файл не удаляется (ни без подписи, ни с чужой/подменённой подписью)", async () => {
    const g = newGuest(), t = await ticket(g), d0 = cl.destroyed.length;
    const forged = [
      ["без подписи", { attachmentUrl: URL_V, attachmentPublicId: "listings/victim" }],
      ["подпись неверным секретом", { attachmentUrl: URL_V, attachmentPublicId: "listings/victim", attachmentVersion: 1700000000, attachmentSignature: sign("listings/victim", 1700000000, "guess") }],
      ["подпись своего файла к чужому publicId", { attachmentUrl: URL_V, attachmentPublicId: "listings/victim", attachmentVersion: 1712345678, attachmentSignature: sign("abc123XYZ", 1712345678) }],
      ["своя ссылка и подпись, но чужой publicId", { attachmentUrl: URL_A, attachmentPublicId: "listings/victim", attachmentVersion: 1712345678, attachmentSignature: sign("abc123XYZ", 1712345678) }],
      ["готовая метка от клиента", { attachmentUrl: URL_V, attachmentPublicId: "sig1:listings/victim" }],
    ];
    const ids = [];
    for (const [name, extra] of forged) {
      const r = await msg(g, t.id, "t " + name, extra);
      assert.equal(r.status, 200, name);
      const saved = await M.SupportMessage.findOne({ threadId: t.id, text: "t " + name }).lean();
      assert.equal(saved.attachmentPublicId, "", name); ids.push(saved._id);
    }
    await expireAll();
    assert.equal((await api("GET", `/api/support/thread/${t.id}`, { headers: hdr(g) })).status, 200);
    assert.deepEqual(cl.destroyed.slice(d0), [], "ни один чужой файл не должен удаляться");
    for (const id of ids) assert.equal((await row(id)).attachmentUrl, "");              // ссылки из БД очищены, как и раньше
  });

  it("некорректная ссылка вложения отклоняется до сохранения и отправки в Telegram", async () => {
    const g = newGuest(), t = await ticket(g);
    const n0 = await M.SupportMessage.countDocuments({ threadId: t.id }), tg0 = tg.calls.length;
    for (const url of ["http://res.cloudinary.com/testcloud/image/upload/v1/a.jpg", "https://evil.example/a.jpg", "javascript:alert(1)",
      URL_A + '" onerror="alert(1)', "https://res.cloudinary.com@evil.example/testcloud/image/upload/a.jpg", "https://res.cloudinary.com/othercloud/image/upload/v1/a.jpg"]) {
      const r = await msg(g, t.id, "с плохим вложением", { attachmentUrl: url, attachmentPublicId: "x" });
      assert.equal(r.status, 400, url); assert.deepEqual(r.body, { error: "Некорректное вложение" });
    }
    assert.equal(await M.SupportMessage.countDocuments({ threadId: t.id }), n0); assert.equal(tg.calls.length, tg0);
  });

  it("старые записи без серверной метки (мог подделать клиент) не удаляются из Cloudinary, ссылка очищается", async () => {
    const g = newGuest(), t = await ticket(g), d0 = cl.destroyed.length;
    const legacy = await M.SupportMessage.create({ threadId: t.id, from: "guest", text: "старое", attachmentUrl: URL_V, attachmentPublicId: "listings/victim", attachmentExpiresAt: new Date(Date.now() - 60000) });
    assert.equal((await api("GET", `/api/support/thread/${t.id}`, { headers: hdr(g) })).status, 200);
    assert.deepEqual(cl.destroyed.slice(d0), []);
    const after = await row(legacy._id); assert.equal(after.attachmentUrl, ""); assert.equal(after.attachmentPublicId, "");
  });

  it("очистку вложений не запускают неавторизованные запросы; авторизованное чтение — запускает", async () => {
    const a = newGuest(), b = newGuest(), t = await ticket(a), d0 = cl.destroyed.length;
    const planted = await M.SupportMessage.create({ threadId: t.id, from: "guest", text: "x", attachmentUrl: URL_A, attachmentPublicId: "sig1:abc123XYZ", attachmentExpiresAt: new Date(Date.now() - 60000) });
    for (const [url, headers] of [[`/api/support/thread/${t.id}`, {}], [`/api/support/thread/${t.id}`, hdr(b)], ["/api/support/thread/abc", hdr(a)], [`/api/support/thread/${new env.mongoose.Types.ObjectId()}`, hdr(a)]])
      assert.equal((await api("GET", url, { headers })).status, 404);
    assert.deepEqual(cl.destroyed.slice(d0), []); assert.equal((await row(planted._id)).attachmentUrl, URL_A);
    assert.equal((await api("GET", `/api/support/thread/${t.id}`, { headers: hdr(a) })).status, 200);
    assert.deepEqual(cl.destroyed.slice(d0), ["abc123XYZ"]); assert.equal((await row(planted._id)).attachmentUrl, "");
  });

  it("без CLOUDINARY_API_SECRET подпись проверить нельзя: вложение принимается, удаление пропускается", async () => {
    const g = newGuest(), t = await ticket(g), d0 = cl.destroyed.length;
    delete process.env.CLOUDINARY_API_SECRET;
    try {
      const r = await msg(g, t.id, "без секрета", signed("abc123XYZ", URL_A));
      assert.equal(r.status, 200);
      assert.equal((await M.SupportMessage.findOne({ threadId: t.id, text: "без секрета" }).lean()).attachmentPublicId, "");
    } finally { process.env.CLOUDINARY_API_SECRET = SECRET; }
    await expireAll();
    assert.equal((await api("GET", `/api/support/thread/${t.id}`, { headers: hdr(g) })).status, 200);
    assert.deepEqual(cl.destroyed.slice(d0), []);
  });

  it("очистка идёт порциями (не более 50 за запрос) и добирает остаток следующим чтением", async () => {
    const g = newGuest(), t = await ticket(g);
    await M.SupportMessage.insertMany(Array.from({ length: 55 }, (_, i) => ({ threadId: t.id, from: "guest", text: "m" + i, attachmentUrl: URL_V, attachmentPublicId: "", attachmentExpiresAt: new Date(Date.now() - 1000) })));
    const left = () => M.SupportMessage.countDocuments({ threadId: t.id, attachmentUrl: { $ne: "" } });
    await api("GET", `/api/support/thread/${t.id}`, { headers: hdr(g) }); assert.equal(await left(), 5);
    await api("GET", `/api/support/thread/${t.id}`, { headers: hdr(g) }); assert.equal(await left(), 0);
  });
});
