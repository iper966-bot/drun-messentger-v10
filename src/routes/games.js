// Мини-игры: "Шахта бурмалдайца" и "Автомат бурмалдайца".
// Раунды считаются целиком на сервере — клиент только шлёт ход и получает
// результат, чтобы исход нельзя было подделать через devtools.
const express = require("express");
const db = require("../db");
const { STARTING_BALANCE } = require("../config");
const { ownUser } = require("../helpers");
const { authMiddleware } = require("../middleware");
const { hammamEffects } = require("../hammam");

const router = express.Router();

// ---------- Мини-игра "Шахта": бурмалдаец ищет чекушки ----------
const MINE_GRID_SIZE = 25; // 5x5
const MINE_DIGS_PER_ROUND = 6; // сколько клеток можно раскопать за раунд
const MINE_COOLDOWN_MS = 3 * 60 * 1000; // пауза между раундами — 3 минуты

// Что может попасться под кайлом бурмалдайца и с какой вероятностью (веса).
const MINE_CELLS = [
  { kind: "empty", value: 0, weight: 42, emoji: "🪨", label: "Пустая порода" },
  { kind: "chekushka", value: 1, weight: 30, emoji: "🍾", label: "Чекушка" },
  { kind: "chekushka2", value: 2, weight: 16, emoji: "🍾", label: "Две чекушки" },
  { kind: "chekushka5", value: 5, weight: 7, emoji: "🍾", label: "Пять чекушек" },
  { kind: "gem", value: 10, weight: 4, emoji: "💎", label: "Клад бурмалдайца" },
  { kind: "trap", value: -3, weight: 1, emoji: "💥", label: "Обвал" },
];
const MINE_WEIGHT_SUM = MINE_CELLS.reduce((s, c) => s + c.weight, 0);

function rollMineCell(effects) {
  // Пар увеличивает веса ценных клеток, Веник снижает вес обвала —
  // проценты применяются к базовому весу из MINE_CELLS.
  const steamBonusPct = effects ? effects.steamBonusPct : 0;
  const venikReductionPct = effects ? effects.venikReductionPct : 0;
  const weighted = MINE_CELLS.map((c) => {
    let w = c.weight;
    if (["gem", "chekushka5", "chekushka2"].includes(c.kind)) {
      w = w * (1 + steamBonusPct / 100);
    }
    if (c.kind === "trap") {
      w = w * (1 - venikReductionPct / 100);
    }
    return { cell: c, weight: Math.max(0.01, w) };
  });
  const sum = weighted.reduce((s, w) => s + w.weight, 0);
  let r = Math.random() * sum;
  for (const w of weighted) {
    if (r < w.weight) return w.cell;
    r -= w.weight;
  }
  return MINE_CELLS[0];
}

function generateMineGrid(effects) {
  const grid = [];
  for (let i = 0; i < MINE_GRID_SIZE; i++) {
    grid.push(rollMineCell(effects).kind);
  }
  return grid;
}

function cellByKind(kind) {
  return MINE_CELLS.find((c) => c.kind === kind) || MINE_CELLS[0];
}

router.get("/api/mine/status", authMiddleware, (req, res) => {
  const round = db.prepare("SELECT * FROM mine_rounds WHERE username = ?").get(req.username);
  const cd = db.prepare("SELECT * FROM mine_cooldown WHERE username = ?").get(req.username);
  if (round) {
    return res.json({
      active: true,
      revealed: JSON.parse(round.revealed),
      digsLeft: round.digs_left,
      earned: round.earned,
      gridSize: MINE_GRID_SIZE,
    });
  }
  const now = Date.now();
  const readyAt = cd ? cd.last_played_at + MINE_COOLDOWN_MS : 0;
  const remainingMs = Math.max(0, readyAt - now);
  res.json({ active: false, remainingMs, digsPerRound: MINE_DIGS_PER_ROUND, gridSize: MINE_GRID_SIZE });
});

router.post("/api/mine/start", authMiddleware, (req, res) => {
  const existing = db.prepare("SELECT * FROM mine_rounds WHERE username = ?").get(req.username);
  if (existing) {
    return res.json({
      active: true,
      revealed: JSON.parse(existing.revealed),
      digsLeft: existing.digs_left,
      earned: existing.earned,
      gridSize: MINE_GRID_SIZE,
    });
  }
  const cd = db.prepare("SELECT * FROM mine_cooldown WHERE username = ?").get(req.username);
  const now = Date.now();
  if (cd && now - cd.last_played_at < MINE_COOLDOWN_MS) {
    const remainingMs = MINE_COOLDOWN_MS - (now - cd.last_played_at);
    return res.status(429).json({ error: "Бурмалдаец ещё отдыхает после смены", remainingMs });
  }
  const grid = generateMineGrid(hammamEffects(req.username));
  const revealed = new Array(MINE_GRID_SIZE).fill(null);
  db.prepare(
    "INSERT INTO mine_rounds (username, grid, revealed, digs_left, earned, started_at) VALUES (?, ?, ?, ?, 0, ?)"
  ).run(req.username, JSON.stringify(grid), JSON.stringify(revealed), MINE_DIGS_PER_ROUND, now);
  res.json({ active: true, revealed, digsLeft: MINE_DIGS_PER_ROUND, earned: 0, gridSize: MINE_GRID_SIZE });
});

