const express      = require("express");
const router       = express.Router();
const PromoCode          = require("../models/PromoCode");
const PromoRedemption    = require("../models/PromoRedemption");
const DiscordRoleRequest = require("../models/DiscordRoleRequest");
const User         = require("../models/User");
const Team         = require("../models/Team");
const ShopItem     = require("../models/ShopItem");
const { requireAuth } = require("../middleware/auth");
const { postAdminAlert } = require("../utils/discordAdminAlert");

// ─── POST /api/promo/redeem ─── погасить промокод ──────────────────────────
router.post("/redeem", requireAuth, async (req, res) => {
  try {
    const code = String(req.body.code || "").trim().toUpperCase();
    if (!code) return res.status(400).json({ error: "Введите промокод" });

    const promo = await PromoCode.findOne({ code });
    if (!promo || !promo.isActive)
      return res.status(404).json({ error: "Промокод не найден" });
    if (promo.expiresAt && promo.expiresAt < new Date())
      return res.status(400).json({ error: "Срок действия промокода истёк" });
    if (promo.maxActivations != null && promo.activationsCount >= promo.maxActivations)
      return res.status(400).json({ error: "Лимит активаций промокода исчерпан" });

    // Атомарно фиксируем факт использования этим юзером — уникальный индекс
    // (codeId, userId) защищает и от повторного использования, и от гонки
    // при двойном одновременном клике.
    try {
      await PromoRedemption.create({ codeId: promo._id, userId: req.user._id });
    } catch (err) {
      if (err.code === 11000) return res.status(400).json({ error: "Вы уже использовали этот промокод" });
      throw err;
    }

    // Атомарно увеличиваем счётчик активаций, но только если лимит всё ещё
    // не превышен — защита от гонки на самой границе лимита.
    const claimed = await PromoCode.findOneAndUpdate(
      {
        _id: promo._id,
        $or: [{ maxActivations: null }, { $expr: { $lt: ["$activationsCount", "$maxActivations"] } }],
      },
      { $inc: { activationsCount: 1 } },
      { new: true }
    );
    if (!claimed) {
      // Лимит успели исчерпать между проверкой и записью — откатываем редемпшн
      await PromoRedemption.deleteOne({ codeId: promo._id, userId: req.user._id });
      return res.status(400).json({ error: "Лимит активаций промокода исчерпан" });
    }

    // Выдаём награды
    const grantedLabels = [];
    for (const reward of promo.rewards) {
      if (reward.type === "personalCoins") {
        await User.findByIdAndUpdate(req.user._id, { $inc: { personalBalance: reward.amount } });
        grantedLabels.push(`+${reward.amount} монет на личный счёт`);

      } else if (reward.type === "teamCoins") {
        if (req.user.teamId) {
          await Team.findByIdAndUpdate(req.user.teamId, { $inc: { balance: reward.amount } });
          grantedLabels.push(`+${reward.amount} монет команде`);
        } else {
          grantedLabels.push(`Награда команде (+${reward.amount} монет) не выдана — вы не состоите в команде`);
        }

      } else if (reward.type === "cosmetic") {
        const item = await ShopItem.findById(reward.itemId).lean();
        if (item) {
          await User.findByIdAndUpdate(req.user._id, {
            $push: { personalInventory: { itemId: item._id, addedAt: new Date() } },
          });
          grantedLabels.push(`Предмет в инвентаре: ${item.name}`);
        }

      } else if (reward.type === "discordRole") {
        await DiscordRoleRequest.create({
          userId:      req.user._id,
          steamId:     req.user.steamId,
          displayName: req.user.displayName,
          roleName:    reward.roleName,
          promoCode:   promo.code,
        });
        grantedLabels.push(`Роль "${reward.roleName}" в Discord — заявка отправлена администратору`);
        await postAdminAlert("🎭 Запрос роли Discord (промокод)", [
          { name: "Игрок",   value: req.user.displayName },
          { name: "SteamID", value: req.user.steamId },
          { name: "Роль",    value: reward.roleName },
          { name: "Промокод", value: promo.code },
        ]);
      }
    }

    res.json({ ok: true, rewards: grantedLabels });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

module.exports = router;