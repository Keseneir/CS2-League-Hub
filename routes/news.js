const express = require("express");
const router  = express.Router();
const News    = require("../models/News");

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

module.exports = router;