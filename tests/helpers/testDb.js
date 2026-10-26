// Защита от случайного запуска интеграционных тестов на боевой БД:
// нужен TEST_MONGODB_URI, имя БД обязано содержать "test", хост — локальный
// (удалённый — только с явным ALLOW_REMOTE_TEST_DB=1). Иначе тесты пропускаются.
function getTestDb() {
  const uri = process.env.TEST_MONGODB_URI;
  if (!uri) return { skip: "TEST_MONGODB_URI не задан — интеграционные тесты не запускались" };
  let u;
  try { u = new URL(uri); } catch { return { skip: "TEST_MONGODB_URI некорректен" }; }
  const db = u.pathname.replace(/^\//, "");
  if (!/test/i.test(db)) return { skip: "имя тестовой БД должно содержать 'test'" };
  const local = ["127.0.0.1", "localhost", "[::1]", "::1"].includes(u.hostname);
  if (!local && process.env.ALLOW_REMOTE_TEST_DB !== "1") return { skip: "удалённая БД запрещена без ALLOW_REMOTE_TEST_DB=1" };
  return { uri };
}
// Каждый тест-файл работает в СВОЕЙ базе (файлы запускаются параллельно, общая БД давала бы гонки при dropDatabase).
// Имя по-прежнему содержит "test", поэтому проверка выше остаётся в силе.
function withDbName(uri, suffix) {
  const u = new URL(uri);
  u.pathname = u.pathname.replace(/\/$/, "") + "_" + suffix;
  return u.toString();
}

module.exports = { getTestDb, withDbName };
