// Общее окружение интеграционных тестов: подключение к ИЗОЛИРОВАННОЙ тестовой БД, минимальное express-приложение
// с подменой авторизации (заголовок x-test-user) и вспомогательные фабрики.
const express = require("express");
const mongoose = require("mongoose");

async function startEnv(uri) {
  process.env.CLOUDINARY_CLOUD_NAME = "testcloud";
  await mongoose.connect(uri);
  await mongoose.connection.dropDatabase();           // только тестовая БД (имя проверено в getTestDb)
  const { ADMIN_STEAM_ID } = require("../../config/constants");
  const M = {
    User: require("../../models/User"), Listing: require("../../models/Listing"), ListingResponse: require("../../models/ListingResponse"),
    Conversation: require("../../models/Conversation"), Message: require("../../models/Message"), ListingReport: require("../../models/ListingReport"),
  };
  await Promise.all(Object.values(M).map(m => m.init()));   // построить индексы (в т.ч. unique)

  let seq = 0;
  const mkUser = (o = {}) => { seq++; return M.User.create({ steamId: "76561191" + String(seq).padStart(9, "0"), displayName: "Игрок" + seq, avatar: "https://avatars.example/a" + seq + ".jpg", discordUsername: "ds" + seq, ...o }); };
  const admin = await mkUser({ steamId: ADMIN_STEAM_ID, displayName: "Админ" });
  const mkListing = (author, o = {}) => M.Listing.create({ authorId: author._id, type: "player_seeking_team", title: "Ищу команду", description: "Опыт 3000 часов", ...o });

  const app = express();
  app.use(express.json());
  app.use(async (req, res, next) => {
    const id = req.headers["x-test-user"];
    req.user = id ? await M.User.findById(id) : undefined;
    req.isAuthenticated = () => !!req.user;
    next();
  });
  app.use("/api/listings", require("../../routes/listings"));
  app.use("/api/conversations", require("../../routes/conversations"));
  app.use("/api/admin/listings", require("../../routes/adminListings"));
  let server; await new Promise(r => { server = app.listen(0, "127.0.0.1", r); });
  const port = server.address().port;

  async function api(method, path, { user, body } = {}) {
    const headers = { "content-type": "application/json" };
    if (user) headers["x-test-user"] = String(user._id || user);
    const res = await fetch(`http://127.0.0.1:${port}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    let json = null; try { json = await res.json(); } catch {}
    return { status: res.status, body: json, raw: json === null ? "" : JSON.stringify(json) };
  }
  async function scenario() {
    const author = await mkUser(), responder = await mkUser(), listing = await mkListing(author);
    const r = await api("POST", `/api/listings/${listing._id}/responses`, { user: responder, body: { message: "Привет, хочу в команду" } });
    if (r.status !== 200) throw new Error("scenario: " + JSON.stringify(r.body));
    return { author, responder, listing, cid: r.body.conversationId };
  }
  async function stop() {
    await new Promise(r => server.close(r));
    await mongoose.connection.dropDatabase(); await mongoose.disconnect();
  }
  return { api, mkUser, mkListing, scenario, stop, admin, M, ADMIN_STEAM_ID, mongoose };
}
module.exports = { startEnv };
