# Патч: госуслуги (паспорт бурмалдайца, прописка в Хаммаме)

## Что изменилось
1. **src/db.js** — таблица `user_services` (username, service, issued_at,
   full_name, birth_date, birth_place, photo_url, doc_number, room_number, purpose).
2. **src/routes/services.js** — новый файл: `GET /api/services`,
   `POST /api/services/:key/issue`.
3. **server.js** — подключён новый роут: `app.use(require("./src/routes/services"));`

## Как задеплоить
Скопируйте эти 3 файла поверх соответствующих в репозитории drun-messentger-v2,
сохранив путь (src/db.js, src/routes/services.js, server.js), затем задеплойте как обычно.

## Эндпоинты
- `GET /api/services` (auth) — список услуг: issued, requiresPassport,
  а для оформленных услуг ещё и `document` с деталями:
  - passport: ФИО, дата/место рождения, фото, номер документа.
  - hammam_registration: room_number (генерируется автоматически), purpose, номер документа.
- `POST /api/services/:key/issue` (auth):
  - `passport` (50 чекушек) — тело: `{ full_name, birth_date ("YYYY-MM-DD"),
    birth_place, photo (data URL картинки) }`. Фото сохраняется через тот же
    механизм, что и медиа в чатах (src/media.js).
  - `hammam_registration` (20 чекушек) — тело: `{ purpose }`.
    **Требует уже оформленного паспорта** — без него сервер вернёт 400
    "Сначала оформите паспорт бурмалдайца". Комната назначается автоматически.

Списание баланса происходит на сервере — как в играх, источник истины там же.
Повторное оформление уже выданной услуги не списывает деньги повторно.
