// Личные сообщения: подарки, реакции, история, стикеры, текст и медиа.
const express = require("express");
const fs = require("fs");
const path = require("path");
const db = require("../db");
const { GIFTS, DEFAULT_GIFT, STARTING_BALANCE, STICKERS, REACTIONS, UPLOAD_DIR } = require("../config");
const {
  ownUser,
  attachReactions,
  reactionAudience,
  canSeeMessage,
  chatPairKey,
} = require("../helpers");
const { saveDataUrl } = require("../media");
const { authMiddleware } = require("../middleware");
const { broadcastToPair, broadcastToUser, broadcastToUsers } = require("../ws");

const router = express.Router();

// Отправка подарка "бурмалдаец" собеседнику за чекушки.
// :kind — bronze/silver/gold/diamond (см. GIFTS); по умолчанию bronze для старых клиентов.
router.post("/api/gift/:peer/:kind?", authMiddleware, (req, res) => {
  const peer = req.params.peer;
  const kind = req.params.kind && GIFTS[req.params.kind] ? req.params.kind : DEFAULT_GIFT;
  const gift = GIFTS[kind];

  if (peer === req.username) {
    return res.status(400).json({ error: "Нельзя подарить бурмалдайца самому себе" });
  }
  const peerExists = db.prepare("SELECT id FROM users WHERE username = ?").get(peer);
  if (!peerExists) return res.status(404).json({ error: "Собеседник не найден" });

  const sender = db.prepare("SELECT * FROM users WHERE username = ?").get(req.username);
  const balance = sender.balance == null ? STARTING_BALANCE : sender.balance;
  if (balance < gift.cost) {
    return res.status(400).json({ error: "Недостаточно чекушек" });
  }

  db.prepare("UPDATE users SET balance = ? WHERE username = ?").run(balance - gift.cost, req.username);

  const now = Date.now();
  const text = `${gift.emoji} ${gift.label}`;
  const info = db
    .prepare(
      "INSERT INTO messages (from_user, to_user, text, type, gift_amount, gift_kind, created_at) VALUES (?, ?, ?, 'gift', ?, ?, ?)"
    )
    .run(req.username, peer, text, gift.cost, kind, now);

  const message = {
    id: info.lastInsertRowid,
    from_user: req.username,
    to_user: peer,
    text,
    type: "gift",
    gift_amount: gift.cost,
    gift_kind: kind,
    reactions: [],
    created_at: now,
  };

  broadcastToPair(req.username, peer, { type: "message", message });

  const updatedSender = db.prepare("SELECT * FROM users WHERE username = ?").get(req.username);
  res.json({ message, user: ownUser(updatedSender) });
});

// Поставить/снять реакцию. Повторный клик по той же реакции её снимает,
// клик по другой — заменяет предыдущую.
router.post("/api/messages/:messageId/react", authMiddleware, (req, res) => {
  const messageId = Number(req.params.messageId);
  const { emoji } = req.body || {};
  if (!Number.isInteger(messageId)) return res.status(400).json({ error: "Некорректное сообщение" });
  if (emoji != null && !REACTIONS.includes(emoji)) {
    return res.status(400).json({ error: "Такой реакции нет" });
  }
  const msg = db.prepare("SELECT * FROM messages WHERE id = ?").get(messageId);
  if (!msg || !canSeeMessage(msg, req.username)) {
    return res.status(404).json({ error: "Сообщение не найдено" });
  }

  const existing = db
    .prepare("SELECT emoji FROM reactions WHERE message_id = ? AND username = ?")
    .get(messageId, req.username);

  if (emoji == null || (existing && existing.emoji === emoji)) {
    db.prepare("DELETE FROM reactions WHERE message_id = ? AND username = ?").run(messageId, req.username);
  } else {
    db.prepare(
      `INSERT INTO reactions (message_id, username, emoji, created_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(message_id, username) DO UPDATE SET emoji = excluded.emoji, created_at = excluded.created_at`
    ).run(messageId, req.username, emoji, Date.now());
  }

  // Каждому получателю шлём его собственный вид реакций (важно поле mine).
  const audience = reactionAudience(msg);
  audience.forEach((uname) => {
    const [withReactions] = attachReactions([{ id: messageId }], uname);
    broadcastToUser(uname, {
      type: "reaction_update",
      messageId,
      chatId: msg.chat_id || null,
      reactions: withReactions.reactions,
    });
  });

  const [mine] = attachReactions([{ id: messageId }], req.username);
  res.json({ messageId, reactions: mine.reactions });
});

