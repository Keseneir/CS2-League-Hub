require("dotenv").config();
const mongoose = require("mongoose");
const ShopItem = require("../models/ShopItem");

// ── Как устроен "сырой" CSS для рамок/фонов ────────────────────────────────
// Если в css есть хотя бы одна фигурная скобка `{` — applyCosmeticCSS (profile.js)
// трактует его как готовые CSS-правила и вставляет как есть, подставляя вместо
// плейсхолдера %SEL% реальный селектор обёртки аватарки (или фона).
// Так можно использовать ::before/::after, несколько слоёв, разные анимации —
// а не только один box-shadow на весь элемент, как раньше.
const ITEMS = [

  // ════════════════════════════════════════════════
  // РАМКИ АВАТАРКИ (avatar_frame) — только профиль
  // ════════════════════════════════════════════════
  {
  name: "Близнецы",
  description: "Две вращающиеся голубые дуги с живым свечением вокруг аватарки.",
  icon: "♊",
  price: 180,
  category: "personal",
  type: "cosmetic",
  cosmeticType: "avatar_frame",
  css: `
    %SEL%::before {
      content: "";
      position: absolute;
      inset: -5px;
      border-radius: 50%;
      border: 5px solid transparent;
      border-top-color: #42d9ff;
      border-right-color: #00aeea;
      box-shadow:
        0 0 6px #42d9ff,
        0 0 14px rgba(0,200,255,0.9),
        0 0 25px rgba(0,140,255,0.55);
      z-index: -1;
      pointer-events: none;
      animation: twinsSpin 2.4s linear infinite,
                 twinsFlicker 0.5s ease-in-out infinite alternate;
    }

    %SEL%::after {
      content: "";
      position: absolute;
      inset: -5px;
      border-radius: 50%;
      border: 5px solid transparent;
      border-bottom-color: #00aeea;
      border-left-color: #42d9ff;
      box-shadow:
        0 0 6px #7de9ff,
        0 0 14px rgba(0,200,255,0.9),
        0 0 25px rgba(0,140,255,0.55);
      z-index: -1;
      pointer-events: none;
      animation: twinsSpinReverse 2.4s linear infinite,
                 twinsFlicker 0.5s ease-in-out infinite alternate-reverse;
    }
  `,
  keyframes: `
    @keyframes twinsSpin {
      from {
        transform: rotate(0deg);
      }
      to {
        transform: rotate(360deg);
      }
    }

    @keyframes twinsSpinReverse {
      from {
        transform: rotate(180deg);
      }
      to {
        transform: rotate(-180deg);
      }
    }

    @keyframes twinsFlicker {
      0% {
        opacity: 0.7;
      }

      100% {
        opacity: 1;
      }
    }
  `,
  isConsumable: false,
  order: 3,
},
  {
    name:         "Золотая корона",
    description:  "Вращающиеся золотые лучи и пульсирующее кольцо — как нимб чемпиона.",
    icon:         "👑",
    price:        120,
    category:     "personal",
    type:         "cosmetic",
    cosmeticType: "avatar_frame",
    css: `
      %SEL%::before {
        content: "";
        position: absolute;
        inset: -20px;
        border-radius: 50%;
        background: repeating-conic-gradient(from 0deg, rgba(230,176,34,0.65) 0deg 3deg, transparent 3deg 16deg);
        filter: blur(0.5px);
        opacity: 0.9;
        z-index: -1;
        animation: crownRays 14s linear infinite;
        pointer-events: none;
      }
      %SEL%::after {
        content: "";
        position: absolute;
        inset: -3px;
        border-radius: 50%;
        box-shadow: 0 0 0 3px #e6b022, 0 0 22px rgba(230,176,34,0.55);
        animation: crownPulse 2.5s ease-in-out infinite;
        pointer-events: none;
      }
    `,
    keyframes: `
      @keyframes crownRays { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      @keyframes crownPulse {
        0%,100% { box-shadow: 0 0 0 3px #e6b022, 0 0 20px rgba(230,176,34,0.5); }
        50%     { box-shadow: 0 0 0 3px #ffd700, 0 0 38px rgba(230,176,34,0.85); }
      }
    `,
    isConsumable: false,
    order: 1,
  },
  {
    name:         "Серебряная аура",
    description:  "Холодные серебристые осколки-искры, вращающиеся вокруг аватарки.",
    icon:         "🌙",
    price:        80,
    category:     "personal",
    type:         "cosmetic",
    cosmeticType: "avatar_frame",
    css: `
      %SEL%::before {
        content: "";
        position: absolute;
        inset: -16px;
        border-radius: 50%;
        background:
          radial-gradient(circle 4px at 50% 2%,   #dff3ff 90%, transparent),
          radial-gradient(circle 3px at 92% 30%,  #dff3ff 90%, transparent),
          radial-gradient(circle 3px at 85% 82%,  #dff3ff 90%, transparent),
          radial-gradient(circle 4px at 15% 85%,  #dff3ff 90%, transparent),
          radial-gradient(circle 3px at 5% 35%,   #dff3ff 90%, transparent);
        filter: drop-shadow(0 0 4px rgba(168,200,216,0.9));
        z-index: 2;
        pointer-events: none;
        animation: silverShardsSpin 6s linear infinite;
      }
      %SEL%::after {
        content: "";
        position: absolute;
        inset: -2px;
        border-radius: 50%;
        box-shadow: 0 0 0 3px #a8c8d8, 0 0 18px rgba(168,200,216,0.5);
        animation: silverGlow 3.2s ease-in-out infinite;
        pointer-events: none;
      }
    `,
    keyframes: `
      @keyframes silverShardsSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      @keyframes silverGlow {
        0%,100% { box-shadow: 0 0 0 3px #a8c8d8, 0 0 18px rgba(168,200,216,0.4); }
        50%     { box-shadow: 0 0 0 3px #cce8f8, 0 0 32px rgba(168,200,216,0.8); }
      }
    `,
    isConsumable: false,
    order: 2,
  },
  {
    name:         "Огненная аура",
    description:  "Настоящее вращающееся пламя с живым мерцанием вокруг аватарки.",
    icon:         "🔥",
    price:        180,
    category:     "personal",
    type:         "cosmetic",
    cosmeticType: "avatar_frame",
    css: `
      %SEL%::before {
        content: "";
        position: absolute;
        inset: -15px;
        border-radius: 50%;
        background: conic-gradient(from 0deg,
          #ff4500, #ffae00, #ff2200, #ff8c00, #ff4500, #ffcf3d, #ff2200, #ff4500);
        filter: blur(8px);
        opacity: 0.9;
        z-index: -1;
        animation: fireSpin 2.4s linear infinite, fireFlicker 0.5s ease-in-out infinite alternate;
        pointer-events: none;
      }
      %SEL%::after {
        content: "";
        position: absolute;
        inset: -3px;
        border-radius: 50%;
        box-shadow: 0 0 16px 3px rgba(255,120,0,0.85), 0 0 32px 8px rgba(255,60,0,0.35);
        animation: fireFlicker 0.4s ease-in-out infinite alternate-reverse;
        pointer-events: none;
      }
    `,
    keyframes: `
      @keyframes fireSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      @keyframes fireFlicker {
        0%   { opacity: 0.75; transform: scale(0.96); }
        100% { opacity: 1;    transform: scale(1.05); }
      }
    `,
    isConsumable: false,
    order: 3,
  },
  {
    name:         "Неоновый контур",
    description:  "Ярко-зелёные неоновые кольца, расходящиеся как радар-пульс.",
    icon:         "💚",
    price:        150,
    category:     "personal",
    type:         "cosmetic",
    cosmeticType: "avatar_frame",
    css: `
      %SEL%::before {
        content: "";
        position: absolute;
        inset: -2px;
        border-radius: 50%;
        box-shadow: 0 0 0 2px #00ff41, 0 0 14px rgba(0,255,65,0.7);
        z-index: 1;
        pointer-events: none;
        animation: neonCore 2s ease-in-out infinite;
      }
      %SEL%::after {
        content: "";
        position: absolute;
        inset: -2px;
        border-radius: 50%;
        border: 2px solid #00ff41;
        opacity: 0;
        z-index: -1;
        pointer-events: none;
        animation: neonSonar 2.4s ease-out infinite;
      }
    `,
    keyframes: `
      @keyframes neonCore {
        0%,100% { box-shadow: 0 0 0 2px #00ff41, 0 0 14px rgba(0,255,65,0.6); }
        50%     { box-shadow: 0 0 0 2px #00ff41, 0 0 28px rgba(0,255,65,0.95); }
      }
      @keyframes neonSonar {
        0%   { transform: scale(1);    opacity: 0.65; }
        100% { transform: scale(1.55); opacity: 0; }
      }
    `,
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
    price:        5,
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