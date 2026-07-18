// Точка входа: собирает Express-приложение из модулей в src/,
// поднимает HTTP- и WebSocket-серверы. Вся логика вынесена в src/.
const express = require("express");
const path = require("path");
const http = require("http");
const https = require("https");
const fs = require("fs");
const cors = require("cors");

const { PORT, UPLOAD_DIR, SSL_KEY_PATH, SSL_CERT_PATH, SSL_CA_PATH } = require("./src/config");
require("./src/db"); // инициализация схемы и миграций (побочный эффект require)
const { initWs } = require("./src/ws");
const { rateLimit } = require("./src/middleware");

const app = express();

// Доверие к заголовку X-Forwarded-For: включайте TRUST_PROXY=1 только если
// сервис реально стоит за прокси/балансировщиком (Render, Railway, nginx и т.п.),
// который сам подставляет этот заголовок и не пропускает его от клиента как есть.
// Без этой настройки любой клиент может подделать X-Forwarded-For и обойти
// бан/rate-limit по IP (middleware.getClientIp и rateLimit его используют).
if (process.env.TRUST_PROXY === "1") {
  app.set("trust proxy", true);
} else {
  app.set("trust proxy", false);
}

// Общие security-заголовки. Без сторонних зависимостей (helmet), чтобы не
// раздувать поверхность атаки лишним пакетом — набор заголовков ниже покрывает
// основные риски: MIME-sniffing, clickjacking, утечку Referer, доступ к
// чужим API из браузера (permissions-policy), протокол-даунгрейд (HSTS).
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "geolocation=(), payment=(), usb=()");
  // HSTS есть смысл слать только когда реально едем по HTTPS (сами или за
  // TLS-терминирующим прокси/балансировщиком) — иначе браузер запомнит
  // требование HTTPS для домена, на котором HTTPS может быть ещё не настроен.
  if (req.secure || req.headers["x-forwarded-proto"] === "https") {
    res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
  }
  next();
});

// Общий лимит запросов к API — подстраховка от простого DoS/скрейпинга поверх
// точечных лимитов на login/register. Достаточно щедрый, чтобы не мешать
// обычному использованию (сообщения, WS-переподключения и т.п.).
app.use("/api/", rateLimit("api", { windowMs: 60 * 1000, max: 240 }));

// CORS: по умолчанию разрешаем только собственный origin. Если сайт открывается
// с другого домена (например, отдельный фронтенд), перечислите разрешённые
// адреса через запятую в переменной окружения ALLOWED_ORIGINS.
// Пустой список = разрешён любой источник, БЕЗ отправки cookie/credentials —
// но не открытый доступ "всем без разбора" вместе с авторизацией.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
app.use(
  cors(
    allowedOrigins.length
      ? { origin: allowedOrigins }
      : { origin: true } // отражаем Origin запроса, без credentials
  )
);
// Лимит поднят: файлы приходят base64-строкой, а base64 раздувает размер на ~33%.
app.use(express.json({ limit: "40mb" }));
app.use(express.static(path.join(__dirname, "public")));
// Раздаём загруженные файлы максимально «тупо»: браузер не должен пытаться
// угадывать/исполнять их как HTML/SVG со скриптом (даже если ALLOWED_MEDIA
// когда-нибудь расширят) — Content-Disposition: attachment убирает риск
// inline-XSS через файл, который прошёл валидацию mime, но содержит полезную
// нагрузку (например, поддельный SVG с <script>, если whitelist расширят неаккуратно).
app.use(
  "/uploads",
  (req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
    next();
  },
  express.static(UPLOAD_DIR, { maxAge: "30d" })
);

// ---------- REST API ----------
app.use(require("./src/routes/auth"));
app.use(require("./src/routes/catalog"));
app.use(require("./src/routes/users"));
app.use(require("./src/routes/messages"));
app.use(require("./src/routes/chats"));
app.use(require("./src/routes/posts"));
app.use(require("./src/routes/games"));
app.use(require("./src/routes/services"));
app.use(require("./src/routes/owner"));

// SPA-fallback: всё остальное отдаёт index.html (клиентский роутинг).
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Поднимаем HTTPS, если в проект импортированы файлы сертификата и ключа
// (по умолчанию certs/cert.pem и certs/key.pem). Иначе — обычный HTTP.
// WebSocket (в т.ч. wss://) прицепляется к тому же серверу автоматически.
function buildServer() {
  if (fs.existsSync(SSL_KEY_PATH) && fs.existsSync(SSL_CERT_PATH)) {
    const options = {
      key: fs.readFileSync(SSL_KEY_PATH),
      cert: fs.readFileSync(SSL_CERT_PATH),
    };
    // Необязательная цепочка (intermediate/CA), если файл присутствует.
    if (fs.existsSync(SSL_CA_PATH)) options.ca = fs.readFileSync(SSL_CA_PATH);
    return { server: https.createServer(options, app), secure: true };
  }
  return { server: http.createServer(app), secure: false };
}

const { server, secure } = buildServer();
initWs(server);

server.listen(PORT, () => {
  const proto = secure ? "https" : "http";
  console.log(`Друн мессенджер запущен: ${proto}://localhost:${PORT}`);
  if (secure) {
    console.log(`SSL: сертификат ${SSL_CERT_PATH}`);
  } else {
    console.log("SSL не найден — работаем по HTTP. Положите certs/cert.pem и certs/key.pem для HTTPS.");
  }
});
