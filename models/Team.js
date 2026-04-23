const mongoose = require("mongoose");

const teamSchema = new mongoose.Schema(
  {
    name:      { type: String, required: true, trim: true, maxlength: 64 },
    tag:       { type: String, required: true, trim: true, maxlength: 8, uppercase: true },
    logo:      { type: String, default: "" },
    telegram:  { type: String, default: "" },
    captainId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    members:   [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // основной состав, макс 5
    subs:      [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // замены, макс 5
  },
  { timestamps: true }
);

module.exports = mongoose.model("Team", teamSchema);