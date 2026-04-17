const mongoose = require("mongoose");

const applicationSchema = new mongoose.Schema(
  {
    userId:      { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    teamId:      { type: mongoose.Schema.Types.ObjectId, ref: "Team", required: true },
    hoursInCS2:  { type: Number, required: true, min: 0 },
    faceitLevel: { type: String, required: true },
    experience:  { type: String, default: "" },
    contacts:    { type: String, required: true },
    status:      { type: String, enum: ["pending", "accepted", "rejected"], default: "pending" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Application", applicationSchema);
