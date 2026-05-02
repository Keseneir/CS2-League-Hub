const mongoose = require("mongoose");

const rankSchema = new mongoose.Schema(
  {
    name:  { type: String, required: true, unique: true, trim: true },
    color: { type: String, default: "#e6b022" }, // HEX цвет бейджа
    order: { type: Number, default: 0 },          // Порядок отображения (меньше = выше)
  },
  { timestamps: true }
);

module.exports = mongoose.model("Rank", rankSchema);