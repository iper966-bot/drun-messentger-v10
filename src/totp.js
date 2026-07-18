// TOTP (Time-based One-Time Password, RFC 6238) — двухфакторная аутентификация
// через приложение-аутентификатор (Google Authenticator, Aegis, 1Password и т.п.).
// Реализовано на встроенном crypto, без внешних зависимостей.
const crypto = require("crypto");

const B32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(buffer) {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(str) {
  const clean = String(str).toUpperCase().replace(/=+$/, "").replace(/\s/g, "");
  let bits = 0;
  let value = 0;
  const out = [];
  for (const ch of clean) {
    const idx = B32_ALPHABET.indexOf(ch);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

// Новый случайный секрет (20 байт) в виде base32-строки для аутентификатора.
function generateSecret() {
  return base32Encode(crypto.randomBytes(20));
}

// Одноразовый код для конкретного счётчика (HOTP).
function hotp(secretBytes, counter) {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac("sha1", secretBytes).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 1000000).padStart(6, "0");
}

// Сравнение кодов за постоянное время, чтобы не давать наблюдателю по
// времени ответа сервера подсказки о том, сколько цифр угаданы верно.
function constantTimeStrEqual(a, b) {
  if (a.length !== b.length) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return crypto.timingSafeEqual(bufA, bufB);
}

// Проверка кода с окном ±1 шаг (учитываем небольшой рассинхрон часов).
function verifyTOTP(secretBase32, token, window = 1, step = 30) {
  if (!token) return false;
  const clean = String(token).replace(/\s/g, "");
  if (!/^\d{6}$/.test(clean)) return false;
  const secretBytes = base32Decode(secretBase32);
  if (!secretBytes.length) return false;
  const counter = Math.floor(Date.now() / 1000 / step);
  let matched = false;
  for (let d = -window; d <= window; d++) {
    if (constantTimeStrEqual(hotp(secretBytes, counter + d), clean)) matched = true;
  }
  return matched;
}

// otpauth:// ссылка для QR/ручного добавления в приложение-аутентификатор.
function otpauthURL(secretBase32, account, issuer = "Друн") {
  const label = encodeURIComponent(issuer) + ":" + encodeURIComponent(account);
  const params = new URLSearchParams({
    secret: secretBase32,
    issuer,
    algorithm: "SHA1",
    digits: "6",
    period: "30",
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

module.exports = { generateSecret, verifyTOTP, otpauthURL };
