// ---------- Хаммам: общие хелперы ----------
// Используется и роутом /api/hammam, и мини-игрой "Шахта" (эффекты Пара и Веника).
const db = require("./db");
const { HAMMAM_PARAMS, HAMMAM_DECOR_STAGES, STARTING_BALANCE } = require("./config");

const PARAM_KEYS = Object.keys(HAMMAM_PARAMS);

function levelColumn(key) {
  return "lvl_" + key;
}

// Возвращает строку хаммама пользователя, создавая её при первом обращении.
function getHammamRow(username) {
  let row = db.prepare("SELECT * FROM hammam WHERE username = ?").get(username);
  if (!row) {
    const now = Date.now();
    db.prepare(
      "INSERT INTO hammam (username, last_collected_at) VALUES (?, ?)"
    ).run(username, now);
    row = db.prepare("SELECT * FROM hammam WHERE username = ?").get(username);
  }
  return row;
}

function costForNextLevel(paramKey, currentLevel) {
  const p = HAMMAM_PARAMS[paramKey];
  if (currentLevel >= p.maxLevel) return null;
  return Math.round(p.baseCost * Math.pow(p.growth, currentLevel));
}

function decorStageFor(decorLevel) {
  let stage = HAMMAM_DECOR_STAGES[0];
  for (const s of HAMMAM_DECOR_STAGES) {
    if (decorLevel >= s.min) stage = s;
  }
  return stage;
}

// Начисляет накопленный пассивный доход с момента последнего обращения,
// капая накопление лимитом "Предбанника". Мутирует БД, возвращает свежую строку.
function accruePassiveIncome(username) {
  const row = getHammamRow(username);
  const now = Date.now();
  const hoursPassed = (now - row.last_collected_at) / 3600000;
  const perHour = HAMMAM_PARAMS.furnace.effect(row.lvl_furnace);
  const cap = HAMMAM_PARAMS.predbannik.effect(row.lvl_predbannik);

  if (perHour > 0 && hoursPassed > 0) {
    const gained = perHour * hoursPassed;
    const newBanked = Math.min(cap, row.banked + gained);
    db.prepare("UPDATE hammam SET banked = ?, last_collected_at = ? WHERE username = ?").run(
      newBanked,
      now,
      username
    );
  } else {
    // Даже без дохода двигаем метку времени, чтобы не копить нулевые интервалы вечно.
    db.prepare("UPDATE hammam SET last_collected_at = ? WHERE username = ?").run(now, username);
  }
  return db.prepare("SELECT * FROM hammam WHERE username = ?").get(username);
}

// Сериализация для клиента: уровни, эффекты, стоимость апгрейда, стадия декора.
function publicHammam(row) {
  const params = {};
  for (const key of PARAM_KEYS) {
    const level = row[levelColumn(key)];
    const p = HAMMAM_PARAMS[key];
    params[key] = {
      label: p.label,
      emoji: p.emoji,
      desc: p.desc,
      level,
      maxLevel: p.maxLevel,
      effect: p.effect(level),
      nextCost: costForNextLevel(key, level),
    };
  }
  const cap = HAMMAM_PARAMS.predbannik.effect(row.lvl_predbannik);
  return {
    params,
    banked: Math.floor(row.banked),
    cap,
    perHour: HAMMAM_PARAMS.furnace.effect(row.lvl_furnace),
    decorStage: decorStageFor(row.lvl_decor),
  };
}

// Эффекты хаммама, нужные другим играм (Шахте) — без сериализации для клиента.
function hammamEffects(username) {
  const row = getHammamRow(username);
  return {
    steamBonusPct: HAMMAM_PARAMS.steam.effect(row.lvl_steam), // + к весам ценных клеток
    venikReductionPct: HAMMAM_PARAMS.venik.effect(row.lvl_venik), // - к весу обвала
  };
}

module.exports = {
  PARAM_KEYS,
  getHammamRow,
  costForNextLevel,
  decorStageFor,
  accruePassiveIncome,
  publicHammam,
  hammamEffects,
};
