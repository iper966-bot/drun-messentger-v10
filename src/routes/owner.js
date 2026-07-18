// ---------- Панель создателя ----------
// Всё ниже доступно только пользователям с is_owner = 1.
const express = require("express");
const db = require("../db");
const { STARTING_BALANCE } = require("../config");
const { ownUser, publicChat, chatById } = require("../helpers");
const { authMiddleware, ownerMiddleware } = require("../middleware");
const { clients, broadcastAll, broadcastToUser, broadcastToUsers } = require("../ws");

const router = express.Router();

// Список всех пользователей (для панели создателя).
router.get("/api/owner/users", authMiddleware, ownerMiddleware, (req, res) => {
  const rows = db.prepare("SELECT * FROM users ORDER BY created_at DESC").all();
  res.json({ users: rows.map((r) => ({ ...ownUser(r), is_owner: !!r.is_owner })) });
});

// Удалить любой аккаунт (кроме собственного) — вместе с его сообщениями,
// членством в чатах и данными мини-игр. Если пользователь был владельцем
// чата/канала — сам чат не удаляется автоматически, только его членство.
router.delete("/api/owner/users/:username", authMiddleware, ownerMiddleware, (req, res) => {
  const target = req.params.username.trim().toLowerCase();
  if (target === req.username) {
    return res.status(400).json({ error: "Нельзя удалить самого себя" });
  }
  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(target);
  if (!user) return res.status(404).json({ error: "Пользователь не найден" });

  db.prepare("DELETE FROM users WHERE username = ?").run(target);
  db.prepare("DELETE FROM chat_members WHERE username = ?").run(target);
  db.prepare("DELETE FROM messages WHERE from_user = ? OR to_user = ?").run(target, target);
  db.prepare("DELETE FROM reactions WHERE username = ?").run(target);
  db.prepare("DELETE FROM mine_rounds WHERE username = ?").run(target);
  db.prepare("DELETE FROM mine_cooldown WHERE username = ?").run(target);
  db.prepare("DELETE FROM slots_cooldown WHERE username = ?").run(target);

  // Разрываем активные соединения удалённого пользователя ("кик" из аккаунта).
  const set = clients.get(target);
  if (set) {
    set.forEach((ws) => {
      try {
        ws.send(JSON.stringify({ type: "account_deleted" }));
        ws.close(4001, "Account deleted");
      } catch (e) {}
    });
    clients.delete(target);
  }

  // Убираем удалённого из списков у всех клиентов (через WebSocket, без REST-опроса).
  broadcastAll({ type: "user_removed", username: target });

  res.json({ ok: true });
});

// Кикнуть пользователя с аккаунта — разрывает его текущие сессии,
// не удаляя сам аккаунт (в отличие от DELETE выше). Клиент обычно
// после этого должен будет войти заново.
router.post("/api/owner/users/:username/kick", authMiddleware, ownerMiddleware, (req, res) => {
  const target = req.params.username.trim().toLowerCase();
  const user = db.prepare("SELECT id FROM users WHERE username = ?").get(target);
  if (!user) return res.status(404).json({ error: "Пользователь не найден" });

  const set = clients.get(target);
  if (set) {
    set.forEach((ws) => {
      try {
        ws.send(JSON.stringify({ type: "kicked" }));
        ws.close(4002, "Kicked by owner");
      } catch (e) {}
    });
    clients.delete(target);
  }
  res.json({ ok: true });
});

// Начислить/списать чекушки любому пользователю. amount может быть отрицательным.
router.post("/api/owner/users/:username/balance", authMiddleware, ownerMiddleware, (req, res) => {
  const target = req.params.username.trim().toLowerCase();
  const { amount } = req.body || {};
  const delta = Number(amount);
  if (!Number.isFinite(delta) || !Number.isInteger(delta)) {
    return res.status(400).json({ error: "amount должен быть целым числом" });
  }
  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(target);
  if (!user) return res.status(404).json({ error: "Пользователь не найден" });

  const current = user.balance == null ? STARTING_BALANCE : user.balance;
  const newBalance = Math.max(0, current + delta);
  db.prepare("UPDATE users SET balance = ? WHERE username = ?").run(newBalance, target);

  const updated = db.prepare("SELECT * FROM users WHERE username = ?").get(target);
  broadcastToUser(target, { type: "balance_update", user: ownUser(updated) });
  res.json({ user: ownUser(updated) });
});

