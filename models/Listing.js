const mongoose = require("mongoose");

// player_seeking_team — игрок ищет команду
// team_seeking_player — команда ищет игрока
// scrim                — команда ищет спарринг/скрим (без второй стороны-игрока)
const LISTING_TYPES = ["player_seeking_team", "team_seeking_player", "scrim"];

const ListingSchema = new mongoose.Schema(
  {
    authorId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "User",
      required: true,
      index:    true,
    },

    // Заполняется только для team_seeking_player / scrim — команда автора на момент публикации
    teamId: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     "Team",
      default: null,
    },

    type: {
      type:     String,
      enum:     LISTING_TYPES,
      required: true,
    },

    title: {
      type:      String,
      required:  true,
      trim:      true,
      maxlength: 100,
    },

    description: {
      type:      String,
      required:  true,
      trim:      true,
      maxlength: 2000,
    },

    // Свободный текст: "AWP", "IGL", "Entry-fragger", "BO3 в субботу" и т.п.
    role: {
      type:      String,
      default:   "",
      trim:      true,
      maxlength: 60,
    },

    image: {
      url:      { type: String, default: "" },
      publicId: { type: String, default: "" },
    },

    // Автор снял объявление с публикации сам (нашёл команду/игрока)
    active: {
      type:    Boolean,
      default: true,
    },

    // Скрыто админом (модерация постфактум) — не показывается в публичном листинге,
    // но остаётся видно автору и в админке
    hiddenByAdmin: {
      type:    Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

ListingSchema.index({ active: 1, hiddenByAdmin: 1, createdAt: -1 });
ListingSchema.index({ type: 1, active: 1, hiddenByAdmin: 1 });

const Listing = mongoose.models.Listing || mongoose.model("Listing", ListingSchema);
Listing.TYPES = LISTING_TYPES;

module.exports = Listing;