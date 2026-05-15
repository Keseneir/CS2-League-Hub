const mongoose = require("mongoose");

const rankSchema = new mongoose.Schema(
  {
    name:  { type: String, required: true, unique: true, trim: true },
    color: { type: String, default: "#e6b022" }, //хекс цвет ранга
    order: { type: Number, default: 0 },          
  },
  { timestamps: true }
);

module.exports = mongoose.model("Rank", rankSchema);