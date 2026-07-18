// Инициализация базы данных и миграции схемы.
// node:sqlite — встроенный в Node.js модуль (с версии 22.5+), не требует
// компиляции нативного кода, поэтому не нужны build-инструменты на Windows.
const { DatabaseSync } = require("node:sqlite");
const { DB_PATH, STARTING_BALANCE } = require("./config");

const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA journal_mode = WAL;");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    nickname TEXT,
    password_hash TEXT NOT NULL,
    avatar TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_user TEXT NOT NULL,
    to_user TEXT NOT NULL,
    text TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'text',
    gift_amount INTEGER,
    gift_kind TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_messages_pair
  ON messages (from_user, to_user, created_at);
`);

// Миграция для баз, созданных до появления ника/аватара.
const existingCols = db.prepare("PRAGMA table_info(users)").all().map((c) => c.name);
if (!existingCols.includes("nickname")) {
  db.exec("ALTER TABLE users ADD COLUMN nickname TEXT;");
  db.exec("UPDATE users SET nickname = username WHERE nickname IS NULL;");
}
if (!existingCols.includes("avatar")) {
  db.exec("ALTER TABLE users ADD COLUMN avatar TEXT;");
}
if (!existingCols.includes("balance")) {
  db.exec("ALTER TABLE users ADD COLUMN balance INTEGER;");
  db.exec(`UPDATE users SET balance = ${STARTING_BALANCE} WHERE balance IS NULL;`);
}
// Флаг "создатель" — расширенные права модерации (см. регистрацию по коду доступа ниже).
if (!existingCols.includes("is_owner")) {
  db.exec("ALTER TABLE users ADD COLUMN is_owner INTEGER NOT NULL DEFAULT 0;");
}
// Двухфакторная аутентификация (TOTP): секрет и флаг включённости.
if (!existingCols.includes("totp_secret")) {
  db.exec("ALTER TABLE users ADD COLUMN totp_secret TEXT;");
}
if (!existingCols.includes("totp_enabled")) {
  db.exec("ALTER TABLE users ADD COLUMN totp_enabled INTEGER NOT NULL DEFAULT 0;");
}
// Последний известный IP — нужен, чтобы забанить не только аккаунт,
// но и устройство/сеть, с которых заходил пользователь (см. bans).
if (!existingCols.includes("last_ip")) {
  db.exec("ALTER TABLE users ADD COLUMN last_ip TEXT;");
}

const existingMsgCols = db.prepare("PRAGMA table_info(messages)").all().map((c) => c.name);
if (!existingMsgCols.includes("type")) {
  db.exec("ALTER TABLE messages ADD COLUMN type TEXT NOT NULL DEFAULT 'text';");
}
if (!existingMsgCols.includes("gift_amount")) {
  db.exec("ALTER TABLE messages ADD COLUMN gift_amount INTEGER;");
}
if (!existingMsgCols.includes("gift_kind")) {
  db.exec("ALTER TABLE messages ADD COLUMN gift_kind TEXT;");
}
if (!existingMsgCols.includes("chat_id")) {
  db.exec("ALTER TABLE messages ADD COLUMN chat_id INTEGER;");
}
if (!existingMsgCols.includes("from_nickname")) {
  db.exec("ALTER TABLE messages ADD COLUMN from_nickname TEXT;");
}
// Медиа: путь к файлу, mime-тип и (для картинок) соотношение сторон,
// чтобы лента не «прыгала» при подгрузке.
if (!existingMsgCols.includes("media_url")) {
  db.exec("ALTER TABLE messages ADD COLUMN media_url TEXT;");
}
if (!existingMsgCols.includes("media_mime")) {
  db.exec("ALTER TABLE messages ADD COLUMN media_mime TEXT;");
}
if (!existingMsgCols.includes("media_w")) {
  db.exec("ALTER TABLE messages ADD COLUMN media_w INTEGER;");
}
if (!existingMsgCols.includes("media_h")) {
  db.exec("ALTER TABLE messages ADD COLUMN media_h INTEGER;");
}
// Длительность голосового сообщения в секундах — для отображения в плеере.
if (!existingMsgCols.includes("media_dur")) {
  db.exec("ALTER TABLE messages ADD COLUMN media_dur INTEGER;");
}
// Какой стикер отправлен (см. STICKERS) — для type = 'sticker'.
if (!existingMsgCols.includes("sticker_kind")) {
  db.exec("ALTER TABLE messages ADD COLUMN sticker_kind TEXT;");
}

// ---------- Реакции на сообщения ----------
// Один пользователь = одна реакция на сообщение (как в Telegram).
db.exec(`
  CREATE TABLE IF NOT EXISTS reactions (
    message_id INTEGER NOT NULL,
    username TEXT NOT NULL,
    emoji TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (message_id, username)
  );
  CREATE INDEX IF NOT EXISTS idx_reactions_msg ON reactions (message_id);
`);

// ---------- Группы и каналы ----------
// "group" — обычная группа, все участники могут писать.
// "channel" — только владелец/админы пишут, остальные читают ("подписчики").
db.exec(`
  CREATE TABLE IF NOT EXISTS chats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL DEFAULT 'group',
    title TEXT NOT NULL,
    avatar TEXT,
    owner_username TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS chat_members (
    chat_id INTEGER NOT NULL,
    username TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    joined_at INTEGER NOT NULL,
    PRIMARY KEY (chat_id, username)
  );

  CREATE INDEX IF NOT EXISTS idx_chat_members_user ON chat_members (username);
  CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages (chat_id, created_at);
`);

// ---------- Мини-игра "Шахта": бурмалдаец ищет чекушки ----------
// Раунд генерируется и хранится целиком на сервере (клиент только шлёт
// номер клетки), чтобы результат нельзя было подделать через devtools.
db.exec(`
  CREATE TABLE IF NOT EXISTS mine_rounds (
    username TEXT PRIMARY KEY,
    grid TEXT NOT NULL,
    revealed TEXT NOT NULL,
    digs_left INTEGER NOT NULL,
    earned INTEGER NOT NULL DEFAULT 0,
    started_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS mine_cooldown (
    username TEXT PRIMARY KEY,
    last_played_at INTEGER NOT NULL
  );
`);

// ---------- Мини-игра "Автомат бурмалдайца": три барабана ----------
db.exec(`
  CREATE TABLE IF NOT EXISTS slots_cooldown (
    username TEXT PRIMARY KEY,
    last_played_at INTEGER NOT NULL
  );
`);

// ---------- Посты (публичная лента, как в Инсте) ----------
db.exec(`
  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    caption TEXT,
    media_url TEXT NOT NULL,
    media_mime TEXT NOT NULL,
    media_kind TEXT NOT NULL,
    media_w INTEGER,
    media_h INTEGER,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_posts_created ON posts (created_at);

  CREATE TABLE IF NOT EXISTS post_likes (
    post_id INTEGER NOT NULL,
    username TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (post_id, username)
  );
  CREATE INDEX IF NOT EXISTS idx_post_likes_post ON post_likes (post_id);

  CREATE TABLE IF NOT EXISTS post_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    username TEXT NOT NULL,
    text TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_post_comments_post ON post_comments (post_id, created_at);
`);

// ---------- Хаммам: прокачиваемое здание за чекушки ----------
// 5 независимых параметров прокачки, у каждого свой уровень.
// Пассивный доход копится "по требованию" (начисляется при обращении,
// на основе прошедшего времени), а не тикает фоновым таймером на сервере.
db.exec(`
  CREATE TABLE IF NOT EXISTS hammam (
    username TEXT PRIMARY KEY,
    lvl_furnace INTEGER NOT NULL DEFAULT 0,
    lvl_steam INTEGER NOT NULL DEFAULT 0,
    lvl_venik INTEGER NOT NULL DEFAULT 0,
    lvl_decor INTEGER NOT NULL DEFAULT 0,
    lvl_predbannik INTEGER NOT NULL DEFAULT 0,
    banked REAL NOT NULL DEFAULT 0,
    last_collected_at INTEGER NOT NULL
  );
`);

// ---------- Баны ----------
// Баним по IP (а не только по username), чтобы забаненный не мог просто
// зарегистрировать новый аккаунт с того же устройства/сети. Username
// сохраняем как справочную информацию (кого именно забанили и за что).
db.exec(`
  CREATE TABLE IF NOT EXISTS bans (
    ip TEXT PRIMARY KEY,
    username TEXT,
    reason TEXT,
    banned_by TEXT,
    created_at INTEGER NOT NULL
  );
`);

// ---------- Друн Услуги: паспорт бурмалдайца ----------
// Один паспорт на пользователя. Оформляется один раз за госпошлину,
// после чего служит "ключом" к услугам, которые его требуют (прописка).
db.exec(`
  CREATE TABLE IF NOT EXISTS passports (
    username TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    birth_date TEXT NOT NULL,
    birth_place TEXT NOT NULL,
    photo_url TEXT NOT NULL,
    doc_number TEXT NOT NULL,
    issued_at INTEGER NOT NULL
  );
`);

// ---------- Друн Услуги: прописка в Хаммаме ----------
// Требует оформленного паспорта. Комната назначается автоматически
// (следующий свободный номер), одна прописка на пользователя.
db.exec(`
  CREATE TABLE IF NOT EXISTS registrations (
    username TEXT PRIMARY KEY,
    purpose TEXT NOT NULL,
    room_number INTEGER NOT NULL,
    doc_number TEXT NOT NULL,
    issued_at INTEGER NOT NULL
  );
`);

// ---------- Друн Услуги: подписка на тариф "Бурмал2" ----------
// Одна активная подписка на пользователя — повторное оформление меняет тариф
// (и списывает полную стоимость нового тарифа за очередной период).
db.exec(`
  CREATE TABLE IF NOT EXISTS burmal2_subscriptions (
    username TEXT PRIMARY KEY,
    plan_key TEXT NOT NULL,
    issued_at INTEGER NOT NULL
  );
`);

module.exports = db;
