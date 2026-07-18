// ---------- Группы и каналы ----------
const express = require("express");
const db = require("../db");
const { STICKERS } = require("../config");
const {
  chatById,
  isChatMember,
  chatMemberRole,
  publicChat,
  attachReactions,
} = require("../helpers");
const { saveDataUrl } = require("../media");
const { authMiddleware } = require("../middleware");
const { broadcastToUser, broadcastToUsers } = require("../ws");

const router = express.Router();

// Список моих групп/каналов.
router.get("/api/chats", authMiddleware, (req, res) => {
  const rows = db
    .prepare(
      `SELECT chats.* FROM chats
       JOIN chat_members ON chat_members.chat_id = chats.id
       WHERE chat_members.username = ?
       ORDER BY chats.created_at DESC`
    )
    .all(req.username);
  res.json({ chats: rows.map((r) => publicChat(r, req.username)) });
});

// Создание группы или канала. members — список username, кроме создателя (необязателен).
router.post("/api/chats", authMiddleware, (req, res) => {
  const { title, kind, members } = req.body || {};
  const cleanTitle = (title || "").trim();
  if (!cleanTitle || cleanTitle.length > 60) {
    return res.status(400).json({ error: "Название от 1 до 60 символов" });
  }
  const cleanKind = kind === "channel" ? "channel" : "group";
  const now = Date.now();
  const info = db
    .prepare("INSERT INTO chats (kind, title, owner_username, created_at) VALUES (?, ?, ?, ?)")
    .run(cleanKind, cleanTitle, req.username, now);
  const chatId = info.lastInsertRowid;

  db.prepare("INSERT INTO chat_members (chat_id, username, role, joined_at) VALUES (?, ?, 'owner', ?)").run(
    chatId,
    req.username,
    now
  );

  const uniqueMembers = Array.isArray(members)
    ? [...new Set(members.filter((m) => typeof m === "string" && m !== req.username))]
    : [];
  for (const uname of uniqueMembers) {
    const exists = db.prepare("SELECT id FROM users WHERE username = ?").get(uname);
    if (!exists) continue;
    db.prepare(
      "INSERT OR IGNORE INTO chat_members (chat_id, username, role, joined_at) VALUES (?, ?, 'member', ?)"
    ).run(chatId, uname, now);
  }

  const chat = chatById(chatId);
  const memberUsernames = db
    .prepare("SELECT username FROM chat_members WHERE chat_id = ?")
    .all(chatId)
    .map((r) => r.username);
  memberUsernames.forEach((uname) => {
    broadcastToUser(uname, { type: "chat_created", chat: publicChat(chat, uname) });
  });

  res.json({ chat: publicChat(chat, req.username) });
});

// Инфо о конкретном чате (для заголовка беседы).
router.get("/api/chats/:chatId", authMiddleware, (req, res) => {
  const chat = chatById(req.params.chatId);
  if (!chat || !isChatMember(chat.id, req.username)) {
    return res.status(404).json({ error: "Чат не найден" });
  }
  res.json({ chat: publicChat(chat, req.username) });
});

// Участники чата.
router.get("/api/chats/:chatId/members", authMiddleware, (req, res) => {
  const chat = chatById(req.params.chatId);
  if (!chat || !isChatMember(chat.id, req.username)) {
    return res.status(404).json({ error: "Чат не найден" });
  }
  const rows = db
    .prepare(
      `SELECT users.username, users.nickname, users.avatar, chat_members.role FROM chat_members
       JOIN users ON users.username = chat_members.username
       WHERE chat_members.chat_id = ?
       ORDER BY chat_members.role = 'owner' DESC, users.nickname COLLATE NOCASE`
    )
    .all(chat.id);
  res.json({
    members: rows.map((r) => ({
      username: r.username,
      nickname: r.nickname || r.username,
      avatar: r.avatar || null,
      role: r.role,
    })),
  });
});

