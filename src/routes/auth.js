// Регистрация, вход, профиль текущего пользователя.
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db");
const {
  JWT_SECRET,
  OWNER_SIGNUP_CODE,
  USERNAME_RE,
  STARTING_BALANCE,
  MAX_AVATAR_LENGTH,
} = require("../config");
const { publicUser, ownUser, containsBannedName } = require("../helpers");
const { authMiddleware, rateLimit, safeEqual, banMiddleware, getClientIp } = require("../middleware");
const { broadcastProfileUpdate, broadcastAll } = require("../ws");
const { generateSecret, verifyTOTP, otpauthURL } = require("../totp");

const router = express.Router();

// Лимиты на чувствительные операции — защита от подбора пароля/кода.
const registerLimiter = rateLimit("register", { windowMs: 15 * 60 * 1000, max: 10 });
const loginLimiter = rateLimit("login", { windowMs: 15 * 60 * 1000, max: 10 });
const twofaLimiter = rateLimit("twofa", { windowMs: 15 * 60 * 1000, max: 15 });

router.post("/api/register", banMiddleware, registerLimiter, (req, res) => {
  const { username, nickname, password } = req.body || {};
  if (!username || !USERNAME_RE.test(username.trim())) {
    return res.status(400).json({
      error: "Имя пользователя: 3-20 символов, латинские буквы, цифры, _ и .",
    });
  }
  if (!password || password.length < 4) {
    return res.status(400).json({ error: "Пароль от 4 символов" });
  }
  const cleanUsername = username.trim().toLowerCase();
  const cleanNickname = (nickname && nickname.trim()) || cleanUsername;
  if (cleanNickname.length > 40) {
    return res.status(400).json({ error: "Ник длиной до 40 символов" });
  }
  if (containsBannedName(cleanUsername) || containsBannedName(cleanNickname)) {
    return res.status(400).json({ error: "Такое имя пользователя или ник запрещены" });
  }
  const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(cleanUsername);
  if (existing) {
    return res.status(409).json({ error: "Такое имя пользователя уже занято" });
  }
  const hash = bcrypt.hashSync(password, 10);
  const now = Date.now();
  // Дополнительная страховка к проверке выше: колонка username объявлена UNIQUE,
  // поэтому даже при гонке двух запросов вставка-дубликат бросит ошибку — ловим
  // её и отдаём чистый 409 вместо 500.
  const regIp = getClientIp(req);
  try {
    db.prepare(
      "INSERT INTO users (username, nickname, password_hash, created_at, balance, last_ip) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(cleanUsername, cleanNickname, hash, now, STARTING_BALANCE, regIp);
  } catch (e) {
    return res.status(409).json({ error: "Такое имя пользователя уже занято" });
  }
  // Сообщаем всем онлайн-клиентам о новом пользователе, чтобы он сразу
  // появился в поиске без REST-опроса.
  broadcastAll({
    type: "user_new",
    user: publicUser({ username: cleanUsername, nickname: cleanNickname, avatar: null, created_at: now }),
  });
  const token = jwt.sign({ username: cleanUsername }, JWT_SECRET, { expiresIn: "30d" });
  res.json({
    token,
    user: ownUser({
      username: cleanUsername,
      nickname: cleanNickname,
      avatar: null,
      created_at: now,
      balance: STARTING_BALANCE,
    }),
  });
});

// Регистрация "создателя" — отдельное окошко в UI, требует код доступа.
// Код доступа не является паролем аккаунта: пароль пользователь придумывает сам,
// код лишь подтверждает право получить права создателя.
router.post("/api/register-owner", banMiddleware, registerLimiter, (req, res) => {
  const { username, nickname, password, code } = req.body || {};
  if (!safeEqual(code, OWNER_SIGNUP_CODE)) {
    return res.status(403).json({ error: "Неверный код доступа" });
  }
  if (!username || !USERNAME_RE.test(username.trim())) {
    return res.status(400).json({
      error: "Имя пользователя: 3-20 символов, латинские буквы, цифры, _ и .",
    });
  }
  if (!password || password.length < 4) {
    return res.status(400).json({ error: "Пароль от 4 символов" });
  }
  const cleanUsername = username.trim().toLowerCase();
  const cleanNickname = (nickname && nickname.trim()) || cleanUsername;
  if (cleanNickname.length > 40) {
    return res.status(400).json({ error: "Ник длиной до 40 символов" });
  }
  if (containsBannedName(cleanUsername) || containsBannedName(cleanNickname)) {
    return res.status(400).json({ error: "Такое имя пользователя или ник запрещены" });
  }
  const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(cleanUsername);
  if (existing) {
    return res.status(409).json({ error: "Такое имя пользователя уже занято" });
  }
  const hash = bcrypt.hashSync(password, 10);
  const now = Date.now();
  const regIp = getClientIp(req);
  try {
    db.prepare(
      "INSERT INTO users (username, nickname, password_hash, created_at, balance, is_owner, last_ip) VALUES (?, ?, ?, ?, ?, 1, ?)"
    ).run(cleanUsername, cleanNickname, hash, now, STARTING_BALANCE, regIp);
  } catch (e) {
    return res.status(409).json({ error: "Такое имя пользователя уже занято" });
  }
  broadcastAll({
    type: "user_new",
    user: publicUser({ username: cleanUsername, nickname: cleanNickname, avatar: null, created_at: now }),
  });
  const token = jwt.sign({ username: cleanUsername }, JWT_SECRET, { expiresIn: "30d" });
  res.json({
    token,
    user: ownUser({
      username: cleanUsername,
      nickname: cleanNickname,
      avatar: null,
      created_at: now,
      balance: STARTING_BALANCE,
      is_owner: 1,
    }),
  });
});

router.post("/api/login", banMiddleware, loginLimiter, (req, res) => {
  const { username, password, code } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: "Введите имя и пароль" });
  }
  const cleanUsername = username.trim().toLowerCase();
  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(cleanUsername);
  // Один и тот же текст ошибки для "нет пользователя" и "неверный пароль" —
  // иначе по разнице ответов можно перебором узнавать, какие логины существуют.
  const genericError = { error: "Неверное имя пользователя или пароль" };
  if (!user) return res.status(401).json(genericError);
  const ok = bcrypt.compareSync(password, user.password_hash);
  if (!ok) return res.status(401).json(genericError);

  // Второй фактор: если у пользователя включена 2FA — требуем код из приложения.
  if (user.totp_enabled) {
    if (!code) {
      return res.status(401).json({ twofa_required: true, error: "Введите код из приложения-аутентификатора" });
    }
    if (!verifyTOTP(user.totp_secret, code)) {
      return res.status(401).json({ twofa_required: true, error: "Неверный код двухфакторной аутентификации" });
    }
  }

  db.prepare("UPDATE users SET last_ip = ? WHERE username = ?").run(getClientIp(req), cleanUsername);

  const token = jwt.sign({ username: cleanUsername }, JWT_SECRET, { expiresIn: "30d" });
  res.json({ token, user: ownUser(user) });
});