// Список всех групп/каналов в системе (для панели создателя).
router.get("/api/owner/chats", authMiddleware, ownerMiddleware, (req, res) => {
  const rows = db.prepare("SELECT * FROM chats ORDER BY created_at DESC").all();
  const chats = rows.map((r) => publicChat(r, req.username));
  res.json({ chats });
});

// Удалить любую группу/канал вместе с сообщениями, участниками и реакциями.
router.delete("/api/owner/chats/:chatId", authMiddleware, ownerMiddleware, (req, res) => {
  const chat = chatById(req.params.chatId);
  if (!chat) return res.status(404).json({ error: "Чат не найден" });

  const memberUsernames = db
    .prepare("SELECT username FROM chat_members WHERE chat_id = ?")
    .all(chat.id)
    .map((r) => r.username);

  const msgIds = db
    .prepare("SELECT id FROM messages WHERE chat_id = ?")
    .all(chat.id)
    .map((r) => r.id);
  if (msgIds.length) {
    const placeholders = msgIds.map(() => "?").join(",");
    db.prepare(`DELETE FROM reactions WHERE message_id IN (${placeholders})`).run(...msgIds);
  }
  db.prepare("DELETE FROM messages WHERE chat_id = ?").run(chat.id);
  db.prepare("DELETE FROM chat_members WHERE chat_id = ?").run(chat.id);
  db.prepare("DELETE FROM chats WHERE id = ?").run(chat.id);

  broadcastToUsers(memberUsernames, { type: "chat_deleted", chatId: chat.id });
  res.json({ ok: true });
});

// ---------- Баны ----------

// Список всех текущих банов (для панели создателя).
router.get("/api/owner/bans", authMiddleware, ownerMiddleware, (req, res) => {
  const rows = db.prepare("SELECT * FROM bans ORDER BY created_at DESC").all();
  res.json({ bans: rows });
});

// Забанить пользователя: блокируем его последний известный IP (значит, с этого
// устройства/сети нельзя будет ни зайти, ни зарегистрировать новый аккаунт),
// удаляем сам аккаунт и рвём активные сессии — как при обычном удалении,
// плюс запись в таблицу bans, которая проверяется при регистрации/входе.
router.post("/api/owner/users/:username/ban", authMiddleware, ownerMiddleware, (req, res) => {
  const target = req.params.username.trim().toLowerCase();
  if (target === req.username) {
    return res.status(400).json({ error: "Нельзя забанить самого себя" });
  }
  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(target);
  if (!user) return res.status(404).json({ error: "Пользователь не найден" });

  const { reason } = req.body || {};
  const ip = user.last_ip || null;
  const banKey = ip || ("user:" + target);

  db.prepare(
    `INSERT INTO bans (ip, username, reason, banned_by, created_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(ip) DO UPDATE SET username = excluded.username, reason = excluded.reason,
       banned_by = excluded.banned_by, created_at = excluded.created_at`
  ).run(banKey, target, reason || null, req.username, Date.now());

  // Удаляем аккаунт целиком (сообщения, членство в чатах, данные игр) —
  // как в DELETE выше, чтобы забаненный не остался «висеть» в системе.
  db.prepare("DELETE FROM users WHERE username = ?").run(target);
  db.prepare("DELETE FROM chat_members WHERE username = ?").run(target);
  db.prepare("DELETE FROM messages WHERE from_user = ? OR to_user = ?").run(target, target);
  db.prepare("DELETE FROM reactions WHERE username = ?").run(target);
  db.prepare("DELETE FROM mine_rounds WHERE username = ?").run(target);
  db.prepare("DELETE FROM mine_cooldown WHERE username = ?").run(target);
  db.prepare("DELETE FROM slots_cooldown WHERE username = ?").run(target);

  const set = clients.get(target);
  if (set) {
    set.forEach((ws) => {
      try {
        ws.send(JSON.stringify({ type: "banned" }));
        ws.close(4003, "Banned by owner");
      } catch (e) {}
    });
    clients.delete(target);
  }
  broadcastAll({ type: "user_removed", username: target });

  res.json({ ok: true, ip: banKey });
});

// Снять бан по ключу (IP, либо служебный "user:<имя>" для банов без известного IP).
router.delete("/api/owner/bans/:key", authMiddleware, ownerMiddleware, (req, res) => {
  const key = req.params.key;
  const ban = db.prepare("SELECT * FROM bans WHERE ip = ?").get(key);
  if (!ban) return res.status(404).json({ error: "Бан не найден" });
  db.prepare("DELETE FROM bans WHERE ip = ?").run(key);
  res.json({ ok: true });
});

module.exports = router;
