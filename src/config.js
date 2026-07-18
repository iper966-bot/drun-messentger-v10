// Конфигурация и справочники приложения — «единый источник правды»
// для констант, которыми пользуются и роуты, и хелперы.
const path = require("path");
const fs = require("fs");

const PORT = process.env.PORT || 3000;

const IS_PROD = process.env.NODE_ENV === "production";

// Секрет для подписи JWT и код регистрации "создателя" ОБЯЗАТЕЛЬНО задаются
// через переменные окружения (.env, секреты Render/Railway и т.п.) — никаких
// вшитых в код значений по умолчанию, чтобы они не "лежали на ладони" у любого,
// кто откроет исходники или архив проекта.
function requireSecret(name, minLength) {
  const value = process.env[name];
  if (!value || value.length < minLength) {
    if (IS_PROD) {
      throw new Error(
        "Переменная окружения " + name + " не задана (или короче " + minLength + " символов). " +
          "Заполните её в .env перед запуском в проде."
      );
    }
    console.warn(
      "[ВНИМАНИЕ] Переменная окружения " + name + " не задана. Использую случайное значение только для разработки. " +
        "Создайте .env (см. .env.example) перед деплоем в прод!"
    );
    return require("crypto").randomBytes(32).toString("hex");
  }
  return value;
}

const JWT_SECRET = requireSecret("JWT_SECRET", 32);

// Код доступа для регистрации аккаунта "создателя" (владельца сервиса).
// Это НЕ пароль от аккаунта — пароль от аккаунта пользователь задаёт сам,
// этот код лишь подтверждает право зарегистрироваться как создатель.
const OWNER_SIGNUP_CODE = requireSecret("OWNER_SIGNUP_CODE", 8);

// Аватар хранится как base64 data URL прямо в базе — ограничиваем размер,
// чтобы база не разрасталась (после сжатия на клиенте это обычно < 250 КБ).
const MAX_AVATAR_LENGTH = 400000;

// Валюта "чекушка" — внутренняя валюта для отправки подарков (бурмалдайцев) в чатах.
// Чекушки добываются только в мини-игре "Шахта" — стартового баланса и пополнения за деньги больше нет.
const STARTING_BALANCE = 0;

// Виды подарков "бурмалдаец" — от простого до "золотого".
const GIFTS = {
  bronze: { label: "Бронзовый бурмалдаец", cost: 5, emoji: "🥉" },
  silver: { label: "Серебряный бурмалдаец", cost: 15, emoji: "🥈" },
  gold: { label: "Золотой бурмалдаец", cost: 30, emoji: "🥇" },
  diamond: { label: "Бриллиантовый бурмалдаец", cost: 50, emoji: "💎" },
  macro: { label: "Бурмалдаец крупным планом", cost: 100, emoji: "🐹", image: "/gift-macro-burm.jpg" },
  golden_statue: { label: "Золотой бурмалдаец-статуя", cost: 6767, emoji: "🏆", image: "/gift-golden-burm.jpg" },
  throne: { label: "Бурмалдаец на троне", cost: 777, emoji: "👑", image: "/gift-burm-throne.jpg" },
  golden_blob: { label: "Золотой бурмалдаец", cost: 6767, emoji: "✨", image: "/gift-burm-golden-blob.jpg" },
};
const DEFAULT_GIFT = "bronze";
// Совместимость со старыми клиентами, которые не передают тип подарка.
const GIFT_COST = GIFTS[DEFAULT_GIFT].cost;

// Статус аккаунта по суммарной стоимости ПОЛУЧЕННЫХ подарков (в чекушках).
// Пороги — минимальная сумма чекушек для достижения уровня.
const GIFT_STATUS_LEVELS = [
  { level: 0, min: 0, label: "Фундамент", emoji: "🧱" },
  { level: 1, min: 100, label: "Деревенская баня", emoji: "🛖" },
  { level: 2, min: 500, label: "Банька", emoji: "♨️" },
  { level: 3, min: 2000, label: "Хаммам", emoji: "🕌" },
  { level: 4, min: 7000, label: "Ультра хаммам", emoji: "👑" },
];

// ---------- Стикеры "бурмалдаец" ----------
// В отличие от подарков — бесплатные, отправляются как отдельный тип сообщения.
const STICKERS = {
  happy: { label: "Рад", image: "/stickers/happy.svg" },
  love: { label: "Любовь", image: "/stickers/love.svg" },
  laugh: { label: "Смех", image: "/stickers/laugh.svg" },
  sad: { label: "Грусть", image: "/stickers/sad.svg" },
  angry: { label: "Злость", image: "/stickers/angry.svg" },
  wow: { label: "Вау", image: "/stickers/wow.svg" },
  sleep: { label: "Сон", image: "/stickers/sleep.svg" },
  wink: { label: "Подмигивание", image: "/stickers/wink.svg" },
  // Фото-эмодзи бурмалдайца (часть 1) — файлы кладутся в public/stickers/ вручную.
  burm_green: { label: "Зелёный друн", image: "/stickers/burm_green.jpg" },
  burm_gold: { label: "Золотой друн", image: "/stickers/burm_gold.jpg" },
  burm_rabbit: { label: "Бурмалдаец", image: "/stickers/burm_rabbit.jpg" },
  burm_malda: { label: "Бурмалда", image: "/stickers/burm_malda.jpg" },
  burm_rabbit2: { label: "Заяц", image: "/stickers/burm_rabbit2.jpg" },
  burm_red: { label: "Красный друн", image: "/stickers/burm_red.jpg" },
};

