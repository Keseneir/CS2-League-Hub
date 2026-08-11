// scripts/migrateSupportToTickets.js
//
// Одноразовая миграция со старой схемы SupportThread (один уникальный
// тред на guestId, без subject/status) на новую тикет-систему
// (SupportGuest отдельно + SupportThread как тикет, guestId не уникален).
//
// Что делает:
//   1. Для каждого guestId, встречающегося в существующих SupportThread,
//      создаёт (если ещё нет) соответствующий SupportGuest — переносит
//      guestName/guestAvatar/guestSteamId/isBlocked из старого документа.
//   2. Проставляет старым тредам subject (дефолтный, т.к. раньше темы не
//      было) и status (resolved, если было isResolved: true, иначе open).
//   3. Дропает старый уникальный индекс guestId_1 на коллекции
//      supportthreads — без этого шага POST /api/support/ticket будет
//      падать с 500 (E11000 duplicate key) при попытке создать ВТОРОЙ
//      тикет для уже существующего гостя.
//
// Запуск (один раз, из корня проекта, там где есть доступ к MONGODB_URI):
//   node scripts/migrateSupportToTickets.js
//
// Скрипт идемпотентен — его безопасно запустить повторно (не создаст дублей
// и не упадёт, если индекс уже дропнут).

require("dotenv").config();
const mongoose = require("mongoose");

const SupportGuest  = require("../models/SupportGuest");
const SupportThread = require("../models/SupportThread");

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI не найден в окружении. Запускай скрипт там же, где обычно запускается сервер (.env настроен).");
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log("Подключено к MongoDB.");

  const db = mongoose.connection.db;
  const threadsColl = db.collection("supportthreads");

  // ── Шаг 1+2: читаем сырые документы напрямую через driver, а не через
  // Mongoose-модель — старые документы могут не соответствовать новой
  // Mongoose-схеме (например, содержать поле isResolved/isBlocked,
  // которого больше нет в схеме), и Mongoose .find() их бы тихо обрезал.
  const rawThreads = await threadsColl.find({}).toArray();
  console.log(`Найдено старых тредов: ${rawThreads.length}`);

  let guestsCreated = 0;
  let guestsSkipped  = 0;
  let threadsUpdated = 0;

  const seenGuestIds = new Set();

  for (const t of rawThreads) {
    const guestId = t.guestId;
    if (!guestId) continue;

    // ── Гость: создаём один раз на guestId, даже если у него уже
    // несколько старых тредов (на практике такого раньше не было, но
    // на всякий случай защищаемся от дублей).
    if (!seenGuestIds.has(guestId)) {
      seenGuestIds.add(guestId);
      const existingGuest = await SupportGuest.findOne({ guestId });
      if (!existingGuest) {
        await SupportGuest.create({
          guestId,
          guestName:    t.guestName    || "Гость",
          guestAvatar:  t.guestAvatar  || "",
          guestSteamId: t.guestSteamId || "",
          isBlocked:    t.isBlocked    || false,
        });
        guestsCreated++;
      } else {
        guestsSkipped++;
      }
    }

    // ── Тред: проставляем subject/status, если их ещё нет (старые
    // документы созданы до появления этих полей в схеме).
    const update = {};
    if (t.subject === undefined || t.subject === null) {
      update.subject = "Обращение в поддержку";
    }
    if (t.status === undefined || t.status === null) {
      update.status = t.isResolved ? "resolved" : "open";
    }

    if (Object.keys(update).length > 0) {
      await threadsColl.updateOne({ _id: t._id }, { $set: update });
      threadsUpdated++;
    }
  }

  console.log(`Гостей создано: ${guestsCreated}, уже существовало: ${guestsSkipped}`);
  console.log(`Тредов обновлено (subject/status): ${threadsUpdated}`);

  // ── Шаг 3: дропаем старый уникальный индекс guestId_1.
  // Без этого второй POST /api/support/ticket для того же гостя падает
  // с E11000 duplicate key error (это и есть причина 500 в проде).
  const indexes = await threadsColl.indexes();
  const oldIndex = indexes.find(ix => ix.name === "guestId_1" && ix.unique);

  if (oldIndex) {
    await threadsColl.dropIndex("guestId_1");
    console.log("Старый уникальный индекс guestId_1 удалён.");
  } else {
    console.log("Старый уникальный индекс guestId_1 не найден (уже удалён или никогда не создавался) — пропускаем.");
  }

  // Новая схема сама создаст свой (не уникальный) индекс guestId_1 при
  // следующем обращении к модели SupportThread — это безопасно, т.к.
  // Mongoose синхронизирует некритичные индексы автоматически.

  console.log("Миграция завершена.");
  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error("Ошибка миграции:", err);
  process.exit(1);
});