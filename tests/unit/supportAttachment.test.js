const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { isValidGuestId, isObjectIdString, checkAttachmentUrl, publicIdMatchesUrl, verifyUploadSignature, resolveAttachment, deletablePublicId, VERIFIED_PREFIX } =
  require("../../utils/supportAttachment");

const CLOUD = "testcloud", SECRET = "test-secret";
const URL_A = "https://res.cloudinary.com/testcloud/image/upload/v1712345678/abc123XYZ.jpg";     // «наш» файл
const URL_V = "https://res.cloudinary.com/testcloud/image/upload/v1700000000/listings/victim.png"; // чужой файл (например, картинка объявления)
const sign = (pid, ver, secret = SECRET, algo = "sha1") => crypto.createHash(algo).update(`public_id=${pid}&version=${ver}${secret}`).digest("hex");
const ENV = { cloudName: CLOUD, apiSecret: SECRET };
const read = p => fs.readFileSync(path.join(__dirname, "../..", p), "utf8").replace(/\r\n/g, "\n");

test("guestId: допустимые форматы (UUID, 32 hex, прежний запасной) и отказ для коротких/опасных значений", () => {
  for (const ok of [crypto.randomUUID(), "g-" + "a1".repeat(16), "g-1712345678901-k3j2h1g0f9d", "A".repeat(16), "a".repeat(100)])
    assert.equal(isValidGuestId(ok), true, ok);
  for (const bad of ["", "abc", "a".repeat(15), "a".repeat(101), "has space 1234567890", "a/b/c/d/e/f/g/h/i/j", "id;drop 1234567890", "a\u0000".repeat(10),
    "%7B%22%24ne%22%3A1%7D1234567890", null, undefined, 5, {}, ["a".repeat(20)], { $ne: "x" }])
    assert.equal(isValidGuestId(bad), false, JSON.stringify(bad));
});

test("ObjectId тикета: ровно 24 hex-символа; короткий номер тикета (6 символов) не годится", () => {
  assert.equal(isObjectIdString("507f1f77bcf86cd799439011"), true);
  for (const bad of ["99439011", "507f1f77bcf86cd79943901z", "", {}, null, ["507f1f77bcf86cd799439011"], "507f1f77bcf86cd7994390111"]) assert.equal(isObjectIdString(bad), false);
});

test("ссылка вложения: только https res.cloudinary.com нашего облака /image/upload/, без спецсимволов", () => {
  assert.deepEqual(checkAttachmentUrl(URL_A, CLOUD), { ok: true, url: URL_A });
  for (const bad of [
    "http://res.cloudinary.com/testcloud/image/upload/v1/a.jpg", "https://evil.com/testcloud/image/upload/v1/a.jpg",
    "https://res.cloudinary.com.evil.com/testcloud/image/upload/v1/a.jpg", "https://res.cloudinary.com@evil.com/testcloud/image/upload/v1/a.jpg",
    "https://res.cloudinary.com/othercloud/image/upload/v1/a.jpg", "https://res.cloudinary.com/testcloud/raw/upload/v1/a.jpg",
    "https://res.cloudinary.com/testcloud/image/upload/", "javascript:alert(1)", "//res.cloudinary.com/testcloud/image/upload/v1/a.jpg",
    URL_A + '" onerror="alert(1)', URL_A + "' onmouseover='x", URL_A + "><script>", URL_A + " x", URL_A + "#f", "https://res.cloudinary.com:8443/testcloud/image/upload/a.jpg",
    "https://res.cloudinary.com/testcloud/image/upload/../../x.jpg", "x".repeat(600), "", "   ", null, undefined, 5, {}, [URL_A],
  ]) assert.equal(checkAttachmentUrl(bad, CLOUD).ok, false, String(bad).slice(0, 60));
  for (const c of [undefined, "", "bad cloud", "a/b"]) assert.equal(checkAttachmentUrl(URL_A, c).ok, false);
});

test("publicId обязан соответствовать пути ссылки", () => {
  assert.equal(publicIdMatchesUrl("abc123XYZ", URL_A), true);
  assert.equal(publicIdMatchesUrl("listings/victim", URL_V), true);
  for (const [pid, url] of [["listings/victim", URL_A], ["abc123XYZ", URL_V], ["../abc123XYZ", URL_A], ["/abc123XYZ", URL_A], ["abc123", URL_A], ["", URL_A], [null, URL_A], [5, URL_A]])
    assert.equal(publicIdMatchesUrl(pid, url), false, String(pid));
});

test("подпись загрузки: SHA-1 и SHA-256 принимаются; подмена публичного id, версии, подписи и секрета — нет", () => {
  for (const algo of ["sha1", "sha256"]) assert.equal(verifyUploadSignature("abc123XYZ", 1712345678, sign("abc123XYZ", 1712345678, SECRET, algo), SECRET), true, algo);
  assert.equal(verifyUploadSignature("abc123XYZ", "1712345678", sign("abc123XYZ", 1712345678), SECRET), true);
  const good = sign("abc123XYZ", 1712345678);
  assert.equal(verifyUploadSignature("other", 1712345678, good, SECRET), false);                 // подпись от другого файла
  assert.equal(verifyUploadSignature("abc123XYZ", 1712345679, good, SECRET), false);             // другая версия
  assert.equal(verifyUploadSignature("abc123XYZ", 1712345678, good, "wrong-secret"), false);
  assert.equal(verifyUploadSignature("abc123XYZ", 1712345678, good.replace(/.$/, c => (c === "0" ? "1" : "0")), SECRET), false);
  for (const sig of ["", "zz", "a".repeat(39), "a".repeat(41), null, undefined, 5, {}, good.toUpperCase().slice(0, 39)])
    assert.equal(verifyUploadSignature("abc123XYZ", 1712345678, sig, SECRET), false);
  for (const ver of ["", "abc", "1e9", "-1", "1".repeat(14), null, undefined, {}]) assert.equal(verifyUploadSignature("abc123XYZ", ver, good, SECRET), false);
  assert.equal(verifyUploadSignature("abc123XYZ", 1712345678, good, ""), false);                 // секрет не настроен — доверять нечему
  assert.equal(verifyUploadSignature("abc123XYZ", 1712345678, good, undefined), false);
});

