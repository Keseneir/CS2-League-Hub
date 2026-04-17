const mongoose = require("mongoose");

const teamSchema = new mongoose.Schema(
  {
    name:      { type: String, required: true, trim: true, maxlength: 64 },
    tag:       { type: String, required: true, trim: true, maxlength: 8, uppercase: true },
    logo:      { type: String, default: "" },
    captainId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    members:   [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Team", teamSchema);
