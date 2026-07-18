// Middleware авторизации и прав создателя.
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const db = require("./db");
const { JWT_SECRET } = require("./config");

// ---------- Простой rate limiter в памяти (без внешних зависимостей) ----------
// Защищает чувствительные эндпоинты (вход, регистрация, 2FA) от перебора.
// Ключ — комбинация имени лимитера и IP, чтобы разные маршруты не делили лимит,
// а разные пользователи за одним NAT не мешали друг другу без надобности.
const rateBuckets = new Map();
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of rateBuckets) {
    if (now - bucket.windowStart > 60 * 60 * 1000) rateBuckets.delete(key);
  }
}, 10 * 60 * 1000);
if (cleanupTimer.unref) cleanupTimer.unref();

function rateLimit(name, opts) {
  const windowMs = opts.windowMs;
  const max = opts.max;
  return (req, res, next) => {
    const ip = getClientIp(req);
    const key = name + ":" + ip;
    const now = Date.now();
    let bucket = rateBuckets.get(key);
    if (!bucket || now - bucket.windowStart > windowMs) {
      bucket = { windowStart: now, count: 0 };
      rateBuckets.set(key, bucket);
    }
    bucket.count++;
    if (bucket.count > max) {
      const retryAfterSec = Math.ceil((bucket.windowStart + windowMs - now) / 1000);
      res.set("Retry-After", String(Math.max(1, retryAfterSec)));
      return res.status(429).json({ error: "Слишком много попыток. Попробуйте позже." });
    }
    next();
  };
}

// Сравнение секретов за постоянное время — защита от timing-атак (код доступа
// создателя, TOTP уже сравнивается через HMAC, но код доступа сравнивался как
// обычная строка, что теоретически позволяет угадывать посимвольно).
function safeEqual(a, b) {
  const bufA = Buffer.from(String(a == null ? "" : a));
  const bufB = Buffer.from(String(b == null ? "" : b));
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(Buffer.alloc(32), Buffer.alloc(32));
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

// Извлекает IP клиента тем же способом, что и rate limiter выше —
// единая логика для банов и лимитов.
// ВАЖНО: X-Forwarded-For доверяем только если Express настроен на это
// (app.set('trust proxy', true), включается через TRUST_PROXY=1 в env) —
// иначе любой клиент может подделать заголовок и обойти бан/лимит по IP.
// req.ip у Express уже учитывает trust proxy сам по себе.
function getClientIp(req) {
  if (req.app && req.app.get("trust proxy")) {
    return req.ip || req.socket.remoteAddress || "unknown";
  }
  return req.socket.remoteAddress || "unknown";
}

// Блокирует запрос, если IP забанен. Ставится ДО регистрации/входа,
// чтобы забаненный не мог ни зайти в старый аккаунт, ни создать новый.
function banMiddleware(req, res, next) {
  const ip = getClientIp(req);
  const ban = db.prepare("SELECT * FROM bans WHERE ip = ?").get(ip);
  if (ban) {
    return res.status(403).json({ error: "Доступ заблокирован администрацией", banned: true, reason: ban.reason || null });
  }
  next();
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Нет токена авторизации" });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.username = payload.username;
    next();
  } catch (e) {
    return res.status(401).json({ error: "Недействительный или истёкший токен" });
  }
}

// Доступ только для аккаунтов с флагом создателя (is_owner). Ставится ПОСЛЕ authMiddleware.
function ownerMiddleware(req, res, next) {
  const user = db.prepare("SELECT is_owner FROM users WHERE username = ?").get(req.username);
  if (!user || !user.is_owner) {
    return res.status(403).json({ error: "Требуются права создателя" });
  }
  next();
}

module.exports = { authMiddleware, ownerMiddleware, rateLimit, safeEqual, banMiddleware, getClientIp };
