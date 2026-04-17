const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    steamId: { type: String, required: true, unique: true },
    displayName: String,
    avatar: String,
    points: { type: Number, default: 0 },
    rank: { type: String, default: "Unranked" }
});

module.exports = mongoose.model('User', UserSchema);