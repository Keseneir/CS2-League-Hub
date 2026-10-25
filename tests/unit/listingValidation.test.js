const test = require("node:test");
const assert = require("node:assert/strict");
const { validateAdminListingEdit, parseAdminListingQuery, validateChatText, isObjectIdString, escapeRegex } = require("../../utils/listingValidation");

const TYPES = ["player_seeking_team", "team_seeking_player", "scrim"];

test("validateChatText: пустые, пробельные, не-строки, слишком длинные, управляющие символы", () => {
  for (const v of [undefined, null, "", "   ", "\n\t ", 5, {}, [], ["a"]]) assert.equal(validateChatText(v, 1000).ok, false, JSON.stringify(v));
  assert.equal(validateChatText("a".repeat(1001), 1000).ok, false);
  assert.equal(validateChatText("a".repeat(1000), 1000).ok, true);
  assert.equal(validateChatText("a\u0000b", 1000).ok, false);
  const r = validateChatText("  привет\nмир  ", 1000);
  assert.deepEqual(r, { ok: true, text: "привет\nмир" });
  assert.equal(validateChatText("a".repeat(1000) + "   ", 1000).ok, true); // пробелы по краям не считаются
});

test("isObjectIdString принимает только 24 hex-символа", () => {
  assert.equal(isObjectIdString("507f1f77bcf86cd799439011"), true);
  for (const v of ["", "123", "507f1f77bcf86cd79943901z", "507f1f77bcf86cd7994390111", {}, null, undefined, 5, ["507f1f77bcf86cd799439011"]])
    assert.equal(isObjectIdString(v), false);
});

test("validateAdminListingEdit", () => {
  assert.equal(validateAdminListingEdit(null).ok, false);
  assert.equal(validateAdminListingEdit([]).ok, false);
  assert.equal(validateAdminListingEdit({}).ok, false);                        // нет изменений
  assert.equal(validateAdminListingEdit({ title: "  " }).ok, false);
  assert.equal(validateAdminListingEdit({ title: 5 }).ok, false);
  assert.equal(validateAdminListingEdit({ title: "a".repeat(101) }).ok, false);
  assert.equal(validateAdminListingEdit({ description: "a".repeat(2001) }).ok, false);
  assert.equal(validateAdminListingEdit({ role: "a".repeat(61) }).ok, false);
  assert.equal(validateAdminListingEdit({ role: {} }).ok, false);
  const ok = validateAdminListingEdit({ title: " Новый ", description: " Описание ", role: " AWP ", removeImage: true, hiddenByAdmin: true, authorId: "x" });
  assert.deepEqual(ok, { ok: true, update: { title: "Новый", description: "Описание", role: "AWP" }, removeImage: true }); // лишние поля игнорируются
  assert.deepEqual(validateAdminListingEdit({ role: "" }), { ok: true, update: { role: "" }, removeImage: false });
  assert.deepEqual(validateAdminListingEdit({ removeImage: true }), { ok: true, update: {}, removeImage: true });
  assert.equal(validateAdminListingEdit({ removeImage: "true" }).ok, false);   // строгий boolean
});

test("parseAdminListingQuery: статусы, тип, поиск (экранирование regex), пагинация", () => {
  let r = parseAdminListingQuery({}, TYPES);
  assert.deepEqual(r.filter, {}); assert.equal(r.page, 1); assert.equal(r.limit, 20); assert.equal(r.skip, 0);
  assert.deepEqual(parseAdminListingQuery({ status: "active" }, TYPES).filter, { active: true, hiddenByAdmin: false });
  assert.deepEqual(parseAdminListingQuery({ status: "inactive" }, TYPES).filter, { active: false });
  assert.deepEqual(parseAdminListingQuery({ status: "hidden" }, TYPES).filter, { hiddenByAdmin: true });
  assert.deepEqual(parseAdminListingQuery({ status: "$ne" }, TYPES).filter, {});          // неизвестный статус игнорируется
  assert.deepEqual(parseAdminListingQuery({ type: "scrim" }, TYPES).filter, { type: "scrim" });
  assert.deepEqual(parseAdminListingQuery({ type: { $ne: "x" } }, TYPES).filter, {});     // NoSQL-инъекция объектом
  assert.deepEqual(parseAdminListingQuery({ type: "bogus" }, TYPES).filter, {});
  const q = parseAdminListingQuery({ q: "a.*(b" }, TYPES).filter.title;
  assert.ok(q instanceof RegExp); assert.equal(q.test("xa.*(by"), true); assert.equal(q.test("aaab"), false);
  assert.deepEqual(parseAdminListingQuery({ q: { $gt: "" } }, TYPES).filter, {});
  r = parseAdminListingQuery({ page: "3", limit: "10" }, TYPES);
  assert.equal(r.skip, 20); assert.equal(r.limit, 10);
  assert.equal(parseAdminListingQuery({ limit: "9999" }, TYPES).limit, 50);
  assert.equal(parseAdminListingQuery({ page: "-4", limit: "0" }, TYPES).page, 1);
  assert.equal(parseAdminListingQuery({ page: "abc" }, TYPES).page, 1);
  assert.equal(escapeRegex("a.b*c"), "a\\.b\\*c");
});
