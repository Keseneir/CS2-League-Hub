/**
 * scripts/seedShop.js — запустить один раз: node scripts/seedShop.js
 * Создаёт косметические предметы магазина (фоны + рамки аватарок) и расходники.
 * Повторный запуск безопасен — дубли пропускаются, CSS обновляется.
 */
require("dotenv").config();
const mongoose = require("mongoose");
const ShopItem = require("../models/ShopItem");

const ITEMS = [

  // ════════════════════════════════════════════════
  // РАМКИ АВАТАРКИ (avatar_frame) — только профиль
  // ════════════════════════════════════════════════
  {
    name:         "Золотая корона",
    description:  "Сверкающая золотая рамка с пульсирующим свечением.",
    icon:         "👑",
    price:        120,
    category:     "personal",
    type:         "cosmetic",
    cosmeticType: "avatar_frame",
    css: `box-shadow: 0 0 0 3px #e6b022, 0 0 0 5px rgba(230,176,34,0.25), 0 0 22px rgba(230,176,34,0.55); border-radius: 50%; animation: goldCrown 2.5s ease-in-out infinite;`,
    keyframes: `@keyframes goldCrown { 0%,100% { box-shadow: 0 0 0 3px #e6b022, 0 0 0 5px rgba(230,176,34,0.25), 0 0 20px rgba(230,176,34,0.5); } 50% { box-shadow: 0 0 0 3px #ffd700, 0 0 0 7px rgba(255,215,0,0.3), 0 0 38px rgba(230,176,34,0.85); } }`,
    isConsumable: false,
    order: 1,
  },
  {
    name:         "Серебряная аура",
    description:  "Холодный серебристый отблеск вокруг аватарки.",
    icon:         "🌙",
    price:        80,
    category:     "personal",
    type:         "cosmetic",
    cosmeticType: "avatar_frame",
    css: `box-shadow: 0 0 0 3px #a8c8d8, 0 0 18px rgba(168,200,216,0.55); border-radius: 50%; animation: silverAura 3.2s ease-in-out infinite;`,
    keyframes: `@keyframes silverAura { 0%,100% { box-shadow: 0 0 0 3px #a8c8d8, 0 0 18px rgba(168,200,216,0.45); } 50% { box-shadow: 0 0 0 3px #cce8f8, 0 0 32px rgba(168,200,216,0.8); } }`,
    isConsumable: false,
    order: 2,
  },
  {
    name:         "Огненная аура",
    description:  "Живое пламя охватывает аватарку.",
    icon:         "🔥",
    price:        180,
    category:     "personal",
    type:         "cosmetic",
    cosmeticType: "avatar_frame",
    css: `box-shadow: 0 0 0 3px #ff6b35, 0 0 20px rgba(255,107,53,0.65); border-radius: 50%; animation: fireAura 1.4s ease-in-out infinite;`,
    keyframes: `@keyframes fireAura { 0%,100% { box-shadow: 0 0 0 3px #ff6b35, 0 0 20px rgba(255,107,53,0.5); } 50% { box-shadow: 0 0 0 4px #ff4500, 0 0 38px rgba(255,69,0,0.85), 0 0 55px rgba(255,100,0,0.3); } }`,
    isConsumable: false,
    order: 3,
  },
  {
    name:         "Неоновый контур",
    description:  "Ярко-зелёный неон, прямо из Matrix.",
    icon:         "💚",
    price:        150,
    category:     "personal",
    type:         "cosmetic",
    cosmeticType: "avatar_frame",
    css: `box-shadow: 0 0 0 2px #00ff41, 0 0 14px rgba(0,255,65,0.7); border-radius: 50%; animation: neonFrame 2s ease-in-out infinite;`,
    keyframes: `@keyframes neonFrame { 0%,100% { box-shadow: 0 0 0 2px #00ff41, 0 0 14px rgba(0,255,65,0.6); } 50% { box-shadow: 0 0 0 2px #00ff41, 0 0 30px rgba(0,255,65,0.95), 0 0 55px rgba(0,255,65,0.3); } }`,
    isConsumable: false,
    order: 4,
  },

  // ════════════════════════════════════════════════
  // ФОНЫ ПРОФИЛЯ (profile_bg) — страница профиля
  // ════════════════════════════════════════════════
  {
    name:         "Северное сияние",
    description:  "Анимированные полярные переливы сине-зелёных тонов.",
    icon:         "🌌",
    price:        200,
    category:     "personal",
    type:         "cosmetic",
    cosmeticType: "profile_bg",
    css: `background: linear-gradient(135deg,#0d1117 0%,#0a2444 25%,#0d3340 55%,#1a0a2e 100%) fixed; background-size: 400% 400%; animation: aurora 14s ease infinite;`,
    keyframes: `@keyframes aurora { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }`,
    isConsumable: false,
    order: 10,
  },
  {
    name:         "Кибер-пурпур",
    description:  "Тёмный пурпурный градиент в стиле sci-fi.",
    icon:         "💜",
    price:        180,
    category:     "personal",
    type:         "cosmetic",
    cosmeticType: "profile_bg",
    css: `background: linear-gradient(135deg,#0b0b1a 0%,#1a0b2e 30%,#2d0a3e 65%,#1a0b2e 100%) fixed; background-size: 400% 400%; animation: cyberpurple 11s ease infinite;`,
    keyframes: `@keyframes cyberpurple { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }`,
    isConsumable: false,
    order: 11,
  },
  {
    name:         "Алый закат",
    description:  "Тёплые алые и оранжевые переливы — как закат над ареной.",
    icon:         "🌅",
    price:        160,
    category:     "personal",
    type:         "cosmetic",
    cosmeticType: "profile_bg",
    css: `background: linear-gradient(135deg,#0d0808 0%,#2d0a0a 30%,#3d1200 65%,#2d0a0a 100%) fixed; background-size: 400% 400%; animation: crimsonDawn 13s ease infinite;`,
    keyframes: `@keyframes crimsonDawn { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }`,
    isConsumable: false,
    order: 12,
  },

  // ════════════════════════════════════════════════
  // ФОНЫ КОМАНДЫ (team_bg) — страница команды
  // ════════════════════════════════════════════════
  {
    name:         "Тёмный карбон",
    description:  "Строгая текстура карбонового плетения на фоне шапки команды.",
    icon:         "🖤",
    price:        150,
    category:     "team",
    type:         "cosmetic",
    cosmeticType: "team_bg",
    css: `background-color: #0d1117; background-image: repeating-linear-gradient(45deg,rgba(255,255,255,0.02) 0,rgba(255,255,255,0.02) 1px,transparent 0,transparent 50%),repeating-linear-gradient(-45deg,rgba(255,255,255,0.02) 0,rgba(255,255,255,0.02) 1px,transparent 0,transparent 50%); background-size: 8px 8px;`,
    keyframes: ``,
    isConsumable: false,
    order: 20,
  },
  {
    name:         "Неоновая сетка",
    description:  "Анимированная киберсетка с пульсирующим свечением.",
    icon:         "🟩",
    price:        250,
    category:     "team",
    type:         "cosmetic",
    cosmeticType: "team_bg",
    css: `background-color: #060f07; background-image: linear-gradient(rgba(0,255,65,0.06) 1px,transparent 1px),linear-gradient(90deg,rgba(0,255,65,0.06) 1px,transparent 1px); background-size: 32px 32px; animation: neonGrid 6s linear infinite;`,
    keyframes: `@keyframes neonGrid { 0% { background-position: 0 0; } 100% { background-position: 32px 32px; } }`,
    isConsumable: false,
    order: 21,
  },
  {
    name:         "Ночной космос",
    description:  "Глубокое звёздное небо с медленным переливом туманностей.",
    icon:         "✨",
    price:        300,
    category:     "team",
    type:         "cosmetic",
    cosmeticType: "team_bg",
    css: `background: linear-gradient(135deg,#020408 0%,#0a1628 30%,#060d1e 65%,#0d0820 100%); background-size: 400% 400%; animation: cosmos 18s ease infinite;`,
    keyframes: `@keyframes cosmos { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }`,
    isConsumable: false,
    order: 22,
  },
  {
    name:         "Золотая лига",
    description:  "Роскошный золотой градиент для чемпионов сезона.",
    icon:         "🏆",
    price:        500,
    category:     "team",
    type:         "cosmetic",
    cosmeticType: "team_bg",
    css: `background: linear-gradient(135deg,#1a1200 0%,#2d2000 30%,#3d2c00 60%,#2d2000 100%); background-size: 400% 400%; animation: goldLeague 10s ease infinite;`,
    keyframes: `@keyframes goldLeague { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }`,
    isConsumable: false,
    order: 23,
  },
  {
    name:         "Кровавый дымок",
    description:  "Алые дымовые завихрения — для тех, кто пугает до начала матча.",
    icon:         "🩸",
    price:        350,
    category:     "team",
    type:         "cosmetic",
    cosmeticType: "team_bg",
    css: `background: linear-gradient(135deg,#0d0505 0%,#200808 30%,#300a0a 60%,#1a0505 100%); background-size: 400% 400%; animation: bloodSmoke 9s ease infinite;`,
    keyframes: `@keyframes bloodSmoke { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }`,
    isConsumable: false,
    order: 24,
  },

  // ════════════════════════════════════════════════
  // РАСХОДНИКИ
  // ════════════════════════════════════════════════

  // ── Буст монет ─────────────────────────────────
  // Срабатывает один раз при записи ЛЮБОГО матча (победа или поражение).
  // Игрок получает x2 личных монет вместо базовых 5.
  // После срабатывания: consumed = true, consumedAt = дата матча.
  // Можно купить несколько — каждый даст x2 на один матч.
  {
    name:         "Буст монет",
    description:  "Следующий матч принесёт x2 личных монет (10 вместо 5). Одноразовый.",
    icon:         "💰",
    price:        50,
    category:     "personal",
    type:         "boost",
    cosmeticType: null,
    css:          "",
    keyframes:    "",
    isConsumable: true,
    order:        50,
  },
];

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("MongoDB connected\n");
  let created = 0, updated = 0;
  for (const item of ITEMS) {
    const existing = await ShopItem.findOne({ name: item.name });
    if (existing) {
      await ShopItem.findByIdAndUpdate(existing._id, { $set: item });
      console.log(`  ↺  Обновлён:  ${item.icon} ${item.name}`);
      updated++;
    } else {
      await ShopItem.create(item);
      console.log(`  ✅  Создан:    ${item.icon} ${item.name}`);
      created++;
    }
  }
  console.log(`\nГотово: создано ${created}, обновлено ${updated}`);
  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });