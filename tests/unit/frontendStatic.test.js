// Статические проверки фронтенда и серверного кода без браузера и без БД:
// выполняем извлечённые функции в изолированном vm и проверяем инварианты исходников.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const read = p => fs.readFileSync(path.join(__dirname, "../..", p), "utf8").replace(/\r\n/g, "\n");

test("публичный esc() экранирует кавычки (нет breakout из src=\"...\")", () => {
  const src = read("public/js/listings.js");
  const m = src.match(/function esc\(s\) \{[\s\S]*?\n  \}/);
  assert.ok(m, "функция esc не найдена");
  const esc = vm.runInNewContext("(" + m[0].replace("function esc", "function") + ")");
  const payload = 'x" onerror="alert(1)';
  const out = esc(payload);
  assert.ok(!out.includes('"'), out);
  assert.equal(out, "x&quot; onerror=&quot;alert(1)");
  assert.equal(esc("<img src=x onerror=alert(1)>"), "&lt;img src=x onerror=alert(1)&gt;");
  assert.equal(esc("it's"), "it&#39;s");
  assert.equal(esc(null), "");
  // подстановка в атрибут не создаёт новых атрибутов/тегов
  const html = `<img src="${esc(payload)}" alt="">`;
  assert.equal((html.match(/"/g) || []).length, 4);
});

test("код чата выводит пользовательский текст только через textContent", () => {
  const src = read("public/js/listings.js");
  const start = src.indexOf("// ── Сообщения: приватный чат по объявлению");
  const end   = src.indexOf("// ── Модалка создания / редактирования");
  assert.ok(start > 0 && end > start);
  const block = src.slice(start, end).replace(/^\s*\/\/.*$/gm, ""); // комментарии не считаем
  assert.ok(!/innerHTML/.test(block), "в блоке чата не должно быть innerHTML");
  assert.ok(/text\.textContent = m\.deleted \? DELETED_TEXT : m\.text/.test(block));   // удалённые показываются заглушкой, остальные — текстом
});

test("admin.html: logoEl экранирует name/logo/инициалы и не подставляет данные в JS-строку обработчика", () => {
  const html = read("public/admin.html");
  const fnLogo = html.match(/function initials\(name\) \{[\s\S]*?\n\}\nfunction logoEl[\s\S]*?\n\}/);
  const fnEsc  = html.match(/function escAdmin\(str\) \{[\s\S]*?\n\}/);
  assert.ok(fnLogo && fnEsc);
  const ctx = vm.createContext({});
  vm.runInContext(fnEsc[0] + "\n" + fnLogo[0], ctx);
  const evil = [
    ['x" onerror="alert(1)', 'x" onerror="alert(1)'],
    ["<img src=x onerror=alert(1)>", "<img src=x onerror=alert(1)>"],
    ["'\"><svg onload=alert(1)>", "'\"><svg onload=alert(1)>"],
  ];
  for (const [name, logo] of evil) {
    for (const out of [ctx.logoEl(logo, name), ctx.logoEl("", name)]) {
      assert.ok(!out.includes("<svg"), out);
      assert.ok(!/<img src=x/.test(out), out);
      assert.ok(!/" onerror="alert/.test(out), out);
      assert.ok(!out.includes("onerror='"), "инициалы не должны попадать в JS-строку: " + out);
    }
  }
  const withLogo = ctx.logoEl('https://a/b.png" onerror="alert(1)', "Team");
  // единственный настоящий атрибут onerror — наш собственный (внутри значения src кавычки экранированы)
  assert.equal((withLogo.match(/\sonerror="/g) || []).length, 1);
  assert.ok(withLogo.includes("&quot;"));
});

test("admin.html: пользовательские значения в inline-обработчиках передаются через dataset, а не в JS-строки", () => {
  const html = read("public/admin.html");
  for (const bad of [
    /onclick="[^"]*\$\{\(?t\.name\)?\.replace/, /onclick="[^"]*\$\{esc\(u\./, /onclick="[^"]*\$\{\(s\.teamId\?\.name\|\|""\)\.replace/,
    /onclick="removeRegistration\([^"]*\$\{r\.team\?\.name/,
  ]) assert.ok(!bad.test(html), String(bad));
  assert.ok(/this\.dataset\.name/.test(html));
});

test("routes/listings.js: удаление файлов Cloudinary отключено, отклик создаёт диалог после upsert", () => {
  const src = read("routes/listings.js");
  assert.ok(!/destroyCloudinaryAsset\(/.test(src), "вызовов destroyCloudinaryAsset быть не должно");
  assert.ok(!/cloudinaryCleanup/.test(src.replace(/\/\/.*$/gm, "")), "модуль cloudinaryCleanup не должен подключаться");
  const iUpsert = src.indexOf("ListingResponse.findOneAndUpdate(");
  const iConv   = src.indexOf("Conversation.ensureForResponse(");
  assert.ok(iUpsert > 0 && iConv > iUpsert, "диалог создаётся только после успешного upsert отклика");
});

test("не тронуты: удаление пользователей, Steam-аутентификация и глобальная проверка banned", () => {
  const server = read("server.js"), auth = read("middleware/auth.js");
  assert.ok(!/banned/.test(server) && !/banned/.test(auth), "глобальной проверки banned быть не должно");
  assert.ok(server.includes("passport.use(new SteamStrategy("));
  const admin = read("routes/admin.js");
  assert.ok(!/Conversation|Message\b/.test(admin), "admin.js не должен работать с диалогами/сообщениями (в т.ч. каскады при удалении пользователя)");
  assert.ok(admin.includes('router.use("/listings", require("./adminListings"));'));
});
