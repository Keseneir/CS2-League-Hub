const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    steamId:     { type: String, required: true, unique: true },
    displayName: { type: String, default: "" },
    avatar:      { type: String, default: "" },
    points:      { type: Number, default: 0 },
    rank:        { type: String, default: "Unranked" },
    teamId:      { type: mongoose.Schema.Types.ObjectId, ref: "Team", default: null },

    
    friends: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    
    friendRequests: [{
      from:      { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
      createdAt: { type: Date, default: Date.now }
    }],

   
    adminNotices: [{
      type:      { type: String, default: "custom" },
      message:   { type: String, default: "" },
      teamId:    { type: mongoose.Schema.Types.ObjectId, ref: "Team" },
      teamName:  { type: String, default: "" },
      read:      { type: Boolean, default: false },
      createdAt: { type: Date, default: Date.now }
    }],

    
    teamInvites: [{
      teamId:    { type: mongoose.Schema.Types.ObjectId, ref: "Team", required: true },
      from:      { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
      role:      { type: String, enum: ["main", "sub"], default: "main" },
      createdAt: { type: Date, default: Date.now }
    }],
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
