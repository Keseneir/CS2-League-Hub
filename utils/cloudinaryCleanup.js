const crypto = require("crypto");

/**
 * Удаляет файл из Cloudinary по public_id (Admin API, требует подписи).
 * Не бросает исключений наружу — если ключи не настроены или запрос упал,
 * просто логируем и продолжаем (вложение останется висеть в Cloudinary,
 * это не критично для работы сайта).
 */
async function destroyCloudinaryAsset(publicId) {
  const cloud  = process.env.CLOUDINARY_CLOUD_NAME;
  const key    = process.env.CLOUDINARY_API_KEY;
  const secret = process.env.CLOUDINARY_API_SECRET;
  if (!cloud || !key || !secret) {
    console.log("Cloudinary cleanup: CLOUDINARY_API_KEY/SECRET not configured, skipping deletion of", publicId);
    return;
  }
  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = crypto
      .createHash("sha1")
      .update(`public_id=${publicId}&timestamp=${timestamp}${secret}`)
      .digest("hex");

    const fd = new URLSearchParams();
    fd.append("public_id", publicId);
    fd.append("timestamp", String(timestamp));
    fd.append("api_key",   key);
    fd.append("signature", signature);

    const res  = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/destroy`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body:   fd,
    });
    const data = await res.json();
    if (data.result !== "ok" && data.result !== "not found") {
      console.error("Cloudinary destroy unexpected result:", data);
    }
  } catch (err) {
    console.error("Cloudinary destroy request failed:", err.message);
  }
}

module.exports = { destroyCloudinaryAsset };