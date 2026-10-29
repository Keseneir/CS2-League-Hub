// Окружение интеграционных тестов поддержки.
// ВАЖНО: модели SupportGuest/SupportThread/SupportMessage и utils/telegramSupport в рабочую копию не передавались,
// поэтому здесь используются ЗАГЛУШКИ, воссозданные по полям, которые реально использует routes/support.js.
// Реальные схемы могут отличаться — тесты проверяют логику маршрута, а не ваши модели. Telegram и Cloudinary — шпионы (сети нет).
const Module = require("module");
const express = require("express");
const mongoose = require("mongoose");

async function startSupportEnv(uri) {
  await mongoose.connect(uri);
  await mongoose.connection.dropDatabase();                  // только тестовая БД (проверено в getTestDb)
  const S = mongoose.Schema;
  const SupportGuest = mongoose.model("SupportGuest", new S({
    guestId: { type: String, required: true, unique: true }, guestName: { type: String, default: "" },
    guestAvatar: { type: String, default: "" }, isBlocked: { type: Boolean, default: false } }, { timestamps: true }));
  const SupportThread = mongoose.model("SupportThread", new S({
    guestId: { type: String, required: true, index: true }, subject: String, status: { type: String, default: "open" },
    telegramMessageIds: { type: [Number], default: [] }, lastMessageAt: { type: Date, default: null } }, { timestamps: true }));
  const SupportMessage = mongoose.model("SupportMessage", new S({
    threadId: { type: S.Types.ObjectId, index: true }, from: String, text: String, authorName: String, authorAvatar: String,
    attachmentUrl: { type: String, default: "" }, attachmentPublicId: { type: String, default: "" }, attachmentExpiresAt: { type: Date, default: null } }, { timestamps: true }));

  const tg = { calls: [], next: 1000, sendTelegramMessage: async (text, replyTo) => { tg.calls.push({ text, replyTo }); return tg.next++; } };
  const cl = { destroyed: [], destroyCloudinaryAsset: async id => { cl.destroyed.push(id); } };

  const origLoad = Module._load;
  Module._load = function (request, parent) {
    if (parent && /routes[\\/]support\.js$/.test(parent.filename)) {
      if (request === "../models/SupportGuest") return SupportGuest;
      if (request === "../models/SupportThread") return SupportThread;
      if (request === "../models/SupportMessage") return SupportMessage;
      if (request === "../utils/telegramSupport") return tg;
      if (request === "../utils/cloudinaryCleanup") return cl;
    }
    return origLoad.apply(this, arguments);
  };
  let router;
  try { router = require("../../routes/support.js"); } finally { Module._load = origLoad; }

  const app = express();
  app.use(express.json());
  app.use("/api/support", router);
  let server; await new Promise(r => { server = app.listen(0, "127.0.0.1", r); });
  const port = server.address().port;

  async function api(method, path, { headers, body } = {}) {
    const h = { "content-type": "application/json", ...(headers || {}) };
    const res = await fetch(`http://127.0.0.1:${port}${path}`, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
    let json = null; try { json = await res.json(); } catch {}
    return { status: res.status, body: json, raw: json === null ? "" : JSON.stringify(json) };
  }
  async function stop() {
    await new Promise(r => server.close(r));
    await mongoose.connection.dropDatabase(); await mongoose.disconnect();
  }
  return { api, stop, tg, cl, M: { SupportGuest, SupportThread, SupportMessage }, mongoose };
}
module.exports = { startSupportEnv };
