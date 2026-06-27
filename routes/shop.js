const express         = require("express");
const router          = express.Router();
const User            = require("../models/User");
const Team            = require("../models/Team");
const ShopItem        = require("../models/ShopItem");
const { requireAuth } = require("../middleware/auth");

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isCaptainOrManager(team, userId) {
  const uid = userId.toString();
  return (
    team.captainId.toString() === uid ||
    (team.managerId && team.managerId.toString() === uid)
  );
}

// ─── GET /api/shop/items ─── все активные предметы (можно фильтровать ?category=personal|team)
router.get("/items", async (req, res) => {
  try {
    const filter = { isActive: true };
    if (req.query.category && ["personal","team"].includes(req.query.category)) {
      filter.category = req.query.category;
    }
    const items = await ShopItem.find(filter).sort({ order: 1, createdAt: 1 }).lean();
    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// ─── GET /api/shop/balance ─── личный баланс + командный (если есть команда)
router.get("/balance", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select("personalBalance teamId").lean();

    let teamBalance   = null;
    let teamName      = null;
    let isTeamManager = false;

    if (user.teamId) {
      const team = await Team.findById(user.teamId)
        .select("balance name captainId managerId").lean();
      if (team) {
        teamBalance   = team.balance;
        teamName      = team.name;
        isTeamManager = isCaptainOrManager(team, req.user._id);
      }
    }

    res.json({
      personalBalance: user.personalBalance || 0,
      teamBalance,
      teamName,
      isTeamManager,
    });
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// ─── GET /api/shop/inventory ─── личный инвентарь + командный
router.get("/inventory", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate("personalInventory.itemId")
      .populate("equippedCosmetics.avatarFrame", "name icon cosmeticType")
      .populate("equippedCosmetics.profileBg",   "name icon cosmeticType")
      .select("personalInventory equippedCosmetics teamId").lean();

    let teamInventory = [];
    let teamEquipped  = {};
    if (user.teamId) {
      const team = await Team.findById(user.teamId)
        .populate("inventory.itemId")
        .populate("equippedCosmetics.teamBg", "name icon cosmeticType")
        .select("inventory equippedCosmetics").lean();
      if (team) {
        teamInventory = team.inventory || [];
        teamEquipped  = team.equippedCosmetics || {};
      }
    }

    res.json({
      // Косметику показываем всю, consumed расходники (бусты) — скрываем
      personal:      (user.personalInventory || []).filter(e => {
        if (!e.itemId) return false;
        if (e.itemId.isConsumable && e.consumed) return false;
        return true;
      }),
      team:          teamInventory,
      equippedUser:  user.equippedCosmetics || {},
      equippedTeam:  teamEquipped,
    });
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// ─── POST /api/shop/equip/personal ─── надеть личную косметику ────────────
// slot: 'avatarFrame' | 'profileBg'  (null = снять)
router.post("/equip/personal", requireAuth, async (req, res) => {
  try {
    const { itemId, slot } = req.body;
    if (!["avatarFrame", "profileBg"].includes(slot))
      return res.status(400).json({ error: "slot: avatarFrame или profileBg" });

    if (!itemId) {
      // Снять
      await User.findByIdAndUpdate(req.user._id, {
        $set: { [`equippedCosmetics.${slot}`]: null },
      });
      return res.json({ ok: true, equipped: null });
    }

    const item = await ShopItem.findById(itemId).lean();
    if (!item) return res.status(404).json({ error: "Предмет не найден" });

    const user = await User.findById(req.user._id)
      .select("personalInventory equippedCosmetics").lean();
    const owns = (user.personalInventory || []).some(
      (e) => e.itemId?.toString() === itemId
    );
    if (!owns)
      return res.status(400).json({ error: "Этого предмета нет в вашем инвентаре" });

    await User.findByIdAndUpdate(req.user._id, {
      $set: { [`equippedCosmetics.${slot}`]: item._id },
    });
    res.json({ ok: true, equipped: item._id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// ─── POST /api/shop/equip/team ─── надеть командную косметику ─────────────
// slot: 'teamBg'  (null itemId = снять)
router.post("/equip/team", requireAuth, async (req, res) => {
  try {
    if (!req.user.teamId)
      return res.status(400).json({ error: "Вы не в команде" });

    const { itemId, slot } = req.body;
    if (!["teamBg"].includes(slot))
      return res.status(400).json({ error: "slot: teamBg" });

    const team = await Team.findById(req.user.teamId)
      .select("captainId managerId inventory equippedCosmetics").lean();
    if (!team) return res.status(404).json({ error: "Команда не найдена" });

    const uid = req.user._id.toString();
    const canEdit =
      team.captainId.toString() === uid ||
      (team.managerId && team.managerId.toString() === uid);
    if (!canEdit)
      return res.status(403).json({ error: "Только капитан или менеджер" });

    if (!itemId) {
      await Team.findByIdAndUpdate(req.user.teamId, {
        $set: { [`equippedCosmetics.${slot}`]: null },
      });
      return res.json({ ok: true, equipped: null });
    }

    const item = await ShopItem.findById(itemId).lean();
    if (!item) return res.status(404).json({ error: "Предмет не найден" });

    const owns = (team.inventory || []).some(
      (e) => !e.consumed && e.itemId?.toString() === itemId
    );
    if (!owns)
      return res.status(400).json({ error: "Этого предмета нет в инвентаре команды" });

    await Team.findByIdAndUpdate(req.user.teamId, {
      $set: { [`equippedCosmetics.${slot}`]: item._id },
    });
    res.json({ ok: true, equipped: item._id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// ─── POST /api/shop/buy/personal ─── купить личный предмет ─────────────────
router.post("/buy/personal", requireAuth, async (req, res) => {
  try {
    const { itemId } = req.body;
    if (!itemId) return res.status(400).json({ error: "Укажите itemId" });

    const item = await ShopItem.findById(itemId).lean();
    if (!item || !item.isActive)
      return res.status(404).json({ error: "Предмет не найден или недоступен" });
    if (item.category !== "personal")
      return res.status(400).json({ error: "Это командный предмет" });

    // Атомарное списание: гарантирует защиту от race condition
    // findOneAndUpdate вернёт null, если баланс недостаточен — без дополнительных запросов
    const updated = await User.findOneAndUpdate(
      { _id: req.user._id, personalBalance: { $gte: item.price } },
      {
        $inc:  { personalBalance: -item.price },
        $push: { personalInventory: { itemId: item._id, addedAt: new Date() } },
      },
      { new: true }
    );

    if (!updated)
      return res.status(400).json({ error: "Недостаточно монет на личном счёте" });

    res.json({ ok: true, personalBalance: updated.personalBalance });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// ─── POST /api/shop/buy/team ─── купить командный предмет ─────────────────
// Только капитан или менеджер могут тратить командный кошелёк
router.post("/buy/team", requireAuth, async (req, res) => {
  try {
    if (!req.user.teamId)
      return res.status(400).json({ error: "Вы не состоите в команде" });

    const { itemId } = req.body;
    if (!itemId) return res.status(400).json({ error: "Укажите itemId" });

    const item = await ShopItem.findById(itemId).lean();
    if (!item || !item.isActive)
      return res.status(404).json({ error: "Предмет не найден или недоступен" });
    if (item.category !== "team")
      return res.status(400).json({ error: "Это личный предмет" });

    // RBAC: только капитан / менеджер
    const teamCheck = await Team.findById(req.user.teamId)
      .select("captainId managerId").lean();
    if (!teamCheck)
      return res.status(404).json({ error: "Команда не найдена" });
    if (!isCaptainOrManager(teamCheck, req.user._id))
      return res.status(403).json({ error: "Только капитан или менеджер могут делать покупки для команды" });

    // Атомарное списание командного баланса
    const updated = await Team.findOneAndUpdate(
      { _id: req.user.teamId, balance: { $gte: item.price } },
      {
        $inc:  { balance: -item.price },
        $push: { inventory: { itemId: item._id, addedAt: new Date(), consumed: false } },
      },
      { new: true }
    );

    if (!updated)
      return res.status(400).json({ error: "Недостаточно монет на командном кошельке" });

    res.json({ ok: true, teamBalance: updated.balance });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// ─── POST /api/shop/team/deposit ─── пополнить командный кошелёк личными монетами
// Любой член команды может скинуться
router.post("/team/deposit", requireAuth, async (req, res) => {
  try {
    if (!req.user.teamId)
      return res.status(400).json({ error: "Вы не состоите в команде" });

    const amount = Number(req.body.amount);
    if (!amount || amount < 1 || !Number.isInteger(amount))
      return res.status(400).json({ error: "Укажите корректную сумму (целое число ≥ 1)" });

    // Атомарно списываем у игрока и зачисляем команде
    const updatedUser = await User.findOneAndUpdate(
      { _id: req.user._id, personalBalance: { $gte: amount } },
      { $inc: { personalBalance: -amount } },
      { new: true }
    );
    if (!updatedUser)
      return res.status(400).json({ error: "Недостаточно монет" });

    await Team.findByIdAndUpdate(req.user.teamId, { $inc: { balance: amount } });

    res.json({ ok: true, personalBalance: updatedUser.personalBalance });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// ─── POST /api/shop/team/consume/:inventoryEntryId ─── использовать расходник
// Например, активировать турнирный билет
router.post("/team/consume/:entryId", requireAuth, async (req, res) => {
  try {
    if (!req.user.teamId)
      return res.status(400).json({ error: "Вы не в команде" });

    const teamCheck = await Team.findById(req.user.teamId)
      .select("captainId managerId inventory").populate("inventory.itemId", "isConsumable").lean();
    if (!teamCheck)
      return res.status(404).json({ error: "Команда не найдена" });
    if (!isCaptainOrManager(teamCheck, req.user._id))
      return res.status(403).json({ error: "Только капитан или менеджер" });

    const entry = (teamCheck.inventory || []).find(e => e._id.toString() === req.params.entryId);
    if (!entry)
      return res.status(404).json({ error: "Предмет не найден в инвентаре" });
    if (entry.consumed)
      return res.status(400).json({ error: "Предмет уже использован" });
    if (!entry.itemId?.isConsumable)
      return res.status(400).json({ error: "Этот предмет нельзя активировать вручную" });

    await Team.updateOne(
      { _id: req.user.teamId, "inventory._id": req.params.entryId },
      { $set: { "inventory.$.consumed": true, "inventory.$.consumedAt": new Date() } }
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

module.exports = router;