// Добавить участников (владелец или админ канала/группы).
router.post("/api/chats/:chatId/members", authMiddleware, (req, res) => {
  const chat = chatById(req.params.chatId);
  if (!chat || !isChatMember(chat.id, req.username)) {
    return res.status(404).json({ error: "Чат не найден" });
  }
  // Добавлять новых участников может только владелец или админ — иначе
  // рядовой участник группы/канала мог бы приглашать кого угодно без спроса.
  const myRole = chatMemberRole(chat.id, req.username);
  if (myRole !== "owner" && myRole !== "admin") {
    return res.status(403).json({ error: "Добавлять участников может только владелец или администратор" });
  }
  const { members } = req.body || {};
  const uniqueMembers = Array.isArray(members)
    ? [...new Set(members.filter((m) => typeof m === "string"))]
    : [];
  const now = Date.now();
  const added = [];
  for (const uname of uniqueMembers) {
    const exists = db.prepare("SELECT id FROM users WHERE username = ?").get(uname);
    if (!exists) continue;
    if (isChatMember(chat.id, uname)) continue;
    db.prepare(
      "INSERT INTO chat_members (chat_id, username, role, joined_at) VALUES (?, ?, 'member', ?)"
    ).run(chat.id, uname, now);
    added.push(uname);
  }
  // Рассылаем обновлённый чат ВСЕМ участникам: новым — чтобы чат появился,
  // существующим — чтобы обновился счётчик участников (всё через WebSocket).
  const allMembers = db
    .prepare("SELECT username FROM chat_members WHERE chat_id = ?")
    .all(chat.id)
    .map((r) => r.username);
  allMembers.forEach((uname) => {
    broadcastToUser(uname, { type: "chat_created", chat: publicChat(chat, uname) });
  });
  res.json({ added });
});

// Выйти из группы/канала (владелец выйти не может — пусть сначала удалит чат).
router.post("/api/chats/:chatId/leave", authMiddleware, (req, res) => {
  const chat = chatById(req.params.chatId);
  if (!chat || !isChatMember(chat.id, req.username)) {
    return res.status(404).json({ error: "Чат не найден" });
  }
  if (chat.owner_username === req.username) {
    return res.status(400).json({ error: "Владелец не может покинуть чат — удалите его вместо этого" });
  }
  db.prepare("DELETE FROM chat_members WHERE chat_id = ? AND username = ?").run(chat.id, req.username);
  // Обновляем счётчик у оставшихся участников через WebSocket.
  const remaining = db
    .prepare("SELECT username FROM chat_members WHERE chat_id = ?")
    .all(chat.id)
    .map((r) => r.username);
  remaining.forEach((uname) => {
    broadcastToUser(uname, { type: "chat_created", chat: publicChat(chat, uname) });
  });
  res.json({ ok: true });
});

// Сообщения группы/канала.
router.get("/api/chats/:chatId/messages", authMiddleware, (req, res) => {
  const chat = chatById(req.params.chatId);
  if (!chat || !isChatMember(chat.id, req.username)) {
    return res.status(404).json({ error: "Чат не найден" });
  }
  const rows = db
    .prepare(
      `SELECT id, from_user, from_nickname, text, type, gift_amount, gift_kind,
              media_url, media_mime, media_w, media_h, media_dur, sticker_kind, created_at FROM messages
       WHERE chat_id = ? ORDER BY created_at ASC`
    )
    .all(chat.id);
  res.json({ messages: attachReactions(rows, req.username) });
});

