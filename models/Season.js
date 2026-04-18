const mongoose = require("mongoose");

const seasonSchema = new mongoose.Schema(
  {
    name:     { type: String, required: true, trim: true },        // "Сезон 2 · 2026"
    year:     { type: Number, required: true },
    isActive: { type: Boolean, default: false },                   // только один активный
  },
  { timestamps: true }
);

module.exports = mongoose.model("Season", seasonSchema);
