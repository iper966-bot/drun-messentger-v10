// WebSocket-сервер и рассылка событий в реальном времени.
// clients: username -> Set<WebSocket> (у одного пользователя может быть
// несколько открытых вкладок/устройств).
const { WebSocketServer } = require("ws");
const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("./config");
const db = require("./db");
const { isChatMember, chatMembers } = require("./helpers");

const clients = new Map();

// Привязывает WebSocket-сервер к переданному http-серверу.
function initWs(server) {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws, req) => {
    const url = new URL(req.url, "http://localhost");
    const token = url.searchParams.get("token");
    let username = null;
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      username = payload.username;
    } catch (e) {
      ws.close(1008, "Unauthorized");
      return;
    }

    // JWT остаётся валидным до истечения (30 дней) даже если аккаунт
    // забанили или удалили — бан/удаление стирают запись из users, поэтому
    // проверяем, что аккаунт всё ещё существует, прежде чем пускать в реальном времени.
    const stillExists = db.prepare("SELECT 1 FROM users WHERE username = ?").get(username);
    if (!stillExists) {
      ws.close(4003, "Account no longer exists");
      return;
    }

    if (!clients.has(username)) clients.set(username, new Set());
    const set = clients.get(username);
    const wasOffline = set.size === 0;
    set.add(ws);

    // Новой вкладке сразу отдаём, кто сейчас в сети.
    try {
      ws.send(JSON.stringify({ type: "presence_list", online: [...clients.keys()] }));
    } catch (e) {}

    // Пользователь только что появился в сети (первое соединение) —
    // сообщаем об этом всем остальным.
    if (wasOffline) {
      broadcastAll({ type: "presence", username, online: true });
    }

    // Сигналинг звонков (WebRTC): сервер лишь пересылает сообщения между
    // двумя собеседниками, сами медиа-потоки идут peer-to-peer, минуя сервер.
    ws.on("message", (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw);
      } catch (e) {
        return;
      }
      if (!msg || typeof msg.type !== "string") return;
      if (msg.type.startsWith("call_") && typeof msg.to === "string") {
        msg.from = username; // отправителю не доверяем — подставляем сами
        broadcastToUser(msg.to, msg);
        return;
      }
      // Индикатор «печатает…» — эфемерное событие, в базу не пишется.
      if (msg.type === "typing" || msg.type === "stop_typing") {
        if (typeof msg.to === "string") {
          // Личка: пересылаем второму собеседнику.
          broadcastToUser(msg.to, { type: msg.type, from: username, scope: "dm" });
        } else if (Number.isInteger(msg.chatId) && isChatMember(msg.chatId, username)) {
          // Группа/канал: всем участникам, кроме самого печатающего.
          const others = chatMembers(msg.chatId).filter((u) => u !== username);
          broadcastToUsers(others, { type: msg.type, from: username, scope: "chat", chatId: msg.chatId });
        }
      }
    });

    ws.on("close", () => {
      const s = clients.get(username);
      if (s) {
        s.delete(ws);
        if (s.size === 0) {
          clients.delete(username);
          // Закрылась последняя вкладка — пользователь ушёл в офлайн.
          broadcastAll({ type: "presence", username, online: false });
        }
      }
    });
  });

  return wss;
}

// Рассылка события всем подключённым клиентам.
function broadcastAll(payload) {
  const data = JSON.stringify(payload);
  clients.forEach((set) => {
    set.forEach((ws) => {
      if (ws.readyState === ws.OPEN) ws.send(data);
    });
  });
}

function broadcastToPair(userA, userB, payload) {
  [userA, userB].forEach((u) => {
    const set = clients.get(u);
    if (set) {
      const data = JSON.stringify(payload);
      set.forEach((ws) => {
        if (ws.readyState === ws.OPEN) ws.send(data);
      });
    }
  });
}

function broadcastToUser(username, payload) {
  const set = clients.get(username);
  if (set) {
    const data = JSON.stringify(payload);
    set.forEach((ws) => {
      if (ws.readyState === ws.OPEN) ws.send(data);
    });
  }
}

function broadcastToUsers(usernames, payload) {
  const data = JSON.stringify(payload);
  usernames.forEach((u) => {
    const set = clients.get(u);
    if (set) {
      set.forEach((ws) => {
        if (ws.readyState === ws.OPEN) ws.send(data);
      });
    }
  });
}

// Когда пользователь меняет ник/аватар — рассылаем всем, чтобы список
// собеседников и открытые чаты обновились без перезагрузки страницы.
function broadcastProfileUpdate(user) {
  const data = JSON.stringify({ type: "profile_update", user });
  clients.forEach((set) => {
    set.forEach((ws) => {
      if (ws.readyState === ws.OPEN) ws.send(data);
    });
  });
}

module.exports = {
  clients,
  initWs,
  broadcastAll,
  broadcastToPair,
  broadcastToUser,
  broadcastToUsers,
  broadcastProfileUpdate,
};
