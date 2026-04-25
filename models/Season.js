const mongoose = require("mongoose");

const seasonSchema = new mongoose.Schema(
  {
    name:     { type: String, required: true, trim: true },        
    year:     { type: Number, required: true },
    isActive: { type: Boolean, default: false },                   
  },
  { timestamps: true }
);

module.exports = mongoose.model("Season", seasonSchema);
