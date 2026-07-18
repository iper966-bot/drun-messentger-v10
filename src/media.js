// ---------- Загрузка медиа ----------
// Принимает data URL (data:image/jpeg;base64,...), проверяет тип и размер,
// сохраняет файл на диск и возвращает публичный путь.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { UPLOAD_DIR, MAX_UPLOAD_BYTES, ALLOWED_MEDIA } = require("./config");

function saveDataUrl(dataUrl) {
  if (typeof dataUrl !== "string") return { error: "Файл не передан" };
  // Разрешаем параметры в mime-типе (например, audio/webm;codecs=opus,
  // как отдаёт MediaRecorder при записи голосовых) — берём базовый тип.
  const m = /^data:([^,]*?);base64,(.+)$/s.exec(dataUrl);
  if (!m) return { error: "Неверный формат файла" };
  const mime = m[1].toLowerCase().split(";")[0].trim();
  const spec = ALLOWED_MEDIA[mime];
  if (!spec) return { error: "Такой тип файла не поддерживается" };
  let buf;
  try {
    buf = Buffer.from(m[2], "base64");
  } catch (e) {
    return { error: "Файл повреждён" };
  }
  if (!buf.length) return { error: "Пустой файл" };
  if (buf.length > MAX_UPLOAD_BYTES) {
    return { error: `Файл больше ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} МБ` };
  }
  const name = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${spec.ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, name), buf);
  return { url: "/uploads/" + name, mime, kind: spec.kind };
}

module.exports = { saveDataUrl };
