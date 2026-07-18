// Госуслуги ("Друн услуги"): разовые услуги за госпошлину.
// Списание баланса и выдача услуги происходят одной транзакцией на сервере,
// чтобы клиент не мог подделать факт оплаты (как в играх — источник истины тут).
const express = require("express");
const crypto = require("crypto");
const db = require("../db");
const { STARTING_BALANCE } = require("../config");
const { ownUser } = require("../helpers");
const { authMiddleware } = require("../middleware");
const { saveDataUrl } = require("../media");

const router = express.Router();

// Каталог услуг. key — стабильный идентификатор (используется в URL и в БД),
// меняется редко; cost — госпошлина в чекушках. requiresForm — нужна ли анкета
// для выдачи "документа". requiresPassport — нельзя оформить без готового паспорта.
const SERVICES = {
  passport: {
    key: "passport",
    title: "Оформление паспорта бурмалдайца",
    cost: 50,
    description: "Главный документ, удостоверяющий личность бурмалдайца в Друн-республике.",
    requiresForm: true,
    requiresPassport: false,
  },
  hammam_registration: {
    key: "hammam_registration",
    title: "Прописка в Хаммаме",
    cost: 20,
    description: "Регистрация по месту жительства в общественном Хаммаме.",
    requiresForm: true,
    requiresPassport: true,
  },
};

function publicService(def, row) {
  let document = null;
  if (row) {
    if (def.key === "passport") {
      document = {
        doc_number: row.doc_number,
        full_name: row.full_name,
        birth_date: row.birth_date,
        birth_place: row.birth_place,
        photo_url: row.photo_url,
      };
    } else if (def.key === "hammam_registration") {
      document = {
        doc_number: row.doc_number,
        room_number: row.room_number,
        purpose: row.purpose,
      };
    }
  }
  return {
    key: def.key,
    title: def.title,
    cost: def.cost,
    description: def.description,
    requiresForm: def.requiresForm,
    requiresPassport: def.requiresPassport,
    issued: !!row,
    issued_at: row ? row.issued_at : null,
    document,
  };
}

// Номер документа: "ДР-" + 8 случайных цифр, для колорита Друн-республики.
function generateDocNumber() {
  const digits = crypto.randomInt(0, 100000000).toString().padStart(8, "0");
  return "ДР-" + digits;
}

// Номер комнаты в Хаммаме — генерируется автоматически при прописке.
function generateRoomNumber() {
  const block = "АБВГД"[crypto.randomInt(0, 5)];
  const num = crypto.randomInt(1, 300);
  return block + "-" + num;
}

// Список услуг с отметкой, какие уже оформлены у текущего пользователя.
router.get("/api/services", authMiddleware, (req, res) => {
  const rows = db.prepare("SELECT * FROM user_services WHERE username = ?").all(req.username);
  const byKey = new Map(rows.map((r) => [r.service, r]));
  const services = Object.values(SERVICES).map((def) => publicService(def, byKey.get(def.key)));
  res.json({ services });
});

// Оформление услуги: списывает госпошлину и отмечает услугу как выданную.
router.post("/api/services/:key/issue", authMiddleware, (req, res) => {
  const def = SERVICES[req.params.key];
  if (!def) return res.status(404).json({ error: "Такой услуги не существует" });

  const already = db
    .prepare("SELECT * FROM user_services WHERE username = ? AND service = ?")
    .get(req.username, def.key);
  if (already) {
    return res.status(400).json({ error: "Услуга уже оформлена", service: publicService(def, already) });
  }

  if (def.requiresPassport) {
    const passport = db
      .prepare("SELECT * FROM user_services WHERE username = ? AND service = 'passport'")
      .get(req.username);
    if (!passport) {
      return res.status(400).json({ error: "Сначала оформите паспорт бурмалдайца — без него прописка недоступна" });
    }
  }

  let full_name = null, birth_date = null, birth_place = null, photo_url = null;
  let room_number = null, purpose = null, doc_number = null;

  if (def.key === "passport") {
    const body = req.body || {};
    full_name = String(body.full_name || "").trim();
    birth_date = String(body.birth_date || "").trim();
    birth_place = String(body.birth_place || "").trim();
    const photo = body.photo;

    if (!full_name || full_name.length < 2 || full_name.length > 100) {
      return res.status(400).json({ error: "Укажите ФИО (от 2 до 100 символов)" });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birth_date)) {
      return res.status(400).json({ error: "Укажите корректную дату рождения" });
    }
    const birthTime = Date.parse(birth_date);
    if (Number.isNaN(birthTime) || birthTime > Date.now()) {
      return res.status(400).json({ error: "Дата рождения не может быть в будущем" });
    }
    if (!birth_place || birth_place.length < 2 || birth_place.length > 100) {
      return res.status(400).json({ error: "Укажите место рождения (от 2 до 100 символов)" });
    }
    if (!photo) {
      return res.status(400).json({ error: "Загрузите фото для паспорта" });
    }
    const saved = saveDataUrl(photo);
    if (saved.error) return res.status(400).json({ error: saved.error });
    if (saved.kind !== "image") return res.status(400).json({ error: "Фото должно быть изображением" });
    photo_url = saved.url;
    doc_number = generateDocNumber();
  } else if (def.key === "hammam_registration") {
    const body = req.body || {};
    purpose = String(body.purpose || "").trim();
    if (!purpose || purpose.length < 2 || purpose.length > 200) {
      return res.status(400).json({ error: "Укажите цель прописки (от 2 до 200 символов)" });
    }
    room_number = generateRoomNumber();
    doc_number = generateDocNumber();
  }

  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(req.username);
  const balance = user.balance == null ? STARTING_BALANCE : user.balance;
  if (balance < def.cost) {
    return res.status(400).json({ error: "Недостаточно чекушек для оплаты госпошлины" });
  }

  const now = Date.now();
  db.prepare("UPDATE users SET balance = ? WHERE username = ?").run(balance - def.cost, req.username);
  db.prepare(
    `INSERT INTO user_services
       (username, service, issued_at, full_name, birth_date, birth_place, photo_url, doc_number, room_number, purpose)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(req.username, def.key, now, full_name, birth_date, birth_place, photo_url, doc_number, room_number, purpose);

  const row = db
    .prepare("SELECT * FROM user_services WHERE username = ? AND service = ?")
    .get(req.username, def.key);
  res.json({
    service: publicService(def, row),
    user: ownUser(db.prepare("SELECT * FROM users WHERE username = ?").get(req.username)),
  });
});

module.exports = router;