router.get("/api/me", authMiddleware, (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(req.username);
  if (!user) return res.status(404).json({ error: "Пользователь не найден" });
  res.json({ user: ownUser(user) });
});

// Изменение ника и/или аватарки — на username и пароль это не влияет.
router.patch("/api/profile", authMiddleware, (req, res) => {
  const { nickname, avatar } = req.body || {};

  if (nickname !== undefined) {
    const clean = String(nickname).trim();
    if (!clean || clean.length > 40) {
      return res.status(400).json({ error: "Ник от 1 до 40 символов" });
    }
    if (containsBannedName(clean)) {
      return res.status(400).json({ error: "Такой ник запрещён" });
    }
    db.prepare("UPDATE users SET nickname = ? WHERE username = ?").run(clean, req.username);
  }

  if (avatar !== undefined) {
    if (avatar !== null && avatar.length > MAX_AVATAR_LENGTH) {
      return res.status(400).json({ error: "Аватар слишком большой, выберите другое фото" });
    }
    if (avatar !== null && !/^data:image\/(png|jpeg|jpg|webp);base64,/.test(avatar)) {
      return res.status(400).json({ error: "Неверный формат аватара" });
    }
    db.prepare("UPDATE users SET avatar = ? WHERE username = ?").run(avatar, req.username);
  }

  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(req.username);
  broadcastProfileUpdate(publicUser(user));
  res.json({ user: ownUser(user) });
});

// ---------- Двухфакторная аутентификация (TOTP) ----------

// Начать подключение: сгенерировать секрет (ещё НЕ включаем 2FA — ждём подтверждения кодом).
// Возвращаем секрет и otpauth-ссылку, чтобы добавить в приложение-аутентификатор.
router.post("/api/2fa/setup", authMiddleware, twofaLimiter, (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(req.username);
  if (!user) return res.status(404).json({ error: "Пользователь не найден" });
  if (user.totp_enabled) return res.status(400).json({ error: "Двухфакторная аутентификация уже включена" });
  const secret = generateSecret();
  db.prepare("UPDATE users SET totp_secret = ? WHERE username = ?").run(secret, req.username);
  res.json({ secret, otpauth: otpauthURL(secret, user.username) });
});

// Подтвердить кодом и включить 2FA.
router.post("/api/2fa/enable", authMiddleware, twofaLimiter, (req, res) => {
  const { code } = req.body || {};
  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(req.username);
  if (!user) return res.status(404).json({ error: "Пользователь не найден" });
  if (user.totp_enabled) return res.status(400).json({ error: "Двухфакторная аутентификация уже включена" });
  if (!user.totp_secret) return res.status(400).json({ error: "Сначала начните настройку" });
  if (!verifyTOTP(user.totp_secret, code)) {
    return res.status(400).json({ error: "Неверный код, попробуйте ещё раз" });
  }
  db.prepare("UPDATE users SET totp_enabled = 1 WHERE username = ?").run(req.username);
  const updated = db.prepare("SELECT * FROM users WHERE username = ?").get(req.username);
  res.json({ ok: true, user: ownUser(updated) });
});

// Отключить 2FA — требуем действующий код (чтобы не отключил посторонний).
router.post("/api/2fa/disable", authMiddleware, twofaLimiter, (req, res) => {
  const { code } = req.body || {};
  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(req.username);
  if (!user) return res.status(404).json({ error: "Пользователь не найден" });
  if (!user.totp_enabled) {
    return res.json({ ok: true, user: ownUser(user) });
  }
  if (!verifyTOTP(user.totp_secret, code)) {
    return res.status(400).json({ error: "Неверный код" });
  }
  db.prepare("UPDATE users SET totp_enabled = 0, totp_secret = NULL WHERE username = ?").run(req.username);
  const updated = db.prepare("SELECT * FROM users WHERE username = ?").get(req.username);
  res.json({ ok: true, user: ownUser(updated) });
});

module.exports = router;