test("resolveAttachment: подпись есть → publicId сохраняется с меткой; подделки → вложение без права удаления", () => {
  const ver = 1712345678, sigA = sign("abc123XYZ", ver);
  // легитимная загрузка
  const ok = resolveAttachment({ url: URL_A, publicId: "abc123XYZ", version: ver, signature: sigA }, ENV);
  assert.deepEqual([ok.ok, ok.url, ok.storedPublicId, ok.verified], [true, URL_A, VERIFIED_PREFIX + "abc123XYZ", true]);
  // подделка: чужой файл (его URL и publicId известны из публичной страницы), подписи нет
  const noSig = resolveAttachment({ url: URL_V, publicId: "listings/victim" }, ENV);
  assert.deepEqual([noSig.ok, noSig.url, noSig.storedPublicId, noSig.verified], [true, URL_V, "", false]);
  // подделка: подпись от своего файла, а publicId/ссылка — чужие
  assert.equal(resolveAttachment({ url: URL_V, publicId: "listings/victim", version: ver, signature: sigA }, ENV).storedPublicId, "");
  // подделка: чужой publicId при своей ссылке и своей подписи
  assert.equal(resolveAttachment({ url: URL_A, publicId: "listings/victim", version: ver, signature: sigA }, ENV).storedPublicId, "");
  // подпись для другого публичного id, но верная для «чужого» с неверным секретом
  assert.equal(resolveAttachment({ url: URL_V, publicId: "listings/victim", version: 1700000000, signature: sign("listings/victim", 1700000000, "attacker-guess") }, ENV).storedPublicId, "");
  // метка не принимается от клиента как готовая
  assert.equal(resolveAttachment({ url: URL_V, publicId: VERIFIED_PREFIX + "listings/victim" }, ENV).storedPublicId, "");
  // секрет не настроен → удаление невозможно
  assert.equal(resolveAttachment({ url: URL_A, publicId: "abc123XYZ", version: ver, signature: sigA }, { cloudName: CLOUD }).storedPublicId, "");
  // некорректная ссылка → отказ; нет ссылки → вложения нет, лишние поля игнорируются
  assert.equal(resolveAttachment({ url: "https://evil.com/a.jpg", publicId: "x" }, ENV).ok, false);
  assert.equal(resolveAttachment({ url: URL_A + '"', publicId: "abc123XYZ", version: ver, signature: sigA }, ENV).ok, false);
  const none = resolveAttachment({ url: "", publicId: "listings/victim", version: ver, signature: sigA }, ENV);
  assert.deepEqual([none.ok, none.url, none.storedPublicId], [true, "", ""]);
  assert.deepEqual(resolveAttachment(undefined, ENV).url, "");
});

test("deletablePublicId: удаляем только записи с серверной меткой и соответствующей ссылкой", () => {
  assert.equal(deletablePublicId(VERIFIED_PREFIX + "abc123XYZ", URL_A, CLOUD), "abc123XYZ");
  for (const [stored, url, cloud] of [
    ["listings/victim", URL_V, CLOUD],                    // старая запись без метки (мог подделать клиент)
    ["abc123XYZ", URL_A, CLOUD], ["", URL_A, CLOUD], [null, URL_A, CLOUD], [undefined, URL_A, CLOUD],
    [VERIFIED_PREFIX + "listings/victim", URL_A, CLOUD],  // метка есть, но не соответствует ссылке
    [VERIFIED_PREFIX + "abc123XYZ", "https://evil.com/abc123XYZ", CLOUD],
    [VERIFIED_PREFIX + "abc123XYZ", URL_A, "othercloud"], [VERIFIED_PREFIX + "abc123XYZ", URL_A, undefined],
    [VERIFIED_PREFIX, URL_A, CLOUD], [VERIFIED_PREFIX + "../abc123XYZ", URL_A, CLOUD],
  ]) assert.equal(deletablePublicId(stored, url, cloud), "", String(stored));
});

test("исходники: чтение тикета без findById по одному id, клиентский publicId не сохраняется, очистка идёт через deletablePublicId", () => {
  const src = read("routes/support.js");
  assert.ok(!/findById\(req\.params\.ticketId\)/.test(src));
  assert.ok(!/req\.body\.attachmentPublicId\s*\|\|/.test(src), "сырое значение publicId не должно сохраняться");
  assert.ok(/deletablePublicId\(m\.attachmentPublicId, m\.attachmentUrl/.test(src));
  assert.ok(!/destroyCloudinaryAsset\(m\.attachmentPublicId\)/.test(src), "прямой вызов удаления с сохранённым значением недопустим");
  const iAuth = src.indexOf("SupportThread.findOne({ _id: req.params.ticketId, guestId })"), iExp = src.indexOf("await expireOldAttachments();   // только после");
  assert.ok(iAuth > 0 && iExp > iAuth, "очистка вложений должна запускаться только после авторизации");
  assert.ok(read("public/js/common.js").includes('"X-Support-Guest-Id": guestId'));
  const esc = read("public/js/common.js").match(/function escSupport\(s\) \{[\s\S]*?\n    \}/)[0];
  const fn = new Function("return (" + esc.replace("function escSupport", "function") + ")")();
  assert.equal(fn('x" onerror="y'), "x&quot; onerror=&quot;y");
});
