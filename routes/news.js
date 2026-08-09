const express       = require("express");
const router        = express.Router();
const News          = require("../models/News");
const NewsReaction  = require("../models/NewsReaction");
const NewsComment   = require("../models/NewsComment");
const { requireAuth } = require("../middleware/auth");
const { ADMIN_STEAM_ID } = require("../config/constants");

// ─── GET /api/news ─── список новостей для публичной страницы ─────────────
router.get("/", async (req, res) => {
  try {
    const news = await News.find()
      .sort({ publishedAt: -1 })
      .select("title text tag img link featured publishedAt")
      .lean();
    res.json(news);
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// ─── GET /api/news/:id ─── одна новость целиком: реакции + комментарии ────
router.get("/:id", async (req, res) => {
  try {
    const news = await News.findById(req.params.id).lean();
    if (!news) return res.status(404).json({ error: "Новость не найдена" });

    const comments = await NewsComment.find({ newsId: news._id })
      .sort({ createdAt: 1 })
      .populate("userId", "displayName avatar")
      .lean();

    let myReaction = null;
    if (req.isAuthenticated && req.isAuthenticated()) {
      const r = await NewsReaction.findOne({ newsId: news._id, userId: req.user._id }).select("emoji").lean();
      myReaction = r ? r.emoji : null;
    }

    res.json({
      ...news,
      reactions: news.reactions || { flame: 0, sad: 0, angry: 0, thumbsUp: 0 },
      myReaction,
      comments: comments.map(c => ({
        _id: c._id,
        text: c.text,
        createdAt: c.createdAt,
        author: c.userId ? { _id: c.userId._id, displayName: c.userId.displayName, avatar: c.userId.avatar } : null,
        isMine: req.user ? String(c.userId?._id) === String(req.user._id) : false,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// ─── POST /api/news/:id/react ─── поставить/переключить/снять реакцию ─────
router.post("/:id/react", requireAuth, async (req, res) => {
  try {
    const { emoji } = req.body;
    if (!NewsReaction.REACTION_TYPES.includes(emoji))
      return res.status(400).json({ error: "Некорректная реакция" });

    const news = await News.findById(req.params.id).select("_id");
    if (!news) return res.status(404).json({ error: "Новость не найдена" });

    const existing = await NewsReaction.findOne({ newsId: news._id, userId: req.user._id });

    if (existing && existing.emoji === emoji) {
      // повторный клик по той же реакции — снимаем
      await existing.deleteOne();
      await News.findByIdAndUpdate(news._id, { $inc: { [`reactions.${emoji}`]: -1 } });
      return res.json({ ok: true, myReaction: null });
    }

    if (existing) {
      // переключение на другую реакцию
      const oldEmoji = existing.emoji;
      existing.emoji = emoji;
      await existing.save();
      await News.findByIdAndUpdate(news._id, {
        $inc: { [`reactions.${oldEmoji}`]: -1, [`reactions.${emoji}`]: 1 },
      });
      return res.json({ ok: true, myReaction: emoji });
    }

    await NewsReaction.create({ newsId: news._id, userId: req.user._id, emoji });
    await News.findByIdAndUpdate(news._id, { $inc: { [`reactions.${emoji}`]: 1 } });
    res.json({ ok: true, myReaction: emoji });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: "Повторите попытку" });
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// ─── POST /api/news/:id/comments ─── добавить комментарий ─────────────────
router.post("/:id/comments", requireAuth, async (req, res) => {
  try {
    const text = String(req.body.text || "").trim();
    if (!text) return res.status(400).json({ error: "Введите текст комментария" });
    if (text.length > 1000) return res.status(400).json({ error: "Слишком длинный комментарий" });

    const news = await News.findById(req.params.id).select("_id");
    if (!news) return res.status(404).json({ error: "Новость не найдена" });

    let comment = await NewsComment.create({ newsId: news._id, userId: req.user._id, text });
    comment = await comment.populate("userId", "displayName avatar");

    res.json({
      _id: comment._id,
      text: comment.text,
      createdAt: comment.createdAt,
      author: { _id: comment.userId._id, displayName: comment.userId.displayName, avatar: comment.userId.avatar },
      isMine: true,
    });
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// ─── DELETE /api/news/:id/comments/:commentId ─── удалить (автор или админ) ─
router.delete("/:id/comments/:commentId", requireAuth, async (req, res) => {
  try {
    const comment = await NewsComment.findById(req.params.commentId);
    if (!comment) return res.status(404).json({ error: "Комментарий не найден" });

    const isOwner = comment.userId.toString() === req.user._id.toString();
    const isAdmin = req.user.steamId === ADMIN_STEAM_ID;
    if (!isOwner && !isAdmin) return res.status(403).json({ error: "Недостаточно прав" });

    await comment.deleteOne();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

module.exports = router;