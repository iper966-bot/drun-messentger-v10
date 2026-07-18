// ---------- Друн Услуги: госуслуги и тариф связи "Бурмал2" ----------
// Эндпоинты для внешних фронтендов (drun-uslugi, burmal2), которые
// используют тот же аккаунт и тот же баланс чекушек, что и мессенджер.
// Все списания проходят на сервере — фронтенд только показывает результат.
const express = require("express");
const crypto = require("crypto");
const db = require("../db");
const { STARTING_BALANCE, SERVICES, BURMAL2_PLANS } = require("../config");
const { ownUser } = require("../helpers");
const { authMiddleware } = require("../middleware");

const router = express.Router();

function getBalance(username) {
  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
  return user.balance == null ? STARTING_BALANCE : user.balance;
}

function chargeUser(username, cost) {
  const balance = getBalance(username);
  if (balance < cost) return null;
  db.prepare("UPDATE users SET balance = ? WHERE username = ?").run(balance - cost, username);
  return db.prepare("SELECT * FROM users WHERE username = ?").get(username);
}

function docNumber(prefix) {
  // Короткий читаемый номер документа: ПРЕФИКС-XXXXXX (случайные цифры).
  const digits = crypto.randomInt(100000, 999999);
  return prefix + "-" + digits;
}

function passportDocument(row) {
  if (!row) return null;
  return {
    full_name: row.full_name,
    birth_date: row.birth_date,
    birth_place: row.birth_place,
    photo_url: row.photo_url,
    doc_number: row.doc_number,
  };
}

function registrationDocument(row) {
  if (!row) return null;
  return {
    purpose: row.purpose,
    room_number: row.room_number,
    doc_number: row.doc_number,
  };
}

// Публичный список госуслуг с текущим статусом оформления для пользователя.
router.get("/api/services", authMiddleware, (req, res) => {
  const passport = db.prepare("SELECT * FROM passports WHERE username = ?").get(req.username);
  const registration = db.prepare("SELECT * FROM registrations WHERE username = ?").get(req.username);

  const services = Object.entries(SERVICES).map(([key, def]) => {
    if (key === "passport") {
      return {
        key,
        title: def.title,
        cost: def.cost,
        requiresPassport: def.requiresPassport,
        issued: !!passport,
        document: passport ? passportDocument(passport) : null,
      };
    }
    if (key === "hammam_registration") {
      return {
        key,
        title: def.title,
        cost: def.cost,
        requiresPassport: def.requiresPassport,
        issued: !!registration,
        document: registration ? registrationDocument(registration) : null,
      };
    }
    return { key, title: def.title, cost: def.cost, requiresPassport: def.requiresPassport, issued: false };
  });

  res.json({ services });
});

