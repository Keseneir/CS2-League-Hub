const mongoose = require("mongoose");

const tournamentSchema = new mongoose.Schema(
  {
    name:        { type: String, required: true, trim: true, maxlength: 128 },
    description: { type: String, default: "",   maxlength: 1000 },
    startDate:   { type: Date,   default: null },
    status:      { type: String, enum: ["upcoming", "active", "finished"], default: "upcoming" },

    // Размер СОСТАВА НА ТУРНИР (не общий ростер команды — тот может быть
    // больше). Раньше был только minMembers с жёстким max:5 (расчёт на
    // 5x5) — теперь диапазон свободный, чтобы поддержать форматы вроде 2х2.
    minMembers:  { type: Number, default: 5, min: 1 },
    maxMembers:  { type: Number, default: 5, min: 1 },

    maxTeams:    { type: Number, default: 16, min: 2 },
    prize:       { type: String, default: "", maxlength: 256 },

    // Пороги разрыва между игроками в выбранном составе — используются
    // только для предупреждения админа в панели, регистрацию не блокируют.
    // 0 или null = проверка выключена.
    maxHoursGap:  { type: Number, default: null, min: 0 },
    maxFaceitGap: { type: Number, default: null, min: 0 },

    registrations: [
      {
        teamId:        { type: mongoose.Schema.Types.ObjectId, ref: "Team", required: true },
        captainId:     { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        ageConfirmed:  { type: Boolean, required: true },
        rulesAccepted: { type: Boolean, required: true },
        registeredAt:  { type: Date, default: Date.now },

        // Состав, который капитан выбрал именно для ЭТОГО турнира — из
        // основного/запасного состава команды. Можно менять, пока турнир
        // не помечен "active".
        roster: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Tournament", tournamentSchema);