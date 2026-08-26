const mongoose = require("mongoose");

// Один embed внутри шаблона — соответствует подмножеству полей Discord embed,
// которое реально поддерживает конструктор в админке (без author/полей/кнопок,
// кнопки через webhook в принципе недоступны — только через настоящего бота).
const EmbedSchema = new mongoose.Schema(
  {
    title:       { type: String, trim: true, maxlength: 256, default: "" },
    description: { type: String, trim: true, maxlength: 4090, default: "" },
    color:       { type: String, trim: true, default: "#E6B022" }, // hex, напр. "#E6B022"
    thumbnail:   { type: String, trim: true, default: "" },        // URL маленькой картинки
    footerText:  { type: String, trim: true, maxlength: 2048, default: "" },
    footerIcon:  { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const DiscordEmbedTemplateSchema = new mongoose.Schema(
  {
    name:   { type: String, required: true, trim: true, maxlength: 100, unique: true },
    embeds: {
      type: [EmbedSchema],
      validate: {
        validator: arr => arr.length > 0 && arr.length <= 10, // лимит Discord — до 10 embed'ов в сообщении
        message: "В шаблоне должно быть от 1 до 10 embed'ов",
      },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("DiscordEmbedTemplate", DiscordEmbedTemplateSchema);