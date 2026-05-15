const mongoose = require("mongoose");

const seasonSchema = new mongoose.Schema(
  {
    name:     { type: String, required: true, trim: true },        //назв сезона
    year:     { type: Number, required: true },
    isActive: { type: Boolean, default: false },                   //1 активный макс
  },
  { timestamps: true }
);

module.exports = mongoose.model("Season", seasonSchema);
