const test = require("node:test");
const assert = require("node:assert/strict");
const { checkImageUrl, publicIdMatchesUrl, sanitizeListingImage } = require("../../utils/listingImage");

const CLOUD = "testcloud";
const GOOD  = "https://res.cloudinary.com/testcloud/image/upload/v1712345678/folder/abcd1234.jpg";

test("принимает корректный Cloudinary URL и пустое значение", () => {
  assert.deepEqual(checkImageUrl(GOOD, CLOUD), { ok: true, url: GOOD });
  for (const empty of [undefined, null, "", "   "]) assert.deepEqual(checkImageUrl(empty, CLOUD), { ok: true, url: "" });
});

test("отклоняет не-https, чужие хосты и обходы строковой проверки префикса", () => {
  const bad = [
    "http://res.cloudinary.com/testcloud/image/upload/v1/a.jpg",
    "https://evil.com/testcloud/image/upload/v1/a.jpg",
    "https://res.cloudinary.com.evil.com/testcloud/image/upload/v1/a.jpg",
    "https://res.cloudinary.com@evil.com/testcloud/image/upload/v1/a.jpg",
    "https://user:pass@res.cloudinary.com/testcloud/image/upload/v1/a.jpg",
    "https://res.cloudinary.com:8443/testcloud/image/upload/v1/a.jpg",
    "javascript:alert(1)",
    "data:image/svg+xml,<svg onload=alert(1)>",
    "//res.cloudinary.com/testcloud/image/upload/v1/a.jpg",
    "https://res.cloudinary.com/othercloud/image/upload/v1/a.jpg",
    "https://res.cloudinary.com/testcloud/raw/upload/v1/a.jpg",
    "https://res.cloudinary.com/testcloud/image/upload/",
    "https://res.cloudinary.com/testcloud/image/upload/../../x.jpg",
    "https://res.cloudinary.com/testcloud/image/upload/%2e%2e/x.jpg",
    "https://res.cloudinary.com/testcloud/image/upload/v1/a.jpg#frag",
  ];
  for (const u of bad) assert.equal(checkImageUrl(u, CLOUD).ok, false, u);
});

test("отклоняет кавычки, угловые скобки, пробелы и управляющие символы (breakout из атрибута)", () => {
  const bad = [
    GOOD + '" onerror="alert(1)',
    GOOD + "' onerror='alert(1)",
    GOOD + "><script>alert(1)</script>",
    GOOD + " onerror=alert(1)",
    GOOD + "\u0000",
    GOOD.replace("image", "im\nage"),   // перевод строки внутри (URL-парсер молча вырезал бы его)
    GOOD + "\\",
    GOOD + "`",
    GOOD + "%22 onerror=alert(1)".replace("%22", '"'),
  ];
  for (const u of bad) assert.equal(checkImageUrl(u, CLOUD).ok, false, JSON.stringify(u));
  // пробелы/переводы строк по краям просто обрезаются, в результате остаётся нормализованный безопасный URL
  assert.deepEqual(checkImageUrl("  " + GOOD + "\n", CLOUD), { ok: true, url: GOOD });
});

test("отклоняет нестроки, слишком длинные URL и отсутствие настройки облака", () => {
  for (const v of [123, {}, [], true]) assert.equal(checkImageUrl(v, CLOUD).ok, false);
  assert.equal(checkImageUrl(GOOD + "a".repeat(600), CLOUD).ok, false);
  for (const c of [undefined, "", "bad cloud!", "a/b"]) assert.equal(checkImageUrl(GOOD, c).ok, false);
});

test("publicId обязан соответствовать пути URL", () => {
  assert.equal(publicIdMatchesUrl("folder/abcd1234", GOOD), true);
  assert.equal(publicIdMatchesUrl("abcd1234", GOOD), true);   // последний сегмент
  for (const id of ["other", "folder/other", "../abcd1234", "/folder/abcd1234", "abcd1234 ", "ab cd", "", 5, null, "a//b"])
    assert.equal(publicIdMatchesUrl(id, GOOD), false, String(id));
});

test("sanitizeListingImage: нормализация, подделка publicId, пустое значение", () => {
  assert.deepEqual(sanitizeListingImage(undefined, CLOUD), { ok: true, image: { url: "", publicId: "" } });
  assert.deepEqual(sanitizeListingImage({ url: "" }, CLOUD), { ok: true, image: { url: "", publicId: "" } });
  assert.deepEqual(sanitizeListingImage({ url: GOOD, publicId: "folder/abcd1234" }, CLOUD), { ok: true, image: { url: GOOD, publicId: "folder/abcd1234" } });
  assert.deepEqual(sanitizeListingImage({ url: GOOD }, CLOUD), { ok: true, image: { url: GOOD, publicId: "" } });
  assert.equal(sanitizeListingImage({ url: GOOD, publicId: "someone-elses/asset" }, CLOUD).ok, false);   // подделка → отказ
  assert.equal(sanitizeListingImage("https://evil.com/x.png", CLOUD).ok, false);
  assert.equal(sanitizeListingImage([GOOD], CLOUD).ok, false);
  assert.equal(sanitizeListingImage({ url: "https://evil.com/x.png", publicId: "x" }, CLOUD).ok, false);
});
