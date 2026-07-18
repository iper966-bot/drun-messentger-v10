// Справочники для клиента: подарки, уровни статуса, стикеры, реакции.
const express = require("express");
const { GIFTS, GIFT_STATUS_LEVELS, STICKERS, REACTIONS } = require("../config");
const { authMiddleware } = require("../middleware");

const router = express.Router();

// Список доступных подарков и их стоимость — используется клиентом для отрисовки выбора.
router.get("/api/gifts", authMiddleware, (req, res) => {
  const gifts = Object.entries(GIFTS).map(([kind, g]) => ({ kind, ...g }));
  res.json({ gifts });
});

// Справочник уровней статуса аккаунта (для отображения шкалы прогресса в UI).
router.get("/api/gift-status-levels", authMiddleware, (req, res) => {
  res.json({ levels: GIFT_STATUS_LEVELS });
});

// Список доступных стикеров (бесплатные) — используется клиентом для отрисовки панели.
router.get("/api/stickers", authMiddleware, (req, res) => {
  const stickers = Object.entries(STICKERS).map(([kind, s]) => ({ kind, ...s }));
  res.json({ stickers });
});

// Список доступных реакций — клиент рисует по нему пикер.
router.get("/api/reactions", authMiddleware, (req, res) => {
  res.json({ reactions: REACTIONS });
});

module.exports = router;