router.post("/api/mine/dig", authMiddleware, (req, res) => {
  const { cell } = req.body || {};
  const idx = Number(cell);
  if (!Number.isInteger(idx) || idx < 0 || idx >= MINE_GRID_SIZE) {
    return res.status(400).json({ error: "Некорректная клетка" });
  }
  const round = db.prepare("SELECT * FROM mine_rounds WHERE username = ?").get(req.username);
  if (!round) return res.status(400).json({ error: "Раунд не начат" });
  if (round.digs_left <= 0) return res.status(400).json({ error: "Попытки закончились" });

  const revealed = JSON.parse(round.revealed);
  if (revealed[idx] !== null) {
    return res.status(400).json({ error: "Эта клетка уже раскопана" });
  }
  const grid = JSON.parse(round.grid);
  const kind = grid[idx];
  const cellDef = cellByKind(kind);
  revealed[idx] = kind;

  const digsLeft = round.digs_left - 1;
  const earned = round.earned + cellDef.value;

  db.prepare("UPDATE mine_rounds SET revealed = ?, digs_left = ?, earned = ? WHERE username = ?").run(
    JSON.stringify(revealed),
    digsLeft,
    earned,
    req.username
  );

  let finished = false;
  let payout = 0;
  if (digsLeft <= 0) {
    finished = true;
    payout = Math.max(0, earned); // баланс не уходит в минус, но и не пополняется при отрицательном итоге
    const user = db.prepare("SELECT * FROM users WHERE username = ?").get(req.username);
    const balance = user.balance == null ? STARTING_BALANCE : user.balance;
    const newBalance = balance + payout;
    db.prepare("UPDATE users SET balance = ? WHERE username = ?").run(newBalance, req.username);
    db.prepare("DELETE FROM mine_rounds WHERE username = ?").run(req.username);
    db.prepare(
      "INSERT INTO mine_cooldown (username, last_played_at) VALUES (?, ?) ON CONFLICT(username) DO UPDATE SET last_played_at = excluded.last_played_at"
    ).run(req.username, Date.now());
  }

  res.json({
    kind,
    label: cellDef.label,
    emoji: cellDef.emoji,
    value: cellDef.value,
    revealed,
    digsLeft,
    earned,
    finished,
    payout: finished ? payout : undefined,
    user: finished ? ownUser(db.prepare("SELECT * FROM users WHERE username = ?").get(req.username)) : undefined,
  });
});

// ---------- Мини-игра "Автомат бурмалдайца": три барабана ----------
const SLOTS_COOLDOWN_MS = 90 * 1000; // пауза между спинами — 90 секунд
const SLOTS_REELS = 3;

// Символы барабана и их вес — редкие символы дороже и реже выпадают.
const SLOTS_SYMBOLS = [
  { kind: "rock", emoji: "🪨", weight: 40 },
  { kind: "burm", emoji: "🐹", weight: 26 },
  { kind: "bottle", emoji: "🍾", weight: 18 },
  { kind: "gold", emoji: "🥇", weight: 10 },
  { kind: "gem", emoji: "💎", weight: 5 },
  { kind: "crown", emoji: "👑", weight: 1 },
];
const SLOTS_WEIGHT_SUM = SLOTS_SYMBOLS.reduce((s, c) => s + c.weight, 0);

// Выплата за тройку одинаковых символов (по виду символа) и за "почти" —
// когда хотя бы два совпали.
const SLOTS_TRIPLE_PAYOUT = {
  rock: 2,
  burm: 5,
  bottle: 12,
  gold: 25,
  gem: 60,
  crown: 200,
};
const SLOTS_PAIR_PAYOUT = 2; // утешительный приз за пару одинаковых

function rollSlotsSymbol() {
  let r = Math.random() * SLOTS_WEIGHT_SUM;
  for (const s of SLOTS_SYMBOLS) {
    if (r < s.weight) return s;
    r -= s.weight;
  }
  return SLOTS_SYMBOLS[0];
}

router.get("/api/slots/status", authMiddleware, (req, res) => {
  const cd = db.prepare("SELECT * FROM slots_cooldown WHERE username = ?").get(req.username);
  const now = Date.now();
  const readyAt = cd ? cd.last_played_at + SLOTS_COOLDOWN_MS : 0;
  const remainingMs = Math.max(0, readyAt - now);
  res.json({ remainingMs, reels: SLOTS_REELS });
});