router.get("/api/messages/:peer", authMiddleware, (req, res) => {
  const [a, b] = chatPairKey(req.username, req.params.peer);
  const rows = db
    .prepare(
      `SELECT id, from_user, to_user, text, type, gift_amount, gift_kind,
              media_url, media_mime, media_w, media_h, media_dur, sticker_kind, created_at FROM messages
       WHERE chat_id IS NULL AND ((from_user = ? AND to_user = ?) OR (from_user = ? AND to_user = ?))
       ORDER BY created_at ASC`
    )
    .all(a, b, b, a);
  res.json({ messages: attachReactions(rows, req.username) });
});

// Отправка стикера бурмалдайца собеседнику — бесплатно, без учёта баланса.
router.post("/api/messages/:peer/sticker", authMiddleware, (req, res) => {
  const { kind } = req.body || {};
  const sticker = STICKERS[kind];
  if (!sticker) return res.status(400).json({ error: "Такого стикера нет" });
  const peer = req.params.peer;
  const peerExists = db.prepare("SELECT id FROM users WHERE username = ?").get(peer);
  if (!peerExists) return res.status(404).json({ error: "Собеседник не найден" });

  const now = Date.now();
  const info = db
    .prepare(
      "INSERT INTO messages (from_user, to_user, text, type, sticker_kind, created_at) VALUES (?, ?, ?, 'sticker', ?, ?)"
    )
    .run(req.username, peer, sticker.label, kind, now);

  const message = {
    id: info.lastInsertRowid,
    from_user: req.username,
    to_user: peer,
    text: sticker.label,
    type: "sticker",
    sticker_kind: kind,
    reactions: [],
    created_at: now,
  };

  broadcastToPair(req.username, peer, { type: "message", message });
  res.json({ message });
});

router.post("/api/messages/:peer", authMiddleware, (req, res) => {
  const { text, media, mediaW, mediaH, mediaDur } = req.body || {};
  const caption = (text || "").trim();
  // Сообщение может быть текстом, медиа или медиа с подписью — но не пустым.
  if (!caption && !media) return res.status(400).json({ error: "Пустое сообщение" });
  const peer = req.params.peer;
  const peerExists = db.prepare("SELECT id FROM users WHERE username = ?").get(peer);
  if (!peerExists) return res.status(404).json({ error: "Собеседник не найден" });

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
  const info = db
    .prepare(
      `INSERT INTO messages (from_user, to_user, text, type, media_url, media_mime, media_w, media_h, media_dur, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      req.username,
      peer,
      caption,
      type,
      saved ? saved.url : null,
      saved ? saved.mime : null,
      w,
      h,
      dur,
      now
    );

  const message = {
    id: info.lastInsertRowid,
    from_user: req.username,
    to_user: peer,
    text: caption,
    type,
    gift_amount: null,
    media_url: saved ? saved.url : null,
    media_mime: saved ? saved.mime : null,
    media_w: w,
    media_h: h,
    media_dur: dur,
    reactions: [],
    created_at: now,
  };

  broadcastToPair(req.username, peer, { type: "message", message });

  res.json({ message });
});

// Удаление сообщения. Удалить может автор сообщения или создатель (is_owner).
// Работает и для лички, и для групп/каналов — рассылаем событие всем, кто его видит.
router.delete("/api/messages/:id", authMiddleware, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Некорректное сообщение" });

  const msg = db.prepare("SELECT * FROM messages WHERE id = ?").get(id);
  if (!msg) return res.status(404).json({ error: "Сообщение не найдено" });

  const me = db.prepare("SELECT is_owner FROM users WHERE username = ?").get(req.username);
  const isOwner = !!(me && me.is_owner);
  if (msg.from_user !== req.username && !isOwner) {
    return res.status(403).json({ error: "Можно удалять только свои сообщения" });
  }

  // Кому разослать событие удаления (до фактического удаления из БД).
  const audience = reactionAudience(msg);

  // Если к сообщению был прикреплён файл — убираем его с диска.
  if (msg.media_url && msg.media_url.startsWith("/uploads/")) {
    const filePath = path.join(UPLOAD_DIR, path.basename(msg.media_url));
    fs.unlink(filePath, () => {});
  }

  db.prepare("DELETE FROM reactions WHERE message_id = ?").run(id);
  db.prepare("DELETE FROM messages WHERE id = ?").run(id);

  const event = { type: "message_deleted", id, chatId: msg.chat_id || null };
  if (msg.chat_id) {
    broadcastToUsers(audience, event);
  } else {
    broadcastToPair(msg.from_user, msg.to_user, event);
  }

  res.json({ ok: true });
});

module.exports = router;