// ---------- Медиа (фото и видео) ----------
// Файлы не лезут в базу (иначе она распухнет и SQLite начнёт тормозить) —
// они складываются на диск в папку uploads/, а в сообщении хранится только путь.
// Путь можно переопределить (например, на Render — на смонтированный
// Persistent Disk, чтобы файлы не стирались при каждом передеплое).
const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(__dirname, "..", "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 МБ на файл
const ALLOWED_MEDIA = {
  "image/jpeg": { ext: "jpg", kind: "image" },
  "image/png": { ext: "png", kind: "image" },
  "image/webp": { ext: "webp", kind: "image" },
  "image/gif": { ext: "gif", kind: "image" },
  "video/mp4": { ext: "mp4", kind: "video" },
  "video/webm": { ext: "webm", kind: "video" },
  "video/quicktime": { ext: "mov", kind: "video" },
  // Голосовые сообщения — записываются в браузере через MediaRecorder.
  "audio/webm": { ext: "webm", kind: "audio" },
  "audio/ogg": { ext: "ogg", kind: "audio" },
  "audio/mp4": { ext: "m4a", kind: "audio" },
  "audio/mpeg": { ext: "mp3", kind: "audio" },
};

// Реакции: какие эмодзи можно ставить на сообщение.
const REACTIONS = ["👍", "❤️", "😂", "🔥", "😮", "😢", "🍾"];

// Путь к БД (файл nova.db в корне проекта).
// Аналогично — путь к файлу базы можно вынести на Persistent Disk.
const DB_PATH = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(__dirname, "..", "nova.db");

// ---------- SSL / HTTPS ----------
// Если положить файлы сертификата и ключа (по умолчанию в папку certs/),
// сервер поднимется по HTTPS; иначе — по обычному HTTP. Пути можно
// переопределить переменными окружения.
const SSL_KEY_PATH = process.env.SSL_KEY_PATH || path.join(__dirname, "..", "certs", "key.pem");
const SSL_CERT_PATH = process.env.SSL_CERT_PATH || path.join(__dirname, "..", "certs", "cert.pem");
const SSL_CA_PATH = process.env.SSL_CA_PATH || path.join(__dirname, "..", "certs", "ca.pem");

const USERNAME_RE = /^[a-zA-Z0-9_.]{3,20}$/;

// ---------- Хаммам: параметры прокачки ----------
// Каждый параметр имеет максимум уровней, базовую стоимость и множитель роста цены.
// cost(level) = round(baseCost * growth^level) — level это уровень, НА КОТОРЫЙ покупаем (0-based текущий -> level+1).
const HAMMAM_PARAMS = {
  furnace: {
    label: "Печь",
    emoji: "🔥",
    desc: "Пассивный доход чекушек в час",
    maxLevel: 20,
    baseCost: 20,
    growth: 1.35,
    // Доход в час на уровне lvl.
    effect: (lvl) => lvl * 3,
  },
  steam: {
    label: "Пар",
    emoji: "💨",
    desc: "Шанс на клад и крупные чекушки в игре «Шахта»",
    maxLevel: 15,
    baseCost: 30,
    growth: 1.4,
    // Множитель к весам gem/chekushka5/chekushka2 в Шахте (в процентах прибавки).
    effect: (lvl) => lvl * 6,
  },
  venik: {
    label: "Веник",
    emoji: "🪵",
    desc: "Снижает шанс обвала в «Шахте»",
    maxLevel: 10,
    baseCost: 25,
    growth: 1.4,
    // Снижение веса trap-клетки в процентах (не более ~90%, чтобы не занулять совсем).
    effect: (lvl) => Math.min(90, lvl * 9),
  },
  decor: {
    label: "Декор",
    emoji: "🖼️",
    desc: "Внешний вид хаммама — чисто для красоты и статуса",
    maxLevel: 8,
    baseCost: 15,
    growth: 1.3,
    effect: (lvl) => lvl,
  },
  predbannik: {
    label: "Предбанник",
    emoji: "🚪",
    desc: "Сколько чекушек может накопиться до сбора",
    maxLevel: 12,
    baseCost: 18,
    growth: 1.3,
    // Лимит накопления (банка) в чекушках.
    effect: (lvl) => 50 + lvl * 40,
  },
};
const HAMMAM_DECOR_STAGES = [
  { min: 0, label: "Дощатый сарайчик", emoji: "🛖" },
  { min: 2, label: "Скромная банька", emoji: "♨️" },
  { min: 4, label: "Уютная банька с верандой", emoji: "🏚️" },
  { min: 6, label: "Хаммам с изразцами", emoji: "🕌" },
  { min: 8, label: "Ультра хаммам бурмалдайца", emoji: "👑" },
];

module.exports = {
  PORT,
  JWT_SECRET,
  OWNER_SIGNUP_CODE,
  MAX_AVATAR_LENGTH,
  STARTING_BALANCE,
  GIFTS,
  DEFAULT_GIFT,
  GIFT_COST,
  GIFT_STATUS_LEVELS,
  STICKERS,
  UPLOAD_DIR,
  MAX_UPLOAD_BYTES,
  ALLOWED_MEDIA,
  REACTIONS,
  DB_PATH,
  SSL_KEY_PATH,
  SSL_CERT_PATH,
  SSL_CA_PATH,
  USERNAME_RE,
  HAMMAM_PARAMS,
  HAMMAM_DECOR_STAGES,
};
