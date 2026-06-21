/**
 * scripts/migrate-remove-friends.js
 *
 * Удаляет поля friends[] и friendRequests[] из всех документов коллекции users.
 * Запускать ПОСЛЕ деплоя новой версии (когда routes/friends.js уже отключён).
 *
 * Запуск:
 *   NODE_ENV=production node scripts/migrate-remove-friends.js
 *
 * Или локально:
 *   node scripts/migrate-remove-friends.js
 */

require("dotenv").config();
const mongoose = require("mongoose");

async function run() {
  console.log("🔌 Подключаемся к MongoDB...");
  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 30000,
  });
  console.log("✅ Подключено.\n");

  // Считаем сколько документов затронем
  const total = await mongoose.connection.db
    .collection("users")
    .countDocuments({
      $or: [
        { friends:       { $exists: true } },
        { friendRequests:{ $exists: true } },
      ],
    });

  console.log(`📊 Документов с полями friends/friendRequests: ${total}`);

  if (total === 0) {
    console.log("✨ Ничего делать не нужно — поля уже отсутствуют.");
    await mongoose.disconnect();
    return;
  }

  // Подтверждение перед запуском (если не передан флаг --yes)
  if (!process.argv.includes("--yes")) {
    console.log("\n⚠️  Это необратимая операция.");
    console.log('   Запустите с флагом --yes для подтверждения:');
    console.log('   node scripts/migrate-remove-friends.js --yes\n');
    await mongoose.disconnect();
    return;
  }

  console.log("\n🚀 Запускаем миграцию...");

  const result = await mongoose.connection.db
    .collection("users")
    .updateMany(
      {},
      { $unset: { friends: "", friendRequests: "" } }
    );

  console.log(`✅ Готово!`);
  console.log(`   Совпало документов:  ${result.matchedCount}`);
  console.log(`   Изменено документов: ${result.modifiedCount}`);

  await mongoose.disconnect();
  console.log("\n🔌 Соединение закрыто.");
}

run().catch(err => {
  console.error("❌ Ошибка миграции:", err);
  process.exit(1);
});