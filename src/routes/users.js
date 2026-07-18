// Список пользователей и публичный профиль (с полученными подарками и статусом).
const express = require("express");
const db = require("../db");
const { GIFTS } = require("../config");
const { publicUser, getGiftStatus } = require("../helpers");
const { authMiddleware } = require("../middleware");

const router = express.Router();

// Публичный профиль пользователя: инфо + подарки, которые он получил в личных чатах,
// сгруппированные по виду (сколько раз подарили каждый бурмалдаец).
router.get("/api/users/:username/profile", authMiddleware, (req, res) => {
  const uname = req.params.username;
  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(uname);
  if (!user) return res.status(404).json({ error: "Пользователь не найден" });

  const giftRows = db
    .prepare(
      `SELECT gift_kind, COUNT(*) AS cnt, MAX(created_at) AS last_at FROM messages
       WHERE to_user = ? AND type = 'gift' AND chat_id IS NULL AND gift_kind IS NOT NULL
       GROUP BY gift_kind
       ORDER BY last_at DESC`
    )
    .all(uname);

  const gifts = giftRows
    .map((r) => {
      const def = GIFTS[r.gift_kind];
      if (!def) return null;
      return {
        kind: r.gift_kind,
        label: def.label,
        emoji: def.emoji,
        image: def.image || null,
        count: r.cnt,
      };
    })
    .filter(Boolean);

  const totalGiftValue = gifts.reduce((sum, g) => sum + g.count * (GIFTS[g.kind]?.cost || 0), 0);
  const status = getGiftStatus(totalGiftValue);

  res.json({ user: publicUser(user), gifts, status });
});

router.get("/api/users", authMiddleware, (req, res) => {
  const rows = db
    .prepare("SELECT * FROM users WHERE username != ? ORDER BY nickname COLLATE NOCASE")
    .all(req.username);
  res.json({ users: rows.map(publicUser) });
});

module.exports = router;