router.post("/api/slots/spin", authMiddleware, (req, res) => {
  const cd = db.prepare("SELECT * FROM slots_cooldown WHERE username = ?").get(req.username);
  const now = Date.now();
  if (cd && now - cd.last_played_at < SLOTS_COOLDOWN_MS) {
    const remainingMs = SLOTS_COOLDOWN_MS - (now - cd.last_played_at);
    return res.status(429).json({ error: "Автомат ещё перезаряжается", remainingMs });
  }

  const result = [rollSlotsSymbol(), rollSlotsSymbol(), rollSlotsSymbol()];
  const kinds = result.map((s) => s.kind);

  let payout = 0;
  let outcome = "none";
  if (kinds[0] === kinds[1] && kinds[1] === kinds[2]) {
    payout = SLOTS_TRIPLE_PAYOUT[kinds[0]] || 0;
    outcome = "triple";
  } else if (kinds[0] === kinds[1] || kinds[1] === kinds[2] || kinds[0] === kinds[2]) {
    payout = SLOTS_PAIR_PAYOUT;
    outcome = "pair";
  }

  db.prepare(
    "INSERT INTO slots_cooldown (username, last_played_at) VALUES (?, ?) ON CONFLICT(username) DO UPDATE SET last_played_at = excluded.last_played_at"
  ).run(req.username, now);

  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(req.username);
  const balance = user.balance == null ? STARTING_BALANCE : user.balance;
  const newBalance = balance + payout;
  db.prepare("UPDATE users SET balance = ? WHERE username = ?").run(newBalance, req.username);

  res.json({
    reels: result.map((s) => ({ kind: s.kind, emoji: s.emoji })),
    outcome,
    payout,
    user: ownUser(db.prepare("SELECT * FROM users WHERE username = ?").get(req.username)),
  });
});

// ---------- Хаммам: статус, прокачка, сбор пассивного дохода ----------
const { HAMMAM_PARAMS } = require("../config");
const { costForNextLevel, accruePassiveIncome, publicHammam, PARAM_KEYS } = require("../hammam");

router.get("/api/hammam", authMiddleware, (req, res) => {
  const row = accruePassiveIncome(req.username);
  res.json({ hammam: publicHammam(row) });
});

router.post("/api/hammam/upgrade/:param", authMiddleware, (req, res) => {
  const param = req.params.param;
  if (!PARAM_KEYS.includes(param)) {
    return res.status(400).json({ error: "Неизвестный параметр прокачки" });
  }
  // Сначала фиксируем накопленный доход по старому уровню печи/лимита,
  // чтобы апгрейд не "задним числом" не подкручивал уже прошедшее время.
  let row = accruePassiveIncome(req.username);

  const column = "lvl_" + param;
  const currentLevel = row[column];
  const cost = costForNextLevel(param, currentLevel);
  if (cost == null) {
    return res.status(400).json({ error: "Уже максимальный уровень" });
  }

  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(req.username);
  const balance = user.balance == null ? STARTING_BALANCE : user.balance;
  if (balance < cost) {
    return res.status(400).json({ error: "Недостаточно чекушек" });
  }

  db.prepare("UPDATE users SET balance = ? WHERE username = ?").run(balance - cost, req.username);
  db.prepare(`UPDATE hammam SET ${column} = ? WHERE username = ?`).run(currentLevel + 1, req.username);

  row = db.prepare("SELECT * FROM hammam WHERE username = ?").get(req.username);
  res.json({
    hammam: publicHammam(row),
    user: ownUser(db.prepare("SELECT * FROM users WHERE username = ?").get(req.username)),
  });
});

router.post("/api/hammam/collect", authMiddleware, (req, res) => {
  const row = accruePassiveIncome(req.username);
  const amount = Math.floor(row.banked);
  if (amount <= 0) {
    return res.json({ collected: 0, hammam: publicHammam(row), user: ownUser(db.prepare("SELECT * FROM users WHERE username = ?").get(req.username)) });
  }
  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(req.username);
  const balance = user.balance == null ? STARTING_BALANCE : user.balance;
  db.prepare("UPDATE users SET balance = ? WHERE username = ?").run(balance + amount, req.username);
  // Оставляем дробный остаток в банке, а не обнуляем его — иначе при частой
  // выплате (например, дважды подряд) теряются накопленные доли чекушки.
  db.prepare("UPDATE hammam SET banked = banked - ? WHERE username = ?").run(amount, req.username);

  const freshRow = db.prepare("SELECT * FROM hammam WHERE username = ?").get(req.username);
  res.json({
    collected: amount,
    hammam: publicHammam(freshRow),
    user: ownUser(db.prepare("SELECT * FROM users WHERE username = ?").get(req.username)),
  });
});

module.exports = router;
