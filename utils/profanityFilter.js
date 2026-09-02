// Автомодерация текста объявлений/откликов по словарю запрещённых слов.
// Библиотека: leo-profanity — открытая, со встроенными RU и EN словарями.
// npm install leo-profanity

const leoProfanity = require("leo-profanity");

leoProfanity.loadDictionary("ru");                    // основной словарь — русский
leoProfanity.add(leoProfanity.getDictionary("en"));    // + английский поверх него

// Место под свои слова/сленг, которых нет в стандартном словаре
// (например обход через транслит/цифры, если заметите конкретные кейсы —
// дописывайте сюда, регистр не важен, библиотека сама приводит к нижнему).
const CUSTOM_BANNED_WORDS = [
  // "пример",
];
if (CUSTOM_BANNED_WORDS.length) leoProfanity.add(CUSTOM_BANNED_WORDS);

/**
 * Проверяет, содержит ли текст запрещённые слова.
 * @param {string} text
 * @returns {boolean}
 */
function containsProfanity(text) {
  if (!text) return false;
  return leoProfanity.check(text);
}

/**
 * Возвращает текст с зацензуренными словами (звёздочками) —
 * на случай если где-то захочется не блокировать публикацию, а чистить текст.
 * @param {string} text
 * @returns {string}
 */
function cleanProfanity(text) {
  if (!text) return text;
  return leoProfanity.clean(text);
}

module.exports = { containsProfanity, cleanProfanity };