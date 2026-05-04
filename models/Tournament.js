const mongoose = require("mongoose");

const tournamentSchema = new mongoose.Schema(
  {
    name:        { type: String, required: true, trim: true, maxlength: 128 },
    description: { type: String, default: "",   maxlength: 1000 },
    startDate:   { type: Date,   default: null },
    status:      { type: String, enum: ["upcoming", "active", "finished"], default: "upcoming" },
    minMembers:  { type: Number, default: 5, min: 1, max: 5 },
    maxTeams:    { type: Number, default: 16, min: 2 },
    prize:       { type: String, default: "", maxlength: 256 },

    registrations: [
      {
        teamId:        { type: mongoose.Schema.Types.ObjectId, ref: "Team", required: true },
        captainId:     { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        ageConfirmed:  { type: Boolean, required: true },
        rulesAccepted: { type: Boolean, required: true },
        registeredAt:  { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Tournament", tournamentSchema);