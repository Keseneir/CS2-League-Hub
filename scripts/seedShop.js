/**
 * scripts/seedShop.js
 * Запустить ОДИН РАЗ для добавления стартовых предметов магазина.
 *
 *   node scripts/seedShop.js
 *
 * Требует MONGODB_URI в .env
 */

require("dotenv").config();
const mongoose = require("mongoose");
const ShopItem = require("../models/ShopItem");

const ITEMS = [
  // ── Для команды: фоны страницы ──────────────────────────────────────────
  {
    name:         "Тёмный карбон",
    description:  "Текстура карбонового плетения на странице команды. Строго и технологично.",
    icon:         "🖤",
    price:        150,
    category:     "team",
    type:         "cosmetic",
    isConsumable: false,
    order:        1,
  },
  {
    name:         "Неоновая сетка",
    description:  "Кибер-сетка в зелёных тонах. Выглядит как настоящий матрикс.",
    icon:         "💚",
    price:        200,
    category:     "team",
    type:         "cosmetic",
    isConsumable: false,
    order:        2,
  },
  {
    name:         "Ночной космос",
    description:  "Звёздное небо и туманности. Для тех, кто целит в звёзды.",
    icon:         "🌌",
    price:        250,
    category:     "team",
    type:         "cosmetic",
    isConsumable: false,
    order:        3,
  },
  {
    name:         "Кровавый дымок",
    description:  "Красные дымовые завихрения. Устрашает соперников ещё до матча.",
    icon:         "🔴",
    price:        300,
    category:     "team",
    type:         "cosmetic",
    isConsumable: false,
    order:        4,
  },
  {
    name:         "Золотая лига",
    description:  "Премиальный золотой градиент — для чемпионов и будущих чемпионов.",
    icon:         "🏆",
    price:        500,
    category:     "team",
    type:         "cosmetic",
    isConsumable: false,
    order:        5,
  },

  // ── Для команды: турнирный билет ────────────────────────────────────────
  {
    name:         "Турнирный билет",
    description:  "Пропуск на финальный платный турнир сезона. Покупает капитан или менеджер.",
    icon:         "🎟️",
    price:        800,
    category:     "team",
    type:         "ticket",
    isConsumable: true,   // расходуется при регистрации на турнир
    order:        10,
  },

  // ── Для себя: личные бейджи ──────────────────────────────────────────────
  {
    name:         "Ветеран лиги",
    description:  "Значок ветерана отображается рядом с ником на странице профиля.",
    icon:         "🎖️",
    price:        120,
    category:     "personal",
    type:         "cosmetic",
    isConsumable: false,
    order:        1,
  },
  {
    name:         "Буст опыта ×2",
    description:  "Удваивает личные монеты за ближайшие 5 сыгранных матчей.",
    icon:         "⚡",
    price:        180,
    category:     "personal",
    type:         "boost",
    isConsumable: true,
    order:        2,
  },
];

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("MongoDB connected");

  let created = 0, skipped = 0;
  for (const item of ITEMS) {
    const exists = await ShopItem.findOne({ name: item.name });
    if (exists) {
      console.log(`  ⏭  Уже есть: ${item.name}`);
      skipped++;
    } else {
      await ShopItem.create(item);
      console.log(`  ✅  Создан: ${item.name}`);
      created++;
    }
  }

  console.log(`\nГотово: создано ${created}, пропущено ${skipped}`);
  await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });