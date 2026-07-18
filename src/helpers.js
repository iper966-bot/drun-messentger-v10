// Общие хелперы: сериализация пользователей/чатов, реакции, статусы.
const db = require("./db");
const { GIFT_STATUS_LEVELS, STARTING_BALANCE } = require("./config");

// По сумме полученных подарков определяет текущий статус и прогресс до следующего уровня.
function getGiftStatus(totalGiftValue) {
  const total = totalGiftValue || 0;
  let current = GIFT_STATUS_LEVELS[0];
  for (const lvl of GIFT_STATUS_LEVELS) {
    if (total >= lvl.min) current = lvl;
  }
  const next = GIFT_STATUS_LEVELS.find((lvl) => lvl.level === current.level + 1) || null;
  return {
    level: current.level,
    label: current.label,
    emoji: current.emoji,
    total_gift_value: total,
    next_level: next
      ? {
          level: next.level,
          label: next.label,
          emoji: next.emoji,
          min: next.min,
          remaining: Math.max(0, next.min - total),
        }
      : null,
  };
}

function chatPairKey(a, b) {
  return [a, b].sort();
}

function publicUser(row) {
  if (!row) return null;
  return {
    username: row.username,
    nickname: row.nickname || row.username,
    avatar: row.avatar || null,
    created_at: row.created_at,
  };
}

// Профиль текущего пользователя — включает баланс чекушек (виден только владельцу).
function ownUser(row) {
  if (!row) return null;
  return {
    ...publicUser(row),
    balance: row.balance == null ? STARTING_BALANCE : row.balance,
    is_owner: !!row.is_owner,
    totp_enabled: !!row.totp_enabled,
  };
}

// Собирает реакции для списка сообщений одним запросом и раскладывает их
// по id: [{emoji, count, mine}], отсортированные по популярности.
function attachReactions(rows, username) {
  if (!rows.length) return rows;
  const ids = rows.map((r) => r.id).filter((id) => id != null);
  if (!ids.length) return rows.map((r) => ({ ...r, reactions: [] }));
  const placeholders = ids.map(() => "?").join(",");
  const all = db
    .prepare(`SELECT message_id, username, emoji FROM reactions WHERE message_id IN (${placeholders})`)
    .all(...ids);
  const byMsg = new Map();
  for (const r of all) {
    if (!byMsg.has(r.message_id)) byMsg.set(r.message_id, new Map());
    const m = byMsg.get(r.message_id);
    if (!m.has(r.emoji)) m.set(r.emoji, { emoji: r.emoji, count: 0, mine: false });
    const entry = m.get(r.emoji);
    entry.count++;
    if (r.username === username) entry.mine = true;
  }
  return rows.map((r) => ({
    ...r,
    reactions: byMsg.has(r.id) ? [...byMsg.get(r.id).values()].sort((a, b) => b.count - a.count) : [],
  }));
}

// Кому рассылать обновление реакции — участникам группы или обоим в личке.
function reactionAudience(msg) {
  if (msg.chat_id) {
    return db
      .prepare("SELECT username FROM chat_members WHERE chat_id = ?")
      .all(msg.chat_id)
      .map((r) => r.username);
  }
  return [msg.from_user, msg.to_user];
}

function canSeeMessage(msg, username) {
  if (!msg) return false;
  if (msg.chat_id) return isChatMember(msg.chat_id, username);
  return msg.from_user === username || msg.to_user === username;
}

function chatById(chatId) {
  return db.prepare("SELECT * FROM chats WHERE id = ?").get(chatId);
}
function isChatMember(chatId, username) {
  return !!db
    .prepare("SELECT 1 FROM chat_members WHERE chat_id = ? AND username = ?")
    .get(chatId, username);
}
function chatMembers(chatId) {
  return db
    .prepare("SELECT username FROM chat_members WHERE chat_id = ?")
    .all(chatId)
    .map((r) => r.username);
}
function chatMemberRole(chatId, username) {
  const row = db
    .prepare("SELECT role FROM chat_members WHERE chat_id = ? AND username = ?")
    .get(chatId, username);
  return row ? row.role : null;
}
function publicChat(row, username) {
  if (!row) return null;
  const memberCount = db
    .prepare("SELECT COUNT(*) AS c FROM chat_members WHERE chat_id = ?")
    .get(row.id).c;
  const role = username ? chatMemberRole(row.id, username) : null;
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    avatar: row.avatar || null,
    owner_username: row.owner_username,
    member_count: memberCount,
    my_role: role,
    created_at: row.created_at,
  };
}

// ---------- Фильтр запрещённого имени "burmalda fm" ----------
// Ловим упоминание в любом написании: кириллицей или латиницей, слитно,
// раздельно, через подчёркивание/точку/дефис, в любом регистре.
// Стратегия: нормализуем строку — приводим похожие кириллические буквы
// к латинским аналогам (транслитерация по внешнему виду, а не по звучанию,
// т.к. обходят именно визуально похожими символами), убираем всё, кроме
// букв и цифр, и ищем "burmaldafm" как подстроку в результате.
const CYRILLIC_TO_LATIN_MAP = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
  и: "i", й: "i", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch",
  ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

function normalizeForBanFilter(str) {
  const lower = String(str || "").toLowerCase();
  let out = "";
  for (const ch of lower) {
    if (Object.prototype.hasOwnProperty.call(CYRILLIC_TO_LATIN_MAP, ch)) {
      out += CYRILLIC_TO_LATIN_MAP[ch];
    } else if (/[a-z0-9]/.test(ch)) {
      out += ch;
    }
    // Всё остальное (пробелы, _, ., -, эмодзи и т.п.) отбрасываем —
    // это и разбивает попытки обхода через разделители.
  }
  return out;
}

function containsBannedName(str) {
  return normalizeForBanFilter(str).includes("burmaldafm");
}

module.exports = {
  getGiftStatus,
  chatPairKey,
  publicUser,
  ownUser,
  attachReactions,
  reactionAudience,
  canSeeMessage,
  chatById,
  isChatMember,
  chatMembers,
  chatMemberRole,
  publicChat,
  containsBannedName,
};