// Отправка стикера в группу/канал — бесплатно; правило на запись такое же, как у обычных сообщений.
router.post("/api/chats/:chatId/messages/sticker", authMiddleware, (req, res) => {
  const chat = chatById(req.params.chatId);
  if (!chat || !isChatMember(chat.id, req.username)) {
    return res.status(404).json({ error: "Чат не найден" });
  }
  if (chat.kind === "channel") {
    const role = chatMemberRole(chat.id, req.username);
    if (role !== "owner" && role !== "admin") {
      return res.status(403).json({ error: "В этом канале писать может только администратор" });
    }
  }
  const { kind } = req.body || {};
  const sticker = STICKERS[kind];
  if (!sticker) return res.status(400).json({ error: "Такого стикера нет" });

  const now = Date.now();
  const user = db.prepare("SELECT nickname FROM users WHERE username = ?").get(req.username);
  const info = db
    .prepare(
      `INSERT INTO messages (from_user, to_user, from_nickname, text, type, sticker_kind, chat_id, created_at)
       VALUES (?, '', ?, ?, 'sticker', ?, ?, ?)`
    )
    .run(req.username, user ? user.nickname : req.username, sticker.label, kind, chat.id, now);

  const message = {
    id: info.lastInsertRowid,
    from_user: req.username,
    from_nickname: user ? user.nickname : req.username,
    text: sticker.label,
    type: "sticker",
    sticker_kind: kind,
    reactions: [],
    chat_id: chat.id,
    created_at: now,
  };

  const memberUsernames = db
    .prepare("SELECT username FROM chat_members WHERE chat_id = ?")
    .all(chat.id)
    .map((r) => r.username);
  broadcastToUsers(memberUsernames, { type: "chat_message", chatId: chat.id, message });

  res.json({ message });
});

router.post("/api/chats/:chatId/messages", authMiddleware, (req, res) => {
  const chat = chatById(req.params.chatId);
  if (!chat || !isChatMember(chat.id, req.username)) {
    return res.status(404).json({ error: "Чат не найден" });
  }
  // В каналах писать может только владелец/админ — остальные только читают.
  if (chat.kind === "channel") {
    const role = chatMemberRole(chat.id, req.username);
    if (role !== "owner" && role !== "admin") {
      return res.status(403).json({ error: "В этом канале писать может только администратор" });
    }
  }
  const { text, media, mediaW, mediaH, mediaDur } = req.body || {};
  const caption = (text || "").trim();
  if (!caption && !media) return res.status(400).json({ error: "Пустое сообщение" });

  let saved = null;
  if (media) {
    saved = saveDataUrl(media);
    if (saved.error) return res.status(400).json({ error: saved.error });
  }

  const now = Date.now();
  const type = saved ? saved.kind : "text";
  const w = saved && Number.isFinite(Number(mediaW)) ? Math.round(Number(mediaW)) : null;
  const h = saved && Number.isFinite(Number(mediaH)) ? Math.round(Number(mediaH)) : null;
  const dur = saved && saved.kind === "audio" && Number.isFinite(Number(mediaDur)) ? Math.round(Number(mediaDur)) : null;
  const user = db.prepare("SELECT nickname FROM users WHERE username = ?").get(req.username);
  const info = db
    .prepare(
      `INSERT INTO messages (from_user, to_user, from_nickname, text, type, media_url, media_mime, media_w, media_h, media_dur, chat_id, created_at)
       VALUES (?, '', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      req.username,
      user ? user.nickname : req.username,
      caption,
      type,
      saved ? saved.url : null,
      saved ? saved.mime : null,
      w,
      h,
      dur,
      chat.id,
      now
    );

  const message = {
    id: info.lastInsertRowid,
    from_user: req.username,
    from_nickname: user ? user.nickname : req.username,
    text: caption,
    type,
    gift_amount: null,
    media_url: saved ? saved.url : null,
    media_mime: saved ? saved.mime : null,
    media_w: w,
    media_h: h,
    media_dur: dur,
    reactions: [],
    chat_id: chat.id,
    created_at: now,
  };

  const memberUsernames = db
    .prepare("SELECT username FROM chat_members WHERE chat_id = ?")
    .all(chat.id)
    .map((r) => r.username);
  broadcastToUsers(memberUsernames, { type: "chat_message", chatId: chat.id, message });

  res.json({ message });
});

module.exports = router;