// Оформление паспорта бурмалдайца — ФИО, дата и место рождения, фото (data URL).
router.post("/api/services/passport/issue", authMiddleware, (req, res) => {
  const existing = db.prepare("SELECT * FROM passports WHERE username = ?").get(req.username);
  if (existing) {
    return res.status(400).json({ error: "Паспорт уже оформлен" });
  }

  const { full_name, birth_date, birth_place, photo } = req.body || {};
  const cleanName = String(full_name || "").trim();
  const cleanPlace = String(birth_place || "").trim();
  if (!cleanName) return res.status(400).json({ error: "Укажите ФИО" });
  if (!birth_date) return res.status(400).json({ error: "Укажите дату рождения" });
  if (!cleanPlace) return res.status(400).json({ error: "Укажите место рождения" });
  if (!photo || !/^data:image\/(png|jpeg|jpg|webp);base64,/.test(photo)) {
    return res.status(400).json({ error: "Загрузите фото" });
  }
  if (photo.length > 400000) {
    return res.status(400).json({ error: "Фото слишком большое, выберите другое" });
  }

  const cost = SERVICES.passport.cost;
  const updatedUser = chargeUser(req.username, cost);
  if (!updatedUser) return res.status(400).json({ error: "Недостаточно чекушек" });

  const doc_number = docNumber("ПАСП");
  const now = Date.now();
  db.prepare(
    "INSERT INTO passports (username, full_name, birth_date, birth_place, photo_url, doc_number, issued_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(req.username, cleanName, birth_date, cleanPlace, photo, doc_number, now);

  const row = db.prepare("SELECT * FROM passports WHERE username = ?").get(req.username);
  res.json({
    user: ownUser(updatedUser),
    service: { key: "passport", document: passportDocument(row) },
  });
});

// Прописка в Хаммаме — требует ранее оформленный паспорт, комната назначается автоматически.
router.post("/api/services/hammam_registration/issue", authMiddleware, (req, res) => {
  const passport = db.prepare("SELECT * FROM passports WHERE username = ?").get(req.username);
  if (!passport) {
    return res.status(400).json({ error: "Сначала оформите паспорт бурмалдайца" });
  }
  const existing = db.prepare("SELECT * FROM registrations WHERE username = ?").get(req.username);
  if (existing) {
    return res.status(400).json({ error: "Прописка уже оформлена" });
  }

  const { purpose } = req.body || {};
  const cleanPurpose = String(purpose || "").trim();
  if (!cleanPurpose) return res.status(400).json({ error: "Укажите цель прописки" });

  const cost = SERVICES.hammam_registration.cost;
  const updatedUser = chargeUser(req.username, cost);
  if (!updatedUser) return res.status(400).json({ error: "Недостаточно чекушек" });

  // Комната — порядковый номер следующей выданной прописки.
  const count = db.prepare("SELECT COUNT(*) AS c FROM registrations").get().c;
  const room_number = 101 + count;
  const doc_number = docNumber("ПРОП");
  const now = Date.now();
  db.prepare(
    "INSERT INTO registrations (username, purpose, room_number, doc_number, issued_at) VALUES (?, ?, ?, ?, ?)"
  ).run(req.username, cleanPurpose, room_number, doc_number, now);

  const row = db.prepare("SELECT * FROM registrations WHERE username = ?").get(req.username);
  res.json({
    user: ownUser(updatedUser),
    service: { key: "hammam_registration", document: registrationDocument(row) },
  });
});

// ---------- Тариф связи "Бурмал2" ----------
// :plan — один из ключей BURMAL2_PLANS (eco / plus / xxl).
router.post("/api/services/burmal2/:plan/issue", authMiddleware, (req, res) => {
  const planKey = req.params.plan;
  const plan = BURMAL2_PLANS[planKey];
  if (!plan) {
    return res.status(404).json({ error: "Такой услуги не существует" });
  }

  const updatedUser = chargeUser(req.username, plan.cost);
  if (!updatedUser) return res.status(400).json({ error: "Недостаточно чекушек" });

  const now = Date.now();
  db.prepare(
    `INSERT INTO burmal2_subscriptions (username, plan_key, issued_at) VALUES (?, ?, ?)
     ON CONFLICT(username) DO UPDATE SET plan_key = excluded.plan_key, issued_at = excluded.issued_at`
  ).run(req.username, planKey, now);

  res.json({
    user: ownUser(updatedUser),
    subscription: { plan_key: planKey, title: plan.title, cost: plan.cost, issued_at: now },
  });
});

// Текущая подписка на Бурмал2 (для отображения в кабинетах Бурмал2 / Друн Услуги).
router.get("/api/services/burmal2/status", authMiddleware, (req, res) => {
  const row = db.prepare("SELECT * FROM burmal2_subscriptions WHERE username = ?").get(req.username);
  if (!row) return res.json({ active: false });
  const plan = BURMAL2_PLANS[row.plan_key];
  res.json({
    active: true,
    plan_key: row.plan_key,
    title: plan ? plan.title : row.plan_key,
    cost: plan ? plan.cost : null,
    issued_at: row.issued_at,
  });
});

module.exports = router;
